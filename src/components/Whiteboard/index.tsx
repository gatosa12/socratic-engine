'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from '@/context/SessionContext';
import { EquationRenderer } from './EquationRenderer';
import { GraphVisualization } from './GraphVisualization';
import { StepList } from './StepList';
import { KnowledgeGraph } from '@/types';
import { getErrorFrequency } from '@/lib/knowledge-graph';

// ─── Knowledge Graph Panel ────────────────────────────────────────────────────

function KnowledgePanel({ kg }: { kg: KnowledgeGraph }) {
  const freq = getErrorFrequency(kg);
  const topics = Object.entries(kg.topics).slice(0, 6);

  return (
    <div className="border-t border-surface-300 pt-4 mt-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400/60">
        Knowledge Graph
      </p>

      {/* Topic Confidence Bars */}
      {topics.length > 0 && (
        <div className="space-y-2">
          {topics.map(([topic, state]) => (
            <div key={topic}>
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-xs text-surface-400/80 truncate max-w-[120px]">{topic}</span>
                <span className="text-xs text-surface-400/60">{state.confidenceScore}%</span>
              </div>
              <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-colors duration-500 ${
                    state.mastered
                      ? 'bg-accent-green'
                      : state.confidenceScore >= 60
                      ? 'bg-accent-blue'
                      : 'bg-accent-red'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${state.confidenceScore}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Weak nodes */}
      {kg.weakNodes.length > 0 && (
        <div>
          <p className="text-[10px] text-surface-400/50 mb-1">Weak Areas</p>
          <div className="flex flex-wrap gap-1">
            {kg.weakNodes.slice(0, 4).map((node) => (
              <span
                key={node}
                className="text-[10px] px-1.5 py-0.5 rounded bg-accent-red/10 text-accent-red/80 border border-accent-red/20"
              >
                {node}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error Frequency */}
      {Object.entries(freq).length > 0 && (
        <div>
          <p className="text-[10px] text-surface-400/50 mb-1">Error Frequency</p>
          <div className="space-y-1">
            {(Object.entries(freq) as [string, number][])
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="text-[10px] text-surface-400/70 truncate max-w-[140px]">{type}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          count >= 3 ? 'bg-accent-red' : 'bg-accent-yellow'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Session Stats */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-surface-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-accent-blue">{kg.sessionStats.totalAttempts}</div>
          <div className="text-[9px] text-surface-400/50 uppercase tracking-wide">Attempts</div>
        </div>
        <div className="bg-surface-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-accent-green">
            {Object.values(kg.topics).filter((t) => t.mastered).length}
          </div>
          <div className="text-[9px] text-surface-400/50 uppercase tracking-wide">Mastered</div>
        </div>
      </div>
    </div>
  );
}

// ─── Micro Drill Banner ───────────────────────────────────────────────────────

function MicroDrillBanner({
  topic,
  onDismiss,
}: {
  topic: string | null;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-4 p-3 rounded-xl bg-accent-yellow/10 border border-accent-yellow/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-accent-yellow uppercase tracking-wide">
            ⚡ Micro-Drill Activated
          </p>
          <p className="text-xs text-surface-400/80 mt-0.5">
            Repeated errors detected on{' '}
            <span className="text-accent-yellow">{topic ?? 'this concept'}</span>.
            2-minute focused drill starting now.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-surface-400/50 hover:text-surface-400/90 text-xs shrink-0 transition-colors"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}

// ─── Whiteboard Component ─────────────────────────────────────────────────────

export function Whiteboard() {
  const { state, dismissMicroDrill } = useSession();
  const { whiteboardInstruction: wb, knowledgeGraph, microDrillActive, microDrillTopic } = state;

  return (
    <div className="h-full flex flex-col bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-300 bg-surface-200/50">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-accent-blue animate-pulse-slow" />
          <span className="text-sm font-semibold text-white/80">Interactive Whiteboard</span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide
            ${wb.visualization_type === 'none'
              ? 'bg-surface-300 text-surface-400/60'
              : 'bg-accent-purple/20 text-accent-purple'
            }`}
        >
          {wb.visualization_type === 'none' ? 'Idle' : wb.visualization_type}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
        {/* Micro Drill Banner */}
        <AnimatePresence>
          {microDrillActive && (
            <MicroDrillBanner topic={microDrillTopic} onDismiss={dismissMicroDrill} />
          )}
        </AnimatePresence>

        {/* Status text */}
        {wb.text && (
          <p className="text-xs text-surface-400/60 italic">{wb.text}</p>
        )}

        {/* Main equation */}
        <AnimatePresence mode="wait">
          {wb.math_expression && (
            <motion.div
              key={wb.math_expression}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-surface-200 rounded-xl p-5 border border-surface-300 text-center"
            >
              <EquationRenderer latex={wb.math_expression} displayMode animate />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Graph Visualization */}
        <AnimatePresence mode="wait">
          {wb.visualization_type !== 'none' && wb.function_config && (
            <GraphVisualization
              visualizationType={wb.visualization_type}
              functionConfig={wb.function_config}
            />
          )}
        </AnimatePresence>

        {/* Step List */}
        <AnimatePresence mode="wait">
          {wb.steps && wb.steps.length > 0 && (
            <motion.div
              key={JSON.stringify(wb.steps)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <StepList steps={wb.steps} highlightIndex={wb.highlight_step} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!wb.math_expression && wb.visualization_type === 'none' && (!wb.steps || wb.steps.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-4 opacity-30">∫</div>
            <p className="text-sm text-surface-400/40">
              Start a conversation to see math visualized here
            </p>
          </div>
        )}

        {/* Knowledge Graph Panel */}
        <KnowledgePanel kg={knowledgeGraph} />
      </div>
    </div>
  );
}
