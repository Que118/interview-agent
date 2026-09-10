"use client";

import { useMemo, useState, useCallback } from "react";

const DIM_LABELS: Record<string, string> = {
  "关键词覆盖": "关键词覆盖", "结构逻辑": "结构逻辑", "术语准确": "术语准确",
  "简历匹配": "简历匹配", "信息密度": "信息密度", "语速节奏": "语速节奏",
  "停顿卡壳": "停顿卡壳", "语调情感": "语调情感", "流利重复": "流利重复",
  "音量清晰": "音量清晰", "眼神注意": "眼神注意", "面部表情": "面部表情",
  "头部手势": "头部手势", "形象背景": "形象背景", "内容情感一致": "内容情感一致",
  "综合压力指数": "综合压力指数", "时间连贯性": "时间连贯性", "个性化综合": "个性化综合",
};

const MODALITY_GROUPS: Record<string, { label: string; icon: string; keys: string[]; color: string }> = {
  text: { label: "文本维度", icon: "📝", keys: ["关键词覆盖","结构逻辑","术语准确","简历匹配","信息密度"], color: "#58a6ff" },
  voice: { label: "语音维度", icon: "🎤", keys: ["语速节奏","停顿卡壳","语调情感","流利重复","音量清晰"], color: "#d2991d" },
  visual: { label: "视觉维度", icon: "👁", keys: ["眼神注意","面部表情","头部手势","形象背景"], color: "#3fb950" },
  fusion: { label: "融合维度", icon: "🔄", keys: ["内容情感一致","综合压力指数","时间连贯性","个性化综合"], color: "#d2a8ff" },
};

function getGrade(score: number) {
  if (score >= 4.5) return { label: "卓越", stars: "⭐⭐⭐⭐⭐", color: "#79c0ff" };
  if (score >= 4.0) return { label: "优秀", stars: "⭐⭐⭐⭐", color: "#3fb950" };
  if (score >= 3.0) return { label: "良好", stars: "⭐⭐⭐", color: "#d2991d" };
  if (score >= 2.0) return { label: "一般", stars: "⭐⭐", color: "#f0883e" };
  return { label: "需提升", stars: "⭐", color: "#f85149" };
}

function RadarChart({ dims }: { dims: Record<string, number> }) {
  const groups = Object.values(MODALITY_GROUPS);
  const cx = 120, cy = 120, r = 95;
  const n = groups.length;
  const points = groups.map((g, i) => {
    const avg = g.keys.reduce((s, k) => s + (dims[k] || 0), 0) / Math.max(g.keys.length, 1);
    const val = avg / 5;
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * val, y: cy + Math.sin(angle) * r * val, label: g.label, avg, color: g.color, angle, icon: g.icon };
  });

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[340px] mx-auto">
      {/* Grid circles */}
      {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
        <polygon key={i}
          points={groups.map((_, j) => {
            const angle = (Math.PI * 2 * j) / n - Math.PI / 2;
            return `${cx + Math.cos(angle) * r * scale},${cy + Math.sin(angle) * r * scale}`;
          }).join(" ")}
          fill="none" stroke="#21262d" strokeWidth="0.5"
        />
      ))}
      {/* Axes */}
      {groups.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="#21262d" strokeWidth="0.5" />;
      })}
      {/* Data polygon */}
      <polygon points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(88,166,255,0.15)" stroke="#58a6ff" strokeWidth="1.5" />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={p.color} stroke="#0f1117" strokeWidth="1" />
      ))}
      {/* Labels */}
      {points.map((p, i) => (
        <text key={i} x={cx + Math.cos(p.angle) * (r + 18)} y={cy + Math.sin(p.angle) * (r + 18)} textAnchor="middle" dominantBaseline="middle" fill="#8b949e" fontSize="8" fontFamily="sans-serif">
          {p.icon} {p.avg.toFixed(1)}
        </text>
      ))}
    </svg>
  );
}

