"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sendMessage, resetSession, getSessionId } from "@/lib/api";
import type { FaceDataPayload } from "@/lib/api";
import FaceCapture from "./FaceCapture";
import type { CameraStatus, FaceData } from "./FaceCapture";
import VoiceRecord from "./VoiceRecord";
import type { MicStatus } from "./VoiceRecord";
import ResumeUpload from "./ResumeUpload";
import type { ResumeData } from "./ResumeUpload";

interface Message {
  role: "user" | "assistant";
  content: string;
  decision?: string;
  dimensions?: Record<string, number> | null;
}

interface AgentState {
  intent: string;
  memory_topics: string[];
  tool_calls: string[];
  task_plan: string;
  round: number;
  pressure: string;
  weak_points: string[];
}

const DIMENSION_LABELS: Record<string, string> = {
  "关键词覆盖": "关键词覆盖", "结构逻辑": "结构逻辑", "术语准确": "术语准确",
  "简历匹配": "简历匹配", "信息密度": "信息密度", "语速节奏": "语速节奏",
  "停顿卡壳": "停顿卡壳", "语调情感": "语调情感", "流利重复": "流利重复",
  "音量清晰": "音量清晰", "眼神注意": "眼神注意", "面部表情": "面部表情",
  "头部手势": "头部手势", "形象背景": "形象背景", "内容情感一致": "内容情感一致",
  "综合压力指数": "综合压力指数", "时间连贯性": "时间连贯性", "个性化综合": "个性化综合",
};

