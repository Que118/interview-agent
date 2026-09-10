"use client";

import { useState, useEffect } from "react";

interface InterviewRecord {
  id: string;
  position: string;
  positionName: string;
  date: string;
  turns: number;
  overallScore: number;
  summary: string;
  dimensions: Record<string, number>;
}

const STORAGE_KEY = "interview_records";

function loadRecords(): InterviewRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function RecordsView({
  onStartInterview,
  onViewReport,
  positions,
}: {
  onStartInterview: (id: string, name: string) => void;
  onViewReport: (record: InterviewRecord) => void;
  positions: { id: string; name: string; icon: string; color: string }[];
}) {
  const [records, setRecords] = useState<InterviewRecord[]>([]);

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  const recordsByPosition = records.reduce((acc, r) => {
    if (!acc[r.position]) acc[r.position] = [];
    acc[r.position].push(r);
    return acc;
  }, {} as Record<string, InterviewRecord[]>);

  if (records.length === 0) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 w-full">
          <h2 className="text-xl font-bold text-[#f0f6fc] mb-1">📋 面试记录</h2>
          <p className="text-[#8b949e] text-sm mb-8">查看过往面试的复盘报告与评分趋势。</p>
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-[#8b949e] text-sm mb-4">还没有面试记录</p>
            <p className="text-[#484f58] text-xs mb-6">开始一次面试后，报告会自动保存到这里</p>
            <div className="grid grid-cols-5 gap-2">
              {positions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onStartInterview(p.id, p.name)}
                  className="bg-[#0d1117] border border-[#21262d] rounded-lg p-2 hover:border-[#58a6ff] transition-all"
                  title={p.name}
                >
                  <div className="text-lg mb-0.5">{p.icon}</div>
                  <div className="text-[9px] text-[#8b949e] truncate">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const handleClearRecords = () => {
    if (confirm("确定要清除所有面试记录吗？此操作不可恢复。")) {
      localStorage.removeItem(STORAGE_KEY);
      setRecords([]);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#f0f6fc] mb-1">📋 面试记录</h2>
            <p className="text-[#8b949e] text-sm">共 {records.length} 次 · 查看复盘报告</p>
          </div>
          <div className="flex gap-2 items-center">
            {positions.slice(0, 3).map((p) => (
              <button
                key={p.id}
                onClick={() => onStartInterview(p.id, p.name)}
                className="px-3 py-1.5 bg-[#238636] text-white text-xs rounded-lg font-medium hover:bg-[#2ea043] transition-colors"
              >
                + {p.name}
              </button>
            ))}
            {records.length > 0 && (
              <button onClick={handleClearRecords} className="px-3 py-1.5 bg-[#f8514922] text-[#f85149] text-xs rounded-lg hover:bg-[#f8514933] transition-colors">
                🗑 清除记录
              </button>
            )}
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
            <div className="text-[11px] text-[#8b949e] mb-1">总面试数</div>
            <div className="text-2xl font-bold text-[#f0f6fc]">{records.length}</div>
          </div>
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
            <div className="text-[11px] text-[#8b949e] mb-1">平均评分</div>
            <div className="text-2xl font-bold text-[#f0f6fc]">
              {(records.reduce((s, r) => s + r.overallScore, 0) / records.length).toFixed(1)}
            </div>
          </div>
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
            <div className="text-[11px] text-[#8b949e] mb-1">涉及岗位</div>
            <div className="text-2xl font-bold text-[#f0f6fc]">{Object.keys(recordsByPosition).length}</div>
          </div>
        </div>

        {/* Records list */}
        <div className="space-y-2">
          {records.map((record) => {
            const pos = positions.find((p) => p.id === record.position);
            const color = (record.overallScore >= 4) ? "#3fb950" : (record.overallScore >= 3) ? "#d2991d" : "#f85149";
            return (
              <button
                key={record.id}
                onClick={() => onViewReport(record)}
                className="w-full bg-[#161b22] border border-[#21262d] rounded-xl p-4 text-left hover:border-[#30363d] transition-all flex items-center gap-4 group"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                  style={{ background: `${pos?.color || "#58a6ff"}22`, color: pos?.color || "#58a6ff" }}
                >
                  {pos?.icon || "📋"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[#f0f6fc] group-hover:text-[#58a6ff]">
                      {record.positionName}
                    </span>
                    <span className="text-[10px] bg-[#1f6feb22] text-[#58a6ff] px-1.5 py-0.5 rounded">{record.date}</span>
                  </div>
                  <div className="text-[11px] text-[#8b949e] truncate">{record.summary}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold" style={{ color }}>{record.overallScore.toFixed(1)}</div>
                  <div className="text-[10px] text-[#484f58]">{record.turns}轮</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
