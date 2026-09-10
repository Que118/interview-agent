"""对话接口 — Agent 面试核心端点（v5：全模态 文本+语音+视觉+融合+报告）"""

import json, os, base64, struct, re, random
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
from services.llm import get_llm, LLMMessage
from services.text_analyzer import analyze_text
from services.voice_analyzer import analyze_voice
from services.visual_analyzer import analyze_visual, FaceData
from services.fusion import fuse_analysis
from services.report import generate_report
from services.agent import get_agent, AgentDecision

router = APIRouter(prefix="/api", tags=["chat"])


# ---- 数据模型 ----

class ChatMessage(BaseModel):
    role: str
    content: str


class FaceDataIn(BaseModel):
    """前端传入的面部数据"""
    left_eye_open: float = 0.9
    right_eye_open: float = 0.9
    eye_blink_rate: float = 15.0
    gaze_x: float = 0.0
    gaze_y: float = 0.0
    gaze_stability: float = 0.8
    head_yaw: float = 0.0
    head_pitch: float = 0.0
    head_roll: float = 0.0
    head_movement: float = 0.1
    smile_ratio: float = 0.3
    expression_variance: float = 0.4
    face_present: bool = True
    face_confidence: float = 0.95
    duration_seconds: float = 0.0


class ChatRequest(BaseModel):
    session_id: str
    position: str
    messages: List[ChatMessage]
    resume_text: str = ""
    voice_wav_base64: str = ""
    voice_sample_rate: int = 16000
    face_data: Optional[FaceDataIn] = None
    background_data: Optional[Dict] = None


class DimensionOut(BaseModel):
    name: str
    score: float
    evidence: str
    modality: str = "text"


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    agent_decision: Optional[str] = None
    dimensions: List[DimensionOut] = []
    overall_score: Optional[float] = None
    analysis_summary: str = ""
    pressure_level: float = 0.0
    knowledge_used: int = 0
    turn: int = 0


class ReportResponse(BaseModel):
    position: str
    date: str
    total_turns: int
    overall_score: float
    overall_grade: str
    summary: str
    modality_scores: Dict[str, float]
    radar: List[dict]
    sections: List[dict]
    recommendations: List[str]
    decision_stats: Dict[str, int]


# ---- 知识库 ----

_knowledge: dict = {}

POSITION_MAP = {
    "frontend": "前端开发工程师",
    "backend": "后端开发工程师",
    "analyst": "数据分析师",
    "pm": "产品经理",
    "designer": "UI/UX 设计师",
}

def _resolve_position(pos_id: str) -> str:
    return POSITION_MAP.get(pos_id, pos_id)

def _load_knowledge():
    global _knowledge
    if _knowledge:
        return _knowledge
    kb_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "knowledge_base.json")
    if os.path.exists(kb_path):
        with open(kb_path, "r", encoding="utf-8") as f:
            _knowledge = json.load(f)
    agent = get_agent()
    agent.retriever.load_knowledge(_knowledge)
    return _knowledge


# ---- 音频解码 ----

def _decode_wav_base64(b64: str, sample_rate: int = 16000) -> tuple:
    if not b64:
        return [], sample_rate
    if not re.match(r'^[A-Za-z0-9+/]*={0,2}$', b64[:100]):
        return [], sample_rate
    try:
        raw = base64.b64decode(b64, validate=True)
        if raw[:4] == b'RIFF':
            import io, wave
            with wave.open(io.BytesIO(raw), 'rb') as wf:
                n = wf.getnframes()
                sr = wf.getframerate()
                data = wf.readframes(n)
                fmt = f'<{n}h'
                return [s / 32768.0 for s in struct.unpack(fmt, data)], sr
        n = len(raw) // 2
        fmt = f'<{n}h'
        return [s / 32768.0 for s in struct.unpack(fmt, raw[:n*2])], sample_rate
    except Exception:
        return [], sample_rate


def build_system_prompt(position: str, knowledge: List[str], decision: str, pressure: float) -> str:
    base = (
        f"你是一个专业的AI面试官，正在面试「{position}」岗位的候选人。\n"
        "你的任务是根据候选人的回答，动态决定下一题问什么。\n"
        "保持专业、友善的语调。每轮只问一个问题。\n"
    )
    hints = {
        "深挖弱点": "[决策:深挖弱点] 候选人在某些维度回答不够深入，请针对弱点追问细节。",
        "转话题": "[决策:转话题] 请换一个不相关的话题方向，扩大考察范围。",
        "给提示": "[决策:给提示] 候选人似乎遇到了困难，请给出一个温和的引导性提示。",
        "结束": "[决策:结束] 请礼貌地结束面试，感谢候选人的参与。",
        "开场": "[决策:开场] 请做开场白，介绍面试流程，请候选人先自我介绍。",
    }
    base += f"\n本轮策略：{hints.get(decision, '请根据对话自然推进')}"
    if pressure > 0.5:
        base += "\n注意：候选人压力水平较高，请保持鼓励和耐心。"
    if knowledge:
        base += "\n\n参考知识：\n" + "\n".join(f"- {k}" for k in knowledge[:5])
    return base


