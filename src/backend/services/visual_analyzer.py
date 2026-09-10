"""视觉 4 维分析管道 — 眼神注意 · 面部表情 · 头部手势 · 形象背景

接收 MediaPipe 提取的面部特征数据（浏览器端运行），在服务端评分。
零外部依赖，纯 Python 标准库实现。
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict
import math


@dataclass
class VisualDimension:
    name: str
    score: float      # 0–100
    weight: float
    evidence: str
    details: dict = field(default_factory=dict)


@dataclass
class FaceData:
    """MediaPipe 提取的面部数据"""
    # 眼睛
    left_eye_open: float = 0.9     # 0–1，左眼开合度
    right_eye_open: float = 0.9    # 0–1，右眼开合度
    eye_blink_rate: float = 15.0   # 次/分钟
    
    # 视线方向
    gaze_x: float = 0.0            # -1(左) ~ 1(右)
    gaze_y: float = 0.0            # -1(下) ~ 1(上)
    gaze_stability: float = 0.8    # 0–1，视线稳定性
    
    # 头部姿态（欧拉角，度）
    head_yaw: float = 0.0          # 左右转
    head_pitch: float = 0.0        # 上下点
    head_roll: float = 0.0         # 歪头
    head_movement: float = 0.1     # 头部运动幅度 0–1
    
    # 表情
    smile_ratio: float = 0.3       # 0–1，微笑程度
    expression_variance: float = 0.4  # 0–1，表情变化度
    
    # 整体
    face_present: bool = True      # 是否检测到人脸
    face_confidence: float = 0.95  # 检测置信度
    duration_seconds: float = 0.0


@dataclass
class VisualAnalysisResult:
    dimensions: List[VisualDimension]
    overall_score: float
    summary: str


# ============================================================
# 维度 1：眼神注意（Eye Gaze & Attention）
# ============================================================

def analyze_eye_gaze(data: FaceData) -> VisualDimension:
    """眼神注意 — 是否注视镜头、眨眼频率"""
    if not data.face_present:
        return VisualDimension(name="眼神注意", score=30, weight=0.30,
                               evidence="未检测到人脸", details={})

    eye_open = (data.left_eye_open + data.right_eye_open) / 2

    # 视线偏移量（越接近0越正视）
    gaze_offset = math.sqrt(data.gaze_x ** 2 + data.gaze_y ** 2)

    # 评分
    eye_score = max(0, min(100, eye_open * 100))  # 眼睛开合度
    gaze_score = max(0, 100 - gaze_offset * 60)    # 视线正中
    stability_score = data.gaze_stability * 100    # 稳定性

    # 眨眼频率（正常15-20次/分钟，过高可能是紧张）
    blink = data.eye_blink_rate
    if 12 <= blink <= 22:
        blink_score = 85
    elif 8 <= blink <= 30:
        blink_score = 60
    else:
        blink_score = 35

    score = round(eye_score * 0.1 + gaze_score * 0.45 + stability_score * 0.2 + blink_score * 0.25, 1)

    if score < 40:
        evidence = "视线偏移明显或眨眼异常"
    elif score < 65:
        evidence = "眼神基本自然，偶有偏移"
    else:
        evidence = "眼神专注，注视镜头稳定"

    return VisualDimension(
        name="眼神注意", score=min(score, 100), weight=0.30,
        evidence=evidence,
        details={"eye_open": round(eye_open, 2), "gaze_offset": round(gaze_offset, 2), "blink_rate": blink},
    )


# ============================================================
# 维度 2：面部表情（Facial Expression）
# ============================================================

def analyze_expression(data: FaceData) -> VisualDimension:
    """面部表情 — 微笑程度、表情丰富度"""
    if not data.face_present:
        return VisualDimension(name="面部表情", score=30, weight=0.25,
                               evidence="未检测到人脸", details={})

    # 微笑评分：面试中适度微笑加分
    smile = data.smile_ratio
    if 0.1 <= smile <= 0.6:
        smile_score = 80
    elif smile < 0.05:
        smile_score = 35   # 面无表情
    elif smile > 0.8:
        smile_score = 55   # 过度微笑可能不自然
    else:
        smile_score = 65

    # 表情变化度
    var = data.expression_variance
    if 0.2 <= var <= 0.6:
        var_score = 80
    elif var < 0.1:
        var_score = 30   # 僵硬
    else:
        var_score = 60   # 过于丰富

    score = round(smile_score * 0.5 + var_score * 0.5, 1)

    if score < 40:
        evidence = "表情较为僵硬，缺乏变化"
    elif score < 65:
        evidence = "表情基本自然"
    else:
        evidence = "表情自然丰富，亲和力好"

    return VisualDimension(
        name="面部表情", score=min(score, 100), weight=0.25,
        evidence=evidence,
        details={"smile": round(smile, 2), "variance": round(var, 2)},
    )


# ============================================================
# 维度 3：头部手势（Head & Gesture）
# ============================================================

def analyze_head_gesture(data: FaceData) -> VisualDimension:
    """头部手势 — 点头、头部稳定性"""
    if not data.face_present:
        return VisualDimension(name="头部手势", score=30, weight=0.25,
                               evidence="未检测到人脸", details={})

    # 头部偏移总量
    head_offset = math.sqrt(data.head_yaw ** 2 + data.head_pitch ** 2 + data.head_roll ** 2)

    # 头部稳定性
    movement = data.head_movement
    if movement < 0.15:
        stability_score = 85    # 非常稳定
    elif movement < 0.3:
        stability_score = 65    # 偶尔晃动
    elif movement < 0.5:
        stability_score = 45    # 频繁晃动
    else:
        stability_score = 25    # 极不稳定

    # 头部偏角（正视最佳）
    if head_offset < 10:
        pose_score = 85
    elif head_offset < 25:
        pose_score = 60
    else:
        pose_score = 35

    score = round(stability_score * 0.6 + pose_score * 0.4, 1)

    if score < 40:
        evidence = "头部晃动较多或偏角明显"
    elif score < 65:
        evidence = "头部姿态基本端正"
    else:
        evidence = "头部稳定，姿态端正"

    return VisualDimension(
        name="头部手势", score=min(score, 100), weight=0.25,
        evidence=evidence,
        details={"head_offset": round(head_offset, 1), "movement": round(movement, 2)},
    )


# ============================================================
# 维度 4：形象背景（Appearance & Background）
# ============================================================

def analyze_appearance(data: FaceData, background_data: Optional[Dict] = None) -> VisualDimension:
    """形象背景 — 面部置信度、检测稳定性"""
    if not data.face_present:
        return VisualDimension(name="形象背景", score=30, weight=0.20,
                               evidence="未检测到人脸", details={})

    # 人脸检测置信度
    conf = data.face_confidence
    if conf > 0.9:
        conf_score = 90
    elif conf > 0.7:
        conf_score = 65
    else:
        conf_score = 35

    # 背景信息（由前端提供）
    bg_score = 60  # 默认
    if background_data:
        brightness = background_data.get("brightness", 0.5)
        if 0.3 <= brightness <= 0.8:
            bg_score = 80
        else:
            bg_score = 45

    score = round(conf_score * 0.6 + bg_score * 0.4, 1)

    if score < 50:
        evidence = "画面质量偏低或面部检测不稳定"
    elif score < 75:
        evidence = "画面基本清晰"
    else:
        evidence = "画面清晰，形象良好"

    return VisualDimension(
        name="形象背景", score=min(score, 100), weight=0.20,
        evidence=evidence,
        details={"confidence": round(conf, 2)},
    )


# ============================================================
# 综合分析入口
# ============================================================

async def analyze_visual(
    face_data: Optional[FaceData] = None,
    background_data: Optional[Dict] = None,
) -> VisualAnalysisResult:
    """
    对面部数据进行 4 维分析。

    参数:
        face_data: MediaPipe 提取的面部特征
        background_data: 背景/光照信息（可选）
    """
    if face_data is None:
        # 无面部数据 → 默认评分
        dims = [
            VisualDimension(name="眼神注意", score=50, weight=0.30, evidence="无面部数据"),
            VisualDimension(name="面部表情", score=50, weight=0.25, evidence="无面部数据"),
            VisualDimension(name="头部手势", score=50, weight=0.25, evidence="无面部数据"),
            VisualDimension(name="形象背景", score=50, weight=0.20, evidence="无面部数据"),
        ]
        return VisualAnalysisResult(dimensions=dims, overall_score=50, summary="无视觉数据")

    dims = [
        analyze_eye_gaze(face_data),
        analyze_expression(face_data),
        analyze_head_gesture(face_data),
        analyze_appearance(face_data, background_data),
    ]

    overall = round(sum(d.score * d.weight for d in dims), 1)

    weak = [d.name for d in dims if d.score < 50]
    strong = [d.name for d in dims if d.score >= 70]

    if weak:
        summary = f"视觉弱点：{'、'.join(weak)}"
    elif strong and overall >= 70:
        summary = f"视觉表现良好：{'、'.join(strong)}"
    else:
        summary = "视觉各项表现均衡"

    return VisualAnalysisResult(dimensions=dims, overall_score=overall, summary=summary)
