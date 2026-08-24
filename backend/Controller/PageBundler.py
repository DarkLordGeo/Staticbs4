"""
Fetches a page and rewrites it so it can be rendered standalone (e.g. in an
iframe) with its original styling intact, without the browser needing to
reach out to the source site directly.

Every stylesheet/image/icon URL is rewritten to point at our own
/api/proxy_asset route, and any relative url(...) references *inside* a CSS
file are rewritten the same way when that CSS is itself proxied.
"""

import re
from urllib.parse import urljoin, urlencode

import requests
from bs4 import BeautifulSoup

REQUEST_TIMEOUT = 10  # seconds

# The bundled HTML is rendered inside an iframe via `srcDoc`, which means any
# relative URL in it resolves against the *parent* page's origin (the Vite
# frontend), not this backend. Proxy links must be absolute so they actually
# hit this server. TODO: move to an env var / config before deploying anywhere
# other than local dev.
BACKEND_ORIGIN = "http://127.0.0.1:5000"

# Matches url(...) inside CSS, capturing an optional quote char and the URL.
_CSS_URL_PATTERN = re.compile(r"""url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)""", re.IGNORECASE)


def _proxy_url(absolute_url: str) -> str:
    return f"{BACKEND_ORIGIN}/api/proxy_asset?" + urlencode({"url": absolute_url})


def _is_proxyable(url: str) -> bool:
    """Only http(s) URLs need (or can) go through the proxy."""
    return url.startswith(("http://", "https://"))


def rewrite_css_urls(css_text: str, base_url: str) -> str:
    """Rewrite relative url(...) references in a CSS file to go through the proxy."""

    def replace(match: re.Match) -> str:
        quote_char, raw_url = match.group(1), match.group(2).strip()
        if raw_url.startswith(("data:", "#")):
            return match.group(0)
        absolute = urljoin(base_url, raw_url)
        return f"url({quote_char}{_proxy_url(absolute)}{quote_char})"

    return _CSS_URL_PATTERN.sub(replace, css_text)


def bundle_page(url: str) -> str:
    """Fetch `url` and return HTML that is safe and self-contained to render."""
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    # html5lib, not html.parser: it performs real HTML5 tree construction
    # (implicit <tbody> in tables, etc.), matching what the frontend's
    # iframe preview actually renders. The generated Python code parses with
    # the same backend for the same reason — see front/src/lib/codegen.ts.
    #
    # response.content (raw bytes), not response.text: when a server sends
    # Content-Type: text/html with no charset (very common — books.toscrape.com
    # does this), requests falls back to guessing ISO-8859-1 per old HTTP
    # defaults even when the body is actually UTF-8, silently mangling
    # non-ASCII text (e.g. "£" -> "Â£"). Handing BeautifulSoup the raw bytes
    # lets it sniff the real encoding itself, which is far more reliable.
    soup = BeautifulSoup(response.content, "html5lib")

    base_tag = soup.find("base", href=True)
    base_url = urljoin(url, base_tag["href"]) if base_tag else url

    # Never let scraped script tags execute inside our app.
    for script in soup.find_all("script"):
        script.decompose()

    # External stylesheets: proxy them so any url(...) refs inside resolve correctly.
    for link in soup.find_all("link", href=True):
        rel = link.get("rel") or []
        is_stylesheet = "stylesheet" in rel
        is_icon = any(r in ("icon", "shortcut icon", "apple-touch-icon") for r in rel)
        if is_stylesheet or is_icon:
            absolute = urljoin(base_url, link["href"])
            if _is_proxyable(absolute):
                link["href"] = _proxy_url(absolute)

    # Inline <style> blocks can contain relative url(...) refs too.
    for style_tag in soup.find_all("style"):
        if style_tag.string:
            style_tag.string.replace_with(rewrite_css_urls(style_tag.string, base_url))

    # Images.
    for img in soup.find_all("img", src=True):
        absolute = urljoin(base_url, img["src"])
        if _is_proxyable(absolute):
            img["src"] = _proxy_url(absolute)
        if img.get("srcset"):
            # Multiple candidate URLs in one attribute; not rewritten yet.
            del img["srcset"]

    return str(soup)
