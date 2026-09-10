"use client";

import { useState, useCallback, useEffect } from "react";
import ChatArea from "@/components/ChatArea";
import { forceNewSession } from "@/lib/api";
import ReportView from "@/components/ReportView";
import RecordsView from "@/components/RecordsView";

const POSITIONS = [
  { id: "frontend", name: "前端开发工程师", icon: "⚛️", desc: "React / Vue / JS基础 / 浏览器原理 / 性能优化", rounds: "5-8轮", difficulty: "中等", color: "#58a6ff", hot: true, tag: "热门" },
  { id: "backend", name: "后端开发工程师", icon: "☕", desc: "Java / Go / 数据库 / 分布式 / 系统设计", rounds: "6-10轮", difficulty: "较高", color: "#3fb950", hot: true, tag: "高薪" },
  { id: "analyst", name: "数据分析师", icon: "📊", desc: "SQL / Python / 统计学 / 数据可视化", rounds: "4-7轮", difficulty: "中等", color: "#d2991d", hot: false },
  { id: "pm", name: "产品经理", icon: "📱", desc: "需求分析 / 竞品调研 / 数据思维 / 沟通协作", rounds: "4-6轮", difficulty: "中等", color: "#d2a8ff", hot: false },
  { id: "designer", name: "UI/UX 设计师", icon: "🎨", desc: "设计规范 / 用户研究 / 交互原型 / 视觉设计", rounds: "4-6轮", difficulty: "中等", color: "#f778ba", hot: false },
];

const AGENT_FEATURES = [
  { icon: "🎯", title: "意图识别", desc: "实时分析候选人回答，识别知识薄弱点与表达模式", color: "#58a6ff" },
  { icon: "🧠", title: "记忆模块", desc: "跨轮次上下文追踪，保持面试连贯性与一致性", color: "#3fb950" },
  { icon: "🔧", title: "工具调用", desc: "RAG知识检索 + 多维度并行分析管道", color: "#d2991d" },
  { icon: "🗺️", title: "任务规划", desc: "自主决策追问/转题/提示/结束四条路径", color: "#d2a8ff" },
  { icon: "📐", title: "18维评估", desc: "文本5 + 语音5 + 视觉4 + 融合4，全维度量化", color: "#f778ba" },
  { icon: "📚", title: "RAG知识库", desc: "500+ 面试知识点，5岗位×5维度覆盖", color: "#79c0ff" },
];

const FAQ_ITEMS = [
  { q: "面试会持续多少轮？", a: "根据岗位不同 4-10 轮，Agent 会根据你的表现动态调整。" },
  { q: "AI 怎么判断我的水平？", a: "18 维实时分析：文本 5 维 + 语音 5 维 + 视觉 4 维 + 融合 4 维。" },
  { q: "报告包含哪些内容？", a: "综合评分、18维雷达图、优势分析、薄弱环节、个性化学习建议。" },
  { q: "数据隐私安全吗？", a: "视觉分析在浏览器本地运行，不上传服务器。语音和文本仅用于本次评估。" },
];

