// [DEPLOY] API_BASE 可通过环境变量覆盖，支持静态部署时直连后端
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DimensionOut {
  name: string;
  score: number;
  evidence: string;
  modality: string;
}

interface ChatResponse {
  session_id: string;
  reply: string;
  agent_decision?: string | null;
  dimensions: DimensionOut[];
  overall_score?: number | null;
  analysis_summary: string;
  pressure_level: number;
  knowledge_used: number;
}

export interface FaceDataPayload {
  left_eye_open: number;
  right_eye_open: number;
  eye_blink_rate: number;
  gaze_x: number;
  gaze_y: number;
  gaze_stability: number;
  head_yaw: number;
  head_pitch: number;
  head_roll: number;
  head_movement: number;
  smile_ratio: number;
  expression_variance: number;
  face_present: boolean;
  face_confidence: number;
  duration_seconds: number;
}

let sessionId = "";

export async function sendMessage(
  position: string,
  messages: ChatMessage[],
  opts?: {
    faceData?: FaceDataPayload;
    voiceWavBase64?: string;
    voiceSampleRate?: number;
    resumeText?: string;
    backgroundData?: Record<string, any>;
  }
): Promise<ChatResponse & { dimensions_snapshot?: Record<string, number> }> {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  const body: any = {
    session_id: sessionId,
    position,
    messages,
  };

  if (opts?.faceData) body.face_data = opts.faceData;
  if (opts?.voiceWavBase64) {
    body.voice_wav_base64 = opts.voiceWavBase64;
    body.voice_sample_rate = opts.voiceSampleRate || 16000;
  }
  if (opts?.resumeText) body.resume_text = opts.resumeText;
  if (opts?.backgroundData) body.background_data = opts.backgroundData;

  // [DEPLOY] 新增超时控制（30秒）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data: ChatResponse = await res.json();

  const dimensions_snapshot: Record<string, number> = {};
  if (data.dimensions) {
    for (const d of data.dimensions) {
      dimensions_snapshot[d.name] = Math.round(d.score / 20 * 10) / 10;
    }
  }

  return { ...data, dimensions_snapshot };
}

export async function fetchReport(sid: string) {
  const res = await fetch(`${API_BASE}/report/${sid}`);
  if (!res.ok) throw new Error(`Report error: ${res.status}`);
  return res.json();
}

export function getSessionId() { return sessionId; }
export function resetSession() { sessionId = ""; }
export function forceNewSession() {
  sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  return sessionId;
}
