from unittest.mock import MagicMock, patch

from PageBundler import bundle_page, rewrite_css_urls


def test_rewrites_relative_url_through_the_proxy():
    css = "body { background: url(images/bg.png); }"
    result = rewrite_css_urls(css, "https://example.com/styles/main.css")
    assert "proxy_asset" in result
    assert "url=" in result


def test_rewrites_quoted_relative_url_preserving_the_quote_char():
    css = "body { background: url('images/bg.png'); }"
    result = rewrite_css_urls(css, "https://example.com/styles/main.css")
    assert "url('" in result
    assert "proxy_asset" in result


def test_leaves_data_uris_untouched():
    css = "body { background: url(data:image/png;base64,AAAA); }"
    assert rewrite_css_urls(css, "https://example.com/styles/main.css") == css


def test_leaves_fragment_references_untouched():
    css = ".icon { fill: url(#gradient); }"
    assert rewrite_css_urls(css, "https://example.com/styles/main.css") == css


def test_resolves_relative_urls_against_the_css_files_own_path():
    css = "body { background: url(../img/bg.png); }"
    result = rewrite_css_urls(css, "https://example.com/assets/css/main.css")
    # ../img/bg.png from /assets/css/main.css resolves to /assets/img/bg.png
    assert "example.com%2Fassets%2Fimg%2Fbg.png" in result


def test_bundle_page_decodes_via_content_not_the_possibly_mis_guessed_text():
    # Simulates a server sending "Content-Type: text/html" with no charset —
    # exactly what books.toscrape.com does — which makes `requests` guess
    # ISO-8859-1 even for a UTF-8 body, silently mangling "£" into "Â£".
    # response.content (raw bytes) sidesteps that guess, letting html5lib
    # sniff the real encoding from the page's own <meta charset> instead —
    # same as books.toscrape.com's actual markup, hence the tag here too.
    real_bytes = (
        '<html><head><meta charset="utf-8"></head><body><p>£10</p></body></html>'
    ).encode("utf-8")
    mis_decoded_text = real_bytes.decode("latin-1")  # what requests' guess would produce

    fake_response = MagicMock()
    fake_response.content = real_bytes
    fake_response.text = mis_decoded_text
    fake_response.raise_for_status = MagicMock()

    with patch("PageBundler.requests.get", return_value=fake_response):
        html = bundle_page("https://example.com")

    assert "£10" in html
    assert "Â£10" not in html
