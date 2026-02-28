'use client';

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '@/context/SessionContext';
import { Message, ErrorType } from '@/types';

// ─── Error Type Badge ─────────────────────────────────────────────────────────

const ERROR_COLORS: Record<ErrorType, string> = {
  'Conceptual Gap': 'text-accent-red bg-accent-red/10 border-accent-red/20',
  'Arithmetic Error': 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/20',
  'Sign Error': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'Wrong Theorem': 'text-accent-purple bg-accent-purple/10 border-accent-purple/20',
  'Notation Confusion': 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  'Correct Idea, Wrong Execution': 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/20',
  None: 'text-accent-green bg-accent-green/10 border-accent-green/20',
};

function ErrorBadge({ type }: { type: ErrorType }) {
  if (type === 'None') return null;
  return (
    <span
      className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium mt-1 ${ERROR_COLORS[type]}`}
    >
      {type}
    </span>
  );
}

// ─── Typewriter Text ──────────────────────────────────────────────────────────

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;

    const interval = setInterval(() => {
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        return;
      }
      setDisplayed(text.slice(0, indexRef.current + 1));
      indexRef.current++;
    }, 18);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-3.5 bg-accent-blue/70 ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, isLatest }: { message: Message; isLatest: boolean }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Role label */}
        <span className={`text-[10px] font-medium uppercase tracking-wider px-1 ${
          isUser ? 'text-accent-blue/50' : 'text-surface-400/50'
        }`}>
          {isUser ? 'You' : 'Tutor'}
        </span>

        {/* Bubble */}
        <div
          className={`
            px-4 py-3 rounded-2xl text-sm leading-relaxed
            ${isUser
              ? 'bg-accent-blue/15 border border-accent-blue/25 text-white/90 rounded-tr-sm'
              : 'bg-surface-200 border border-surface-300 text-white/80 rounded-tl-sm'
            }
            ${message.isMicroDrill ? 'ring-1 ring-accent-yellow/30' : ''}
          `}
        >
          {isLatest && !isUser ? (
            <TypewriterText text={message.content} />
          ) : (
            message.content
          )}
        </div>

        {/* Error badge */}
        {message.errorType && message.errorType !== 'None' && (
          <ErrorBadge type={message.errorType} />
        )}
        {message.errorType === 'None' && !isUser && (
          <span className="text-[10px] text-accent-green/60 px-1">✓ Correct direction</span>
        )}
        {message.isMicroDrill && (
          <span className="text-[10px] text-accent-yellow/70 px-1">⚡ Micro-drill</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Thinking Indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex justify-start"
    >
      <div className="bg-surface-200 border border-surface-300 px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-accent-blue/60"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Chat Input ───────────────────────────────────────────────────────────────

function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder="Type your answer or reasoning... (or use voice above)"
        rows={2}
        className="
          flex-1 resize-none bg-surface-200 border border-surface-300 rounded-xl
          px-4 py-3 text-sm text-white/80 placeholder-surface-400/40
          focus:outline-none focus:ring-1 focus:ring-accent-blue/40 focus:border-accent-blue/30
          disabled:opacity-50 transition-colors
          scrollbar-thin
        "
      />
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="submit"
        disabled={disabled || !value.trim()}
        className="
          h-[52px] w-12 rounded-xl bg-accent-blue/80 text-white
          flex items-center justify-center flex-shrink-0
          hover:bg-accent-blue transition-all
          disabled:opacity-30 disabled:cursor-not-allowed
        "
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </motion.button>
    </form>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

export function ChatPanel() {
  const { state, sendMessage, resetSession } = useSession();
  const { messages, isLoading, error } = state;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300 bg-surface-200/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green" />
          <span className="text-sm font-semibold text-white/70">Conversation</span>
          {messages.length > 0 && (
            <span className="text-[10px] text-surface-400/50">
              {Math.ceil(messages.length / 2)} exchanges
            </span>
          )}
        </div>
        <button
          onClick={resetSession}
          className="text-[10px] px-2 py-1 rounded bg-surface-300/50 text-surface-400/50 hover:text-white/50 transition-colors uppercase tracking-wide"
        >
          New Session
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin"
      >
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <p className="text-2xl mb-2">🧮</p>
            <p className="text-sm font-semibold text-white/60 mb-1">SocraticEngine</p>
            <p className="text-xs text-surface-400/50 max-w-[240px] mx-auto leading-relaxed">
              Ask me anything in calculus, algebra, or any math topic.
              I&apos;ll guide you to the answer — never just give it away.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {[
                'What is a limit?',
                'Explain the chain rule',
                'How do integrals work?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-surface-300/60 text-surface-400/80 hover:text-white/70 hover:bg-surface-300 transition-colors border border-surface-400/20"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatest={i === messages.length - 1}
            />
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        <AnimatePresence>
          {isLoading && <ThinkingIndicator />}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2"
            >
              ⚠ {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Full Chat Component (chat + input) ───────────────────────────────────────

export function ChatSection() {
  const { state, sendMessage } = useSession();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
      <div className="px-4 pb-4 pt-2 border-t border-surface-300 shrink-0">
        <ChatInput onSubmit={sendMessage} disabled={state.isLoading} />
      </div>
    </div>
  );
}
