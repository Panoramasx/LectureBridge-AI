import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import type { RawData } from "ws";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const QWEN_BASE_URL = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_REALTIME_WS_URL = process.env.QWEN_REALTIME_WS_URL || "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
const QWEN_CHAT_MODEL = process.env.QWEN_CHAT_MODEL || "qwen3.7-plus";
const QWEN_REALTIME_MODEL = process.env.QWEN_REALTIME_MODEL || "qwen3.5-livetranslate-flash-realtime";
const QWEN_AUDIO_HTTP_MODEL = process.env.QWEN_AUDIO_HTTP_MODEL || "qwen3-livetranslate-flash";

app.use(express.json({ limit: "50mb" }));

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

const getDashScopeApiKey = () => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError("DASHSCOPE_API_KEY environment variable is missing.");
  }
  return apiKey;
};

const getQwenClient = () => {
  return new OpenAI({
    apiKey: getDashScopeApiKey(),
    baseURL: QWEN_BASE_URL,
  });
};

const stripJsonFences = (value: string) => {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
};

const parseJson = (value: string, routeName: string) => {
  try {
    return JSON.parse(stripJsonFences(value));
  } catch {
    throw new Error(`Qwen returned invalid JSON for ${routeName}.`);
  }
};

const qwenJson = async (routeName: string, prompt: string) => {
  const client = getQwenClient();
  const response = await client.chat.completions.create({
    model: QWEN_CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precise bilingual academic assistant. Always return only valid JSON. Do not use markdown fences.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Qwen returned an empty response for ${routeName}.`);
  }

  return parseJson(content, routeName);
};

const apiError = (res: express.Response, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof ConfigurationError ? 500 : 502;
  console.error(fallback, error);
  res.status(status).json({ success: false, error: message });
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asNumber = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

const normalizeTerms = (raw: any) => {
  const terms = asArray<any>(raw?.terms ?? raw);
  return terms
    .map((term) => ({
      term: asString(term?.term),
      chinese: asString(term?.chinese),
      phonetic: asString(term?.phonetic),
      definitionEn: asString(term?.definitionEn, asString(term?.definitionZh)),
      definitionZh: asString(term?.definitionZh, asString(term?.definitionEn)),
      category: asString(term?.category, "Jargon"),
    }))
    .filter((term) => term.term && term.chinese && term.definitionZh);
};

const normalizeAnalysis = (raw: any) => ({
  chineseSummary: asString(raw?.chineseSummary, "这段内容需要结合上下文进一步理解。"),
  difficulty: Math.min(5, Math.max(1, Math.round(asNumber(raw?.difficulty, 3)))),
  contextBridge: asString(raw?.contextBridge),
  detectedTerms: asArray<any>(raw?.detectedTerms).map((term) => ({
    term: asString(term?.term),
    chinese: asString(term?.chinese),
    definitionZh: asString(term?.definitionZh),
  })).filter((term) => term.term && term.chinese),
});

const normalizeSummary = (raw: any) => ({
  title: asString(raw?.title, "课堂阶段小结"),
  bulletPoints: asArray<string>(raw?.bulletPoints).filter(Boolean),
  keyConcepts: asArray<string>(raw?.keyConcepts).filter(Boolean),
  quickCatchUp: asString(raw?.quickCatchUp),
});

const normalizeRescue = (raw: any) => ({
  plainChineseExplanation: asString(raw?.plainChineseExplanation, "暂时无法生成稳定解释，请稍后重试。"),
  sentenceDeconstruction: asString(raw?.sentenceDeconstruction),
  suggestedQuestion: asString(raw?.suggestedQuestion, "Could you please clarify that point again?"),
  analogy: asString(raw?.analogy),
  keyVocab: asArray<any>(raw?.keyVocab).map((item) => ({
    term: asString(item?.term),
    chinese: asString(item?.chinese),
    explanation: asString(item?.explanation),
  })).filter((item) => item.term && item.chinese),
});

const normalizeNotes = (raw: any) => ({
  chineseSummary: asString(raw?.chineseSummary, "暂无概要。"),
  cueQuestions: asArray<any>(raw?.cueQuestions).map((item) => ({
    questionEn: asString(item?.questionEn),
    questionZh: asString(item?.questionZh),
    answerZh: asString(item?.answerZh),
  })).filter((item) => item.questionEn && item.answerZh),
  detailedNotesMarkdown: asString(raw?.detailedNotesMarkdown),
  flashcards: asArray<any>(raw?.flashcards).map((item) => ({
    front: asString(item?.front),
    back: asString(item?.back),
  })).filter((item) => item.front && item.back),
  quiz: asArray<any>(raw?.quiz).map((item) => ({
    question: asString(item?.question),
    options: asArray<string>(item?.options).filter(Boolean),
    correctIndex: Math.max(0, Math.round(asNumber(item?.correctIndex, 0))),
    explanationZh: asString(item?.explanationZh),
  })).filter((item) => item.question && item.options.length > 0),
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    provider: "qwen",
    chatModel: QWEN_CHAT_MODEL,
    realtimeModel: QWEN_REALTIME_MODEL,
    time: new Date().toISOString(),
  });
});

app.post("/api/auth/verify", (req, res) => {
  const configuredCode = (process.env.INVITE_CODE || "").trim();
  if (!configuredCode || configuredCode === "CHANGE_ME") {
    return res.json({ success: true, accessRequired: false });
  }

  const providedCode = String(req.body?.code || "").trim();
  res.json({ success: providedCode === configuredCode, accessRequired: true });
});

app.post("/api/preload-syllabus", async (req, res) => {
  try {
    const { courseTitle, rawContent } = req.body;
    const sourceText = String(rawContent || courseTitle || "").trim();
    if (!sourceText) {
      return res.status(400).json({ success: false, error: "Course material text is required." });
    }

    const prompt = `Analyze the following course material for Chinese international students taking English-taught university courses.

Course: "${courseTitle || "General Academic Course"}"

Course content:
${sourceText}

Return JSON exactly in this shape:
{
  "terms": [
    {
      "term": "English technical term",
      "chinese": "Accurate Chinese translation",
      "phonetic": "IPA or simple phonetic guide",
      "definitionEn": "Simplified English definition",
      "definitionZh": "Concise Chinese explanation",
      "category": "Core Concept | Method | Formula | Jargon"
    }
  ]
}

Extract 8 to 15 high-value technical academic terms likely to appear in lectures.`;

    const raw = await qwenJson("preload-syllabus", prompt);
    res.json({ success: true, terms: normalizeTerms(raw) });
  } catch (error) {
    apiError(res, error, "Failed to extract syllabus terms");
  }
});

app.post("/api/analyze-chunk", async (req, res) => {
  try {
    const { transcriptChunk, courseTitle, activeGlossary } = req.body;
    const transcriptText = String(transcriptChunk || "").trim();
    if (!transcriptText) {
      return res.status(400).json({ success: false, error: "Transcript chunk is required." });
    }

    const glossaryContext = Array.isArray(activeGlossary)
      ? activeGlossary.map((g: any) => `${g.term} (${g.chinese})`).join(", ")
      : "";

    const prompt = `You are a real-time classroom assistant for a Chinese student listening to an English lecture.

Course: "${courseTitle || "University Lecture"}"
Current lecture English speech segment:
"${transcriptText}"
Known course vocabulary context: [${glossaryContext}]

Return JSON exactly in this shape:
{
  "chineseSummary": "1-sentence Chinese core takeaway",
  "difficulty": 1,
  "contextBridge": "Chinese context bridge if useful, otherwise empty string",
  "detectedTerms": [
    { "term": "English term", "chinese": "Chinese translation", "definitionZh": "Concise Chinese explanation" }
  ]
}

Tasks:
1. Provide a concise, clear one-sentence Chinese logic takeaway.
2. Extract high-value technical terms in this segment.
3. Rate difficulty from 1 easy to 5 heavy jargon or fast dense speech.
4. Provide a quick Chinese context bridge if the segment builds on prior logic.`;

    const raw = await qwenJson("analyze-chunk", prompt);
    res.json({ success: true, analysis: normalizeAnalysis(raw) });
  } catch (error) {
    apiError(res, error, "Failed to analyze chunk");
  }
});

app.post("/api/progressive-summary", async (req, res) => {
  try {
    const { transcripts, courseTitle, minuteBlock } = req.body;
    const fullText = Array.isArray(transcripts) ? transcripts.join("\n").trim() : String(transcripts || "").trim();
    if (!fullText) {
      return res.status(400).json({ success: false, error: "Transcript text is required." });
    }

    const prompt = `Summarize the recent lecture block for Chinese students.

Course: "${courseTitle || "Lecture"}"
Block: ${minuteBlock || 1}

Transcript:
${fullText}

Return JSON exactly in this shape:
{
  "title": "Chinese title for this block",
  "bulletPoints": ["Chinese key point 1", "Chinese key point 2", "Chinese key point 3"],
  "keyConcepts": ["Formula, term, or framework"],
  "quickCatchUp": "2-sentence Chinese recap for students who lost focus"
}`;

    const raw = await qwenJson("progressive-summary", prompt);
    res.json({ success: true, summary: normalizeSummary(raw) });
  } catch (error) {
    apiError(res, error, "Failed to generate summary");
  }
});

app.post("/api/rescue-analysis", async (req, res) => {
  try {
    const { snippetText, courseTitle, timestamp } = req.body;
    const snippet = String(snippetText || "").trim();
    if (!snippet) {
      return res.status(400).json({ success: false, error: "Snippet text is required." });
    }

    const prompt = `A Chinese international student pressed the Rescue Button during an English lecture.

Course: "${courseTitle || "Academic Lecture"}"
Timestamp: ${timestamp || "recent"}
Confusing lecture speech snippet:
"${snippet}"

Return JSON exactly in this shape:
{
  "plainChineseExplanation": "Clear step-by-step Chinese explanation",
  "sentenceDeconstruction": "Breakdown of grammar, oral phrasing, idioms, or connected speech",
  "keyVocab": [
    { "term": "tricky vocabulary", "chinese": "Chinese translation", "explanation": "Chinese explanation" }
  ],
  "suggestedQuestion": "Polite English sentence the student can ask the professor or TA",
  "analogy": "Relatable Chinese analogy"
}`;

    const raw = await qwenJson("rescue-analysis", prompt);
    res.json({ success: true, rescueData: normalizeRescue(raw) });
  } catch (error) {
    apiError(res, error, "Failed to generate rescue analysis");
  }
});

app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { base64Audio } = req.body;
    if (!base64Audio) {
      return res.status(400).json({ success: false, error: "Audio data is required." });
    }

    res.status(501).json({
      success: false,
      error: `HTTP audio transcription fallback is reserved for ${QWEN_AUDIO_HTTP_MODEL}. Use WS /api/live-audio for the MVP realtime path.`,
    });
  } catch (error) {
    apiError(res, error, "Failed to transcribe audio");
  }
});

app.post("/api/generate-study-notes", async (req, res) => {
  try {
    const { fullTranscripts, courseTitle } = req.body;
    const fullText = Array.isArray(fullTranscripts)
      ? fullTranscripts.join("\n").trim()
      : String(fullTranscripts || "").trim();
    if (!fullText) {
      return res.status(400).json({ success: false, error: "Full transcript text is required." });
    }

    const prompt = `Convert this English lecture transcript into a Cornell Note study guide and bilingual review system.

Course: "${courseTitle || "Lecture"}"

Full transcript:
${fullText}

Return JSON exactly in this shape:
{
  "chineseSummary": "2-3 paragraph executive summary in Chinese",
  "cueQuestions": [
    { "questionEn": "English key question", "questionZh": "Chinese version", "answerZh": "Chinese answer" }
  ],
  "detailedNotesMarkdown": "Markdown detailed notes",
  "flashcards": [
    { "front": "English term or question", "back": "Chinese answer or explanation" }
  ],
  "quiz": [
    {
      "question": "Multiple-choice question",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanationZh": "Chinese explanation"
    }
  ]
}

Include 5 cue questions, 5 flashcards, and 3 quiz questions.`;

    const raw = await qwenJson("generate-study-notes", prompt);
    res.json({ success: true, notesData: normalizeNotes(raw) });
  } catch (error) {
    apiError(res, error, "Failed to generate study notes");
  }
});

type ClientAudioMessage = {
  type: "audio_chunk";
  sessionId?: string;
  seq?: number;
  mimeType?: string;
  base64Audio?: string;
  courseTitle?: string;
};

const buildRealtimeUrl = () => {
  const separator = QWEN_REALTIME_WS_URL.includes("?") ? "&" : "?";
  return `${QWEN_REALTIME_WS_URL}${separator}model=${encodeURIComponent(QWEN_REALTIME_MODEL)}`;
};

const safeJson = (data: RawData) => {
  try {
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
};

const findTextValue = (value: any): string => {
  if (!value || typeof value !== "object") return "";
  const directKeys = ["transcript", "text", "translation", "content"];
  for (const key of directKeys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  if (Array.isArray(value.content)) {
    for (const item of value.content) {
      const text = findTextValue(item);
      if (text) return text;
    }
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      const text = findTextValue(nested);
      if (text) return text;
    }
  }
  return "";
};

const shouldEmitTranscript = (event: any) => {
  const type = String(event?.type || "");
  return (
    type.includes("transcription") ||
    type.includes("translation") ||
    type === "response.text.done" ||
    type === "conversation.item.input_audio_transcription.completed"
  );
};

const setupLiveAudioWebSocket = (server: http.Server) => {
  const wss = new WebSocketServer({ server, path: "/api/live-audio" });

  wss.on("connection", (clientWs) => {
    let qwenWs: WebSocket | null = null;
    let latestSeq = 0;
    let sessionId = `session-${Date.now()}`;

    const sendClient = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const apiKey = getDashScopeApiKey();
      qwenWs = new WebSocket(buildRealtimeUrl(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
    } catch (error) {
      sendClient({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to initialize Qwen realtime client.",
      });
      clientWs.close(1011, "Qwen realtime configuration error");
      return;
    }

    qwenWs.on("open", () => {
      qwenWs?.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text"],
          input_audio_format: "pcm16",
          instructions:
            "Transcribe English university lecture audio accurately into punctuated English transcript text. Do not summarize.",
        },
      }));
      sendClient({ type: "ready", sessionId, model: QWEN_REALTIME_MODEL });
    });

    qwenWs.on("message", (data) => {
      const event = safeJson(data);
      if (!event) return;
      if (event.type === "error") {
        sendClient({
          type: "error",
          sessionId,
          seq: latestSeq,
          message: event.error?.message || event.message || "Qwen realtime error.",
        });
        return;
      }
      if (!shouldEmitTranscript(event)) return;
      const text = findTextValue(event);
      if (!text) return;
      sendClient({
        type: "transcript",
        sessionId,
        seq: latestSeq,
        textEn: text,
        punctuatedText: text,
        confidence: event.confidence,
      });
    });

    qwenWs.on("error", (error) => {
      sendClient({
        type: "error",
        sessionId,
        seq: latestSeq,
        message: error instanceof Error ? error.message : "Qwen realtime WebSocket error.",
      });
    });

    qwenWs.on("close", () => {
      sendClient({ type: "closed", sessionId });
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    });

    clientWs.on("message", (data) => {
      const message = safeJson(data) as ClientAudioMessage | null;
      if (!message || message.type !== "audio_chunk") return;
      if (!message.base64Audio) {
        sendClient({ type: "error", sessionId, seq: message.seq, message: "Empty audio chunk skipped." });
        return;
      }
      sessionId = message.sessionId || sessionId;
      latestSeq = typeof message.seq === "number" ? message.seq : latestSeq + 1;

      if (!qwenWs || qwenWs.readyState !== WebSocket.OPEN) {
        sendClient({ type: "error", sessionId, seq: latestSeq, message: "Qwen realtime connection is not ready." });
        return;
      }

      qwenWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: message.base64Audio }));
      qwenWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    });

    clientWs.on("close", () => {
      if (qwenWs && qwenWs.readyState === WebSocket.OPEN) {
        qwenWs.close();
      }
    });
  });
};

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  setupLiveAudioWebSocket(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`LectureBridge AI Qwen server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
