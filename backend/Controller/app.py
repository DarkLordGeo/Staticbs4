from flask import Flask, request, Response, abort
from flask_cors import CORS
import requests

from PageBundler import bundle_page, rewrite_css_urls

app = Flask(__name__)
cors = CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route('/api/fetch_website')
def fetch_website():
    website = request.args.get("website")
    if not website:
        return 'missing website param', 400
    try:
        html = bundle_page(website)
    except requests.RequestException:
        return 'bad request', 400
    return html


@app.route('/api/proxy_asset')
def proxy_asset():
    target = request.args.get("url")
    if not target or not target.startswith(("http://", "https://")):
        abort(400, "invalid or missing url")

    try:
        upstream = requests.get(target, timeout=10)
    except requests.RequestException:
        abort(502, "failed to fetch asset")

    if upstream.status_code != 200:
        abort(upstream.status_code)

    content_type = upstream.headers.get("Content-Type", "")

    if "text/css" in content_type:
        body = rewrite_css_urls(upstream.text, target)
        return Response(body, mimetype="text/css")

    return Response(upstream.content, mimetype=content_type or "application/octet-stream")


if __name__ == '__main__':
    app.run()

