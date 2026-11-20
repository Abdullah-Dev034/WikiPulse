# Backend image. Build from the repository root:
#   docker build -t wikipulse-api .
#   docker run -p 7860:7860 wikipulse-api
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_LINK_MODE=copy \
    PORT=7860

RUN pip install --no-cache-dir uv==0.5.11 && useradd --create-home --uid 1000 app

WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/ ./
COPY data/sample_events.jsonl /app/data/sample_events.jsonl

USER app
EXPOSE 7860
CMD ["sh", "-c", "exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
