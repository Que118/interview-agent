"use client";

import { useState, useRef, useCallback } from "react";

export type UploadStatus = "idle" | "uploading" | "done" | "error";
export interface ResumeData {
  fileName: string;
  text: string;
  size: number;
}

interface Props {
  onResumeParsed: (data: ResumeData) => void;
  position: string;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const ALLOWED_EXT = [".pdf", ".docx", ".doc"];

export default function ResumeUpload({ onResumeParsed, position }: Props) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("拖拽或点击上传");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<ResumeData | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePDF = useCallback(async (arrayBuf: ArrayBuffer): Promise<string> => {
    // Simple PDF text extraction (no external lib)
    const bytes = new Uint8Array(arrayBuf);
    const text = new TextDecoder("utf-8").decode(bytes);
    // Extract readable text between stream/endstream
    const matches = text.match(/BT\s*\n([\s\S]*?)\n\s*ET/g) || [];
    if (matches.length > 0) {
      return matches.map(m => {
        const t = m.match(/\((.*?)\)\s*Tj/g);
        return t ? t.map(x => x.replace(/^\(|\)\s*Tj$/g, "")).join(" ") : "";
      }).filter(Boolean).join("\n");
    }
    // Fallback: strip binary, keep readable chars
    return text.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r]/g, " ").replace(/\s+/g, " ").trim();
  }, []);

  const parseDOCX = useCallback(async (arrayBuf: ArrayBuffer): Promise<string> => {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
      return result.value;
    } catch {
      // Fallback: try basic extraction
      const bytes = new Uint8Array(arrayBuf);
      return new TextDecoder("utf-8").decode(bytes).replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r]/g, " ").replace(/\s+/g, " ").trim();
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setStatus("error"); setStatusMsg(`不支持 ${ext} 格式`); return;
    }
    if (file.size > MAX_SIZE) {
      setStatus("error"); setStatusMsg("文件超过 5MB 限制"); return;
    }

    setStatus("uploading"); setStatusMsg("解析中..."); setProgress(30);

    try {
      const arrayBuf = await file.arrayBuffer();
      setProgress(60);
      let text = "";
      if (ext === ".pdf") text = await parsePDF(arrayBuf);
      else text = await parseDOCX(arrayBuf);

      setProgress(100);
      if (!text || text.length < 10) {
        setStatus("error"); setStatusMsg("无法提取文本内容"); return;
      }

      const data: ResumeData = { fileName: file.name, text, size: file.size };
      setPreview(data); setStatus("done"); setStatusMsg("解析完成");
      onResumeParsed(data);
    } catch {
      setStatus("error"); setStatusMsg("文件解析失败");
    }
  }, [parsePDF, parseDOCX, onResumeParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClick = () => fileInputRef.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearResume = () => { setPreview(null); setStatus("idle"); setStatusMsg("拖拽或点击上传"); setProgress(0); };

  const statusColors: Record<UploadStatus, string> = {
    idle: "bg-[#21262d] text-[#8b949e]", uploading: "bg-[#d2991d22] text-[#d2991d]",
    done: "bg-[#3fb95022] text-[#3fb950]", error: "bg-[#f8514922] text-[#f85149]",
  };

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
      <div className="text-sm font-semibold text-[#c9d1d9] mb-3 flex items-center gap-2">
        <span>📄</span> 简历上传
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-auto ${statusColors[status]}`}>{statusMsg}</span>
      </div>

      {preview && status === "done" ? (
        <div className="border border-[#3fb95033] rounded-lg p-3 bg-[#3fb9500a] mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#3fb950] font-medium">✅ {preview.fileName}</span>
            <button onClick={clearResume} className="text-[#8b949e] hover:text-[#f85149] text-xs">✕</button>
          </div>
          <div className="text-[10px] text-[#8b949e]">
            {(preview.size / 1024).toFixed(1)} KB · {preview.text.length} 字符
          </div>
          <div className="text-[9px] text-[#c9d1d9] mt-2 leading-relaxed max-h-[60px] overflow-y-auto bg-[#0d1117] rounded p-2">
            {preview.text.slice(0, 200)}...
          </div>
        </div>
      ) : status === "uploading" ? (
        <div className="border-2 border-dashed border-[#d2991d55] rounded-lg p-6 text-center mb-3">
          <div className="text-2xl mb-1">⏳</div>
          <div className="text-[10px] text-[#d2991d] mb-2">正在解析简历...</div>
          <div className="h-1 bg-[#21262d] rounded-full overflow-hidden">
            <div className="h-full bg-[#d2991d] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : status === "error" ? (
        <div className="border-2 border-dashed border-[#f8514955] rounded-lg p-6 text-center mb-3 cursor-pointer hover:border-[#f85149] transition-colors" onClick={handleClick}>
          <div className="text-2xl mb-1">⚠️</div>
          <div className="text-[10px] text-[#f85149]">{statusMsg}</div>
          <div className="text-[9px] text-[#484f58] mt-1">点击重试</div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-3 ${dragOver ? "border-[#58a6ff] bg-[#1f6feb0a]" : "border-[#21262d] hover:border-[#30363d]"}`}
          onClick={handleClick}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="text-2xl mb-1">📤</div>
          <div className="text-[10px] text-[#8b949e]">拖拽或点击上传</div>
          <div className="text-[9px] text-[#484f58] mt-1">PDF / DOCX · 最大 5MB</div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" onChange={handleChange} className="hidden" />
    </div>
  );
}
