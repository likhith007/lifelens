import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "processing";

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setState("recording");
  }, []);

  const stop = useCallback((): Promise<{ blob: Blob; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        reject(new Error("Not recording"));
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        recorder.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        setState("idle");
        resolve({ blob, mimeType: recorder.mimeType });
      };

      recorder.onerror = () => reject(new Error("Recording failed"));
      recorder.stop();
    });
  }, []);

  const setProcessing = useCallback((processing: boolean) => {
    setState(processing ? "processing" : "idle");
  }, []);

  return { state, start, stop, setProcessing };
}
