const SENTENCE_END = /(?<=[.!?…])\s+/;

/** Split text into complete sentences and any trailing fragment. */
export function splitCompleteSentences(text: string): {
  sentences: string[];
  remainder: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { sentences: [], remainder: "" };

  const parts = trimmed.split(SENTENCE_END);
  if (parts.length <= 1) {
    const endsSentence = /[.!?…]["')\]]?\s*$/.test(trimmed);
    if (endsSentence) return { sentences: [trimmed], remainder: "" };
    return { sentences: [], remainder: trimmed };
  }

  const last = parts[parts.length - 1] ?? "";
  const endsSentence = /[.!?…]["')\]]?\s*$/.test(last);
  if (endsSentence) {
    return { sentences: parts, remainder: "" };
  }
  return { sentences: parts.slice(0, -1), remainder: last };
}

/** Split full text into speakable sentence chunks. */
export function splitAllSentences(text: string): string[] {
  const { sentences, remainder } = splitCompleteSentences(text);
  const all = [...sentences];
  if (remainder.trim()) all.push(remainder);
  return all.filter((s) => s.trim());
}
