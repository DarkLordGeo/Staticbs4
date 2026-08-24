import pytest
from app import app as flask_app


@pytest.fixture()
def client():
    flask_app.config.update(TESTING=True)
    return flask_app.test_client()


def test_fetch_website_requires_a_website_param(client):
    resp = client.get("/api/fetch_website")
    assert resp.status_code == 400


def test_proxy_asset_requires_a_url_param(client):
    resp = client.get("/api/proxy_asset")
    assert resp.status_code == 400


def test_proxy_asset_rejects_non_http_urls(client):
    # guards against being used as an arbitrary-scheme fetch proxy
    resp = client.get("/api/proxy_asset", query_string={"url": "file:///etc/passwd"})
    assert resp.status_code == 400
