"""语音 5 维分析管道 — 语速节奏 · 停顿卡壳 · 语调情感 · 流利重复 · 音量清晰

纯 Python 标准库实现（wave + math + struct），零外部依赖。
Whisper 转录由上游调用方负责，本模块仅分析音频信号。
"""

import wave
import struct
import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


@dataclass
class VoiceDimension:
    name: str
    score: float      # 0–100
    weight: float
    evidence: str
    details: dict = field(default_factory=dict)


@dataclass
class VoiceAnalysisResult:
    dimensions: List[VoiceDimension]
    overall_score: float
    summary: str
    # 原始音频特征
    duration_seconds: float = 0.0
    sample_rate: int = 0
    word_count: int = 0  # 来自转录文本的估算词数


# ============================================================
# 音频加载（WAV 格式）
# ============================================================

def load_wav(filepath: str) -> Tuple[List[float], int]:
    """加载 WAV 文件，返回 (样本列表, 采样率)。仅支持 16-bit PCM 单声道。"""
    with wave.open(filepath, 'rb') as wf:
        n_frames = wf.getnframes()
        sample_rate = wf.getframerate()
        raw = wf.readframes(n_frames)
        fmt = f'<{n_frames}h'  # 16-bit signed little-endian
        samples = struct.unpack(fmt, raw)
        # 归一化到 [-1, 1]
        normalized = [s / 32768.0 for s in samples]
        return normalized, sample_rate


# ============================================================
# 信号处理工具
# ============================================================

def compute_rms(samples: List[float]) -> float:
    """均方根能量"""
    if not samples:
        return 0.0
    return math.sqrt(sum(s * s for s in samples) / len(samples))


def compute_zero_crossing_rate(samples: List[float]) -> float:
    """过零率 — 衡量信号频率特性"""
    if len(samples) < 2:
        return 0.0
    crossings = sum(
        1 for i in range(1, len(samples))
        if samples[i] * samples[i - 1] < 0
    )
    return crossings / (len(samples) - 1)


def segment_speech(samples: List[float], threshold: float = 0.015,
                   min_dur_samples: int = 4000) -> List[Tuple[int, int]]:
    """
    语音活动检测(VAD) — 将音频切分为有声段。
    返回 [(开始索引, 结束索引), ...]
    """
    segments = []
    in_speech = False
    start = 0

    for i, s in enumerate(samples):
        if abs(s) > threshold and not in_speech:
            in_speech = True
            start = i
        elif abs(s) <= threshold and in_speech:
            dur = i - start
            if dur >= min_dur_samples:
                segments.append((start, i))
            in_speech = False

    if in_speech:
        dur = len(samples) - start
        if dur >= min_dur_samples:
            segments.append((start, len(samples)))

    return segments


