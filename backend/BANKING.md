# Banking demo API

Postgres-backed **FastAPI** routes under `/api/banking` for the BFSI agentic resolution prototype.

## Docker (recommended)

```bash
# from repo root
docker compose up --build
```

See [DOCKER.md](../DOCKER.md).

## Local without Docker

Requires Postgres 16+ with database `banking` and credentials matching `DATABASE_URL`.

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://banking:banking@localhost:5432/banking
uvicorn main:app --reload --port 8000
```

## Demo customers

| Customer ID   | Scenario |
|---------------|----------|
| `cust_priya`  | Suspected card compromise — block card |
| `cust_rahul`  | Wrong / incomplete name on mailed address |
| `cust_anita`  | Address change stuck in queue |
| `cust_james`  | Duplicate charge dispute |
| `cust_sarah`  | Frozen account (KYC) + expired card |

`GET /api/banking/demo-profiles` — UI picker list.

## Key endpoints

- `GET /api/banking/customers`
- `GET /api/banking/accounts?customer_id=cust_priya`
- `GET /api/banking/issues/open` — agent desk
- `POST /api/banking/accounts/{id}/cards/block`
- `POST /api/banking/reset` — re-seed (`BANKING_ALLOW_RESET=false` to disable)
