"use client";

import { useState, useRef, useEffect } from "react";

// Browser Speech Recognition types (not in default TS libs for all environments)
interface ISpeechRecognitionResult {
  readonly transcript: string;
}
interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): { item(i: number): ISpeechRecognitionResult };
  [index: number]: { item(i: number): ISpeechRecognitionResult };
}
interface ISpeechRecognitionEvent extends Event {
  readonly results: ISpeechRecognitionResultList;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface ISpeechRecognitionCtor {
  new (): ISpeechRecognition;
}

function getSpeechRecognition(): ISpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    // Check support on mount (client-side only)
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  function startListening() {
    setError(null);
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setError("该浏览器不支持语音输入");
      return;
    }

    const recognition = new SpeechRecognitionCtor();

    // Auto-select language based on browser locale
    const lang = navigator.language?.startsWith("zh") ? "zh-CN" : "en-US";
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      const transcript = e.results[0].item(0).transcript;
      setIsListening(false);
      onResult(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  return { isListening, isSupported, error, startListening, stopListening };
}
