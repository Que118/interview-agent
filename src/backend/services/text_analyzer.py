"""文本 5 维分析管道 — 关键词覆盖 · 结构逻辑 · 术语准确 · 简历匹配 · 信息密度"""

import re
import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class TextDimension:
    name: str
    score: float
    weight: float
    evidence: str
    details: dict = field(default_factory=dict)


@dataclass
class TextAnalysisResult:
    dimensions: List[TextDimension]
    overall_score: float
    summary: str


# ============================================================
# 岗位关键词库
# ============================================================

KEYWORD_BANK: Dict[str, List[str]] = {
    "前端开发工程师": [
        "HTML", "CSS", "JavaScript", "TypeScript", "React", "Vue", "Angular",
        "虚拟DOM", "组件化", "状态管理", "Redux", "响应式", "Webpack", "Vite",
        "性能优化", "首屏加载", "懒加载", "缓存策略", "CDN", "SEO",
        "跨域", "CORS", "RESTful", "GraphQL", "Promise", "async/await",
        "闭包", "原型链", "事件循环", "ES6", "Flexbox", "Grid", "BFC",
    ],
    "后端开发工程师": [
        "数据库", "索引", "SQL", "NoSQL", "Redis", "缓存", "消息队列",
        "微服务", "分布式", "CAP", "一致性", "高可用", "负载均衡",
        "API", "RESTful", "gRPC", "Docker", "Kubernetes", "CI/CD",
        "设计模式", "SOLID", "DDD", "并发", "线程池", "锁", "事务",
        "JWT", "OAuth", "日志", "监控", "熔断", "降级", "限流",
    ],
    "数据分析师": [
        "SQL", "Python", "Pandas", "NumPy", "数据清洗", "特征工程",
        "假设检验", "p值", "置信区间", "A/B测试", "回归分析", "分类",
        "聚类", "时间序列", "可视化", "Tableau", "PowerBI", "ETL",
        "数据仓库", "数据湖", "维度建模", "指标体系", "漏斗分析",
    ],
    "产品经理": [
        "用户需求", "需求分析", "PRD", "用户故事", "敏捷开发", "Scrum",
        "MVP", "产品路线图", "竞品分析", "用户调研", "可用性测试",
        "数据分析", "转化率", "留存率", "DAU", "AARRR", "北极星指标",
        "迭代", "优先级", "需求池", "原型", "交互设计",
    ],
    "UI/UX 设计师": [
        "设计系统", "组件化", "Design Token", "Figma", "Sketch",
        "用户研究", "可用性", "信息架构", "交互原型", "视觉层级",
        "色彩理论", "排版", "网格系统", "响应式设计", "无障碍",
        "移动端规范", "触控区域", "Material Design", "Human Interface",
    ],
}


# ============================================================
# 维度 1：关键词覆盖
# ============================================================

def analyze_keyword_coverage(text: str, position: str) -> TextDimension:
    if text is None:
        text = ""
    if position is None:
        position = ""
    keywords = KEYWORD_BANK.get(position, KEYWORD_BANK.get("前端开发工程师", []))
    if not keywords:
        return TextDimension(
            name="关键词覆盖", score=50, weight=0.25,
            evidence="暂无该岗位关键词库", details={"hit": 0, "total": 0},
        )

    text_lower = text.lower()
    hit_keywords = [kw for kw in keywords if kw.lower() in text_lower]

    hit_rate = len(hit_keywords) / len(keywords)
    # 非线性评分：面试单题无需覆盖全部关键词，命中即得分
    score = round(min(100, len(hit_keywords) * 14 + 18), 1)

    if len(hit_keywords) <= 3:
        evidence = f"命中 {len(hit_keywords)}/{len(keywords)} 个关键词，覆盖偏低"
    elif len(hit_keywords) <= 8:
        evidence = f"命中 {len(hit_keywords)}/{len(keywords)} 个关键词，覆盖适中"
    else:
        evidence = f"命中 {len(hit_keywords)}/{len(keywords)} 个关键词，覆盖较好"

    return TextDimension(
        name="关键词覆盖", score=min(score, 100), weight=0.25,
        evidence=evidence,
        details={"hit": len(hit_keywords), "total": len(keywords), "matched": hit_keywords[:8]},
    )


# ============================================================
# 维度 2：结构逻辑
# ============================================================

