'use client';

import { SessionProvider } from '@/context/SessionContext';
import { Whiteboard } from '@/components/Whiteboard';
import { VoicePanel } from '@/components/Voice';
import { ChatSection } from '@/components/Chat';

// ─── Logo / Header Mark ───────────────────────────────────────────────────────

function HeaderMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <div className="absolute inset-0 bg-accent-blue/20 rounded-lg" />
        <span className="relative text-lg font-bold text-accent-blue">∫</span>
      </div>
      <div>
        <span className="text-sm font-bold text-white/80 tracking-tight">SocraticEngine</span>
        <p className="text-[10px] text-surface-400/50 -mt-0.5">AI Math Tutor · Socratic Method</p>
      </div>
    </div>
  );
}

// ─── Agent Tags ───────────────────────────────────────────────────────────────

function AgentTag({ label, color }: { label: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border ${color}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse-slow" />
      <span className="font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <SessionProvider>
      <div className="h-screen w-screen flex flex-col bg-surface-50 text-white overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-12 flex items-center justify-between px-5 border-b border-surface-300/60 bg-surface-100/80 backdrop-blur-sm shrink-0 z-10">
          <HeaderMark />
          <div className="flex items-center gap-2">
            <AgentTag label="Brain" color="text-accent-blue border-accent-blue/20 bg-accent-blue/5" />
            <AgentTag label="Whiteboard" color="text-accent-purple border-accent-purple/20 bg-accent-purple/5" />
            <AgentTag label="Voice" color="text-accent-green border-accent-green/20 bg-accent-green/5" />
          </div>
        </header>

        {/* Main Content — Split Screen */}
        <main className="flex-1 flex min-h-0 gap-3 p-3 overflow-hidden">
          {/* ─── Left Panel: Voice + Chat ─── */}
          <section className="w-[42%] flex flex-col gap-3 min-h-0 shrink-0">
            {/* Voice Agent */}
            <div className="shrink-0 bg-surface-100 rounded-2xl border border-surface-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Agent 3 · Voice
                </span>
              </div>
              <VoicePanel />
            </div>

            {/* Chat Agent / Brain Output */}
            <div className="flex-1 bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden min-h-0">
              <ChatSection />
            </div>
          </section>

          {/* ─── Right Panel: Whiteboard ─── */}
          <section className="flex-1 min-h-0 min-w-0">
            <Whiteboard />
          </section>
        </main>
      </div>
    </SessionProvider>
  );
}
