"""18 维融合层 — 跨模态一致性 · 压力指数 · 时间连贯 · 个性化评分

将文本5维 + 语音5维 + 视觉4维 融合为 18 维完整评估。
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict
import math


@dataclass
class FusionDimension:
    name: str
    score: float
    modality: str       # "text" | "voice" | "visual" | "fusion"
    weight: float
    evidence: str


@dataclass
class FusionResult:
    """18 维融合结果"""
    dimensions: List[FusionDimension]       # 全部 18 维
    overall_score: float                     # 综合分
    modality_scores: Dict[str, float]        # 各模态独立分
    pressure_index: float                    # 综合压力指数 0-1
    consistency_score: float                 # 跨模态一致性 0-100
    summary: str                             # 总体评价
    recommendations: List[str]               # 学习建议


# ============================================================
# 融合维度 1：跨模态一致性
# ============================================================

def compute_consistency(text_score: float, voice_score: float, visual_score: float) -> float:
    """
    跨模态一致性 — 文本/语音/视觉三者评分是否一致。
    如果语音积极但文本空洞（不一致），分数低。
    """
    scores = [text_score, voice_score, visual_score]
    active = [s for s in scores if s > 0]

    if len(active) < 2:
        return 60  # 只有单个模态时默认中等

    mean_score = sum(active) / len(active)
    # 变异系数（越低越一致）
    variance = sum((s - mean_score) ** 2 for s in active) / len(active)
    cv = math.sqrt(variance) / max(mean_score, 1)

    if cv < 0.15:
        return 85   # 高度一致
    elif cv < 0.3:
        return 65   # 基本一致
    elif cv < 0.45:
        return 40   # 有偏差
    else:
        return 25   # 严重不一致

    evidence = f"各模态评分{'一致' if cv < 0.3 else '存在偏差'}"
    return evidence


# ============================================================
# 融合维度 2：压力评估
# ============================================================

def compute_pressure_index(
    text_score: float,
    voice_score: float,
    visual_score: float,
    agent_pressure: float = 0.0,
) -> float:
    """
    综合压力指数 — 融合多模态压力信号。
    - 文本低分 → 内容压力
    - 语音低分 → 表达压力
    - 视觉低分 → 形象压力
    """
    # 各模态压力贡献
    text_stress = max(0, (60 - text_score) / 60) * 0.35
    voice_stress = max(0, (60 - voice_score) / 60) * 0.35
    visual_stress = max(0, (60 - visual_score) / 60) * 0.15
    agent_stress = agent_pressure * 0.15

    return round(min(1.0, text_stress + voice_stress + visual_stress + agent_stress), 2)


# ============================================================
# 融合维度 3：时间连贯性
# ============================================================

def compute_temporal_coherence(history_overalls: List[float]) -> tuple:
    """
    时间连贯性 — 多轮表现是否稳定。
    返回 (score, evidence)
    """
    if len(history_overalls) < 2:
        return 60, "轮次不足，无法评估连贯性"

    mean_val = sum(history_overalls) / len(history_overalls)
    variance = sum((s - mean_val) ** 2 for s in history_overalls) / len(history_overalls)
    std = math.sqrt(variance)

    if std < 8:
        score = 85
        evidence = "多轮表现稳定，水平一致"
    elif std < 15:
        score = 65
        evidence = "表现略有波动，整体可控"
    elif std < 25:
        score = 45
        evidence = "表现起伏较大"
    else:
        score = 25
        evidence = "表现极不稳定，波动剧烈"

    return score, evidence


# ============================================================
# 融合维度 4：个性化评分（加权调整）
# ============================================================

def compute_personalized_score(
    base_overall: float,
    consistency: float,
    pressure: float,
    temporal_score: float,
) -> float:
    """
    个性化综合分 — 在基础分上做加权调整。
    - 一致性高 → 加分
    - 压力高 → 减分
    - 连贯性好 → 加分
    """
    adjustment = 0
    if consistency > 70:
        adjustment += 5
    if pressure > 0.5:
        adjustment -= 5
    if temporal_score > 70:
        adjustment += 3

    return round(max(0, min(100, base_overall + adjustment)), 1)


# ============================================================
# 学习建议生成
# ============================================================

def generate_recommendations(dimensions: List[FusionDimension]) -> List[str]:
    """根据 18 维评分生成个性化学习建议"""
    recs = []
    weak_dims = [d for d in dimensions if d.score < 50]

    for d in weak_dims[:5]:
        if d.name == "关键词覆盖":
            recs.append("建议系统梳理岗位相关的核心知识点，扩展专业术语储备")
        elif d.name == "结构逻辑":
            recs.append("练习用STAR法则组织回答：情境→任务→行动→结果")
        elif d.name == "术语准确":
            recs.append("深入学习核心技术的底层原理，避免停留在表面理解")
        elif d.name == "简历匹配":
            recs.append("确保回答中的技能点与简历描述一致，避免矛盾")
        elif d.name == "信息密度":
            recs.append("回答中多用具体数据和案例，减少空泛描述")
        elif d.name == "语速节奏":
            recs.append("练习控制语速，可以用录音回放来调整节奏")
        elif d.name == "停顿卡壳":
            recs.append("提前准备常见问题的回答框架，减少临场卡顿")
        elif d.name == "语调情感":
            recs.append("适度增加语调起伏，让表达更有感染力")
        elif d.name == "流利重复":
            recs.append("减少口头禅和重复，可以录像回看自我纠正")
        elif d.name == "音量清晰":
            recs.append("注意麦克风距离和说话音量，确保清晰可闻")
        elif d.name == "眼神注意":
            recs.append("练习面试时注视镜头（模拟眼神交流），提升自信感")
        elif d.name == "面部表情":
            recs.append("适度增加自然微笑，让表情更亲和")
        elif d.name == "头部手势":
            recs.append("保持头部稳定，减少不必要的晃动和手势")
        elif d.name == "形象背景":
            recs.append("选择整洁的背景和充足的光线，保证画面清晰")

    if not recs:
        recs.append("各项表现均衡，继续保持当前的面试状态")

    return recs


# ============================================================
# 融合入口
# ============================================================

async def fuse_analysis(
    text_dims: list,        # List[{name, score, evidence}]
    voice_dims: list,       # List[{name, score, evidence}]
    visual_dims: list,      # List[{name, score, evidence}]
    text_overall: float,
    voice_overall: float,
    visual_overall: float,
    agent_pressure: float = 0.0,
    history_overalls: List[float] = None,
) -> FusionResult:
    """
    将三模态分析结果融合为 18 维完整评估。
    """

    if history_overalls is None:
        history_overalls = []

    # 合并原始维度（文本5 + 语音5 + 视觉4 = 14维）
    all_dims = []

    for d in text_dims:
        all_dims.append(FusionDimension(
            name=d.name, score=d.score, modality="text",
            weight=0.055, evidence=d.evidence,
        ))
    for d in voice_dims:
        all_dims.append(FusionDimension(
            name=d.name, score=d.score, modality="voice",
            weight=0.055, evidence=d.evidence,
        ))
    for d in visual_dims:
        all_dims.append(FusionDimension(
            name=d.name, score=d.score, modality="visual",
            weight=0.055, evidence=d.evidence,
        ))

    # 计算 4 个融合维度
    consistency = compute_consistency(text_overall, voice_overall, visual_overall)
    pressure = compute_pressure_index(text_overall, voice_overall, visual_overall, agent_pressure)
    temporal_score, temporal_evidence = compute_temporal_coherence(history_overalls)

    all_dims.append(FusionDimension(
        name="跨模态一致性", score=round(consistency, 1), modality="fusion",
        weight=0.06, evidence=f"三模态评分{'一致' if consistency >= 65 else '存在偏差'}",
    ))
    all_dims.append(FusionDimension(
        name="压力评估", score=round((1 - pressure) * 100, 1), modality="fusion",
        weight=0.06, evidence=f"综合压力指数{pressure:.0%}" + ("，偏高" if pressure > 0.5 else "，可控"),
    ))
    all_dims.append(FusionDimension(
        name="连贯时间", score=round(temporal_score, 1), modality="fusion",
        weight=0.06, evidence=temporal_evidence,
    ))

    # 个性化综合分
    overall = compute_personalized_score(
        text_overall * 0.4 + voice_overall * 0.3 + visual_overall * 0.3,
        consistency, pressure, temporal_score,
    )
    all_dims.append(FusionDimension(
        name="个性化综合", score=overall, modality="fusion",
        weight=0.06, evidence="基于多模态融合的个性化评分",
    ))

    # 学习建议
    recommendations = generate_recommendations(all_dims)

    # 模态独立分
    modality_scores = {
        "text": text_overall, "voice": voice_overall, "visual": visual_overall,
    }

    # 总结语
    if overall >= 75:
        summary = "整体表现优秀，各项能力均衡"
    elif overall >= 55:
        summary = f"整体表现良好，建议关注薄弱维度"
    else:
        summary = "整体有提升空间，建议针对性练习"

    return FusionResult(
        dimensions=all_dims,
        overall_score=overall,
        modality_scores=modality_scores,
        pressure_index=pressure,
        consistency_score=consistency,
        summary=summary,
        recommendations=recommendations,
    )
