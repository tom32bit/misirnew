# Misir backend (FastAPI). Build context = backend/.
#
# Notes:
# - The default requirements include torch + sentence-transformers (large) for
#   EMBEDDING_PROVIDER=local. For small images / small hosts set
#   EMBEDDING_PROVIDER=nomic and you can drop those two deps from requirements.
# - The SAME image runs the job worker — override the command:
#       docker run ... python -m infrastructure.jobs.worker
#   (see Procfile). The worker is required only when JOB_QUEUE_ENABLED=true.
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# System deps kept minimal; build tools only if a wheel needs compiling.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Run as a non-root user (least privilege).
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Liveness check against the exempt /health route (no curl in slim image).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status==200 else 1)"

# Honor $PORT (Railway/Render/Fly set it). Shell form so $PORT expands.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
