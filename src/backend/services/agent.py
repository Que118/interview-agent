"""Agent 决策核心 — 面试状态机（LangGraph 风格，纯 Python 实现）"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Callable, Awaitable
from enum import Enum
import asyncio


# ============================================================
# 状态定义
# ============================================================

class AgentDecision(str, Enum):
    DEEP_DIVE = "深挖弱点"
    SWITCH_TOPIC = "转话题"
    GIVE_HINT = "给提示"
    END = "结束"
    GREETING = "开场"


@dataclass
class DimensionSnapshot:
    """维度评分快照"""
    name: str
    score: float
    evidence: str


@dataclass
class TurnRecord:
    """单轮对话记录"""
    turn: int
    user_text: str
    assistant_text: str
    decision: AgentDecision
    analysis: Optional[List[DimensionSnapshot]] = None
    overall_score: float = 0.0
    summary: str = ""


@dataclass
class InterviewState:
    """面试会话完整状态"""
    session_id: str
    position: str
    turn: int = 0
    history: List[TurnRecord] = field(default_factory=list)

    # 知识库检索缓存（当前轮次相关知识点）
    knowledge_context: List[str] = field(default_factory=list)

    # 追踪
    weakness_hits: Dict[str, int] = field(default_factory=dict)  # 维度名 → 连续弱点次数
    topic_coverage: List[str] = field(default_factory=list)      # 已覆盖的话题
    pressure_level: float = 0.0                                   # 压力指数 0-1

    # 当前轮次
    current_user_text: str = ""
    current_analysis: Optional[List[DimensionSnapshot]] = None
    current_decision: AgentDecision = AgentDecision.GREETING
    current_reply: str = ""

    def is_first_turn(self) -> bool:
        return self.turn <= 1

    def should_end(self) -> bool:
        return self.turn >= 10 or self.decision_count(AgentDecision.END) > 0

    def decision_count(self, decision: AgentDecision) -> int:
        return sum(1 for r in self.history if r.decision == decision)


# ============================================================
# 决策策略（可插拔）
# ============================================================

class DecisionStrategy:
    """Agent 决策策略 — 根据状态决定下一步"""

    @staticmethod
    def decide(state: InterviewState, analysis: List[DimensionSnapshot], overall: float) -> AgentDecision:
        weak_count = sum(1 for d in analysis if d.score < 50)
        strong_count = sum(1 for d in analysis if d.score >= 70)

        # 规则 0：已标记结束
        if state.should_end():
            return AgentDecision.END

        # 规则 0.5：首轮开场 — 最高优先级，其他规则不适用
        if state.is_first_turn():
            return AgentDecision.GREETING

        # 规则 1：轮次上限
        if state.turn >= 12:
            return AgentDecision.END

        # 规则 2：连续压力检测 — 如果连续 3 轮分数 < 35，结束面试（避免候选人崩溃）
        recent_overalls = [r.overall_score for r in state.history[-3:] if r.overall_score > 0]
        if len(recent_overalls) >= 3 and all(s < 35 for s in recent_overalls):
            return AgentDecision.END

        # 规则 3：超低分 — 给提示，不给压力
        if overall < 35:
            return AgentDecision.GIVE_HINT

        # 规则 4：多弱点但总分数尚可 — 转话题换方向
        if weak_count >= 3 and overall >= 45:
            return AgentDecision.SWITCH_TOPIC

        # 规则 4b：多弱点且低分 — 给提示而非转话题
        if weak_count >= 3 and overall < 45:
            return AgentDecision.GIVE_HINT

        # 规则 5：有弱点但非极端 — 深挖
        if weak_count >= 2:
            return AgentDecision.DEEP_DIVE

        # 规则 6：表现优秀 — 转话题扩大考察面
        if overall >= 70 and strong_count >= 3:
            return AgentDecision.SWITCH_TOPIC

        # 规则 7：中等偏下 — 可给提示
        if overall < 48:
            return AgentDecision.GIVE_HINT

        # 默认：深挖
        return AgentDecision.DEEP_DIVE


# ============================================================
# 知识检索器（模拟 — 后续接 ChromaDB）
# ============================================================

class KnowledgeRetriever:
    """
    知识库检索 — 当前为内存实现，后续替换为 ChromaDB。
    根据 Agent 决策和当前分析结果，检索相关知识点。
    """

    def __init__(self, knowledge_path: str = ""):
        self._cache: Dict[str, List[str]] = {}
        self._knowledge: Dict[str, List[str]] = {}  # topic → [knowledge items]

    def load_knowledge(self, knowledge: Dict[str, List[str]]):
        """加载知识库"""
        self._knowledge = knowledge

    async def retrieve(
        self, state: InterviewState, analysis: List[DimensionSnapshot]
    ) -> List[str]:
        """
        根据当前状态检索相关知识。
        决策为 DEEP_DIVE → 检索弱点维度相关知识
        决策为 SWITCH_TOPIC → 检索未覆盖话题
        其他 → 返回空
        """
        decision = state.current_decision
        results = []

        if decision == AgentDecision.DEEP_DIVE:
            # 找到最弱的维度，检索相关知识点
            weak_dims = sorted(analysis, key=lambda d: d.score)[:2]
            for dim in weak_dims:
                topic = f"{state.position}_{dim.name}"
                items = self._knowledge.get(topic, [])
                results.extend(items[:3])  # 最多取3条

        elif decision == AgentDecision.SWITCH_TOPIC:
            # 找一个未覆盖的话题
            all_topics = [
                k for k in self._knowledge
                if k.startswith(state.position + "_") and k not in state.topic_coverage
            ]
            if all_topics:
                topic = all_topics[len(state.topic_coverage) % len(all_topics)]
                results = self._knowledge.get(topic, [])[:2]
                state.topic_coverage.append(topic)

        elif decision == AgentDecision.GIVE_HINT:
            # 给提示时检索基础知识
            basic_topic = f"{state.position}_基础概念"
            results = self._knowledge.get(basic_topic, [])[:2]

        state.knowledge_context = results
        return results


# ============================================================
# Agent 执行器（编排节点流程）
# ============================================================

class InterviewAgent:
    """
    面试 Agent 执行器。
    编排 分析 → 决策 → 检索 → 生成 的完整流程。
    """

    def __init__(self):
        self.strategy = DecisionStrategy()
        self.retriever = KnowledgeRetriever()
        self._states: Dict[str, InterviewState] = {}

    def get_or_create_state(self, session_id: str, position: str) -> InterviewState:
        if session_id not in self._states:
            self._states[session_id] = InterviewState(
                session_id=session_id,
                position=position,
            )
        return self._states[session_id]

    def reset_state(self, session_id: str):
        self._states.pop(session_id, None)

    async def process_turn(
        self,
        session_id: str,
        position: str,
        user_text: str,
        analysis: List[DimensionSnapshot],
        overall_score: float,
        analysis_summary: str,
        llm_generate: Callable[..., Awaitable[str]],
    ) -> dict:
        """
        处理一轮面试。

        参数:
            session_id: 会话ID
            position: 岗位
            user_text: 用户回答
            analysis: 文本5维分析结果
            overall_score: 综合分
            analysis_summary: 分析摘要
            llm_generate: LLM 生成函数 async (state, knowledge) -> str

        返回:
            {decision, reply, state_summary}
        """
        state = self.get_or_create_state(session_id, position)
        state.turn += 1
        state.current_user_text = user_text
        state.current_analysis = analysis

        # 节点 1：决策
        decision = self.strategy.decide(state, analysis, overall_score)
        state.current_decision = decision

        # 更新压力指数
        if overall_score < 40:
            state.pressure_level = min(1.0, state.pressure_level + 0.15)
        else:
            state.pressure_level = max(0.0, state.pressure_level - 0.05)

        # 跟踪弱点命中
        for dim in analysis:
            if dim.score < 50:
                state.weakness_hits[dim.name] = state.weakness_hits.get(dim.name, 0) + 1

        # 节点 2：知识检索
        knowledge = await self.retriever.retrieve(state, analysis)

        # 节点 3：LLM 生成回复
        reply = await llm_generate(state, knowledge)

        # 记录本轮
        record = TurnRecord(
            turn=state.turn,
            user_text=user_text,
            assistant_text=reply,
            decision=decision,
            analysis=analysis,
            overall_score=overall_score,
            summary=analysis_summary,
        )
        state.history.append(record)
        state.current_reply = reply

        return {
            "decision": decision.value,
            "reply": reply,
            "pressure_level": round(state.pressure_level, 2),
            "turn": state.turn,
            "knowledge_used": len(knowledge),
            "state_summary": self._state_summary(state),
        }

    def _state_summary(self, state: InterviewState) -> str:
        """生成状态摘要（调试用）"""
        parts = [f"第{state.turn}轮"]
        if state.weakness_hits:
            top_weak = max(state.weakness_hits, key=state.weakness_hits.get)
            parts.append(f"最大弱点: {top_weak}({state.weakness_hits[top_weak]}次)")
        parts.append(f"压力: {state.pressure_level:.2f}")
        parts.append(f"已覆盖话题: {len(state.topic_coverage)}")
        return " | ".join(parts)


# ============================================================
# 全局单例
# ============================================================

_agent_instance: Optional[InterviewAgent] = None


def get_agent() -> InterviewAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = InterviewAgent()
    return _agent_instance
