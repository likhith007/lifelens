# Docker development stack

Runs **Postgres**, **FastAPI backend**, and **Vite frontend** together.

## Prerequisites

- Docker Engine + Docker Compose v2

## Start everything

```bash
docker compose up --build
```

| Service   | URL |
|-----------|-----|
| Frontend  | http://localhost:5173 |
| Backend   | http://localhost:8000/docs |
| Postgres  | `localhost:5432` (user/pass/db: `banking` / `banking` / `banking`) |

The backend waits for Postgres, creates tables on first boot, and seeds demo customers if the database is empty.

## Useful commands

```bash
# Reset demo banking data (API)
curl -X POST http://localhost:8000/api/banking/reset

# Stop and remove containers (keeps DB volume)
docker compose down

# Stop and wipe database volume
docker compose down -v
```

## Environment

Copy root `.env.example` values as needed. Compose sets `DATABASE_URL` for the backend automatically.

For Cloud Run production builds, the root `Dockerfile` (monolith) is unchanged; local hackathon work uses `docker-compose.yml`.
