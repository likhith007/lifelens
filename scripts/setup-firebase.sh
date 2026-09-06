#!/usr/bin/env bash
# LifeLens: create Firestore database and deploy security rules for an existing Firebase project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${PROJECT_ID:-lifelens-apac-04429}"
REGION="${REGION:-asia-south1}"

echo "==> LifeLens Firestore setup"
echo "    Project ID: $PROJECT_ID"
echo "    Region:     $REGION"

if ! command -v firebase >/dev/null; then
  echo "ERROR: Firebase CLI not found. Install: npm install -g firebase-tools"
  exit 1
fi

echo "==> Checking Firebase login..."
if ! firebase projects:list --json >/dev/null 2>&1; then
  echo ""
  echo "Firebase CLI is not authenticated (token expired)."
  echo "Run this first, then re-run this script:"
  echo "  firebase login --reauth"
  echo ""
  exit 1
fi

cd "$ROOT"

# Link local repo to your existing GCP/Firebase project
cat > "$ROOT/.firebaserc" <<EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF
firebase use "$PROJECT_ID"

echo "==> Creating Firestore database (default) in $REGION"
if firebase firestore:databases:create "(default)" \
  --location "$REGION" \
  --project "$PROJECT_ID" \
  --non-interactive 2>/dev/null; then
  echo "    Firestore database created."
else
  echo "    Firestore already exists or creation skipped — continuing."
fi

echo "==> Deploying Firestore security rules"
firebase deploy --only firestore:rules --project "$PROJECT_ID" --non-interactive

echo ""
echo "✅ Firestore setup complete!"
echo ""
echo "Project: https://console.firebase.google.com/project/$PROJECT_ID/firestore"
echo ""
echo "Next steps:"
echo "  1. Enable Google Sign-In:"
echo "     https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
echo "  2. Register a web app (if not done) and add config to frontend/.env"
echo "  3. Store Gemini key: ./scripts/setup-secrets.sh"
