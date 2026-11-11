# Build the React app, then serve it from the FastAPI process.
FROM node:22-bookworm-slim AS frontend

WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /src/dist ./static

EXPOSE 8000

# Railway sets PORT. Local `docker run` keeps the default of 8000.
# JSON form so the shell is not an extra process after uvicorn starts.
CMD ["sh", "-c", "python seed.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
