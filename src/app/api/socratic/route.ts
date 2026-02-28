import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt, buildUserMessage } from '@/lib/prompts';
import { EngineRequest, SocraticResponse, WhiteboardInstruction } from '@/types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-6';

// ─── Tool Schema ──────────────────────────────────────────────────────────────

const SOCRATIC_TOOL: Anthropic.Tool = {
  name: 'socratic_response',
  description: 'Return a structured Socratic tutoring response. Always invoke this tool.',
  input_schema: {
    type: 'object' as const,
    properties: {
      tutor_response: {
        type: 'string',
        description:
          'Spoken response to the student. Plain text only — no LaTeX. ' +
          'Speak math verbally ("x squared", "the limit as x approaches 2"). ' +
          'End with a guiding question. Max 4 sentences.',
      },
      error_type: {
        type: 'string',
        enum: [
          'Conceptual Gap',
          'Arithmetic Error',
          'Sign Error',
          'Wrong Theorem',
          'Notation Confusion',
          'Correct Idea, Wrong Execution',
          'None',
        ],
        description: 'Exact classification of the student\'s error. "None" if correct.',
      },
      micro_drill: {
        type: 'boolean',
        description:
          'Set true if any error type has occurred 3+ times this session. ' +
          'Triggers a focused 2-minute drill on that weakness.',
      },
      whiteboard_instruction: {
        type: 'object',
        description: 'Instructions for the interactive math whiteboard.',
        properties: {
          text: {
            type: 'string',
            description: 'Short text label for the whiteboard state.',
          },
          visualization_type: {
            type: 'string',
            enum: ['limit', 'derivative', 'integral', 'none'],
            description: 'Which mathematical visualization to render.',
          },
          math_expression: {
            type: 'string',
            description: 'Primary LaTeX expression for display (e.g., "\\\\lim_{x \\\\to 2} x^2 = 4").',
          },
          function_config: {
            type: 'object',
            description: 'Graph function configuration.',
            properties: {
              expression: {
                type: 'string',
                description:
                  'JavaScript-evaluable math expression using x. ' +
                  'Use Math.* functions: "Math.pow(x,2)", "Math.sin(x)", "Math.log(x)". ' +
                  'Do NOT use ^ for exponents — use Math.pow.',
              },
              limit_approach: { type: 'number', description: 'x value the limit approaches' },
              limit_value: { type: 'number', description: 'y value the limit approaches' },
              derivative_point: { type: 'number', description: 'x value where tangent line is shown' },
              integral_a: { type: 'number', description: 'Left bound of integral' },
              integral_b: { type: 'number', description: 'Right bound of integral' },
              x_min: { type: 'number', description: 'Graph x-axis minimum' },
              x_max: { type: 'number', description: 'Graph x-axis maximum' },
              y_min: { type: 'number', description: 'Graph y-axis minimum' },
              y_max: { type: 'number', description: 'Graph y-axis maximum' },
            },
            required: ['expression'],
          },
          steps: {
            type: 'array',
            description: 'Step-by-step solution breakdown. Each step shown on whiteboard.',
            items: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: 'LaTeX expression for this step.',
                },
                status: {
                  type: 'string',
                  enum: ['neutral', 'student', 'correct', 'error'],
                  description:
                    'neutral=grey, student=blue (student\'s work), correct=green, error=red.',
                },
                annotation: {
                  type: 'string',
                  description: 'Optional annotation shown next to error steps.',
                },
              },
              required: ['expression', 'status'],
            },
          },
          highlight_step: {
            type: 'number',
            description: 'Index of the currently active step (0-based). Animates into view.',
          },
        },
        required: ['text', 'visualization_type'],
      },
      knowledge_update: {
        type: 'object',
        description: 'Update to the student\'s knowledge graph after this interaction.',
        properties: {
          topic: {
            type: 'string',
            description: 'The specific math topic being worked on (e.g., "limits", "chain rule").',
          },
          confidence_delta: {
            type: 'number',
            description:
              'Change in confidence score. Range -30 to +20. ' +
              'Correct = +10 to +20. Wrong = -10 to -20.',
          },
          mastered: {
            type: 'boolean',
            description: 'Whether the student has mastered this topic (confidence > 85, 3+ correct).',
          },
          weak_nodes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of prerequisite topics the student seems weak on.',
          },
        },
        required: ['topic', 'confidence_delta'],
      },
    },
    required: [
      'tutor_response',
      'error_type',
      'micro_drill',
      'whiteboard_instruction',
      'knowledge_update',
    ],
  },
};

// ─── Default Whiteboard ────────────────────────────────────────────────────────

const DEFAULT_WHITEBOARD: WhiteboardInstruction = {
  text: 'Waiting for student input...',
  visualization_type: 'none',
};

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: EngineRequest = await req.json();
    const { message, knowledgeGraph, conversationHistory } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(knowledgeGraph);
    const attemptNum = knowledgeGraph.sessionStats.attemptOnCurrentProblem + 1;
    const userContent = buildUserMessage(message, attemptNum);

    // Build messages — keep last 20 turns for context window efficiency
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      tools: [SOCRATIC_TOOL],
      tool_choice: { type: 'tool', name: 'socratic_response' },
      messages,
    });

    // Extract the tool use block
    const toolBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolBlock || toolBlock.name !== 'socratic_response') {
      throw new Error('SocraticEngine did not invoke the required tool');
    }

    const engineOutput = toolBlock.input as SocraticResponse;

    // Ensure whiteboard_instruction always has required fields
    if (!engineOutput.whiteboard_instruction) {
      engineOutput.whiteboard_instruction = DEFAULT_WHITEBOARD;
    }

    return NextResponse.json(engineOutput, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[SocraticEngine] Error:', error);

    const message =
      error instanceof Anthropic.APIError
        ? `Anthropic API error ${error.status}: ${error.message}`
        : error instanceof Error
        ? error.message
        : 'Unknown error';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