def analyze_structure(text: str) -> TextDimension:
    if text is None:
        text = ""
    signals = {
        "序号": bool(re.search(r'[1一①]\.|[（(][1一①][）)]|首先|然后|最后|第[一二三]', text)),
        "总分": bool(re.search(r'(总之|综上|所以|因此|概括|总结)', text)),
        "因果": bool(re.search(r'(因为|所以|由于|导致|因此|从而)', text)),
        "并列": bool(re.search(r'(同时|另外|此外|还有|以及|并且)', text)),
        "对比": bool(re.search(r'(但是|然而|相比|不同|区别|优势|劣势)', text)),
    }

    signal_count = sum(signals.values())
    total = len(signals)

    if signal_count == 0:
        score = 38
        evidence = "未检测到结构化表达信号"
    elif signal_count <= 2:
        score = 50
        evidence = f"检测到 {signal_count}/{total} 类结构信号，逻辑较弱"
    else:
        score = 70 + (signal_count - 2) * 10
        evidence = f"检测到 {signal_count}/{total} 类结构信号，逻辑较清晰"

    sentences = re.split(r'[。！？，\n]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 3]
    # 温和句数惩罚：仅对较长但无分句的文本打折
    tlen = len((text or "").strip())
    if len(sentences) < 2 and tlen > 100:
        score = max(score * 0.75, 25)
    elif len(sentences) == 0:
        score = max(score * 0.6, 15)

    return TextDimension(
        name="结构逻辑", score=min(round(score, 1), 100), weight=0.20,
        evidence=evidence,
        details={"signals": signals, "sentence_count": len(sentences)},
    )

# ============================================================
# 维度 3：术语准确
# ============================================================

def analyze_terminology(text: str, position: str) -> TextDimension:
    if text is None:
        text = ""
    if position is None:
        position = ""
    keywords = KEYWORD_BANK.get(position, [])
    text_lower = text.lower()

    high_value = [kw for kw in keywords if len(kw) > 2 and kw.lower() in text_lower]
    basic = [kw for kw in keywords if len(kw) <= 2 and kw.lower() in text_lower]

    term_score = len(high_value) * 12 + len(basic) * 5
    score = min(term_score, 100)

    if score < 30:
        evidence = "专业术语使用较少"
    elif score < 60:
        evidence = f"使用了 {len(high_value)} 个专业术语，准确性一般"
    else:
        evidence = f"使用了 {len(high_value)} 个专业术语，术语准确"

    return TextDimension(
        name="术语准确", score=round(score, 1), weight=0.20,
        evidence=evidence,
        details={"high_value_terms": high_value[:8], "basic_terms": basic[:8]},
    )


# ============================================================
# 维度 4：简历匹配（jieba 懒加载，简历为空时跳过）
# ============================================================

def analyze_resume_match(text: str, resume_text: str = "") -> TextDimension:
    if text is None:
        text = ""
    if resume_text is None:
        resume_text = ""
    if not resume_text:
        return TextDimension(
            name="简历匹配", score=50, weight=0.15,
            evidence="未提供简历文本，暂用默认评分",
            details={"resume_available": False},
        )

    try:
        import jieba  # 懒加载
        text_words = set(jieba.lcut(text))
        resume_words = set(jieba.lcut(resume_text))
    except ImportError:
        # jieba 未安装时的降级：按字符匹配
        text_words = set(text)
        resume_words = set(resume_text)

    if not text_words or not resume_words:
        score = 50
    else:
        overlap = text_words & resume_words
        score = round(len(overlap) / max(len(text_words | resume_words), 1) * 100, 1)

    return TextDimension(
        name="简历匹配", score=min(score, 100), weight=0.15,
        evidence=f"回答与简历词汇重叠度 {score:.0f}%",
        details={"resume_available": True, "overlap_ratio": score},
    )


# ============================================================
# 维度 5：信息密度
# ============================================================

def analyze_information_density(text: str) -> TextDimension:
    if text is None:
        text = ""
    text_clean = re.sub(r'\s+', '', text)
    if len(text_clean) == 0:
        return TextDimension(
            name="信息密度", score=10, weight=0.20,
            evidence="回答为空", details={},
        )

    entities = re.findall(r'[A-Z][a-z]+|[A-Z]{2,}|\d+\.?\d*|[一-龥]{2,}', text_clean)
    entity_density = len(entities) / max(len(text_clean), 1) * 100

    # 中文内容比例检测
    chinese_chars = [c for c in text_clean if '\u4e00' <= c <= '\u9fff']
    chinese_ratio = len(chinese_chars) / max(len(text_clean), 1)

    stopwords = set('的了吗呢吧啊嗯哦就是这也和与及或但而所以因为如果虽然然后')
    stop_count = sum(1 for c in chinese_chars if c in stopwords)
    stop_ratio = stop_count / max(len(chinese_chars), 1)

    density_score = min(entity_density * 8, 60)
    clarity_bonus = (1 - stop_ratio) * 40
    score = density_score + clarity_bonus

    # 非中文内容惩罚：中文占比低于20%时线性打折
    if chinese_ratio < 0.2:
        score = score * max(chinese_ratio / 0.2, 0.1)

    if score < 30:
        evidence = "信息密度偏低，回答较为空泛"
    elif score < 60:
        evidence = "信息密度适中"
    else:
        evidence = "信息密度较高，回答充实"

    return TextDimension(
        name="信息密度", score=min(round(score, 1), 100), weight=0.20,
        evidence=evidence,
        details={
            "char_count": len(text_clean),
            "entity_count": len(entities),
            "stopword_ratio": round(stop_ratio, 2),
            "chinese_ratio": round(chinese_ratio, 2),
        },
    )


# ============================================================
# 综合分析入口
# ============================================================

async def analyze_text(
    text: str,
    position: str,
    resume_text: str = "",
) -> TextAnalysisResult:
    dims = [
        analyze_keyword_coverage(text, position),
        analyze_structure(text),
        analyze_terminology(text, position),
        analyze_resume_match(text, resume_text),
        analyze_information_density(text),
    ]

    overall = round(sum(d.score * d.weight for d in dims), 1)

    weak_dims = [d.name for d in dims if d.score < 50]
    strong_dims = [d.name for d in dims if d.score >= 70]

    if weak_dims:
        summary = f"弱点：{'、'.join(weak_dims)}；建议深挖或给提示"
    elif strong_dims and overall >= 70:
        summary = f"表现良好：{'、'.join(strong_dims)} 得分较高；可转话题或结束"
    else:
        summary = "各项表现均衡"

    return TextAnalysisResult(
        dimensions=dims, overall_score=overall, summary=summary,
    )
