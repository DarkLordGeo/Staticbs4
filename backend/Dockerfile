# VisualBs4Scraper backend — Flask API that fetches/bundles a page for the
# frontend's live preview and proxies its assets.
#
#   docker build -t visualbs4scraper-backend .
#   docker run --rm -p 5000:5000 visualbs4scraper-backend
#
# The frontend calls http://127.0.0.1:5000 directly, so map to that same
# host port (see README.md for details/limitations).

FROM python:3.12-slim

WORKDIR /app

# Install deps first so this layer is cached across source-only changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY Controller/ Controller/
COPY Helpers/ Helpers/

WORKDIR /app/Controller

EXPOSE 5000

CMD ["python", "app.py"]