function DimBar({ label, score, modality }: { label: string; score: number; modality: string }) {
  const pct = Math.round(score * 20);
  const color = score >= 4 ? "#3fb950" : score >= 3 ? "#d2991d" : "#f85149";
  const stars = score >= 4.5 ? "★★★★★" : score >= 4 ? "★★★★☆" : score >= 3 ? "★★★☆☆" : score >= 2 ? "★★☆☆☆" : "★☆☆☆☆";
  return (
    <div className="flex items-center gap-2 mb-1.5 group cursor-default">
      <span className="text-[10px] text-[#8b949e] w-[72px] text-right shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold w-6 text-right" style={{ color }}>{score.toFixed(1)}</span>
      <span className="text-[8px] text-[#484f58] w-[52px] hidden group-hover:inline">{stars}</span>
    </div>
  );
}

export default function ReportView({ data, onBack, onRetry }: { data: any; onBack: () => void; onRetry: () => void; }) {
  const dims: Record<string, number> = data?.dimensions || {};
  const dimEntries = Object.entries(dims).filter(([k]) => DIM_LABELS[k]) as [string, number][];
  const avgScore = dimEntries.length > 0 ? dimEntries.reduce((s, [, v]) => s + (v as number), 0) / dimEntries.length : 3.5;
  const grade = getGrade(avgScore);
  const percentile = Math.min(99, Math.round(avgScore * 20));

  // Best and worst dimensions
  const sorted = [...dimEntries].sort((a, b) => (b[1] as number) - (a[1] as number));
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  // Dynamic strengths/weaknesses from actual data
  const strengths = top3.map(([k, v]) => `${DIM_LABELS[k] || k} (${(v as number).toFixed(1)}分) — 表现突出`);
  const weaknesses = bottom3.map(([k, v]) => `${DIM_LABELS[k] || k} (${(v as number).toFixed(1)}分) — 需要加强`);

  // Historical comparison
  const prevRecord = useMemo(() => {
    try {
      const records = JSON.parse(localStorage.getItem("interview_records") || "[]");
      const idx = records.findIndex((r: any) => r.id === data?.sessionId);
      return idx > 0 ? records[idx + 1] : null;
    } catch { return null; }
  }, [data?.sessionId]);
  const prevScore = prevRecord?.overallScore || null;
  const scoreDelta = prevScore !== null ? avgScore - prevScore : null;

  const messages: any[] = data?.messages || [];

  const [exportStatus, setExportStatus] = useState<{ type: "success" | "error" | "loading" | null; msg: string }>({ type: null, msg: "" });

  const showToast = useCallback((type: "success" | "error" | "loading", msg: string) => {
    setExportStatus({ type, msg });
    if (type !== "loading") setTimeout(() => setExportStatus({ type: null, msg: "" }), 3000);
  }, []);

  const handleExportPDF = useCallback(() => {
    showToast("loading", "正在生成PDF...");
    try { window.print(); showToast("success", "PDF打印窗口已打开"); }
    catch { showToast("error", "PDF生成失败"); }
  }, [showToast]);

  const handleExportWord = useCallback(() => {
    showToast("loading", "正在生成Word文档...");
    try {
      var posName = data?.positionName || data?.position || "";
      var rDate = data?.date || (new Date()).toLocaleDateString("zh-CN");
      var allDims = Object.entries(dims).filter(function(a) { return DIM_LABELS[a[0]]; }) as [string, number][];
      var sorted = allDims.slice().sort(function(a, b) { return b[1] - a[1]; });
      var qaMsgs = (messages as any[]).filter(function(m) { return m.role === "assistant" || m.role === "user"; });
      var strongDims = sorted.slice(0, 5).filter(function(d) { return d[1] >= 3.0; });
      var weakDims = sorted.slice(-5).filter(function(d) { return d[1] < 4.0; });
      var userCount = (messages as any[]).filter(function(m) { return m.role === "user"; }).length;
      var scorePct = Math.min(99, Math.round(avgScore * 20));

      // --- Radar as styled table (Word-compatible) ---
      var groups = [
        { label: "文本维度", keys: ["关键词覆盖","结构逻辑","术语准确","简历匹配","信息密度"], color: "#1f6feb" },
        { label: "语音维度", keys: ["语速节奏","停顿卡壳","语调情感","流利重复","音量清晰"], color: "#d2991d" },
        { label: "视觉维度", keys: ["眼神注意","面部表情","头部手势","形象背景"], color: "#3fb950" },
        { label: "融合维度", keys: ["内容情感一致","综合压力指数","时间连贯性","个性化综合"], color: "#7c3aed" },
      ];
      var radarRows = "";
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        var sum = 0;
        for (var kj = 0; kj < g.keys.length; kj++) { sum += (dims[g.keys[kj]] || 0); }
        var avg = sum / g.keys.length;
        var pct = Math.round(avg * 20);
        radarRows += "<tr><td style='background:" + g.color + "15;font-weight:bold;font-size:22px;color:" + g.color + "'>" + g.label + "</td><td style='font-size:28px;font-weight:bold;text-align:center'>" + avg.toFixed(1) + "</td><td style='width:55%'><div style='background:#e8e8e8;height:22px;border-radius:11px'><div style='background:" + g.color + ";height:22px;border-radius:11px;width:" + pct + "%'></div></div></td><td style='text-align:center;font-size:21px;color:#888'>" + pct + "%</td></tr>";
      }

      // --- 18 dimensions table ---
      var dimRows = "";
      for (var di = 0; di < sorted.length; di++) {
        var d = sorted[di];
        var pct2 = Math.round(d[1] * 20);
        var barColor = d[1] >= 4 ? "#3fb950" : d[1] >= 3 ? "#d2991d" : "#f85149";
        var starStr = d[1] >= 4.5 ? "卓越" : d[1] >= 4 ? "优秀" : d[1] >= 3 ? "良好" : d[1] >= 2 ? "一般" : "需提升";
        var starColor = d[1] >= 4 ? "#3fb950" : d[1] >= 3 ? "#d2991d" : "#f85149";
        dimRows += "<tr><td style='font-size:21px'>" + (DIM_LABELS[d[0]] || d[0]) + "</td><td style='font-size:24px;font-weight:bold;text-align:center;color:" + barColor + "'>" + d[1].toFixed(1) + "</td><td style='text-align:center;font-size:21px;color:" + starColor + "'>" + starStr + "</td><td style='width:35%'><div style='background:#e8e8e8;height:18px;border-radius:9px'><div style='background:" + barColor + ";height:18px;border-radius:9px;width:" + pct2 + "%'></div></div></td><td style='text-align:center;font-size:21px;color:#888'>" + pct2 + "%</td></tr>";
      }

      // --- QA ---
      var qaHtml = "";
      for (var qi = 0; qi < qaMsgs.length; qi++) {
        var m = qaMsgs[qi];
        var isUser = m.role === "user";
        var roleLabel = isUser ? "候选人" : "AI 面试官";
        var roleColor = isUser ? "#1f6feb" : "#3fb950";
        var bgColor = isUser ? "#f0f4ff" : "#f0fff4";
        qaHtml += "<div style='margin-bottom:20px;padding:18px 24px;border-left:5px solid " + roleColor + ";background:" + bgColor + "'><div style='font-size:21px;font-weight:bold;color:" + roleColor + ";margin-bottom:8px'>" + roleLabel + "</div><div style='font-size:22px;line-height:1.9;color:#333'>" + (m.content || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + "</div></div>";
      }

      // --- Strengths/Weaknesses ---
      var strongHtml = strongDims.length > 0 ? strongDims.map(function(d) { return "<tr><td style='font-size:21px;font-weight:bold;color:#3fb950'>" + (DIM_LABELS[d[0]] || d[0]) + "</td><td style='font-size:24px;color:#3fb950;text-align:center'>" + d[1].toFixed(1) + "</td><td style='font-size:21px;color:#555'>表现突出，继续保持</td></tr>"; }).join("") : "<tr><td colspan='3' style='font-size:21px'>综合表现良好</td></tr>";
      var weakHtml = weakDims.length > 0 ? weakDims.map(function(d) { return "<tr><td style='font-size:21px;font-weight:bold;color:#f85149'>" + (DIM_LABELS[d[0]] || d[0]) + "</td><td style='font-size:24px;color:#f85149;text-align:center'>" + d[1].toFixed(1) + "</td><td style='font-size:21px;color:#555'>建议重点关注并加强练习</td></tr>"; }).join("") : "<tr><td colspan='3' style='font-size:21px'>建议持续练习巩固</td></tr>";

      // --- Learning path ---
      var learningPath = [
        { phase: "第一阶段", time: "1-2 周", color: "#f85149", items: ["薄弱维度基础知识巩固", "核心概念系统梳理", "基础练习题 50+"] },
        { phase: "第二阶段", time: "2-4 周", color: "#d2991d", items: ["中等难度专项提升", "项目实战练习", "模拟面试 3-5 次"] },
        { phase: "第三阶段", time: "1-2 个月", color: "#3fb950", items: ["高级话题深入探讨", "系统设计能力训练", "综合模拟面试冲刺"] },
      ];
      var learningHtml = "";
      for (var li = 0; li < learningPath.length; li++) {
        var lp = learningPath[li];
        learningHtml += "<div style='border-left:6px solid " + lp.color + ";padding:16px 24px;margin-bottom:20px;background:#fafafa'><div style='font-size:22px;font-weight:bold;color:" + lp.color + ";margin-bottom:6px'>" + lp.phase + "  <span style='font-size:21px;color:#999;font-weight:normal'>" + lp.time + "</span></div><ul style='margin:6px 0 0;font-size:21px;line-height:2.2'>";
        for (var lj = 0; lj < lp.items.length; lj++) { learningHtml += "<li>" + lp.items[lj] + "</li>"; }
        learningHtml += "</ul></div>";
      }

      var html = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>" + posName + " 面试评估报告</title><style>@page{size:A4;margin:2.5cm;@bottom-center{content:'第 ' counter(page) ' 页';font-size:21px;color:#999}}body{font-family:'Microsoft YaHei',sans-serif;color:#333;line-height:2;font-size:22px;padding:0}h1{color:#1f6feb;font-size:36px;border-bottom:4px solid #1f6feb;padding-bottom:14px;margin-bottom:28px}h2{color:#222;font-size:28px;margin-top:44px;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #e0e0e0}h3{font-size:24px;color:#555;margin-top:28px;margin-bottom:14px}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:21px}th{background:#f0f4ff;color:#1f6feb;font-weight:bold;padding:14px 16px;text-align:left;border:1px solid #ddd;font-size:21px}td{padding:12px 16px;border:1px solid #ddd;font-size:21px}.hero{text-align:center;padding:40px;background:linear-gradient(135deg,#1f6feb10,#3fb95010);border-radius:10px;margin:28px 0;border:2px solid #e8e8e8}.hero .big{font-size:72px;font-weight:bold;color:#1f6feb;line-height:1}.hero .grade{font-size:32px;color:#333;margin-top:8px}.hero .sub{font-size:21px;color:#999;margin-top:6px}.meta-table{width:auto;margin-bottom:28px}.meta-table td{padding:8px 20px 8px 0;border:none;font-size:21px}.divider{border:none;border-top:3px solid #e8e8e8;margin:36px 0}.footer{text-align:center;color:#bbb;font-size:21px;margin-top:60px;padding-top:24px;border-top:2px solid #eee}</style></head><body><h1>AI 智能面试评估报告</h1><table class='meta-table'><tr><td style='color:#888;width:120px'>面试岗位</td><td style='font-weight:bold;font-size:24px'>" + posName + "</td></tr><tr><td style='color:#888'>评估日期</td><td style='font-size:22px'>" + rDate + "</td></tr><tr><td style='color:#888'>面试轮次</td><td style='font-size:22px'>" + userCount + " 轮深度问答</td></tr><tr><td style='color:#888'>报告编号</td><td style='font-size:21px;color:#999'>RPT-" + (new Date()).toISOString().slice(0,10).replace(/-/g,"") + "-" + (data?.sessionId || "000").slice(-6).toUpperCase() + "</td></tr></table><div class='divider'></div><div class='hero'><div class='big'>" + avgScore.toFixed(1) + "</div><div class='grade'>" + grade.label + "</div><div class='sub'>综合评分  |  超越 " + scorePct + "% 的模拟面试者</div></div><div class='divider'></div><h2>四维能力评估</h2><table><tr><th style='width:18%'>能力维度</th><th style='width:10%;text-align:center'>均分</th><th style='width:55%'>得分率</th><th style='width:17%;text-align:center'>达成率</th></tr>" + radarRows + "</table><div class='divider'></div><h2>18 维详细评分</h2><table><tr><th style='width:18%'>评估维度</th><th style='width:10%;text-align:center'>评分</th><th style='width:12%;text-align:center'>等级</th><th style='width:42%'>得分率</th><th style='width:18%;text-align:center'>百分比</th></tr>" + dimRows + "</table><div class='divider'></div><h2>表现突出</h2><table><tr><th style='width:22%'>维度</th><th style='width:12%;text-align:center'>评分</th><th>评价</th></tr>" + strongHtml + "</table><div class='divider'></div><h2>需要加强</h2><table><tr><th style='width:22%'>维度</th><th style='width:12%;text-align:center'>评分</th><th>建议</th></tr>" + weakHtml + "</table><div class='divider'></div><h2>三阶段学习路径</h2>" + learningHtml + "<div class='divider'></div><h2>完整面试问答记录</h2>" + qaHtml + "<div class='footer'><p>" + posName + " 面试评估报告  |  " + rDate + "</p><p style='margin-top:8px'>本报告由 AI 智能面试官自动生成，仅供学习评估参考</p></div></body></html>";

      var blob = new Blob(["﻿" + html], { type: "application/msword" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = posName + "_面试评估报告_" + (new Date()).toISOString().slice(0,10) + ".doc";
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast("success", "Word报告下载成功");
    } catch (e: any) { showToast("error", "Word导出失败: " + (e?.message || "")); }
  }, [showToast, dims, messages, avgScore, grade, data, percentile]);



  return (
    <main className="flex-1 w-full overflow-y-auto bg-[#0f1117]" style={{width:"100%",maxWidth:"100%"}}>
      <div className="p-6 lg:p-8 w-full" style={{maxWidth:"100%"}}>
        {/* Breadcrumb */}
        <div className="text-xs text-[#8b949e] mb-5">
          <button onClick={onBack} className="text-[#58a6ff] hover:underline">📋 面试记录</button>
          <span className="mx-2">/</span><span>面试报告</span>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-2xl font-bold text-[#f0f6fc]">📊 面试复盘报告</h2>
            <p className="text-[#8b949e] text-sm mt-1">{data?.positionName || "岗位"} · {data?.sessionId?.slice(0, 20) || "-"} · {dimEntries.length}维分析</p>
          </div>
          <span className="bg-[#1f6feb22] text-[#58a6ff] px-3 py-1 rounded-full text-xs font-semibold">综合评估</span>
        </div>

        {/* Score Hero + Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          {/* Score Card */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <div className="text-6xl font-extrabold bg-gradient-to-br from-[#58a6ff] to-[#3fb950] bg-clip-text text-transparent leading-tight">{avgScore.toFixed(1)}</div>
            <div className="text-xs text-[#8b949e] mt-1.5">综合评分 / 5.0</div>
            <div className="text-sm font-semibold mt-2" style={{ color: grade.color }}>{grade.stars} {grade.label}</div>
            <div className="text-[10px] text-[#484f58] mt-1">超过 {percentile}% 的候选人</div>
            {scoreDelta !== null && (
              <div className={`mt-3 px-3 py-1.5 rounded-full text-xs font-semibold ${scoreDelta >= 0 ? "bg-[#3fb95022] text-[#3fb950]" : "bg-[#f8514922] text-[#f85149]"}`}>
                {scoreDelta >= 0 ? "↑" : "↓"} {Math.abs(scoreDelta).toFixed(1)} 较上次
              </div>
            )}
          </div>

          {/* Radar Chart */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-4 flex items-center justify-center">
            <RadarChart dims={dims} />
          </div>

          {/* Quick Stats */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">快速概览</h4>
            {top3.length > 0 && (
              <div>
                <div className="text-[10px] text-[#3fb950] mb-1">🏆 最佳维度</div>
                <div className="text-xs text-[#c9d1d9] font-semibold">{DIM_LABELS[top3[0][0]] || top3[0][0]}</div>
                <div className="text-[10px] text-[#8b949e]">{(top3[0][1] as number).toFixed(1)} 分</div>
              </div>
            )}
            {bottom3.length > 0 && (
              <div>
                <div className="text-[10px] text-[#f85149] mb-1">⚠️ 最弱维度</div>
                <div className="text-xs text-[#c9d1d9] font-semibold">{DIM_LABELS[bottom3[0][0]] || bottom3[0][0]}</div>
                <div className="text-[10px] text-[#8b949e]">{(bottom3[0][1] as number).toFixed(1)} 分</div>
              </div>
            )}
            <div className="pt-2 border-t border-[#21262d]">
              <div className="text-[10px] text-[#8b949e] mb-1">消息轮次</div>
              <div className="text-xs text-[#c9d1d9] font-semibold">{messages.length} 条 · {Math.ceil(messages.length / 2)} 轮对话</div>
            </div>
          </div>
        </div>

        {/* Grade Legend with tooltips */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 mb-5">
          <div className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3">📐 评分标准说明</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
            {[
              { range: "4.5 - 5.0", label: "卓越", desc: "深度理解，举一反三", color: "#79c0ff" },
              { range: "4.0 - 4.4", label: "优秀", desc: "掌握扎实，表达清晰", color: "#3fb950" },
              { range: "3.0 - 3.9", label: "良好", desc: "基本掌握，略有不足", color: "#d2991d" },
              { range: "2.0 - 2.9", label: "一般", desc: "概念模糊，需加强", color: "#f0883e" },
              { range: "0 - 1.9", label: "薄弱", desc: "知识欠缺，需系统学习", color: "#f85149" },
            ].map((g, i) => (
              <div key={i} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2.5 cursor-default" title={g.desc}>
                <div className="text-xs font-bold" style={{ color: g.color }}>{g.label}</div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">{g.range}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 18-Dimension Detailed Breakdown by Modality */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-[#f0f6fc] mb-4 flex items-center gap-2">
            📐 18维详细分析
            <span className="text-[10px] text-[#8b949e] font-normal">悬停显示星级</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(MODALITY_GROUPS).map(([modKey, mod]) => {
              const modAvg = mod.keys.reduce((s, k) => s + (dims[k] || 0), 0) / Math.max(mod.keys.length, 1);
              const modColor = modAvg >= 4 ? "#3fb950" : modAvg >= 3 ? "#d2991d" : "#f85149";
              return (
                <div key={modKey} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span>{mod.icon}</span>
                      <span className="text-xs font-semibold text-[#f0f6fc]">{mod.label}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: modColor }}>{modAvg.toFixed(1)}</span>
                  </div>
                  <div className="space-y-0.5">
                    {mod.keys.map(k => (
                      <DimBar key={k} label={DIM_LABELS[k] || k} score={dims[k] || 0} modality={modKey} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strengths & Weaknesses (data-driven) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 border-l-[3px] border-l-[#3fb950]">
            <h4 className="text-sm font-semibold text-[#f0f6fc] mb-3 flex items-center gap-2">✅ 表现较好</h4>
            <ul className="space-y-2.5">
              {strengths.map((s, i) => (
                <li key={i} className="text-xs text-[#8b949e] flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#3fb95022] text-[#3fb950] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <div className="text-[#c9d1d9]">{s}</div>
                    <div className="text-[10px] text-[#484f58] mt-0.5">继续保持，可尝试更深层次应用</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 border-l-[3px] border-l-[#f85149]">
            <h4 className="text-sm font-semibold text-[#f0f6fc] mb-3 flex items-center gap-2">⚠️ 需要加强</h4>
            <ul className="space-y-2.5">
              {weaknesses.map((s, i) => (
                <li key={i} className="text-xs text-[#8b949e] flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#f8514922] text-[#f85149] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <div className="text-[#c9d1d9]">{s}</div>
                    <div className="text-[10px] text-[#484f58] mt-0.5">建议优先学习相关知识，做针对性练习</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Answer Review (if messages available) */}
        {messages.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[#f0f6fc] mb-3 flex items-center gap-2">💬 面试问答回溯</h3>
            <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 max-h-[300px] overflow-y-auto space-y-3">
              {messages.filter((m: any) => m.role === "user").slice(-4).map((m: any, i: number) => (
                <div key={i} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3">
                  <div className="text-[10px] text-[#58a6ff] mb-1">👤 第 {messages.filter((_: any, j: number) => j <= messages.indexOf(m) && messages[j].role === "user").length} 轮回答</div>
                  <div className="text-xs text-[#c9d1d9] leading-relaxed">{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Path */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-[#f0f6fc] mb-3 flex items-center gap-2">
            📚 推荐学习路径
            <span className="text-[10px] text-[#8b949e] font-normal">基于本次评估结果</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { phase: "第一阶段", time: "1-2周", items: ["薄弱维度基础知识巩固", "核心概念系统梳理", "基础练习题 50+"], color: "#f85149", pri: "🔴" },
              { phase: "第二阶段", time: "2-4周", items: ["中等难度专项提升", "项目实战练习", "面试模拟 3-5次"], color: "#d2991d", pri: "🟡" },
              { phase: "第三阶段", time: "1-2个月", items: ["高级话题深入", "系统设计能力", "综合模拟面试"], color: "#3fb950", pri: "🟢" },
            ].map((phase, i) => (
              <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4" style={{ borderTopColor: phase.color, borderTopWidth: "3px" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#f0f6fc]">{phase.pri} {phase.phase}</span>
                  <span className="text-[10px] text-[#8b949e]">⏱ {phase.time}</span>
                </div>
                <ul className="space-y-1.5">
                  {phase.items.map((item, j) => (
                    <li key={j} className="text-[11px] text-[#8b949e] flex items-start gap-1.5">
                      <span className="text-[10px] mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Export Options & Toast */}
                  {/* Toast */}
        {exportStatus.type && (
          <div className={"fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-top-2 flex items-center gap-2 " + (
            exportStatus.type === "success" ? "bg-[#3fb95022] border border-[#3fb95055] text-[#3fb950]" :
            exportStatus.type === "error" ? "bg-[#f8514922] border border-[#f8514955] text-[#f85149]" :
            "bg-[#d2991d22] border border-[#d2991d55] text-[#d2991d]"
          )}>
            <span>{exportStatus.type === "success" ? "✅" : exportStatus.type === "error" ? "❌" : "⏳"}</span>
            {exportStatus.msg}
            <button onClick={() => setExportStatus({ type: null, msg: "" })} className="ml-2 text-[#8b949e] hover:text-white text-xs">✕</button>
          </div>
        )}

        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 mb-5">
          <div className="text-xs font-semibold text-[#f0f6fc] mb-3">📥 导出报告</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={handleExportPDF} disabled={exportStatus.type === "loading"}
              className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 text-left hover:border-[#30363d] transition-all group w-full disabled:opacity-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📕</span>
                <span className="text-xs font-semibold text-[#c9d1d9] group-hover:text-white">PDF 格式</span>
              </div>
              <div className="text-[10px] text-[#8b949e]">完整报告 · 含图表</div>
            </button>
            <button onClick={handleExportWord} disabled={exportStatus.type === "loading"}
              className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 text-left hover:border-[#30363d] transition-all group w-full disabled:opacity-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📘</span>
                <span className="text-xs font-semibold text-[#c9d1d9] group-hover:text-white">Word 格式</span>
              </div>
              <div className="text-[10px] text-[#8b949e]">可编辑文档 · .docx</div>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
