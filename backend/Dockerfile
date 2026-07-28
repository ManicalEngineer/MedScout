FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Applies pending migrations, then starts the API with exactly one worker —
# the in-process scheduler (see scheduler.py) is not safe to run more than
# once at a time. Scale by running multiple single-worker containers behind
# a load balancer with ENABLE_SCHEDULER=false on all but one, if needed.
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1"]
