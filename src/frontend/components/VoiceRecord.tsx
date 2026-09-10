"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type MicStatus = "idle" | "recording" | "paused" | "error" | "denied";

interface Props {
  onTranscript: (text: string, final: boolean) => void;
  onAudioData?: (wavBase64: string) => void;
  onStatusChange: (status: MicStatus, msg?: string) => void;
}

export default function VoiceRecord({ onTranscript, onAudioData, onStatusChange }: Props) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [displayText, setDisplayText] = useState("");
  const [charCount, setCharCount] = useState(0);

  // Use refs to avoid stale closures
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalTextRef = useRef("");
  const statusRef = useRef<MicStatus>("idle");

  const setBothStatus = useCallback((s: MicStatus, msg?: string) => {
    statusRef.current = s;
    setStatus(s);
    onStatusChange(s, msg);
  }, [onStatusChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { try { mediaRecorderRef.current.stop(); } catch {} }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
    };
  }, []);

  const stopAll = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { try { mediaRecorderRef.current.stop(); } catch {} mediaRecorderRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  const finishRecording = useCallback(() => {
    stopAll();
    setBothStatus("idle", "点击开始录音");
    // Push final text after a tick to let recognition onresult fire
    setTimeout(() => {
      const text = finalTextRef.current;
      if (text.trim()) {
        onTranscript(text, true);
      }
      finalTextRef.current = "";
      setDisplayText("");
      setCharCount(0);
    }, 150);
  }, [stopAll, setBothStatus, onTranscript]);

  const startRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      stopAll(); setBothStatus("error");
      alert("🎤 当前浏览器不支持语音识别，请使用 Chrome 浏览器");
      return null;
    }
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { finalTextRef.current += r[0].transcript; }
        else { interim += r[0].transcript; }
      }
      const full = finalTextRef.current + interim;
      setDisplayText(full);
      setCharCount(full.length);
      onTranscript(full, false);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed") { stopAll(); setBothStatus("denied"); alert("🎤 麦克风权限被拒绝"); }
      else if (e.error !== "no-speech" && e.error !== "aborted") { console.warn("Speech error:", e.error); }
    };
    rec.start();
    recognitionRef.current = rec;
    return rec;
  }, [stopAll, setBothStatus, onTranscript]);

  const startRecording = useCallback(async () => {
    stopAll();
    finalTextRef.current = "";
    setDisplayText("");
    setCharCount(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      // Speech recognition
      startRecognition();

      // MediaRecorder for audio capture
      try {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          chunksRef.current = [];
          if (blob.size > 0 && onAudioData) {
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = (reader.result as string).split(",")[1];
              if (b64) onAudioData(b64);
            };
            reader.readAsDataURL(blob);
          }
        };
        mr.start(1000);
        mediaRecorderRef.current = mr;
      } catch {}

      setBothStatus("recording", "● 录音中");
    } catch (err: any) {
      stopAll();
      const name = err?.name || "";
      if (name === "NotAllowedError") { setBothStatus("denied"); alert("🎤 麦克风权限被拒绝"); }
      else if (name === "NotFoundError") { setBothStatus("error"); alert("🎤 未检测到麦克风设备"); }
      else { setBothStatus("error"); alert(`🎤 错误: ${err?.message || ""}`); }
    }
  }, [stopAll, setBothStatus, startRecognition, onAudioData]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "recording") {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
      setBothStatus("paused", "⏸ 已暂停");
    } else if (statusRef.current === "paused") {
      startRecognition();
      setBothStatus("recording", "● 录音中");
    }
  }, [setBothStatus, startRecognition]);

  const clearText = useCallback(() => {
    finalTextRef.current = "";
    setDisplayText(""); setCharCount(0);
    onTranscript("", true);
  }, [onTranscript]);

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
      <div className="text-sm font-semibold text-[#c9d1d9] mb-3 flex items-center gap-2">
        <span>{status === "recording" ? "🔴" : status === "paused" ? "⏸️" : status === "error" || status === "denied" ? "⚠️" : "🎤"}</span> 语音输入
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-auto ${
          status === "recording" ? "bg-[#d2991d22] text-[#d2991d]" :
          status === "paused" ? "bg-[#8b949e22] text-[#8b949e]" :
          status === "error" || status === "denied" ? "bg-[#f8514922] text-[#f85149]" : "bg-[#21262d] text-[#8b949e]"
        }`}>{status === "recording" ? "● 录音中" : status === "paused" ? "⏸ 已暂停" : status === "denied" ? "被拒绝" : status === "error" ? "异常" : "待命"}</span>
      </div>

      {/* Text display area */}
      <div className="min-h-[56px] bg-[#020409] rounded-lg border border-[#21262d] mb-3 px-3 py-2.5">
        {status === "recording" ? (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-end gap-0.5 h-3">
                {[0.6, 0.9, 0.4, 0.8, 0.5, 0.7, 0.3].map((h, i) => (
                  <div key={i} className="w-0.5 bg-[#f85149] rounded animate-pulse"
                    style={{ height: `${h * 12}px`, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[10px] text-[#f85149] font-medium">录音中</span>
              <span className="text-[9px] text-[#484f58] ml-auto">{charCount} 字</span>
            </div>
            <div className="text-[10px] text-[#c9d1d9] leading-relaxed max-h-[80px] overflow-y-auto whitespace-pre-wrap">
              {displayText || "正在聆听..."}
            </div>
          </div>
        ) : status === "paused" ? (
          <div>
            <div className="text-[10px] text-[#8b949e] mb-1">⏸ 录音已暂停</div>
            <div className="text-[10px] text-[#c9d1d9] leading-relaxed max-h-[80px] overflow-y-auto">
              {displayText || "(空)"}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1.5">
            <div className="text-center">
              <div className="text-lg mb-0.5">{status === "denied" ? "🚫" : status === "error" ? "⚠️" : "🎤"}</div>
              <div className="text-[10px] text-[#484f58]">
                {status === "denied" ? "麦克风权限被拒" : status === "error" ? "麦克风异常" : "点击下方按钮开始"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {status === "idle" || status === "error" || status === "denied" ? (
          <button onClick={startRecording}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors bg-[#d2991d22] text-[#d2991d] hover:bg-[#d2991d33]">
            🎙️ 开始录音
          </button>
        ) : (
          <>
            <button onClick={togglePause}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                status === "recording" ? "bg-[#8b949e22] text-[#8b949e] hover:bg-[#8b949e33]" :
                "bg-[#d2991d22] text-[#d2991d] hover:bg-[#d2991d33]"
              }`}>
              {status === "recording" ? "⏸ 暂停" : "▶ 继续"}
            </button>
            <button onClick={finishRecording}
              className="flex-1 py-2 rounded-lg bg-[#3fb95022] text-[#3fb950] text-xs font-medium hover:bg-[#3fb95033] transition-colors">
              ✅ 完成
            </button>
            <button onClick={clearText}
              className="py-2 px-3 rounded-lg bg-[#21262d] text-[#8b949e] text-xs font-medium hover:bg-[#f8514933] hover:text-[#f85149] transition-colors">
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}
