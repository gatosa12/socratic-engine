import {
  KnowledgeGraph,
  KnowledgeUpdate,
  ErrorType,
  ErrorRecord,
  TopicState,
} from '@/types';

const STORAGE_KEY = 'socratic_knowledge_graph';

export function createInitialKnowledgeGraph(): KnowledgeGraph {
  return {
    topics: {},
    weakNodes: [],
    errorHistory: [],
    sessionStats: {
      totalAttempts: 0,
      consecutiveFailures: 0,
      microDrillsCompleted: 0,
      currentTopic: '',
      attemptOnCurrentProblem: 0,
    },
  };
}

export function loadKnowledgeGraph(): KnowledgeGraph {
  if (typeof window === 'undefined') return createInitialKnowledgeGraph();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as KnowledgeGraph;
  } catch {
    // Corrupted storage — start fresh
  }
  return createInitialKnowledgeGraph();
}

export function saveKnowledgeGraph(kg: KnowledgeGraph): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kg));
  } catch {
    // Storage quota exceeded — ignore
  }
}

export function clearKnowledgeGraph(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function applyKnowledgeUpdate(
  kg: KnowledgeGraph,
  update: KnowledgeUpdate,
  errorType: ErrorType,
  isCorrect: boolean
): KnowledgeGraph {
  const { topic, confidence_delta, mastered, weak_nodes } = update;

  // Clone to avoid mutation
  const next: KnowledgeGraph = {
    ...kg,
    topics: { ...kg.topics },
    weakNodes: [...kg.weakNodes],
    errorHistory: [...kg.errorHistory],
    sessionStats: { ...kg.sessionStats },
  };

  // Update or create topic entry
  const existing: TopicState = next.topics[topic] ?? {
    mastered: false,
    confidenceScore: 50,
    attempts: 0,
    lastErrors: [],
  };

  const newScore = Math.min(100, Math.max(0, existing.confidenceScore + confidence_delta));
  const recentErrors: ErrorType[] = errorType !== 'None'
    ? [...existing.lastErrors.slice(-4), errorType]
    : existing.lastErrors;

  next.topics[topic] = {
    mastered: mastered ?? (newScore >= 85 && isCorrect),
    confidenceScore: newScore,
    attempts: existing.attempts + 1,
    lastErrors: recentErrors,
  };

  // Update weak nodes
  if (weak_nodes && weak_nodes.length > 0) {
    const merged = Array.from(new Set([...next.weakNodes, ...weak_nodes]));
    next.weakNodes = merged;
  }

  // Remove from weak nodes if mastered
  if (next.topics[topic].mastered) {
    next.weakNodes = next.weakNodes.filter((n) => n !== topic);
  }

  // Add to error history
  if (errorType !== 'None') {
    const record: ErrorRecord = { type: errorType, topic, timestamp: Date.now() };
    next.errorHistory = [...next.errorHistory.slice(-49), record]; // Keep last 50
  }

  // Update session stats
  next.sessionStats = {
    ...next.sessionStats,
    totalAttempts: next.sessionStats.totalAttempts + 1,
    consecutiveFailures: isCorrect ? 0 : next.sessionStats.consecutiveFailures + 1,
    currentTopic: topic,
    attemptOnCurrentProblem: isCorrect
      ? 0
      : next.sessionStats.attemptOnCurrentProblem + 1,
  };

  return next;
}

export function recordMicroDrillCompleted(kg: KnowledgeGraph): KnowledgeGraph {
  return {
    ...kg,
    sessionStats: {
      ...kg.sessionStats,
      microDrillsCompleted: kg.sessionStats.microDrillsCompleted + 1,
    },
  };
}

export function getErrorFrequency(kg: KnowledgeGraph): Record<ErrorType, number> {
  const freq: Partial<Record<ErrorType, number>> = {};
  const window = kg.errorHistory.slice(-30);
  for (const r of window) {
    freq[r.type] = (freq[r.type] ?? 0) + 1;
  }
  return freq as Record<ErrorType, number>;
}

export function shouldTriggerMicroDrill(kg: KnowledgeGraph): boolean {
  const freq = getErrorFrequency(kg);
  return Object.values(freq).some((count) => count >= 3);
}

export function getDominantError(kg: KnowledgeGraph): ErrorType | null {
  const freq = getErrorFrequency(kg);
  let max = 0;
  let dominant: ErrorType | null = null;
  for (const [type, count] of Object.entries(freq) as [ErrorType, number][]) {
    if (count > max) {
      max = count;
      dominant = type;
    }
  }
  return max >= 3 ? dominant : null;
}

export function getTopicConfidence(kg: KnowledgeGraph, topic: string): number {
  return kg.topics[topic]?.confidenceScore ?? 50;
}

export function resetAttemptCounter(kg: KnowledgeGraph): KnowledgeGraph {
  return {
    ...kg,
    sessionStats: {
      ...kg.sessionStats,
      attemptOnCurrentProblem: 0,
      consecutiveFailures: 0,
    },
  };
}
