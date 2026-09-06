import { useCallback, useRef, useState } from "react";

export function useAudioPlayback() {
  const [playing, setPlaying] = useState(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    queueRef.current = Promise.resolve();
    setPlaying(false);
  }, []);

  const playBlob = useCallback((blob: Blob, onStart?: () => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlaying(true);

      audio.onplaying = () => {
        onStart?.();
      };
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        setPlaying(false);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlaying(false);
        reject(new Error("Playback failed"));
      };
      void audio.play().catch(reject);
    });
  }, []);

  const enqueueBlob = useCallback(
    (blob: Blob) => {
      queueRef.current = queueRef.current
        .then(() => playBlob(blob))
        .catch(() => undefined);
      return queueRef.current;
    },
    [playBlob]
  );

  const playBase64Wav = useCallback(
    async (base64: string): Promise<void> => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await enqueueBlob(new Blob([bytes], { type: "audio/wav" }));
    },
    [enqueueBlob]
  );

  const waitForQueue = useCallback(async () => {
    await queueRef.current;
  }, []);

  return { playing, playBlob, playBase64Wav, enqueueBlob, waitForQueue, stop };
}
