#!/usr/bin/env bash
# Store Gemini API key in Google Secret Manager (Firebase web config lives in frontend/.env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${PROJECT_ID:-lifelens-apac-04429}"
SECRET_ID="${SECRET_ID:-GEMINI_API_KEY}"

echo "==> LifeLens Secret Manager setup"
echo "    Project: $PROJECT_ID"
echo "    Secret:  $SECRET_ID"
echo ""

if ! command -v gcloud >/dev/null; then
  echo "ERROR: gcloud CLI not found."
  echo "Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

gcloud config set project "$PROJECT_ID" --quiet

echo "==> Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project "$PROJECT_ID" --quiet

echo "==> Creating secret '$SECRET_ID' (if needed)..."
if ! gcloud secrets describe "$SECRET_ID" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET_ID" \
    --project "$PROJECT_ID" \
    --replication-policy="automatic" \
    --quiet
  echo "    Created."
else
  echo "    Already exists."
fi

echo ""
echo "Paste your Gemini API key (input hidden), then press Enter:"
read -rs GEMINI_API_KEY_VALUE
echo ""

if [ -z "$GEMINI_API_KEY_VALUE" ]; then
  echo "ERROR: No key provided."
  exit 1
fi

echo "==> Saving secret version..."
printf '%s' "$GEMINI_API_KEY_VALUE" | gcloud secrets versions add "$SECRET_ID" \
  --project "$PROJECT_ID" \
  --data-file=- \
  --quiet
unset GEMINI_API_KEY_VALUE

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)
if [ -n "$ACTIVE_ACCOUNT" ]; then
  echo "==> Granting access to: $ACTIVE_ACCOUNT"
  gcloud secrets add-iam-policy-binding "$SECRET_ID" \
    --project "$PROJECT_ID" \
    --member="user:${ACTIVE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "==> Granting access to Cloud Run SA: $RUNTIME_SA"
gcloud secrets add-iam-policy-binding "$SECRET_ID" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

cat > "$ROOT/.env" <<EOF
# Backend — Gemini key loaded from Secret Manager only
# Firebase client config is in frontend/.env (VITE_FIREBASE_*)
FIREBASE_PROJECT_ID=$PROJECT_ID
GCP_PROJECT_ID=$PROJECT_ID
GEMINI_API_KEY_SECRET_ID=$SECRET_ID

# Firebase Admin JWT verification (Service Accounts → Generate new private key)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=""

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
EOF

echo ""
echo "✅ Done! Gemini key stored in Secret Manager."
echo ""
echo "Next steps:"
echo "  1. Copy frontend/.env.example to frontend/.env and add VITE_FIREBASE_* values"
echo "  2. gcloud auth application-default login"
echo "  3. Restart backend:"
echo "     cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000"
