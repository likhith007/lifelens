# LifeLens system prompts

All AI system prompts for LifeLens live in this folder as plain `.txt` files.

## ADK agent instructions

| File | Agent |
|------|--------|
| `coordinator.txt` | `lifelens_coordinator` — routes to specialists |
| `datetime_agent.txt` | `datetime_agent` — current date/time |
| `reflection_agent.txt` | `reflection_agent` — Reflection journal mode |
| `brainstorm_agent.txt` | `brainstorm_agent` — Brainstorm journal mode |
| `archive_agent.txt` | `archive_agent` — save to journal |
| `calendar_agent.txt` | `calendar_agent` — Google Calendar events |
| `summary_agent.txt` | `summary_agent` — session recap |

`shared_rules.txt` is appended to every agent instruction via `{shared_rules}`.

## Runtime prompts (prepended per request)

| File | Used when |
|------|-----------|
| `journal_mode_reflection.txt` | User is in Reflection mode |
| `journal_mode_brainstorm.txt` | User is in Brainstorm mode |
| `summarize_session.txt` | User clicks **Summarize session** |
| `temporal_context.txt` | Every chat message (today / yesterday / tomorrow) |
| `calendar_extract.txt` | `/api/calendar/create-from-message` fallback |

Load prompts through `app.agents.prompts` — do not duplicate strings in code.
