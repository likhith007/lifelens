import { useEffect, useState } from "react";
import { getRandomThinkingMessage } from "@/lib/thinking-messages";

export function useRotatingMessage(active: boolean, intervalMs = 2800): string {
  const [message, setMessage] = useState(() => getRandomThinkingMessage());

  useEffect(() => {
    if (!active) return;

    setMessage(getRandomThinkingMessage());

    const id = window.setInterval(() => {
      setMessage((prev) => getRandomThinkingMessage(prev));
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return message;
}
