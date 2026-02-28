'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Step } from '@/types';
import { EquationRenderer } from './EquationRenderer';

interface StepListProps {
  steps: Step[];
  highlightIndex?: number;
}

const STATUS_STYLES: Record<Step['status'], string> = {
  neutral: 'border-surface-300 bg-surface-200',
  student: 'border-accent-blue/50 bg-accent-blue/5',
  correct: 'border-accent-green/50 bg-accent-green/5',
  error: 'border-accent-red/50 bg-accent-red/5',
};

const STATUS_DOTS: Record<Step['status'], string> = {
  neutral: 'bg-surface-400',
  student: 'bg-accent-blue',
  correct: 'bg-accent-green',
  error: 'bg-accent-red',
};

const STATUS_LABELS: Record<Step['status'], string> = {
  neutral: '',
  student: 'Your step',
  correct: 'Correct',
  error: 'Error',
};

export function StepList({ steps, highlightIndex }: StepListProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-surface-400/70 mb-3">
        Solution Steps
      </p>
      <AnimatePresence initial={false}>
        {steps.map((step, i) => {
          const isHighlighted = highlightIndex === i;
          return (
            <motion.div
              key={`${step.expression}-${i}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className={`
                relative flex items-start gap-3 p-3 rounded-lg border
                transition-all duration-300
                ${STATUS_STYLES[step.status]}
                ${isHighlighted ? 'ring-1 ring-white/10 shadow-lg shadow-black/30' : ''}
              `}
            >
              {/* Step number */}
              <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                <div
                  className={`w-2 h-2 rounded-full ${STATUS_DOTS[step.status]} transition-colors duration-300`}
                />
                {i < steps.length - 1 && (
                  <div className="w-px h-full min-h-[16px] bg-surface-300/50" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium text-surface-400/60 uppercase tracking-wider">
                    Step {i + 1}
                  </span>
                  {STATUS_LABELS[step.status] && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold
                        ${step.status === 'correct' ? 'text-accent-green bg-accent-green/10' : ''}
                        ${step.status === 'error' ? 'text-accent-red bg-accent-red/10' : ''}
                        ${step.status === 'student' ? 'text-accent-blue bg-accent-blue/10' : ''}
                      `}
                    >
                      {STATUS_LABELS[step.status]}
                    </span>
                  )}
                </div>

                <EquationRenderer
                  latex={step.expression}
                  displayMode={false}
                  animate={false}
                  className="text-sm"
                />

                {step.annotation && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 text-xs text-accent-red/90 bg-accent-red/5 px-2 py-1.5 rounded border border-accent-red/20"
                  >
                    ⚠ {step.annotation}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
