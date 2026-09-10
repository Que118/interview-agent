"""面试报告生成器 — 雷达图数据 · 评语 · 学习建议"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime


@dataclass
class RadarSeries:
    """雷达图数据系列"""
    name: str          # 系列名（如"文本"、"语音"、"视觉"）
    values: List[float]
    labels: List[str]


@dataclass
class ReportSection:
    """报告章节"""
    title: str
    content: str
    score: Optional[float] = None
    items: List[str] = field(default_factory=list)


@dataclass
class InterviewReport:
    """完整面试报告"""
    # 基本信息
    candidate_name: str = "候选人"
    position: str = ""
    date: str = ""
    total_turns: int = 0
    duration_minutes: float = 0.0

    # 总评
    overall_score: float = 0.0
    overall_grade: str = ""
    summary: str = ""

    # 雷达图
    radar: List[RadarSeries] = field(default_factory=list)

    # 分项评估
    sections: List[ReportSection] = field(default_factory=list)

    # 学习建议
    recommendations: List[str] = field(default_factory=list)

    # Agent 决策统计
    decision_stats: Dict[str, int] = field(default_factory=dict)


def grade(score: float) -> str:
    """分数 → 等级"""
    if score >= 85:
        return "优秀"
    elif score >= 70:
        return "良好"
    elif score >= 55:
        return "中等"
    elif score >= 40:
        return "待提升"
    else:
        return "需加强"


async def generate_report(
    position: str,
    total_turns: int,
    text_overall: float,
    voice_overall: float,
    visual_overall: float,
    fusion_result,
    decision_stats: Dict[str, int],
    duration_minutes: float = 0.0,
) -> InterviewReport:
    """生成完整面试报告"""

    # 雷达图数据
    text_labels = ["关键词覆盖", "结构逻辑", "术语准确", "简历匹配", "信息密度"]
    voice_labels = ["语速节奏", "停顿卡壳", "语调情感", "流利重复", "音量清晰"]
    visual_labels = ["眼神注意", "面部表情", "头部手势", "形象背景"]

    text_dims = [d for d in fusion_result.dimensions if d.modality == "text"]
    voice_dims = [d for d in fusion_result.dimensions if d.modality == "voice"]
    visual_dims = [d for d in fusion_result.dimensions if d.modality == "visual"]

    radar = [
        RadarSeries(
            name="文本分析",
            labels=text_labels,
            values=[next((d.score for d in text_dims if d.name == n), 50) for n in text_labels],
        ),
        RadarSeries(
            name="语音分析",
            labels=voice_labels,
            values=[next((d.score for d in voice_dims if d.name == n), 50) for n in voice_labels],
        ),
        RadarSeries(
            name="视觉分析",
            labels=visual_labels,
            values=[next((d.score for d in visual_dims if d.name == n), 50) for n in visual_labels],
        ),
    ]

    # 分项评估
    sections = []

    # 综合表现
    sections.append(ReportSection(
        title="综合表现",
        score=fusion_result.overall_score,
        content=f"等级：{grade(fusion_result.overall_score)} | "
                f"文本{text_overall:.0f}分 | 语音{voice_overall:.0f}分 | 视觉{visual_overall:.0f}分",
    ))

    # 文本分析
    text_section = ReportSection(title="文本能力", score=text_overall, content="")
    for d in text_dims:
        text_section.items.append(f"{d.name}：{d.score:.0f}分 — {d.evidence}")
    sections.append(text_section)

    # 语音分析
    voice_section = ReportSection(title="语言表达", score=voice_overall, content="")
    for d in voice_dims:
        voice_section.items.append(f"{d.name}：{d.score:.0f}分 — {d.evidence}")
    sections.append(voice_section)

    # 视觉分析
    visual_section = ReportSection(title="形象礼仪", score=visual_overall, content="")
    for d in visual_dims:
        visual_section.items.append(f"{d.name}：{d.score:.0f}分 — {d.evidence}")
    sections.append(visual_section)

    # 融合维度
    fusion_dims = [d for d in fusion_result.dimensions if d.modality == "fusion"]
    fusion_section = ReportSection(title="综合分析", score=fusion_result.overall_score, content="")
    for d in fusion_dims:
        fusion_section.items.append(f"{d.name}：{d.score:.0f}分 — {d.evidence}")
    sections.append(fusion_section)

    # Agent 决策统计
    decision_section = ReportSection(title="面试过程", content="")
    decision_section.items.append(f"总轮次：{total_turns}轮")
    decision_section.items.append(f"预估时长：{duration_minutes:.0f}分钟")
    for dec, count in decision_stats.items():
        decision_section.items.append(f"· {dec}：{count}次")
    sections.append(decision_section)

    return InterviewReport(
        position=position,
        date=datetime.now().strftime("%Y-%m-%d %H:%M"),
        total_turns=total_turns,
        duration_minutes=duration_minutes,
        overall_score=fusion_result.overall_score,
        overall_grade=grade(fusion_result.overall_score),
        summary=fusion_result.summary,
        radar=radar,
        sections=sections,
        recommendations=fusion_result.recommendations,
        decision_stats=decision_stats,
    )
