# LifeLens

**LifeLens** is a private AI journaling web app built for the Google Cloud Run AI Challenge (APAC). You sign in with Google, talk or type about your day, and optionally save the full conversation to your personal archive.

**Stack:** React frontend · FastAPI backend · Firebase Auth & Firestore · Google ADK multi-agent orchestration · Gemini (chat, speech, calendar parsing)

---

## How the app works

### 1. Sign in

Open the app and click **Continue with Google**. Firebase Auth handles sign-in. Your journal data is isolated to your account via Firestore security rules.

### 2. Journal through AI

LifeLens has **one core feature** — journaling with AI — and **two modes** you pick from the sidebar:

| Mode | Purpose |
|------|---------|
| **Reflection** | Default daily flow. The AI warmly asks how your day went and helps you process thoughts and feelings with follow-up questions. |
| **Brainstorm** | A softer, idea-focused flow. The AI gently helps you explore possibilities and next steps around what you share. |

Every conversation runs in one of these modes. Switching modes does **not** clear your chat — only **New journal entry** starts a fresh session.

### 3. Talk or type

- **Voice (default):** Tap the mic → speak → tap again to send. Your speech is transcribed (Gemini STT), the AI responds, and the reply is spoken back sentence-by-sentence (Gemini TTS) with synced on-screen text.
- **Text:** Toggle to type mode. Responses stream live with rotating “thinking” messages while the AI works.

### 4. Session actions

These work during any active journal session:

| Action | How |
|--------|-----|
| **Summarize session** | Button appears after a few messages. Recaps the **entire** conversation so far (not just the last turn). |
| **Save to journal** | Say *“save this to my journal”* (or similar). The full chat is written to **Archives** in Firestore with a title and date. |
| **Calendar** | Mention a date or time in chat (e.g. *“Remind me tomorrow at 9am to reflect”*). The calendar agent creates a Google Calendar event. You may need to grant Calendar permission on sign-in. |

### 5. Archives

Saved conversations appear in the sidebar under **Archives**, ordered by date. Click one to read the full message history. Archives are only created when you explicitly ask to save — nothing is auto-saved when you leave.

---

## User flow (diagram)

```
Landing page
    │
    ▼
Google Sign-In ──────────────────────────────┐
    │                                        │
    ▼                                        │
Dashboard                                    │
    │                                        │
    ├─ New journal entry                     │
    │       │                                │
    │       ├─ Mode: Reflection / Brainstorm │
    │       ├─ Voice or text chat            │
    │       ├─ Summarize session (optional)  │
    │       └─ "Save to my journal" ────────┼──► Firestore Archives
    │                                        │
    └─ Open archive ◄────────────────────────┘
```

---

## How the AI works

LifeLens uses **Google ADK** (Agent Development Kit) with a **coordinator** that routes work to specialist sub-agents.

```
                    ┌─────────────────────┐
                    │ lifelens_coordinator │
                    └──────────┬──────────┘
                               │
       ┌───────────┬───────────┼───────────┬────────────┐
       ▼           ▼           ▼           ▼            ▼
 reflection   brainstorm   archive    calendar      summary
   _agent        _agent      _agent     _agent        _agent
       │                       │           │
       │                       │           └── create_calendar_event
       │                       └── prepare_journal_archive
       │
 datetime_agent (current date/time for "yesterday", "tomorrow", etc.)
```

### Routing rules

- **Reflection mode** → `reflection_agent` for normal chat
- **Brainstorm mode** → `brainstorm_agent` for normal chat
- **“Save to my journal”** → `archive_agent` → `prepare_journal_archive` tool
- **Dates / scheduling** → `datetime_agent` then `calendar_agent` → Google Calendar API
- **Summarize session** → `summary_agent` (full session recap)
- **Relative dates** (“yesterday”, “next Monday”) → `get_current_datetime` tool + user timezone from the browser

Each chat request includes the user’s **timezone** and **journal mode**. The backend prepends the current local date/time so the AI can reason about relative dates correctly.

### Model fallback

If a Gemini model is unavailable, the backend tries a fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → …) before failing.

---

## Request flow (technical)

```
Browser (React)
  │
  │  Firebase ID token + optional Google Calendar token
  │  journal_mode, user_timezone, message, session_id
  ▼
POST /api/chat/stream  (SSE)
  │
  ├─ Verify Firebase JWT
  ├─ Set request context (tokens, timezone, mode)
  ├─ Prepend temporal context (today / yesterday / tomorrow)
  ├─ ADK Runner → coordinator → specialist agent
  │     └─ Tools: get_current_datetime, create_calendar_event, prepare_journal_archive, …
  └─ Stream deltas → complete (+ calendar events as SSE)

Save to journal (client-side Firestore batch write after archive intent)
  users/{uid}/interactions/{id}
  users/{uid}/interactions/{id}/messages/{msgId}
```

---

## Project structure

```
lifelens/
├── frontend/                    # React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/               # Landing, Dashboard
│       ├── components/          # JournalEditor, AppSidebar, voice UI
│       ├── contexts/            # AuthContext (Google + Calendar scope)
│       ├── hooks/               # Voice recording, synced TTS playback
│       └── lib/                 # Firestore, journal/calendar intents
├── backend/
│   ├── main.py                  # FastAPI routes
│   └── app/
│       ├── adk_service.py       # ADK streaming, session bootstrap
│       ├── agents/
│       │   ├── lifelens_agent.py
│       │   ├── tools.py
│       │   └── prompts/         # All system prompts (.txt)
│       ├── calendar_service.py
│       ├── calendar_extract.py
│       ├── datetime_context.py
│       ├── speech_service.py    # Gemini STT / TTS
│       ├── secrets.py           # Gemini key from Secret Manager
│       └── auth.py              # Firebase JWT verification
├── firestore.rules
├── Dockerfile                   # Single Cloud Run image (API + static SPA)
└── scripts/
    ├── dev.sh
    └── setup-secrets.sh
```

