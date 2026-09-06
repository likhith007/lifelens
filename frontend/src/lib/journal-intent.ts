const SAVE_PATTERNS = [
  /\bsave\s+(this|it|that)\s+(to\s+)?(my\s+)?journal\b/i,
  /\bsave\s+(to\s+)?(my\s+)?journal\b/i,
  /\barchive\s+(this|it|that)\s+(conversation|chat|session)?\b/i,
  /\badd\s+(this|it)\s+to\s+(my\s+)?journal\b/i,
  /\bstore\s+(this|it)\s+in\s+(my\s+)?journal\b/i,
  /\bsave\s+(this|it|that)\s+(conversation|chat)\b/i,
];

export function isSaveToJournalIntent(message: string): boolean {
  const text = message.trim();
  return SAVE_PATTERNS.some((pattern) => pattern.test(text));
}
