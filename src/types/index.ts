// ─── Error Classification ─────────────────────────────────────────────────────

export type ErrorType =
  | 'Conceptual Gap'
  | 'Arithmetic Error'
  | 'Sign Error'
  | 'Wrong Theorem'
  | 'Notation Confusion'
  | 'Correct Idea, Wrong Execution'
  | 'None';

// ─── Whiteboard Types ─────────────────────────────────────────────────────────

export type VisualizationType = 'limit' | 'derivative' | 'integral' | 'none';
export type StepStatus = 'neutral' | 'student' | 'correct' | 'error';

export interface Step {
  expression: string;   // LaTeX string
  status: StepStatus;
  annotation?: string;  // Shown in red for errors
}

export interface FunctionConfig {
  expression: string;       // JS-evaluable, e.g. "Math.pow(x, 2)", "Math.sin(x)"
  limit_approach?: number;  // x → value
  limit_value?: number;     // y → value
  derivative_point?: number;
  integral_a?: number;
  integral_b?: number;
  x_min?: number;
  x_max?: number;
  y_min?: number;
  y_max?: number;
}

export interface WhiteboardInstruction {
  text: string;
  visualization_type: VisualizationType;
  math_expression?: string;       // LaTeX for main equation display
  function_config?: FunctionConfig;
  steps?: Step[];
  highlight_step?: number;        // Index of currently active step
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export interface TopicState {
  mastered: boolean;
  confidenceScore: number;  // 0-100
  attempts: number;
  lastErrors: ErrorType[];
}

export interface ErrorRecord {
  type: ErrorType;
  topic: string;
  timestamp: number;
}

export interface KnowledgeGraph {
  topics: Record<string, TopicState>;
  weakNodes: string[];
  errorHistory: ErrorRecord[];
  sessionStats: {
    totalAttempts: number;
    consecutiveFailures: number;
    microDrillsCompleted: number;
    currentTopic: string;
    attemptOnCurrentProblem: number;
  };
}

// ─── Engine I/O ───────────────────────────────────────────────────────────────

export interface KnowledgeUpdate {
  topic: string;
  confidence_delta: number;     // -30 to +20
  mastered?: boolean;
  weak_nodes?: string[];
}

export interface SocraticResponse {
  tutor_response: string;
  error_type: ErrorType;
  micro_drill: boolean;
  whiteboard_instruction: WhiteboardInstruction;
  knowledge_update: KnowledgeUpdate;
}

export interface EngineRequest {
  message: string;
  knowledgeGraph: KnowledgeGraph;
  conversationHistory: ConversationMessage[];
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  errorType?: ErrorType;
  timestamp: number;
  isMicroDrill?: boolean;
}

// ─── Voice State ──────────────────────────────────────────────────────────────

export type VoiceMode = 'push-to-talk' | 'continuous';

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
}