---

## Configuration

| What | Where |
|------|--------|
| Firebase web config | `frontend/.env` → `VITE_FIREBASE_*` |
| Firebase Admin (JWT verify) | `backend/.env` → `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Gemini API key | **Secret Manager** (`GEMINI_API_KEY`) — never in frontend or git |
| GCP project | `.env` / `GCP_PROJECT_ID` |

Copy `frontend/.env.example` → `frontend/.env` and fill in Firebase Console values.

---

## Prerequisites

- Python 3.12+
- Node.js 20+
- [gcloud CLI](https://cloud.google.com/sdk/docs/install)
- [Firebase CLI](https://firebase.google.com/docs/cli) (for rules deploy)

---

## Setup

### 1. Enable Google Cloud APIs

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  calendar-json.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

For Google Calendar events, add scope `https://www.googleapis.com/auth/calendar.events` on the OAuth consent screen. Users must **sign out and sign in again** after adding it.

### 2. Firebase

1. Create or link a Firebase project.
2. Enable **Authentication → Google** sign-in.
3. Enable **Cloud Firestore** (production mode).
4. Register a **Web app** → copy config to `frontend/.env`.
5. Create a **service account** for backend JWT verification → `backend/.env`.

Deploy security rules:

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

Rules enforce `request.auth.uid == userId` on all user data.

### 3. Gemini API key (Secret Manager)

```bash
chmod +x scripts/setup-secrets.sh
./scripts/setup-secrets.sh
```

For local dev:

```bash
gcloud auth application-default login
```

### 4. Local development

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Or:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

- **Frontend:** http://localhost:5173  
- **API health:** http://localhost:8000/api/health

### 5. Deploy to Cloud Run

**Live deployment (APAC challenge):**

| | |
|---|---|
| **URL** | https://lifelens-dsnkuh2cta-as.a.run.app |
| **Label** | `dev-tutorial=cloud-run-ai-challenge` |

One-command deploy:

```bash
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

The script enables APIs, grants Cloud Build IAM, builds from `Dockerfile`, deploys to Cloud Run, sets env vars, and applies the challenge label.

**After first deploy — Firebase authorized domain**

1. Open [Firebase Console → Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/lifelens-apac-04429/authentication/settings)
2. Add your Cloud Run host (e.g. `lifelens-dsnkuh2cta-as.a.run.app`)
3. Sign in at your live URL

Verify the challenge label:

```bash
gcloud run services describe lifelens \
  --region asia-southeast1 \
  --format='value(metadata.labels.dev-tutorial)'
# → cloud-run-ai-challenge
```

Manual deploy (alternative):

```bash
export PROJECT_ID=lifelens-apac-04429
export REGION=asia-southeast1

# Load Firebase web config for the Docker build
set -a && source frontend/.env && set +a

gcloud run deploy lifelens \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-build-env-vars "VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY,..." \
  --update-labels dev-tutorial=cloud-run-ai-challenge
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/chat/stream` | SSE chat (main journal flow) |
| `POST` | `/api/chat` | Non-streaming chat (fallback) |
| `POST` | `/api/speech/transcribe` | Audio → text |
| `POST` | `/api/speech/tts` | Text → WAV |
| `POST` | `/api/calendar/events` | Create calendar event (structured) |
| `POST` | `/api/calendar/create-from-message` | Parse natural language → create event |

All `/api/*` routes except `/api/health` require `Authorization: Bearer <Firebase ID token>`.

---

## Threat model

| Zone | Risk | Mitigation |
|------|------|------------|
| Input | Malicious journal text | Pydantic validation, 8k char limit |
| AI reasoning | Prompt injection | System instructions isolated; specialist agents with fixed roles |
| Tools | Unauthorized Calendar writes | User’s OAuth token passed per request; JWT verified |
| Memory | Cross-user data leaks | Firestore rules: `request.auth.uid == userId` |
| Secrets | API key exposure | Gemini key in Secret Manager only; not in client bundle |

---

## Walkthrough test cases

| ID | Test | Expected |
|----|------|----------|
| TC-01 | Load `/` | Landing page with **Continue with Google** |
| TC-02 | Visit `/dashboard` unsigned | Redirect to `/` |
| TC-03 | Google Sign-In | Dashboard loads, avatar shown |
| TC-04 | Cancel sign-in | Error shown, stay on landing |
| TC-05 | New journal entry | Empty state for Reflection mode |
| TC-06 | Switch to Brainstorm mode | Mode changes; chat not cleared |
| TC-07 | Send message (text) | User + assistant messages appear; streamed reply |
| TC-08 | Voice: record & send | Transcription sent; TTS plays synced text |
| TC-09 | Multi-turn chat | Contextual follow-up in same session |
| TC-10 | Summarize session | Full-session recap (not empty / not single-turn only) |
| TC-11 | Say “save this to my journal” | Entry appears in Archives with messages |
| TC-12 | Open archive | Full history loads read-only |
| TC-13 | New journal entry | Chat clears; new session ID |
| TC-14 | Calendar phrase in chat | Success banner + link (with Calendar scope granted) |
| TC-15 | Sign out | Redirect to landing |
| TC-16 | Different user signs in | Cannot see another user’s archives |

---

## Why React + FastAPI?

- **React:** Polished chat UI, voice controls, streaming SSE, client-side Firestore for fast archive loading
- **FastAPI:** ADK agent runner, JWT verification, Secret Manager, speech and calendar APIs
- **Single Cloud Run service:** API and built SPA served from one container

---

## License

Apache 2.0
