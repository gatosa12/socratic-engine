'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceMode, VoiceState } from '@/types';

// Augment window for browser speech APIs
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface UseVoiceOptions {
  mode: VoiceMode;
  onTranscriptReady: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
}

interface UseVoiceReturn extends VoiceState {
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string, onEnd?: () => void) => void;
  cancelSpeech: () => void;
  toggleMode: () => void;
  mode: VoiceMode;
}

// Clean text for speech synthesis (strip math symbols that TTS can't handle well)
function cleanForSpeech(text: string): string {
  return text
    .replace(/\$\$?([^$]+)\$\$?/g, '$1') // Strip LaTeX delimiters
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
    .replace(/\\lim/g, 'the limit')
    .replace(/\\to/g, 'approaches')
    .replace(/\\infty/g, 'infinity')
    .replace(/\^/g, ' to the power of ')
    .replace(/_{([^}]+)}/g, ' sub $1')
    .replace(/\{|\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useVoice({
  mode: initialMode,
  onTranscriptReady,
  onInterimTranscript,
}: UseVoiceOptions): UseVoiceReturn {
  const [mode, setMode] = useState<VoiceMode>(initialMode);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    interimTranscript: '',
    isSupported: false,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const finalTranscriptRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);

  // ─── Check support ───────────────────────────────────────────────────────
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) &&
      'speechSynthesis' in window;
    setVoiceState((s) => ({ ...s, isSupported: supported }));
  }, []);

  // ─── Initialize recognition ──────────────────────────────────────────────
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRec) return null;

    const rec = new SpeechRec();
    rec.continuous = mode === 'continuous';
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      isListeningRef.current = true;
      setVoiceState((s) => ({ ...s, isListening: true, interimTranscript: '' }));
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (interim) {
        onInterimTranscript?.(interim);
        setVoiceState((s) => ({ ...s, interimTranscript: interim }));
      }

      if (final) {
        finalTranscriptRef.current += final + ' ';
        setVoiceState((s) => ({
          ...s,
          transcript: finalTranscriptRef.current.trim(),
          interimTranscript: '',
        }));

        // In continuous mode, auto-submit after 1.5s silence
        if (mode === 'continuous') {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            const text = finalTranscriptRef.current.trim();
            if (text) {
              finalTranscriptRef.current = '';
              onTranscriptReady(text);
              setVoiceState((s) => ({ ...s, transcript: '', interimTranscript: '' }));
            }
          }, 1500);
        }
      }
    };

    rec.onend = () => {
      isListeningRef.current = false;
      setVoiceState((s) => ({ ...s, isListening: false, interimTranscript: '' }));

      // In continuous mode, restart unless explicitly stopped
      if (mode === 'continuous' && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Already started or stopped intentionally
        }
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.warn('[Voice] SpeechRecognition error:', e.error);
      isListeningRef.current = false;
      setVoiceState((s) => ({ ...s, isListening: false }));
    };

    return rec;
  }, [mode, onTranscriptReady, onInterimTranscript]);

  // ─── Start listening ──────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // Interrupt any ongoing speech
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel();
      setVoiceState((s) => ({ ...s, isSpeaking: false }));
    }

    if (isListeningRef.current) return;
    finalTranscriptRef.current = '';

    const rec = initRecognition();
    if (!rec) return;

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      console.warn('[Voice] Failed to start recognition');
    }
  }, [initRecognition]);

  // ─── Stop listening ───────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    }

    isListeningRef.current = false;
    setVoiceState((s) => ({ ...s, isListening: false, interimTranscript: '' }));

    // Submit collected transcript for push-to-talk
    if (mode === 'push-to-talk') {
      const text = finalTranscriptRef.current.trim();
      if (text) {
        finalTranscriptRef.current = '';
        onTranscriptReady(text);
        setVoiceState((s) => ({ ...s, transcript: '' }));
      }
    }
  }, [mode, onTranscriptReady]);

  // ─── Speak text ───────────────────────────────────────────────────────────
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const cleaned = cleanForSpeech(text);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Prefer a natural English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && !v.name.includes('Compact') && v.name.includes('Natural')
    ) ?? voices.find((v) => v.lang.startsWith('en-US')) ?? voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setVoiceState((s) => ({ ...s, isSpeaking: true }));
    utterance.onend = () => {
      setVoiceState((s) => ({ ...s, isSpeaking: false }));
      onEnd?.();
    };
    utterance.onerror = () => setVoiceState((s) => ({ ...s, isSpeaking: false }));

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setVoiceState((s) => ({ ...s, isSpeaking: true }));
  }, []);

  // ─── Cancel speech ────────────────────────────────────────────────────────
  const cancelSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setVoiceState((s) => ({ ...s, isSpeaking: false }));
    }
  }, []);

  // ─── Toggle mode ──────────────────────────────────────────────────────────
  const toggleMode = useCallback(() => {
    stopListening();
    setMode((m) => (m === 'continuous' ? 'push-to-talk' : 'continuous'));
  }, [stopListening]);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch { /**/ }
      }
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    ...voiceState,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    toggleMode,
    mode,
  };
}
