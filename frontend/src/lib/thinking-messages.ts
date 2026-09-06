export const THINKING_MESSAGES = [
  "Listening to what you shared…",
  "Sitting with your thoughts for a moment…",
  "Finding the right words…",
  "Reflecting on what matters here…",
  "Drawing out a gentle insight…",
  "Taking a breath before responding…",
  "Your words deserve a thoughtful reply…",
  "Connecting the dots in your story…",
  "Honoring what you wrote…",
  "Almost there — crafting something meaningful…",
  "Turning feelings into clarity…",
  "Reading between the lines…",
  "Gathering perspective for you…",
  "Letting the thought settle…",
  "Composing something worth your time…",
  "Following the thread of your reflection…",
  "Something good is forming…",
  "Holding space for your story…",
  "Distilling what you really mean…",
  "One moment — this deserves care…",
  "Wandering through your words with care…",
  "The quiet before a good reply…",
  "Thinking like a friend who really listens…",
  "Sifting for the insight underneath…",
  "Patience — the good stuff takes a second…",
];

function pickRandom(messages: string[], exclude?: string): string {
  if (messages.length <= 1) return messages[0] ?? "";
  const pool = exclude ? messages.filter((m) => m !== exclude) : messages;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getRandomThinkingMessage(exclude?: string): string {
  return pickRandom(THINKING_MESSAGES, exclude);
}
