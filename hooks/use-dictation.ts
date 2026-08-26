"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function joinSpeech(base: string, next: string) {
  const phrase = next.replace(/\s+/g, " ").trim();
  if (!phrase) return base;
  const prefix = base.trimEnd();
  if (!prefix) return phrase;
  if (/^[.,!?;:]/.test(phrase)) return `${prefix}${phrase}`;
  return `${prefix} ${phrase}`;
}

function errorMessage(code: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Dictation lost its network connection.";
    case "no-speech":
      return null;
    default:
      return "Dictation stopped unexpectedly.";
  }
}

function subscribe() {
  return () => {};
}

function getSpeechSupport() {
  return Boolean(getSpeechRecognitionCtor());
}

export function useDictation({
  active,
  onFinal,
  onInterim,
  onDenied,
}: {
  active: boolean;
  onFinal: (phrase: string) => void;
  onInterim: (phrase: string) => void;
  onDenied?: () => void;
}) {
  const supported = useSyncExternalStore(subscribe, getSpeechSupport, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  const onDeniedRef = useRef(onDenied);

  useEffect(() => {
    onFinalRef.current = onFinal;
    onInterimRef.current = onInterim;
    onDeniedRef.current = onDenied;
  }, [onDenied, onFinal, onInterim]);

  useEffect(() => {
    if (!active) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    let cancelled = false;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-IN";

    recognition.onstart = () => {
      if (cancelled) return;
      setListening(true);
      setError(null);
    };
    recognition.onresult = (event) => {
      if (cancelled) return;
      let finalPhrase = "";
      let interimPhrase = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i];
        const text = piece[0]?.transcript ?? "";
        if (piece.isFinal) finalPhrase += text;
        else interimPhrase += text;
      }
      if (finalPhrase.trim()) {
        onFinalRef.current(finalPhrase);
        onInterimRef.current("");
      } else {
        onInterimRef.current(interimPhrase);
      }
    };
    recognition.onerror = (event) => {
      if (cancelled) return;
      const message = errorMessage(event.error);
      if (message) setError(message);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onDeniedRef.current?.();
      }
    };
    recognition.onend = () => {
      if (cancelled) return;
      setListening(false);
      onInterimRef.current("");
      window.setTimeout(() => {
        if (cancelled) return;
        try {
          recognition.start();
        } catch {
          /* already running */
        }
      }, 180);
    };

    try {
      recognition.start();
    } catch {
      /* already running */
    }

    return () => {
      cancelled = true;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
      }
    };
  }, [active]);

  return { supported, listening: active && listening, error };
}
