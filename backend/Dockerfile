FROM python:3.11-slim AS builder

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ── Production image ──────────────────────────────────────────
FROM python:3.11-slim

RUN groupadd -r hackfarmer && useradd -r -g hackfarmer -d /app -s /sbin/nologin hackfarmer

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app .

RUN chown -R hackfarmer:hackfarmer /app

USER hackfarmer

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