# ---- 主端点 ----

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    sid = request.session_id
    position = request.position
    position = _resolve_position(position)
    user_text = request.messages[-1].content if request.messages else ""

    _load_knowledge()
    agent = get_agent()
    llm = get_llm()

    # === 三模态并行分析 ===
    text_analysis = await analyze_text(user_text, position, request.resume_text)

    voice_analysis = None
    if request.voice_wav_base64:
        vs, vsr = _decode_wav_base64(request.voice_wav_base64, request.voice_sample_rate)
        voice_analysis = await analyze_voice(samples=vs, sample_rate=vsr, transcript=user_text)

    visual_analysis = None
    if request.face_data:
        fd = FaceData(
            left_eye_open=request.face_data.left_eye_open,
            right_eye_open=request.face_data.right_eye_open,
            eye_blink_rate=request.face_data.eye_blink_rate,
            gaze_x=request.face_data.gaze_x,
            gaze_y=request.face_data.gaze_y,
            gaze_stability=request.face_data.gaze_stability,
            head_yaw=request.face_data.head_yaw,
            head_pitch=request.face_data.head_pitch,
            head_roll=request.face_data.head_roll,
            head_movement=request.face_data.head_movement,
            smile_ratio=request.face_data.smile_ratio,
            expression_variance=request.face_data.expression_variance,
            face_present=request.face_data.face_present,
            face_confidence=request.face_data.face_confidence,
            duration_seconds=request.face_data.duration_seconds,
        )
        visual_analysis = await analyze_visual(fd, request.background_data)

    # === 融合层 ===
    vo = voice_analysis.overall_score if voice_analysis else 50
    vi = visual_analysis.overall_score if visual_analysis else 50

    state = agent._states.get(sid)
    history_overalls = [r.overall_score for r in (state.history if state else []) if r.overall_score > 0]

    fusion = await fuse_analysis(
        text_dims=[type('D',(),{'name':d.name,'score':d.score,'evidence':d.evidence})() for d in text_analysis.dimensions],
        voice_dims=[type('D',(),{'name':d.name,'score':d.score,'evidence':d.evidence})() for d in (voice_analysis.dimensions if voice_analysis else [])],
        visual_dims=[type('D',(),{'name':d.name,'score':d.score,'evidence':d.evidence})() for d in (visual_analysis.dimensions if visual_analysis else [])],
        text_overall=text_analysis.overall_score,
        voice_overall=vo,
        visual_overall=vi,
        agent_pressure=state.pressure_level if state else 0.0,
        history_overalls=history_overalls,
    )

    # === Agent 决策 ===
    all_dims = [type('D',(),{'name':d.name,'score':d.score,'evidence':d.evidence})() for d in fusion.dimensions]

    async def llm_generate(state, knowledge):
        sp = build_system_prompt(position, knowledge, state.current_decision.value, state.pressure_level)
        msgs = [LLMMessage(role="system", content=sp)]
        for m in request.messages:
            msgs.append(LLMMessage(role=m.role, content=m.content))
        r = await llm.chat(msgs, session_id=sid, position=position)
        return r.content

    result = await agent.process_turn(
        session_id=sid, position=position, user_text=user_text,
        analysis=all_dims, overall_score=fusion.overall_score,
        analysis_summary=fusion.summary, llm_generate=llm_generate,
    )

    # === 响应 ===
    dims_out = []
    mod_map = {"text": "text", "voice": "voice", "visual": "visual", "fusion": "fusion"}
    for d in fusion.dimensions:
        dims_out.append(DimensionOut(name=d.name, score=d.score, evidence=d.evidence, modality=mod_map.get(d.modality, d.modality)))

    return ChatResponse(
        session_id=sid, reply=result["reply"],
        agent_decision=result["decision"], dimensions=dims_out,
        overall_score=fusion.overall_score,
        analysis_summary=fusion.summary,
        pressure_level=fusion.pressure_index,
        knowledge_used=result.get("knowledge_used", 0),
        turn=result.get("turn", 0),
    )


# ---- 报告端点 ----

@router.get("/report/{session_id}", response_model=ReportResponse)
async def get_report(session_id: str):
    agent = get_agent()
    state = agent._states.get(session_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "session not found"})

    # 统计决策
    decision_stats = {}
    for r in state.history:
        d = r.decision.value if hasattr(r.decision, 'value') else str(r.decision)
        decision_stats[d] = decision_stats.get(d, 0) + 1

    # 用最后一轮的融合数据生成报告（简化：取平均分）
    text_avg = sum(getattr(r, 'overall_score', 50) for r in state.history) / max(len(state.history), 1)
    report = await generate_report(
        position=state.position,
        total_turns=state.turn,
        text_overall=text_avg,
        voice_overall=50,
        visual_overall=50,
        fusion_result=type('F',(),{
            'dimensions': [],
            'overall_score': text_avg,
            'summary': f'共{state.turn}轮面试完成',
            'recommendations': ['建议回顾薄弱知识点'],
        })(),
        decision_stats=decision_stats,
        duration_minutes=state.turn * 3,
    )

    return ReportResponse(
        position=report.position, date=report.date,
        total_turns=report.total_turns,
        overall_score=report.overall_score,
        overall_grade=report.overall_grade,
        summary=report.summary,
        modality_scores={"text": text_avg, "voice": 50, "visual": 50},
        radar=[{
            "name": s.name, "labels": s.labels, "values": s.values,
        } for s in report.radar],
        sections=[{
            "title": s.title, "content": s.content,
            "score": s.score, "items": s.items,
        } for s in report.sections],
        recommendations=report.recommendations,
        decision_stats=decision_stats,
    )


@router.get("/chat/sessions/{session_id}")
async def get_session(session_id: str):
    agent = get_agent()
    state = agent._states.get(session_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "session not found"})
    return {
        "session_id": session_id, "position": state.position,
        "turn": state.turn, "pressure_level": state.pressure_level,
        "weakness_hits": state.weakness_hits,
        "topic_coverage": state.topic_coverage,
        "history_count": len(state.history),
    }


@router.delete("/chat/sessions/{session_id}")
async def end_session(session_id: str):
    get_agent().reset_state(session_id)
    return {"status": "ended"}


@router.get("/health")
async def health():
    _load_knowledge()
    return {"status": "ok", "kb_loaded": len(_knowledge) > 0, "kb_topics": len(_knowledge)}
