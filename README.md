# 基于多模态 Agent 的智能面试评估系统

> Multimodal Agent-Powered Intelligent Interview Evaluation System

**在线演示 Live Demo:** https://agent-interview.cn

An AI interviewer that adapts to the candidate in real time — instead of reading from a fixed question bank, it analyzes the candidate's text, voice, and facial signals across 18 evaluation dimensions, then decides on its own whether to dig deeper, switch topics, give hints, or end the interview.

一个"会看人下菜碟"的 AI 面试官：根据候选人的 18 维实时表现，自主决定下一题问什么。

---

## Architecture

```
Candidate answers
      │
      ▼
┌─ Perception Layer (3 parallel pipelines) ──────────────┐
│  Text 5-Dim    Voice 5-Dim      Visual 4-Dim           │
│  (jieba+regex) (VAD+ZCR+RMS)    (MediaPipe, browser)   │
└──────────┬─────────────┬───────────────┬───────────────┘
           ▼             ▼               ▼
┌─ Fusion Layer ─────────────────────────────────────────┐
│  Cross-modal consistency · Pressure index              │
│  Temporal coherence · Personalized score               │
│  14 perception + 4 fusion = 18-Dim vector              │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌─ Agent Decision Layer (state machine) ─────────────────┐
│  7 priority rules: greeting → deep-dive → switch       │
│  topic → give hint → end                               │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌─ Knowledge Retrieval & Question Generation ────────────┐
│  501-item knowledge base → retrieve by decision type   │
│  → LLM generates next question                         │
└─────────────────────────────────────────────────────────┘
```

**Key design: decision/generation separation.** The state machine makes the *decision* (explainable, traceable rules); the LLM only converts the decision into natural language. A decision error can be traced to a specific rule; a generation quality issue can be fixed by swapping the model.

**Privacy by design.** Face analysis runs entirely in the browser via MediaPipe Face Mesh — only 13 numeric features (eye openness, gaze direction, head pose, smile ratio, etc.) are sent to the backend. The video stream never leaves the browser.

**Graceful degradation.** If any modality fails (camera denied, WASM load failure, no microphone), its dimensions are filled with neutral scores and weights are redistributed. Worst case the system degrades to a text-only interview and keeps working.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | FastAPI (Python 3.11) |
| Agent Engine | Hand-written state machine (LangGraph-inspired) |
| LLM | `BaseLLM` abstraction — ChatGLM (OpenAI-compatible API) / MockLLM dual mode |
| Knowledge Base | 501-item structured JSON, in-memory index (<50ms) |
| Text Analysis | jieba + regex engine (pure Python) |
| Voice Analysis | Python stdlib (wave + struct + math): VAD, ZCR, RMS |
| Visual Analysis | MediaPipe Face Mesh (browser-side), simulated fallback |

## 18-Dimension Evaluation

| Group | Dimensions | Count |
|---|---|---|
| Text | keyword coverage, structure & logic, terminology accuracy, resume match, information density | 5 |
| Voice | speech rate, pause & hesitation, tone & emotion, fluency & repetition, volume & clarity | 5 |
| Visual | eye gaze, facial expression, head & gesture, appearance & background | 4 |
| Fusion | cross-modal consistency, pressure index, temporal coherence, personalized score | 4 |

## Getting Started

> **Live demo:** https://agent-interview.cn — no installation needed.
>
> The instructions below are for **local development only** (after cloning the repo). The `localhost` addresses only work on your own machine.

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend (local dev)

```bash
cd src/backend
pip install -r requirements.txt
cp ../../config/.env.example ../../config/.env  # adjust if needed
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Local API docs: http://localhost:8000/docs

### Frontend (local dev)

```bash
cd src/frontend
npm install
npm run dev
```

Open http://localhost:3000 (local dev server)

### Production

Production deployment: Nginx + HTTPS reverse proxy (config templates in `config/`), or static hosting.

## Project Structure

```
src/
├── backend/
│   ├── main.py              # FastAPI entrypoint
│   ├── api/chat.py          # /api/chat core endpoint (7-step orchestration)
│   ├── core/config.py       # pydantic-settings
│   └── services/
│       ├── text_analyzer.py   # text 5 dimensions
│       ├── voice_analyzer.py  # voice 5 dimensions
│       ├── visual_analyzer.py # visual 4 dimensions
│       ├── fusion.py          # fusion layer (14+4=18 dims)
│       ├── agent.py           # state machine + 7 rules + retriever
│       ├── llm.py             # BaseLLM / ChatGLM / MockLLM
│       └── report.py          # report generation
├── frontend/
│   ├── app/page.tsx           # home: position selection
│   └── components/
│       ├── ChatArea.tsx       # interview page (3-column layout)
│       ├── FaceCapture.tsx    # camera + MediaPipe + fallback
│       ├── VoiceRecord.tsx    # recording + Web Speech API
│       ├── ResumeUpload.tsx   # resume parsing (mammoth)
│       ├── ReportView.tsx     # radar chart + 18-dim + PDF/Word export
│       └── RecordsView.tsx    # interview history
data/
├── knowledge_base.json        # 501 knowledge items
└── test_sets.json             # 50 multi-turn test cases
config/                        # nginx.conf + systemd service templates
```

## License

This is a graduation project (undergraduate thesis). Feel free to reference, but please attribute.
