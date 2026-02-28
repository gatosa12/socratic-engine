'use client';

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '@/context/SessionContext';
import { useVoice } from './useVoice';

// ─── Speaking Indicator ───────────────────────────────────────────────────────

function SpeakingIndicator({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <AnimatePresence>
      {isSpeaking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 rounded-full"
        >
          <div className="flex items-end gap-0.5 h-4">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-accent-green rounded-full"
                animate={{ height: ['4px', '14px', '4px'] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.8,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
          <span className="text-xs text-accent-green font-medium">Tutor speaking</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Mic Button ───────────────────────────────────────────────────────────────

function MicButton({
  isListening,
  isSpeaking,
  isPushToTalk,
  onPressStart,
  onPressEnd,
  onClick,
}: {
  isListening: boolean;
  isSpeaking: boolean;
  isPushToTalk: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onPointerDown={isPushToTalk ? onPressStart : undefined}
      onPointerUp={isPushToTalk ? onPressEnd : undefined}
      onPointerLeave={isPushToTalk ? onPressEnd : undefined}
      onClick={!isPushToTalk ? onClick : undefined}
      className={`
        relative w-16 h-16 rounded-full flex items-center justify-center
        transition-all duration-200 select-none
        ${isListening
          ? 'bg-accent-red shadow-lg shadow-accent-red/30'
          : isSpeaking
          ? 'bg-accent-green/20 border-2 border-accent-green/50'
          : 'bg-surface-300 border border-surface-400/30 hover:bg-surface-400/50'
        }
      `}
    >
      {/* Ping rings when listening */}
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-full bg-accent-red/30 animate-ping" />
          <span className="absolute inset-[-6px] rounded-full bg-accent-red/10 animate-ping animation-delay-300" />
        </>
      )}

      {/* Icon */}
      <svg
        className={`w-7 h-7 transition-colors ${isListening ? 'text-white' : 'text-surface-400/70'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M5 10a7 7 0 0014 0M12 19v4M8 23h8" />
      </svg>
    </motion.button>
  );
}

// ─── Transcript Panel ─────────────────────────────────────────────────────────

function TranscriptPanel({
  transcript,
  interimTranscript,
}: {
  transcript: string;
  interimTranscript: string;
}) {
  return (
    <div className="min-h-[48px] px-4 py-3 bg-surface-200 rounded-xl border border-surface-300">
      {transcript || interimTranscript ? (
        <p className="text-sm text-white/80 leading-relaxed">
          {transcript && <span>{transcript} </span>}
          {interimTranscript && (
            <span className="text-surface-400/60 italic">{interimTranscript}</span>
          )}
        </p>
      ) : (
        <p className="text-xs text-surface-400/40 italic">
          Transcript will appear here as you speak...
        </p>
      )}
    </div>
  );
}

// ─── Voice Panel ──────────────────────────────────────────────────────────────

export function VoicePanel() {
  const { state, sendMessage } = useSession();
  const { messages, isLoading } = state;
  const lastSpokenRef = useRef('');

  const handleTranscriptReady = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      sendMessage(text.trim());
    },
    [sendMessage, isLoading]
  );

  const voice = useVoice({
    mode: 'push-to-talk',
    onTranscriptReady: handleTranscriptReady,
  });

  // Auto-speak new assistant messages
  useEffect(() => {
    const lastMsg = messages.at(-1);
    if (
      lastMsg?.role === 'assistant' &&
      lastMsg.content !== lastSpokenRef.current &&
      !isLoading
    ) {
      lastSpokenRef.current = lastMsg.content;
      // Small delay to let UI update first
      setTimeout(() => voice.speak(lastMsg.content), 300);
    }
  }, [messages, isLoading, voice]);

  if (!voice.isSupported) {
    return (
      <div className="p-4 bg-surface-200 rounded-xl border border-surface-300 text-center">
        <p className="text-xs text-surface-400/60">
          Voice not supported in this browser. Use Chrome or Edge for full experience.
        </p>
      </div>
    );
  }

  const isPushToTalk = voice.mode === 'push-to-talk';

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SpeakingIndicator isSpeaking={voice.isSpeaking} />
          {!voice.isSpeaking && voice.isListening && (
            <span className="text-xs text-accent-red font-medium animate-pulse">
              ● Listening...
            </span>
          )}
          {!voice.isSpeaking && !voice.isListening && (
            <span className="text-xs text-surface-400/40">
              {isPushToTalk ? 'Hold mic to speak' : 'Continuous mode active'}
            </span>
          )}
        </div>

        {/* Mode toggle */}
        <button
          onClick={voice.toggleMode}
          className="text-[10px] px-2 py-1 rounded-md bg-surface-300 text-surface-400/60 hover:text-white/60 transition-colors uppercase tracking-wide"
        >
          {isPushToTalk ? 'Push-to-talk' : 'Continuous'}
        </button>
      </div>

      {/* Transcript */}
      <TranscriptPanel
        transcript={voice.transcript}
        interimTranscript={voice.interimTranscript}
      />

      {/* Controls */}
      <div className="flex items-center justify-center gap-6">
        <MicButton
          isListening={voice.isListening}
          isSpeaking={voice.isSpeaking}
          isPushToTalk={isPushToTalk}
          onPressStart={voice.startListening}
          onPressEnd={voice.stopListening}
          onClick={voice.isListening ? voice.stopListening : voice.startListening}
        />

        {/* Cancel speech */}
        {voice.isSpeaking && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={voice.cancelSpeech}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-300 text-surface-400/70 hover:text-white/60 transition-colors"
          >
            Stop speaking
          </motion.button>
        )}
      </div>

      {/* Instruction */}
      <p className="text-center text-[10px] text-surface-400/30">
        {isPushToTalk
          ? 'Hold the microphone button while speaking, release to send'
          : 'Speaking automatically detected · pause to send'}
      </p>
    </div>
  );
}
