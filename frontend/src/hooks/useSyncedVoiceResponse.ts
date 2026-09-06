import { useCallback, useRef } from "react";
import { splitAllSentences } from "@/lib/sentences";

export type VoicePlaybackPhase = "preparing" | "speaking";

interface SyncedVoiceOptions {
  fetchTts: (text: string) => Promise<Blob>;
  onVisibleText: (text: string) => void;
  playAudio: (blob: Blob, onStart?: () => void) => Promise<void>;
  onPhaseChange?: (phase: VoicePlaybackPhase | null) => void;
}

export function useSyncedVoiceResponse({
  fetchTts,
  onVisibleText,
  playAudio,
  onPhaseChange,
}: SyncedVoiceOptions) {
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const reset = useCallback(() => {
    queueRef.current = Promise.resolve();
    onVisibleText("");
    onPhaseChange?.(null);
  }, [onVisibleText, onPhaseChange]);

  /** After full reply is collected: prefetch TTS, then reveal text in sync with audio. */
  const playSynced = useCallback(
    async (fullReply: string) => {
      const sentences = splitAllSentences(fullReply);
      if (sentences.length === 0) {
        onVisibleText(fullReply);
        return;
      }

      onVisibleText("");
      onPhaseChange?.("preparing");

      const audioBlobs = await Promise.all(
        sentences.map(async (sentence) => {
          try {
            return await fetchTts(sentence.trim());
          } catch {
            return null;
          }
        })
      );

      onPhaseChange?.("speaking");
      let visible = "";

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const blob = audioBlobs[i];

        if (blob) {
          await playAudio(blob, () => {
            visible += sentence;
            onVisibleText(visible);
          });
        } else {
          visible += sentence;
          onVisibleText(visible);
        }
      }

      onVisibleText(fullReply);
      onPhaseChange?.(null);
    },
    [fetchTts, onVisibleText, playAudio, onPhaseChange]
  );

  const waitForSpeech = useCallback(async () => {
    await queueRef.current;
  }, []);

  return { reset, playSynced, waitForSpeech };
}