def compute_pitch_variation(samples: List[float]) -> float:
    """
    估算基频变化 — 用过零率波动近似音高变化。
    将信号分帧，计算每帧过零率的标准差。
    """
    frame_size = min(2048, max(512, len(samples) // 50))
    if len(samples) < frame_size * 2:
        return 0.0

    zcrs = []
    for i in range(0, len(samples) - frame_size, frame_size):
        frame = samples[i:i + frame_size]
        zcr = compute_zero_crossing_rate(frame)
        zcrs.append(zcr)

    if len(zcrs) < 2:
        return 0.0

    mean_zcr = sum(zcrs) / len(zcrs)
    variance = sum((z - mean_zcr) ** 2 for z in zcrs) / len(zcrs)
    return math.sqrt(variance) / max(mean_zcr, 0.001)


# ============================================================
# 维度 1：语速节奏（Speech Rate）
# ============================================================

def analyze_speech_rate(
    samples: List[float], sample_rate: int,
    word_count: int = 0, duration: float = 0.0,
) -> VoiceDimension:
    """
    语速节奏 — 基于有声段密度和词速估算。
    """
    if not samples or sample_rate == 0:
        return VoiceDimension(name="语速节奏", score=50, weight=0.20, evidence="无音频数据")

    segments = segment_speech(samples)
    total_dur = len(samples) / sample_rate if not duration else duration

    if total_dur < 0.5:
        return VoiceDimension(name="语速节奏", score=50, weight=0.20, evidence="音频过短")

    # 有声段占比 → 语速感
    speech_dur = sum((end - start) / sample_rate for start, end in segments)
    speech_ratio = speech_dur / total_dur

    # 词速（如有转录词数）
    if word_count > 0 and total_dur > 0:
        wpm = word_count / total_dur * 60  # 词/分钟
        # 理想范围：中文 180-260 字/分钟
        if 160 <= wpm <= 280:
            speed_score = 85
        elif 120 <= wpm <= 320:
            speed_score = 65
        else:
            speed_score = 40
    else:
        # 仅靠语音活动密度估算
        if 0.3 <= speech_ratio <= 0.7:
            speed_score = 75
        elif 0.15 <= speech_ratio <= 0.85:
            speed_score = 55
        else:
            speed_score = 35
        wpm = 0

    # 平均语段长度 → 节奏
    if segments:
        avg_seg_len = sum(end - start for start, end in segments) / len(segments) / sample_rate
        if 0.5 <= avg_seg_len <= 3.0:
            rhythm_score = 80
        elif 0.2 <= avg_seg_len <= 6.0:
            rhythm_score = 60
        else:
            rhythm_score = 35
    else:
        rhythm_score = 30

    score = round(speed_score * 0.6 + rhythm_score * 0.4, 1)

    if score < 40:
        evidence = "语速偏慢或偏快，节奏欠佳"
    elif score < 65:
        evidence = "语速和节奏基本正常"
    else:
        evidence = "语速适中，节奏流畅"

    return VoiceDimension(
        name="语速节奏", score=min(score, 100), weight=0.20,
        evidence=evidence,
        details={"wpm_estimate": round(wpm), "speech_ratio": round(speech_ratio, 2), "segments": len(segments)},
    )


# ============================================================
# 维度 2：停顿卡壳（Pauses & Stuttering）
# ============================================================

def analyze_pauses(
    samples: List[float], sample_rate: int, duration: float = 0.0,
) -> VoiceDimension:
    """停顿卡壳 — 检测长停顿和犹豫信号。"""
    if not samples or sample_rate == 0:
        return VoiceDimension(name="停顿卡壳", score=50, weight=0.20, evidence="无音频数据")

    total_dur = len(samples) / sample_rate if not duration else duration
    segments = segment_speech(samples)

    if not segments:
        return VoiceDimension(name="停顿卡壳", score=30, weight=0.20, evidence="未检测到有效语音段")

    # 统计段间停顿
    pauses = []
    for i in range(1, len(segments)):
        gap = (segments[i][0] - segments[i - 1][1]) / sample_rate
        pauses.append(gap)

    if not pauses:
        # 只有一个语音段 → 连贯但可能太短
        single_dur = (segments[0][1] - segments[0][0]) / sample_rate
        if single_dur < 5:
            score = 70
            evidence = "回答连贯，无明显停顿"
        else:
            score = 60
            evidence = "单段长回答，无法评估停顿"
    else:
        long_pauses = [p for p in pauses if p > 1.5]  # >1.5秒的停顿
        avg_pause = sum(pauses) / len(pauses)

        if len(long_pauses) <= 1 and avg_pause < 1.0:
            score = 85
            evidence = "停顿自然，表达流畅"
        elif len(long_pauses) <= 3:
            score = 60
            evidence = f"有{len(long_pauses)}次较长停顿，整体可接受"
        elif len(long_pauses) <= 6:
            score = 40
            evidence = f"停顿较多({len(long_pauses)}次)，可能存在卡壳"
        else:
            score = 20
            evidence = f"频繁停顿({len(long_pauses)}次)，表达不流畅"

    return VoiceDimension(
        name="停顿卡壳", score=score, weight=0.20,
        evidence=evidence,
        details={"pause_count": len(pauses), "long_pauses": sum(1 for p in pauses if p > 1.5), "avg_pause": round(sum(pauses)/len(pauses), 2) if pauses else 0},
    )


# ============================================================
# 维度 3：语调情感（Tone & Emotion）
# ============================================================

def analyze_tone(
    samples: List[float], sample_rate: int,
) -> VoiceDimension:
    """语调情感 — 通过音高变化和能量波动估算情感丰富度。"""
    if not samples or sample_rate == 0:
        return VoiceDimension(name="语调情感", score=50, weight=0.20, evidence="无音频数据")

    pitch_var = compute_pitch_variation(samples)

    # 分帧能量变化
    frame_size = sample_rate // 10  # 100ms 帧
    if len(samples) < frame_size * 3:
        return VoiceDimension(name="语调情感", score=50, weight=0.20, evidence="音频过短")

    energies = []
    for i in range(0, len(samples) - frame_size, frame_size):
        frame = samples[i:i + frame_size]
        energies.append(compute_rms(frame))

    if len(energies) < 2:
        return VoiceDimension(name="语调情感", score=50, weight=0.20, evidence="音频过短")

    mean_e = sum(energies) / len(energies)
    e_var = sum((e - mean_e) ** 2 for e in energies) / len(energies)
    energy_cv = math.sqrt(e_var) / max(mean_e, 0.001)  # 能量变异系数

    # 综合评分：音高变化（40%）+ 能量变化（60%）
    pitch_score = min(pitch_var * 80, 80) if pitch_var > 0.01 else 30
    energy_score = min(energy_cv * 40, 80) if energy_cv > 0.05 else 25

    score = round(pitch_score * 0.4 + energy_score * 0.6, 1)

    if score < 35:
        evidence = "语调平淡，缺乏情感起伏"
    elif score < 60:
        evidence = "语调有一定变化，情感表达一般"
    else:
        evidence = "语调丰富，情感表达生动"

    return VoiceDimension(
        name="语调情感", score=min(score, 100), weight=0.20,
        evidence=evidence,
        details={"pitch_var": round(pitch_var, 4), "energy_cv": round(energy_cv, 2)},
    )


# ============================================================
# 维度 4：流利重复（Fluency & Repetition）
# ============================================================

def analyze_fluency(
    samples: List[float], sample_rate: int,
    transcript: str = "",
) -> VoiceDimension:
    """
    流利重复 — 结合音频短段密度和转录文本的重复检测。
    """
    if not samples or sample_rate == 0:
        return VoiceDimension(name="流利重复", score=50, weight=0.20, evidence="无音频数据")

    segments = segment_speech(samples, threshold=0.02, min_dur_samples=4000)

    total_dur = len(samples) / sample_rate
    if total_dur < 1:
        return VoiceDimension(name="流利重复", score=50, weight=0.20, evidence="音频过短")

    # 音频层面：检查是否有大量极短语音段（可能表示重复/卡顿）
    if segments:
        short_segs = [s for s in segments if (s[1] - s[0]) / sample_rate < 0.3]
        seg_density = len(segments) / total_dur
        short_ratio = len(short_segs) / max(len(segments), 1)

        if seg_density < 2 and short_ratio < 0.15:
            audio_score = 85
        elif seg_density < 4 and short_ratio < 0.3:
            audio_score = 65
        else:
            audio_score = 40
    else:
        audio_score = 50

    # 文本层面：检测重复词/短语（如有转录）
    text_score = 50
    if transcript:
        import re
        words = re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+', transcript)
        if len(words) > 5:
            # 检测连续重复
            repeats = sum(1 for i in range(1, len(words)) if words[i] == words[i - 1])
            repeat_ratio = repeats / len(words)
            if repeat_ratio < 0.05:
                text_score = 85
            elif repeat_ratio < 0.15:
                text_score = 60
            else:
                text_score = 30

    score = round(audio_score * 0.5 + text_score * 0.5, 1)

    if score < 40:
        evidence = "存在较多重复或卡顿"
    elif score < 65:
        evidence = "基本流畅，偶有重复"
    else:
        evidence = "表达流畅，无明显重复"

    return VoiceDimension(
        name="流利重复", score=min(score, 100), weight=0.20,
        evidence=evidence,
        details={"segments": len(segments), "text_repeats": 0},
    )


# ============================================================
# 维度 5：音量清晰（Volume & Clarity）
# ============================================================

def analyze_volume(
    samples: List[float], sample_rate: int,
) -> VoiceDimension:
    """音量清晰 — 检测音量适中和信号质量。"""
    if not samples or sample_rate == 0:
        return VoiceDimension(name="音量清晰", score=50, weight=0.20, evidence="无音频数据")

    rms = compute_rms(samples)
    zcr = compute_zero_crossing_rate(samples)

    # RMS → 音量评估（对话场景下 RMS 通常在 0.02-0.15）
    if 0.03 <= rms <= 0.15:
        volume_score = 85
    elif 0.01 <= rms <= 0.25:
        volume_score = 60
    elif rms < 0.005:
        volume_score = 20
        evidence_suffix = "，声音过轻"
    else:
        volume_score = 40

    # 过零率 → 清晰度（适中的 ZCR 表示清晰语音，过高可能噪声）
    if 0.05 <= zcr <= 0.25:
        clarity_score = 80
    elif 0.02 <= zcr <= 0.4:
        clarity_score = 55
    else:
        clarity_score = 30

    score = round(volume_score * 0.5 + clarity_score * 0.5, 1)

    if score < 40:
        evidence = "音量或清晰度偏低"
    elif score < 65:
        evidence = "音量基本适中，清晰度一般"
    else:
        evidence = "音量和清晰度良好"

    return VoiceDimension(
        name="音量清晰", score=min(score, 100), weight=0.20,
        evidence=evidence,
        details={"rms": round(rms, 4), "zcr": round(zcr, 3)},
    )


# ============================================================
# 综合分析入口
# ============================================================

async def analyze_voice(
    samples: Optional[List[float]] = None,
    sample_rate: int = 16000,
    filepath: str = "",
    transcript: str = "",
    word_count: int = 0,
) -> VoiceAnalysisResult:
    """
    对一段语音进行 5 维分析。

    参数:
        samples: 归一化音频样本 [-1, 1]
        sample_rate: 采样率
        filepath: WAV 文件路径（与 samples 二选一）
        transcript: Whisper 转录文本（可选，提升流利/语速分析精度）
        word_count: 转录词数
    """
    # 加载音频
    if filepath and not samples:
        try:
            samples, sample_rate = load_wav(filepath)
        except Exception:
            samples, sample_rate = [], 16000

    duration = len(samples) / sample_rate if samples and sample_rate else 0

    # 估算词数
    if transcript and not word_count:
        import re
        word_count = len(re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+', transcript))

    dims = [
        analyze_speech_rate(samples, sample_rate, word_count, duration),
        analyze_pauses(samples, sample_rate, duration),
        analyze_tone(samples, sample_rate),
        analyze_fluency(samples, sample_rate, transcript),
        analyze_volume(samples, sample_rate),
    ]

    overall = round(sum(d.score * d.weight for d in dims), 1)

    weak_dims = [d.name for d in dims if d.score < 50]
    strong_dims = [d.name for d in dims if d.score >= 70]

    if weak_dims:
        summary = f"语音弱点：{'、'.join(weak_dims)}"
    elif strong_dims and overall >= 70:
        summary = f"语音表现良好：{'、'.join(strong_dims)}"
    else:
        summary = "语音各项表现均衡"

    return VoiceAnalysisResult(
        dimensions=dims, overall_score=overall, summary=summary,
        duration_seconds=duration, sample_rate=sample_rate, word_count=word_count,
    )