export default function Home() {
  const [view, setView] = useState<"home" | "records" | "interview" | "report" | "knowledge" | "config">("home");
  const [activeNav, setActiveNav] = useState("home");
  const [position, setPosition] = useState("");
  const [positionName, setPositionName] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [interviewKey, setInterviewKey] = useState(0);
  const [filter, setFilter] = useState("all");
  const [showGuide, setShowGuide] = useState(true);

  const navItems = [
    { id: "home", icon: "🏠", label: "首页" },
    { id: "records", icon: "📋", label: "面试记录" },
    { id: "knowledge", icon: "📚", label: "知识库" },
    { id: "config", icon: "⚙️", label: "岗位配置" },
  ];

  const handleNav = useCallback((navId: string) => { setActiveNav(navId); if (navId === "home") setView("home"); else if (navId === "records") setView("records"); else if (navId === "knowledge") setView("knowledge"); else if (navId === "config") setView("config"); }, []);
  const handleStartInterview = useCallback((posId: string, posName: string) => { forceNewSession(); setPosition(posId); setPositionName(posName); setInterviewKey(k => k + 1); setView("interview"); setActiveNav("home"); }, []);
  const handleViewReport = useCallback((data: any) => { setReportData(data); setView("report"); }, []);
  const handleBackFromReport = useCallback(() => { setView("records"); setActiveNav("records"); }, []);
  const handleRetryFromReport = useCallback(() => { forceNewSession(); setPosition(reportData?.position || ""); setPositionName(reportData?.positionName || ""); setInterviewKey(k => k + 1); setView("interview"); setActiveNav("home"); }, [reportData]);
  const handleViewRecordReport = useCallback((record: any) => { setReportData(record); setView("report"); }, []);

  const filteredPositions = filter === "hot" ? POSITIONS.filter(p => p.hot) : filter === "all" ? POSITIONS : POSITIONS.filter(p => p.id === filter);

  const sidebar = (
    <aside className="w-[220px] bg-[#161b22] border-r border-[#21262d] flex flex-col shrink-0 min-h-screen">
      <div className="p-4">
        <h1 className="text-base font-bold text-[#58a6ff] mb-5">🎓 AI模拟面试官</h1>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => handleNav(item.id)} className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2.5 ${activeNav === item.id ? "bg-[#1f6feb22] text-[#58a6ff] font-semibold" : "text-[#8b949e] hover:bg-[#1c2128] hover:text-[#c9d1d9]"}`}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4 border-t border-[#21262d] space-y-2">
        <div className="text-[11px] text-[#484f58]">Agent v2.0 · 18维评估</div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#0f1117] w-full">
      {sidebar}

      {view === "home" && (
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">
            {/* Welcome + Dismissible Guide */}
            {showGuide && (
              <div className="mb-5 bg-gradient-to-r from-[#1f6feb22] to-[#3fb95022] border border-[#30363d] rounded-xl p-4 relative">
                <button onClick={() => setShowGuide(false)} className="absolute top-3 right-3 text-[#484f58] hover:text-[#8b949e] text-sm">✕</button>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">👋</span>
                  <div>
                    <h3 className="text-sm font-semibold text-[#f0f6fc] mb-1">欢迎来到 AI 模拟面试系统</h3>
                    <p className="text-xs text-[#8b949e] leading-relaxed">
                      这是一个<strong className="text-[#58a6ff]">会看人下菜碟</strong>的 AI 面试官 — 不是按顺序念题，而是根据你的回答实时分析 18 个维度，
                      自主决定追问、转话题、给提示还是结束面试。选择岗位 → 开始面试 → 查看复盘报告，三步即可体验。
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { setShowGuide(false); handleStartInterview("frontend", "前端开发工程师"); }} className="px-4 py-1.5 bg-[#238636] text-white text-xs rounded-lg font-medium hover:bg-[#2ea043] transition-colors">🚀 快速体验</button>
                      <button onClick={() => setShowGuide(false)} className="px-4 py-1.5 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] text-xs rounded-lg hover:bg-[#30363d] transition-colors">知道了</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5">
              <h2 className="text-xl font-bold text-[#f0f6fc] mb-1">智能面试评估系统</h2>
              <p className="text-[#8b949e] text-sm">多模态 Agent 驱动的 AI 面试官 · 18 维实时分析 · 千人千面</p>
            </div>

            {/* Quick Actions + Stats Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-5">
              {/* Stats (3 cols) */}
              <div className="lg:col-span-3 grid grid-cols-4 gap-3">
                {[
                  { label: "累计面试", value: "1,284", sub: "↑ 12%", clickable: true },
                  { label: "题库总量", value: "5,632", sub: "+128题", clickable: true },
                  { label: "分析维度", value: "18维", sub: "四层覆盖", clickable: false },
                  { label: "知识库", value: "500+", sub: "5×5主题", clickable: false },
                ].map((s, i) => (
                  <div key={i} className={`bg-[#161b22] border border-[#21262d] rounded-xl p-3.5 group ${s.clickable ? "cursor-pointer hover:border-[#58a6ff] hover:bg-[#1c2128]" : ""} transition-all`} title={s.clickable ? "点击查看详情" : undefined}>
                    <div className="text-[10px] text-[#8b949e] uppercase tracking-wide mb-1">{s.label}</div>
                    <div className="text-xl font-bold text-[#f0f6fc] group-hover:text-[#58a6ff] transition-colors">{s.value}</div>
                    <div className="text-[10px] text-[#3fb950] mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
              {/* Quick Actions (2 cols) */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                <button onClick={() => handleStartInterview("frontend", "前端开发工程师")} className="bg-gradient-to-br from-[#1f6feb22] to-[#1f6feb08] border border-[#1f6feb33] rounded-xl p-3.5 text-left hover:border-[#58a6ff] transition-all group">
                  <div className="text-lg mb-1">🚀</div>
                  <div className="text-xs font-semibold text-[#58a6ff] group-hover:text-[#79c0ff]">快速面试</div>
                  <div className="text-[10px] text-[#8b949e] mt-1">热门岗位一键开始</div>
                </button>
                <button onClick={() => handleNav("records")} className="bg-gradient-to-br from-[#3fb95022] to-[#3fb95008] border border-[#3fb95033] rounded-xl p-3.5 text-left hover:border-[#3fb950] transition-all group">
                  <div className="text-lg mb-1">📋</div>
                  <div className="text-xs font-semibold text-[#3fb950] group-hover:text-[#7ee787]">继续上次</div>
                  <div className="text-[10px] text-[#8b949e] mt-1">查看历史面试记录</div>
                </button>
              </div>
            </div>

            {/* Main Content: Positions + Features side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              {/* Positions (2/3) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#f0f6fc]">🎯 选择面试岗位</h3>
                  <div className="flex gap-1 text-[11px]">
                    {[
                      { id: "all", label: "全部" },
                      { id: "hot", label: "🔥 热门" },
                      { id: "frontend", label: "前端" },
                      { id: "backend", label: "后端" },
                    ].map(f => (
                      <button key={f.id} onClick={() => setFilter(f.id)}
                        className={`px-3 py-1 rounded-full transition-all ${filter === f.id ? "bg-[#1f6feb22] text-[#58a6ff] font-semibold" : "text-[#8b949e] hover:text-[#c9d1d9]"}`}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPositions.map((p) => (
                    <button key={p.id} onClick={() => handleStartInterview(p.id, p.name)}
                      className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 text-left hover:border-[#58a6ff] hover:-translate-y-0.5 transition-all group relative overflow-hidden">
                      {p.tag && <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-medium bg-[#f8514922] text-[#f85149]">{p.tag}</span>}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base mb-2.5" style={{ background: `${p.color}22`, color: p.color }}>{p.icon}</div>
                      <h3 className="text-sm font-semibold text-[#f0f6fc] mb-1 group-hover:text-[#58a6ff]">{p.name}</h3>
                      <p className="text-[10px] text-[#8b949e] leading-relaxed mb-2">{p.desc}</p>
                      <div className="flex gap-3 text-[10px] text-[#484f58]"><span>🕐 {p.rounds}</span><span>⭐ {p.difficulty}</span></div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Features (1/3) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#f0f6fc] flex items-center gap-2">⚡ Agent 核心能力 <span className="text-[9px] bg-[#1f6feb22] text-[#58a6ff] px-1.5 py-0.5 rounded-full">NEW</span></h3>
                {AGENT_FEATURES.map((f, i) => (
                  <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-3 flex items-start gap-2.5 hover:border-[#30363d] transition-all group cursor-default">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 group-hover:scale-110 transition-transform" style={{ background: `${f.color}22`, color: f.color }}>{f.icon}</div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#f0f6fc] mb-0.5">{f.title}</div>
                      <div className="text-[10px] text-[#8b949e] leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom: Flow + Quick Start + FAQ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Agent Flow */}
              <div className="lg:col-span-2 bg-[#161b22] border border-[#21262d] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#f0f6fc] mb-4">🔄 Agent 面试闭环</h3>
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {[
                    { step: "1", label: "候选人回答", icon: "👤" },
                    { step: "2", label: "18维分析", icon: "📐" },
                    { step: "3", label: "融合计算", icon: "🔄" },
                    { step: "4", label: "Agent决策", icon: "🤖" },
                    { step: "5", label: "RAG出题", icon: "📚" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#21262d] rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-[#58a6ff] bg-[#1f6feb22] w-5 h-5 rounded flex items-center justify-center">{item.step}</span>
                        <span className="text-xs">{item.icon}</span>
                        <span className="text-[10px] text-[#c9d1d9]">{item.label}</span>
                      </div>
                      {i < 4 && <span className="text-[#484f58] text-[10px]">→</span>}
                    </div>
                  ))}
                  <span className="text-[#484f58] text-[10px]">→ 🔁 循环 → 📊 报告</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "深挖弱点", icon: "🔍", desc: "弱项追问细节", color: "#f85149" },
                    { label: "转话题", icon: "🔄", desc: "扩大考察范围", color: "#d2991d" },
                    { label: "给提示", icon: "💡", desc: "降低问题难度", color: "#58a6ff" },
                    { label: "结束面试", icon: "✅", desc: "生成复盘报告", color: "#3fb950" },
                  ].map((d, i) => (
                    <div key={i} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2.5 text-center hover:scale-[1.02] transition-transform cursor-default">
                      <div className="text-lg mb-1">{d.icon}</div>
                      <div className="text-[10px] font-semibold text-[#f0f6fc]">{d.label}</div>
                      <div className="text-[9px] text-[#484f58]">{d.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Start */}
              <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex flex-col">
                <h3 className="text-sm font-semibold text-[#f0f6fc] mb-4 flex items-center gap-2">🚀 快速开始 <span className="text-[9px] bg-[#3fb95022] text-[#3fb950] px-1.5 py-0.5 rounded-full">3步上手</span></h3>
                <div className="space-y-3 flex-1">
                  {[
                    { step: "1", text: "选择目标岗位", sub: "前端 / 后端 / 算法 / 产品 / 设计" },
                    { step: "2", text: "AI 出题，语音或文字回答", sub: "支持语音输入 + 摄像头面部分析" },
                    { step: "3", text: "查看18维复盘报告", sub: "雷达图 + 优势分析 + 学习路径" },
                  ].map((s, i) => (
                    <div key={i} className="flex gap-3 group cursor-default">
                      <span className="text-xs font-bold text-[#58a6ff] bg-[#1f6feb22] w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">{s.step}</span>
                      <div>
                        <div className="text-xs font-semibold text-[#f0f6fc]">{s.text}</div>
                        <div className="text-[10px] text-[#8b949e]">{s.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* FAQ mini */}
                <div className="mt-4 pt-4 border-t border-[#21262d]">
                  <h4 className="text-[11px] font-semibold text-[#8b949e] mb-3">💬 常见问题</h4>
                  <div className="space-y-2">
                    {FAQ_ITEMS.slice(0, 3).map((item, i) => (
                      <details key={i} className="group text-[11px]">
                        <summary className="text-[#c9d1d9] cursor-pointer hover:text-[#58a6ff] transition-colors list-none flex items-center gap-1">
                          <span className="text-[10px] group-open:rotate-90 transition-transform">▶</span> {item.q}
                        </summary>
                        <p className="text-[#8b949e] mt-1 ml-4 text-[10px] leading-relaxed">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {view === "records" && <RecordsView onStartInterview={handleStartInterview} onViewReport={handleViewRecordReport} positions={POSITIONS} />}
      {view === "interview" && <ChatArea key={interviewKey} position={position} positionName={positionName} onBack={() => { setView("home"); setActiveNav("home"); }} onViewReport={handleViewReport} />}
      {view === "report" && reportData && <ReportView data={reportData} onBack={handleBackFromReport} onRetry={handleRetryFromReport} />}
      {view === "knowledge" && (
        <main className="flex-1 overflow-y-auto bg-[#0f1117]">
          <div className="p-6 lg:p-8 w-full">
            <h2 className="text-2xl font-bold text-[#f0f6fc] mb-2">知识库管理</h2>
            <p className="text-sm text-[#8b949e] mb-6">RAG 知识库 · 501 条知识点 · 5 个岗位 · 18 维评估体系（文本5+语音5+视觉4+融合4）</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[{ label: "知识点总数", value: "501", icon: "", color: "#58a6ff" }, { label: "覆盖岗位", value: "5", icon: "", color: "#3fb950" }, { label: "评估维度", value: "18 维", icon: "", color: "#d2991d" }].map((s, i) => (
                <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
                  <div className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs text-[#8b949e]">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 mb-4">
              <h3 className="text-sm font-semibold text-[#f0f6fc] mb-4">岗位知识覆盖</h3>
              {[{ pos: "前端开发工程师", topics: ["关键词覆盖 (48条)", "结构逻辑 (9条)", "术语准确 (23条)", "基础概念 (14条)", "追问策略 (8条)"], color: "#58a6ff" }, { pos: "后端开发工程师", topics: ["关键词覆盖 (44条)", "结构逻辑 (6条)", "术语准确 (23条)", "基础概念 (14条)", "追问策略 (6条)"], color: "#3fb950" }, { pos: "数据分析师", topics: ["关键词覆盖 (42条)", "结构逻辑 (5条)", "术语准确 (22条)", "基础概念 (14条)", "追问策略 (5条)"], color: "#d2991d" }, { pos: "产品经理", topics: ["关键词覆盖 (35条)", "结构逻辑 (5条)", "术语准确 (22条)", "基础概念 (14条)", "追问策略 (5条)"], color: "#d2a8ff" }, { pos: "UI/UX 设计师", topics: ["关键词覆盖 (35条)", "结构逻辑 (5条)", "术语准确 (25条)", "基础概念 (14条)", "追问策略 (5条)"], color: "#f778ba" }].map((p, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-sm font-semibold text-[#c9d1d9]">{p.pos}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 ml-5">
                    {p.topics.map((t, j) => (
                      <span key={j} className="text-[10px] bg-[#0d1117] border border-[#21262d] rounded-full px-2.5 py-1 text-[#8b949e]">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-[#484f58] text-center py-4">知识库共 501 条 · 5 岗位 x 6 话题 + 2 通用类 · 存储于 src/backend/data/knowledge_base.json · 支持 ChromaDB 向量检索</div>
          </div>
        </main>
      )}
      {view === "config" && (
        <main className="flex-1 overflow-y-auto bg-[#0f1117]">
          <div className="p-6 lg:p-8 w-full">
            <h2 className="text-2xl font-bold text-[#f0f6fc] mb-2">岗位配置</h2>
            <p className="text-sm text-[#8b949e] mb-6">管理模拟面试的岗位类型与参数</p>
            <div className="space-y-4">
              {POSITIONS.map((p, i) => (
                <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: p.color + "22" }}>{p.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[#f0f6fc]">{p.name}</span>
                      {p.hot && <span className="text-[9px] bg-[#f8514922] text-[#f85149] px-1.5 py-0.5 rounded-full">{p.tag}</span>}
                    </div>
                    <div className="text-[11px] text-[#8b949e]">{p.desc}</div>
                    <div className="flex gap-3 mt-1.5 text-[10px] text-[#484f58]">
                      <span>难度: {p.difficulty}</span>
                      <span>{p.rounds}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#484f58] bg-[#0d1117] px-2.5 py-1 rounded-full border border-[#21262d]">ID: {p.id}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-[#484f58] text-center py-4 mt-2">岗位配置存储于 src/frontend/app/page.tsx · POSITIONS 数组</div>
          </div>
        </main>
      )}
    </div>
  );
}
