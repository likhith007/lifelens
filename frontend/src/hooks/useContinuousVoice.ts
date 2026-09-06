import { useCallback, useEffect, useRef, useState } from "react";

export type ContinuousVoiceState =
  | "off"
  | "listening"
  | "speaking"
  | "processing";

interface UseContinuousVoiceOptions {
  enabled: boolean;
  paused: boolean;
  onUtterance: (blob: Blob, mimeType: string) => Promise<void>;
  silenceMs?: number;
  minSpeechMs?: number;
}

const SPEECH_THRESHOLD = 0.018;
const SILENCE_MS_DEFAULT = 1600;
const MIN_SPEECH_MS_DEFAULT = 400;

function rmsLevel(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

export function useContinuousVoice({
  enabled,
  paused,
  onUtterance,
  silenceMs = SILENCE_MS_DEFAULT,
  minSpeechMs = MIN_SPEECH_MS_DEFAULT,
}: UseContinuousVoiceOptions) {
  const [state, setState] = useState<ContinuousVoiceState>("off");
  const [level, setLevel] = useState(0);
  const [micPaused, setMicPaused] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const capturingRef = useRef(false);
  const processingRef = useRef(false);
  const speechStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const stopCapture = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        capturingRef.current = false;
        silenceStartedAtRef.current = null;
        resolve(blob.size > 0 ? blob : null);
      };
      recorder.stop();
    });
  }, []);

  const startCapture = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || capturingRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    capturingRef.current = true;
    speechStartedAtRef.current = Date.now();
    silenceStartedAtRef.current = null;
    setState("speaking");
  }, []);

  const teardown = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    void stopCapture();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    capturingRef.current = false;
    setLevel(0);
    setState("off");
  }, [stopCapture]);

  const monitor = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const volume = rmsLevel(data);
    setLevel(Math.min(1, volume * 8));

    const now = Date.now();
    const isSpeech = volume > SPEECH_THRESHOLD;

    if (!paused && !micPaused && !processingRef.current) {
      if (isSpeech) {
        silenceStartedAtRef.current = null;
        if (!capturingRef.current) startCapture();
      } else if (capturingRef.current) {
        if (!silenceStartedAtRef.current) {
          silenceStartedAtRef.current = now;
        } else if (now - silenceStartedAtRef.current >= silenceMs) {
          const speechDuration = now - speechStartedAtRef.current;
          if (speechDuration >= minSpeechMs) {
            const recorder = recorderRef.current;
            const mimeType = recorder?.mimeType ?? "audio/webm";
            void stopCapture().then(async (blob) => {
              if (!blob) {
                if (!paused && !micPaused) setState("listening");
                else setState("off");
                return;
              }
              processingRef.current = true;
              setState("processing");
              try {
                await onUtteranceRef.current(blob, mimeType);
              } finally {
                processingRef.current = false;
                if (enabled && !micPaused && !paused) {
                  setState("listening");
                } else {
                  setState("off");
                }
              }
            });
          } else {
            void stopCapture();
            setState("listening");
          }
        }
      } else {
        setState("listening");
      }
    }

    rafRef.current = requestAnimationFrame(monitor);
  }, [paused, micPaused, silenceMs, minSpeechMs, startCapture, stopCapture, enabled]);

  useEffect(() => {
    if (!enabled) {
      teardown();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;

        if (!paused && !micPaused) {
          setState("listening");
          rafRef.current = requestAnimationFrame(monitor);
        }
      } catch {
        setState("off");
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [enabled, teardown]);

  useEffect(() => {
    if (!enabled || !streamRef.current) return;

    if (paused) {
      cancelAnimationFrame(rafRef.current);
      if (capturingRef.current) void stopCapture();
      setState("off");
      return;
    }

    if (!micPaused && state === "off") {
      setState("listening");
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(monitor);
    }
  }, [paused, micPaused, enabled, monitor, state, stopCapture]);

  const toggleMic = useCallback(() => {
    setMicPaused((p) => {
      const next = !p;
      if (next) {
        cancelAnimationFrame(rafRef.current);
        void stopCapture();
        setState("off");
      } else if (enabled && !paused) {
        setState("listening");
        rafRef.current = requestAnimationFrame(monitor);
      }
      return next;
    });
  }, [enabled, paused, monitor, stopCapture]);

  return { state, level, micPaused, toggleMic };
}
