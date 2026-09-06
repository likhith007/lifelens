const CALENDAR_PATTERNS = [
  /\bcalendar\b/i,
  /\bschedule\b/i,
  /\bremind\s+me\b/i,
  /\bset\s+a\s+reminder\b/i,
  /\bmark\s+(on|in)\s+(my\s+)?calendar\b/i,
  /\bon\s+(this|that|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)\b/i,
  /\btomorrow\b/i,
  /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b/i,
  /\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
];

export function isCalendarIntent(message: string): boolean {
  const text = message.trim();
  return CALENDAR_PATTERNS.some((pattern) => pattern.test(text));
}
