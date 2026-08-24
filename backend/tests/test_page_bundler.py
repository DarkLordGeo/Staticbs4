from PageBundler import rewrite_css_urls


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
