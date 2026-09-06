export type JournalMode = "reflection" | "brainstorm";

export const JOURNAL_TITLE = "Journal through AI";

export interface JournalModeMeta {
  id: JournalMode;
  label: string;
  description: string;
}

export const JOURNAL_MODES: JournalModeMeta[] = [
  {
    id: "reflection",
    label: "Reflection",
    description: "Share how your day went and explore what's on your mind.",
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    description: "Gently explore ideas and possibilities around your thoughts.",
  },
];

export const SUMMARIZE_SESSION_PROMPT =
  "Summarize our complete conversation in this session — themes, emotions, and key moments.";