export default function ChatArea({
  position, positionName, onBack, onViewReport,
}: {
  position: string; positionName: string; onBack: () => void; onViewReport: (data: any) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>({
    intent: "等待开始", memory_topics: [], tool_calls: [], task_plan: "初始化面试流程",
    round: 0, pressure: "正常", weak_points: [],
  });
  const [latestDimensions, setLatestDimensions] = useState<Record<string, number>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // === 左侧面板数据 ===
  const [faceData, setFaceData] = useState<FaceData | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceWav, setVoiceWav] = useState("");
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);

  const faceDataRef = useRef<FaceData | null>(null);
  const voiceWavRef = useRef("");
  const resumeTextRef = useRef("");

  const handleFaceData = useCallback((data: FaceData) => {
    setFaceData(data);
    faceDataRef.current = data;
  }, []);

  const handleTranscript = useCallback((text: string, final: boolean) => {
    setVoiceTranscript(text);
    if (final && text.trim()) setInput(text);
  }, []);

  const handleAudioData = useCallback((wav: string) => {
    setVoiceWav(wav);
    voiceWavRef.current = wav;
  }, []);

  const handleResumeParsed = useCallback((data: ResumeData) => {
    setResumeData(data);
    resumeTextRef.current = data.text;
    setAgentState(prev => ({
      ...prev,
      memory_topics: [...prev.memory_topics, `简历: ${data.fileName}`],
      tool_calls: [...prev.tool_calls, `简历解析: ${data.text.length}字符`],
    }));
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!started) { setStarted(true); handleSend("开始面试"); }
  }, []);

  // Build FaceDataPayload from FaceData
  const buildFacePayload = useCallback((): FaceDataPayload | undefined => {
    const fd = faceDataRef.current;
    if (!fd || !fd.facePresent) return undefined;
    return {
      left_eye_open: fd.eyeOpenness * 0.5,
      right_eye_open: fd.eyeOpenness * 0.5,
      eye_blink_rate: 15 + (1 - fd.eyeOpenness) * 30,
      gaze_x: fd.gazeX,
      gaze_y: fd.gazeY,
      gaze_stability: 0.8,
      head_yaw: fd.headYaw,
      head_pitch: fd.headPitch,
      head_roll: 0,
      head_movement: Math.abs(fd.headYaw) * 0.1,
      smile_ratio: fd.smileRatio,
      expression_variance: fd.smileRatio * 0.5,
      face_present: fd.facePresent,
      face_confidence: 0.9,
      duration_seconds: 0,
    };
  }, []);

  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;
    const userMsg: Message = { role: "user", content };
    const updated = [...messages, userMsg];
    setMessages(updated); setInput(""); setLoading(true);
    setAgentState((prev) => ({ ...prev, round: prev.round + 1, intent: "分析中..." }));

    try {
      const facePayload = buildFacePayload();
      const res = await sendMessage(position, updated, {
        faceData: facePayload,
        voiceWavBase64: voiceWavRef.current || undefined,
        resumeText: resumeTextRef.current || undefined,
      });
      voiceWavRef.current = ""; // Clear after sending

      const newMsg: Message = { role: "assistant", content: res.reply, decision: res.agent_decision ?? undefined, dimensions: res.dimensions_snapshot };
      setMessages([...updated, newMsg]);
      if (res.dimensions_snapshot) setLatestDimensions(res.dimensions_snapshot);

      // Update agent state with real-time data
      const faceActive = faceDataRef.current?.facePresent;
      const micActive = micStatus === "recording";
      setAgentState((prev) => {
        const tools: string[] = [];
        if (res.agent_decision) tools.push(`RAG检索: ${res.agent_decision}`);
        if (res.dimensions) tools.push(`维度分析: ${res.dimensions.length}项`);
        if (faceActive) tools.push("MediaPipe: 面部分析中");
        if (micActive) tools.push("语音识别: 实时转写中");
        if (resumeTextRef.current) tools.push("简历: 已匹配");

        return {
          ...prev,
          intent: res.agent_decision || "决策中",
          memory_topics: [...prev.memory_topics, positionName].slice(-5),
          tool_calls: tools,
          task_plan: prev.round >= 6 ? "准备收尾，生成报告" : `第${prev.round + 1}轮: ${res.agent_decision || "继续提问"}`,
          pressure: res.pressure_level > 0.6 ? "偏高" : "正常",
          weak_points: res.dimensions ? res.dimensions.filter((d: any) => d.score < 30).map((d: any) => d.name) : [],
        };
      });

      if (res.agent_decision?.includes("结束") || res.reply.includes("面试结束")) {
        try {
          const dims = res.dimensions_snapshot || latestDimensions;
          const vals = Object.values(dims);
          const avg = vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
          const record = {
            id: getSessionId(), position, positionName,
            date: new Date().toLocaleDateString("zh-CN"),
            turns: agentState.round + 1, overallScore: Math.round(avg * 10) / 10,
            summary: res.analysis_summary || "面试已完成", dimensions: dims,
          };
          const existing = JSON.parse(localStorage.getItem("interview_records") || "[]");
          existing.unshift(record);
          localStorage.setItem("interview_records", JSON.stringify(existing.slice(0, 50)));
        } catch {}

        setTimeout(() => {
          onViewReport({ position, positionName, sessionId: getSessionId(),
            messages: [...updated, newMsg],
            dimensions: res.dimensions_snapshot || latestDimensions,
          });
        }, 1500);
      }
    } catch (err) {
      console.error("[ChatArea] API error:", err);
      setMessages([...updated, { role: "assistant", content: "后端连接失败，请确认服务已启动。" }]);
    } finally { setLoading(false); }
  };

  const handleEnd = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await sendMessage(position, [...messages, { role: "user", content: "结束面试" }]);
    } catch {}
    resetSession();
    setTimeout(() => onViewReport({
      position, positionName, sessionId: getSessionId(), messages,
      dimensions: latestDimensions,
    }), 500);
    setLoading(false);
  }, [messages, position, positionName, latestDimensions, loading, onViewReport]);

  const dimEntries = Object.entries(latestDimensions).sort(([, a], [, b]) => (b as number) - (a as number));

  return (
    <div className="flex flex-1 w-full bg-[#0f1117] text-[#c9d1d9]" style={{ minHeight: 0 }}>
      {/* LEFT PANEL — 输入面板 */}
      <aside className="w-[260px] shrink-0 bg-[#161b22] border-r border-[#21262d] flex flex-col p-4 gap-4" style={{ minHeight: 0, overflowY: "auto" }}>
        <div className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">输入面板</div>

        <FaceCapture onFaceData={handleFaceData} onStatusChange={(s, m) => setCameraStatus(s)} />
        <VoiceRecord onTranscript={handleTranscript} onAudioData={handleAudioData} onStatusChange={(s) => setMicStatus(s)} />
        <ResumeUpload onResumeParsed={handleResumeParsed} position={position} />

        {/* Status indicators */}
        <div className="text-[9px] text-[#484f58] space-y-1">
          <div className="flex justify-between">
            <span>📷 摄像头</span>
            <span className={cameraStatus === "active" ? "text-[#3fb950]" : "text-[#8b949e]"}>
              {cameraStatus === "active" ? "运行中" : cameraStatus === "denied" ? "已拒绝" : cameraStatus === "error" ? "异常" : "未开启"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>🎤 麦克风</span>
            <span className={micStatus === "recording" ? "text-[#f85149]" : micStatus === "denied" ? "text-[#f85149]" : "text-[#8b949e]"}>
              {micStatus === "recording" ? "录音中" : micStatus === "denied" ? "已拒绝" : micStatus === "error" ? "异常" : "未开启"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>📄 简历</span>
            <span className={resumeData ? "text-[#3fb950]" : "text-[#8b949e]"}>
              {resumeData ? "已上传" : "未上传"}
            </span>
          </div>
        </div>
      </aside>

      {/* CENTER — 对话区 */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f1117]">
        <header className="bg-[#161b22] border-b border-[#21262d] px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleEnd} className="text-[#8b949e] hover:text-[#c9d1d9] text-sm">← 返回</button>
            <span className="font-semibold text-[#f0f6fc] text-sm">{positionName}</span>
            <span className="text-xs bg-[#1f6feb22] text-[#58a6ff] px-2.5 py-0.5 rounded-full font-medium">面试中</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#8b949e]">
            <span>第 <b className="text-[#f0f6fc]">{agentState.round}</b> 轮</span>
            <span>{String(Math.floor(agentState.round * 1.5)).padStart(2, "0")}:00</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.length === 0 && <div className="text-center text-[#8b949e] text-xs py-16">—— 面试即将开始 ——</div>}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-[#1f6feb33] flex items-center justify-center text-xs shrink-0 mt-1">🤖</div>
              )}
              <div className={`max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
                {msg.role === "assistant" && msg.decision && (
                  <div className="text-[10px] text-[#58a6ff] mb-1 ml-1">{msg.decision}</div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#1f6feb] text-white rounded-br-md"
                    : "bg-[#161b22] border border-[#30363d] text-[#e1e4e8] rounded-bl-md"
                }`}>
                  {msg.content}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-[#1f6feb] flex items-center justify-center text-xs shrink-0 mt-1">👤</div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#1f6feb33] flex items-center justify-center text-xs shrink-0 mt-1">🤖</div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-[#484f58] rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-[#484f58] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} /><div className="w-1.5 h-1.5 bg-[#484f58] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} /></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="bg-[#161b22] border-t border-[#21262d] px-5 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => handleSend()} disabled={loading}
              className="w-10 h-10 rounded-lg bg-[#0d1117] border border-[#30363d] text-[#58a6ff] text-lg flex items-center justify-center hover:border-[#58a6ff] shrink-0">🎤</button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={micStatus === "recording" ? "语音识别中..." : micStatus === "paused" ? "录音已暂停，点击继续或完成" : "输入你的回答..."} disabled={loading}
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm text-[#e1e4e8] outline-none focus:border-[#58a6ff] disabled:opacity-50" />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-lg bg-[#238636] text-white flex items-center justify-center text-lg hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#484f58] shrink-0"></button>
            <button onClick={handleEnd} className="px-4 h-10 rounded-lg bg-[#f8514922] text-[#f85149] text-xs font-medium hover:bg-[#f8514933] shrink-0">结束</button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Agent面板 */}
      <aside className="w-[320px] shrink-0 bg-[#161b22] border-l border-[#21262d] flex flex-col p-4 gap-4" style={{ minHeight: 0 }}>
        <div className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Agent 面板</div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm font-semibold text-[#c9d1d9] mb-2 flex items-center gap-2"><span></span> 意图识别</div>
          <div className="text-xs text-[#58a6ff] font-mono bg-[#161b22] rounded-lg px-3 py-2 border border-[#21262d]">{agentState.intent}</div>
        </div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm font-semibold text-[#c9d1d9] mb-2 flex items-center gap-2"><span></span> 记忆模块</div>
          <div className="space-y-1.5">
            {agentState.memory_topics.length > 0 ? agentState.memory_topics.map((t, i) => (
              <div key={i} className="text-xs text-[#8b949e] bg-[#161b22] rounded-lg px-3 py-1.5 border border-[#21262d]">{t}</div>
            )) : <div className="text-xs text-[#484f58]">等待上下文...</div>}
          </div>
        </div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm font-semibold text-[#c9d1d9] mb-2 flex items-center gap-2"><span></span> 工具调用</div>
          <div className="space-y-1.5">
            {agentState.tool_calls.length > 0 ? agentState.tool_calls.map((t, i) => (
              <div key={i} className="text-xs text-[#3fb950] font-mono bg-[#161b22] rounded-lg px-3 py-1.5 border border-[#21262d]">{t}</div>
            )) : <div className="text-xs text-[#484f58]">等待调用...</div>}
          </div>
        </div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm font-semibold text-[#c9d1d9] mb-2 flex items-center gap-2"><span></span> 任务规划</div>
          <div className="text-xs text-[#d2a8ff] font-mono bg-[#161b22] rounded-lg px-3 py-2 border border-[#21262d]">{agentState.task_plan}</div>
        </div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 flex-1 min-h-0 flex flex-col">
          <div className="text-sm font-semibold text-[#c9d1d9] mb-3 flex items-center gap-2 shrink-0"><span>📐</span> 18维实时评分</div>
          {dimEntries.length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-1">
              {dimEntries.map(([key, val]) => {
                const pct = Math.round((val as number) * 20);
                const color = (val as number) >= 4 ? "#3fb950" : (val as number) >= 3 ? "#d2991d" : "#f85149";
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#8b949e] w-[72px] text-right truncate shrink-0">{DIMENSION_LABELS[key] || key}</span>
                    <div className="flex-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} /></div>
                    <span className="text-[10px] font-mono font-semibold w-5 text-right" style={{ color }}>{(val as number).toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="text-2xl mb-1.5 opacity-40">📐</div><div className="text-xs text-[#484f58]">等待首轮回答...</div><div className="text-[9px] text-[#30363d] mt-1">回答后将自动显示18维评分</div></div></div>
          )}
          <div className="mt-3 pt-3 border-t border-[#21262d]">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#8b949e]">综合压力指数</span>
              <span className={`text-[10px] font-semibold ${agentState.pressure === "偏高" ? "text-[#f85149]" : "text-[#3fb950]"}`}>{agentState.pressure}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
