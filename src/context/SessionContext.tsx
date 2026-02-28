'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  ConversationMessage,
  EngineRequest,
  KnowledgeGraph,
  Message,
  SocraticResponse,
  WhiteboardInstruction,
} from '@/types';
import {
  applyKnowledgeUpdate,
  clearKnowledgeGraph,
  createInitialKnowledgeGraph,
  loadKnowledgeGraph,
  recordMicroDrillCompleted,
  resetAttemptCounter,
  saveKnowledgeGraph,
} from '@/lib/knowledge-graph';

// ─── State ────────────────────────────────────────────────────────────────────

interface SessionState {
  messages: Message[];
  conversationHistory: ConversationMessage[];
  knowledgeGraph: KnowledgeGraph;
  whiteboardInstruction: WhiteboardInstruction;
  isLoading: boolean;
  error: string | null;
  microDrillActive: boolean;
  microDrillTopic: string | null;
  streamingText: string;
  isStreaming: boolean;
}

const INITIAL_WHITEBOARD: WhiteboardInstruction = {
  text: 'Ask me any math question to get started.',
  visualization_type: 'none',
};

function createInitialState(): SessionState {
  return {
    messages: [],
    conversationHistory: [],
    knowledgeGraph: createInitialKnowledgeGraph(),
    whiteboardInstruction: INITIAL_WHITEBOARD,
    isLoading: false,
    error: null,
    microDrillActive: false,
    microDrillTopic: null,
    streamingText: '',
    isStreaming: false,
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'INIT_KG'; payload: KnowledgeGraph }
  | { type: 'SEND_MESSAGE'; payload: { userMessage: Message; history: ConversationMessage[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'STREAM_CHUNK'; payload: string }
  | { type: 'ENGINE_RESPONSE'; payload: SocraticResponse }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'DISMISS_MICRO_DRILL' }
  | { type: 'RESET_SESSION' };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'INIT_KG':
      return { ...state, knowledgeGraph: action.payload };

    case 'SEND_MESSAGE': {
      return {
        ...state,
        messages: [...state.messages, action.payload.userMessage],
        conversationHistory: action.payload.history,
        error: null,
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload, streamingText: action.payload ? '' : state.streamingText };

    case 'STREAM_CHUNK':
      return { ...state, streamingText: state.streamingText + action.payload };

    case 'ENGINE_RESPONSE': {
      const { tutor_response, error_type, micro_drill, whiteboard_instruction, knowledge_update } =
        action.payload;

      const isCorrect = error_type === 'None';

      const updatedKg = applyKnowledgeUpdate(
        state.knowledgeGraph,
        knowledge_update,
        error_type,
        isCorrect
      );

      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: tutor_response,
        errorType: error_type,
        timestamp: Date.now(),
        isMicroDrill: micro_drill,
      };

      const newHistory: ConversationMessage[] = [
        ...state.conversationHistory,
        { role: 'assistant', content: tutor_response },
      ];

      const finalKg = micro_drill
        ? recordMicroDrillCompleted(updatedKg)
        : updatedKg;

      return {
        ...state,
        messages: [...state.messages, assistantMessage],
        conversationHistory: newHistory,
        knowledgeGraph: finalKg,
        whiteboardInstruction: whiteboard_instruction,
        isLoading: false,
        isStreaming: false,
        streamingText: '',
        microDrillActive: micro_drill,
        microDrillTopic: micro_drill ? knowledge_update.topic : state.microDrillTopic,
      };
    }

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false, isStreaming: false };

    case 'DISMISS_MICRO_DRILL': {
      const resetKg = resetAttemptCounter(state.knowledgeGraph);
      return { ...state, microDrillActive: false, microDrillTopic: null, knowledgeGraph: resetKg };
    }

    case 'RESET_SESSION':
      return { ...createInitialState(), knowledgeGraph: createInitialKnowledgeGraph() };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SessionContextValue {
  state: SessionState;
  sendMessage: (text: string) => Promise<void>;
  dismissMicroDrill: () => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const streamingTextRef = useRef('');

  // Load persisted knowledge graph on mount
  useEffect(() => {
    const saved = loadKnowledgeGraph();
    if (Object.keys(saved.topics).length > 0 || saved.sessionStats.totalAttempts > 0) {
      dispatch({ type: 'INIT_KG', payload: saved });
    }
  }, []);

  // Persist KG whenever it changes
  useEffect(() => {
    saveKnowledgeGraph(state.knowledgeGraph);
  }, [state.knowledgeGraph]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || state.isLoading) return;

      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const updatedHistory: ConversationMessage[] = [
        ...state.conversationHistory,
        { role: 'user', content: text },
      ];

      dispatch({ type: 'SEND_MESSAGE', payload: { userMessage, history: updatedHistory } });
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_STREAMING', payload: true });
      streamingTextRef.current = '';

      const requestBody: EngineRequest = {
        message: text,
        knowledgeGraph: state.knowledgeGraph,
        conversationHistory: updatedHistory,
      };

      try {
        const res = await fetch('/api/socratic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        const engineResponse: SocraticResponse = await res.json();
        dispatch({ type: 'ENGINE_RESPONSE', payload: engineResponse });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        dispatch({ type: 'SET_ERROR', payload: msg });
      }
    },
    [state.isLoading, state.conversationHistory, state.knowledgeGraph]
  );

  const dismissMicroDrill = useCallback(() => {
    dispatch({ type: 'DISMISS_MICRO_DRILL' });
  }, []);

  const resetSession = useCallback(() => {
    clearKnowledgeGraph();
    dispatch({ type: 'RESET_SESSION' });
  }, []);

  return (
    <SessionContext.Provider value={{ state, sendMessage, dismissMicroDrill, resetSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
