# Banking demo API (local)

In-memory **FastAPI** routes under `/api/banking` for the AI Builder Cup BFSI prototype. No database required for local dev.

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open **http://127.0.0.1:8000/docs** for Swagger.

## Demo customers

| Customer ID   | Scenario |
|---------------|----------|
| `cust_priya`  | Suspected card compromise — block card |
| `cust_rahul`  | Wrong / incomplete name on mailed address |
| `cust_anita`  | Address change stuck in queue |
| `cust_james`  | Duplicate charge dispute |
| `cust_sarah`  | Frozen account (KYC) + expired card |

`GET /api/banking/demo-profiles` returns a short picker list for the UI.

## Key endpoints

- `GET /api/banking/customers` — customers + open issue counts
- `GET /api/banking/accounts?customer_id=cust_priya` — accounts for a customer
- `GET /api/banking/accounts/{account_id}` — account + customer profile
- `GET /api/banking/issues/open` — all open issues (agent desk)
- `POST /api/banking/accounts/{account_id}/cards/block` — block card (validates last four)
- `POST /api/banking/reset` — restore seed data (set `BANKING_ALLOW_RESET=false` to disable)

## Example

```bash
curl -s http://127.0.0.1:8000/api/banking/demo-profiles | jq
curl -s "http://127.0.0.1:8000/api/banking/accounts?customer_id=cust_priya" | jq
```
