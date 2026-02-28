# SocraticEngine 🧮

A 3-agent AI math tutoring system powered by Claude that uses the **Socratic method** — no answer-dumping, just real guided learning.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SocraticEngine                           │
├──────────────────┬──────────────────────┬────────────────────────┤
│   Agent 1: Brain │ Agent 2: Whiteboard  │    Agent 3: Voice      │
│                  │                      │                        │
│  Claude Opus 4.6 │  React + KaTeX       │  Web Speech API        │
│  Tool-use JSON   │  SVG Graphs          │  STT + TTS             │
│  Socratic logic  │  Framer Motion       │  Push-to-talk          │
│  Error classify  │  Animated limits     │  Continuous mode       │
│  Knowledge graph │  Tangent lines       │  Interrupt handling    │
│  Micro-drills    │  Riemann integrals   │  Speaking indicator    │
└──────────────────┴──────────────────────┴────────────────────────┘
```

## Features

### Brain (SocraticEngine API)
- **Never gives direct answers** unless student fails 3+ attempts
- **Always asks a guiding question** before revealing any step
- **Analyzes spoken reasoning**, not just final answers
- Classifies errors into 6 categories:
  - Conceptual Gap · Arithmetic Error · Sign Error
  - Wrong Theorem · Notation Confusion · Correct Idea, Wrong Execution
- **Tracks error frequency** across the session
- **Triggers 2-minute micro-drills** after 3 repeated error types
- Maintains a **persistent knowledge graph** with:
  - Topics mastered / weak nodes / confidence scores
  - Session statistics and error history

### Whiteboard (Interactive Math Canvas)
- Split-screen layout with chat
- **Step-by-step equation rendering** with KaTeX
- Color-coded steps: Blue (student) · Green (correct) · Red (error + annotation)
- **Animated limit visualization** — point approaching the curve
- **Animated derivative** — secant line converging to tangent
- **Animated integrals** — Riemann rectangles converging to shaded area
- Knowledge graph panel with confidence bars

### Voice Layer
- Web Speech API for STT (SpeechRecognition)
- Web Speech API for TTS (SpeechSynthesis)
- Live transcript panel with interim results
- **Push-to-talk** + **Continuous listening** modes
- Tutor speaks every SocraticEngine response aloud
- **Interrupt handling** — speaking while tutor talks cancels speech
- Visual speaking indicator with waveform animation

## Quick Start

```bash
# 1. Clone and install
cd socratic-engine
npm install

# 2. Set your API key
cp .env.example .env.local
echo "ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE" > .env.local

# 3. Run dev server
npm run dev

# 4. Open http://localhost:3000
```

## Voice Requirements
Voice features require **Chrome, Edge, or Safari** (not Firefox).
The app gracefully degrades to text-only if voice is unsupported.

## Tech Stack
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** with dark mode
- **KaTeX** for LaTeX math rendering
- **Framer Motion** for animations
- **Custom SVG** for mathematical graphs (no external graph deps)
- **@anthropic-ai/sdk** with `tool_use` for reliable structured output
- **Web Speech API** for voice I/O
- **localStorage** for knowledge graph persistence

## Response Format
Every interaction returns structured JSON via Claude tool_use:
```json
{
  "tutor_response": "What happens to (x²-4)/(x-2) when you factor the numerator?",
  "error_type": "Conceptual Gap",
  "micro_drill": false,
  "whiteboard_instruction": {
    "text": "Factoring to resolve the indeterminate form",
    "visualization_type": "limit",
    "math_expression": "\\lim_{x \\to 2} \\frac{x^2-4}{x-2}",
    "function_config": { "expression": "(Math.pow(x,2)-4)/(x-2)", "limit_approach": 2, "limit_value": 4, "x_min": -1, "x_max": 5, "y_min": 0, "y_max": 6 },
    "steps": [
      { "expression": "\\frac{x^2-4}{x-2}", "status": "neutral" },
      { "expression": "\\frac{(x+2)(x-2)}{x-2}", "status": "correct" },
      { "expression": "x+2, \\quad x \\neq 2", "status": "correct" }
    ]
  },
  "knowledge_update": {
    "topic": "limits",
    "confidence_delta": -10,
    "weak_nodes": ["factoring", "indeterminate forms"]
  }
}
```
