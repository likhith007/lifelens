#!/usr/bin/env bash
# Build and deploy LifeLens to Google Cloud Run (APAC AI Challenge).
#
# Prerequisites:
#   - gcloud CLI: brew install --cask google-cloud-sdk && gcloud auth login
#   - frontend/.env with VITE_FIREBASE_* values
#   - ./scripts/setup-secrets.sh (Gemini key in Secret Manager)
#
# Usage:
#   ./scripts/deploy-cloud-run.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${PROJECT_ID:-lifelens-apac-04429}"
REGION="${REGION:-asia-southeast1}"
SERVICE_NAME="${SERVICE_NAME:-lifelens}"
CHALLENGE_LABEL="${CHALLENGE_LABEL:-dev-tutorial=cloud-run-ai-challenge}"

FRONTEND_ENV="$ROOT/frontend/.env"

echo "==> LifeLens Cloud Run deploy"
echo "    Project:  $PROJECT_ID"
echo "    Region:   $REGION"
echo "    Service:  $SERVICE_NAME"
echo "    Label:    $CHALLENGE_LABEL"
echo ""

if ! command -v gcloud >/dev/null; then
  echo "ERROR: gcloud CLI not found."
  echo "  macOS: brew install --cask google-cloud-sdk"
  exit 1
fi

if [ ! -f "$FRONTEND_ENV" ]; then
  echo "ERROR: Missing $FRONTEND_ENV — copy frontend/.env.example and fill VITE_FIREBASE_*"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$FRONTEND_ENV"
set +a

for var in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID \
  VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID VITE_FIREBASE_APP_ID; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in frontend/.env"
    exit 1
  fi
done

gcloud config set project "$PROJECT_ID" --quiet

echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  calendar-json.googleapis.com \
  storage.googleapis.com \
  --project "$PROJECT_ID" \
  --quiet

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "==> IAM for Cloud Build / Cloud Run (first-time setup)..."
for role in roles/storage.admin roles/artifactregistry.writer roles/logging.logWriter roles/cloudbuild.builds.builder; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${COMPUTE_SA}" --role="$role" --quiet >/dev/null 2>&1 || true
done
for role in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/storage.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${BUILD_SA}" --role="$role" --quiet >/dev/null 2>&1 || true
done
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null 2>&1 || true

echo "==> Building container image (Cloud Build + Firebase web config)..."
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild.yaml \
  --substitutions="_VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY},_VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN},_VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID},_VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET},_VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID},_VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}" \
  .

IMAGE="gcr.io/${PROJECT_ID}/lifelens:latest"

echo "==> Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --port 8080 \
  --update-labels "$CHALLENGE_LABEL" \
  --quiet

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)')

ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
cat >"$ENV_FILE" <<EOF
FIREBASE_PROJECT_ID: ${VITE_FIREBASE_PROJECT_ID}
GCP_PROJECT_ID: ${PROJECT_ID}
GEMINI_API_KEY_SECRET_ID: GEMINI_API_KEY
CORS_ORIGINS: "${SERVICE_URL},http://localhost:5173,http://127.0.0.1:5173"
EOF

echo "==> Setting runtime env vars (CORS + Secret Manager)..."
gcloud run services update "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --env-vars-file "$ENV_FILE" \
  --quiet

echo ""
echo "=============================================="
echo "  Deployed successfully"
echo "=============================================="
echo ""
echo "  Live URL:  $SERVICE_URL"
echo "  Label:     $CHALLENGE_LABEL"
echo ""
echo "  Verify challenge label:"
echo "    gcloud run services describe $SERVICE_NAME --region $REGION --format='value(metadata.labels.dev-tutorial)'"
echo ""
echo "  Required: Firebase Console → Authentication → Authorized domains"
echo "    Add: $(echo "$SERVICE_URL" | sed 's|https://||')"
echo ""
