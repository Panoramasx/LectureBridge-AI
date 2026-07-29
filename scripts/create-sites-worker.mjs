import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const contentTypeByExtension = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const staticAssets = {};

const collectStaticAssets = (directory) => {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const relativePath = relative("dist", absolutePath).split(sep).join("/");

    if (relativePath === "server" || relativePath.startsWith("server/")) continue;
    if (relativePath === ".openai" || relativePath.startsWith(".openai/")) continue;
    if (relativePath === "server.cjs" || relativePath === "server.cjs.map") continue;

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      collectStaticAssets(absolutePath);
      continue;
    }

    staticAssets[`/${relativePath}`] = {
      contentType: contentTypeByExtension[extname(relativePath)] || "application/octet-stream",
      base64: readFileSync(absolutePath).toString("base64")
    };
  }
};

collectStaticAssets("dist");

const workerSource = `const staticAssets = ${JSON.stringify(staticAssets)};

const decodeBase64 = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const staticResponse = (request, pathname) => {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const asset =
    staticAssets[pathname] ||
    staticAssets[pathname.endsWith("/") ? \`\${pathname}index.html\` : \`\${pathname}/index.html\`];

  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const fallbackAsset = acceptsHtml ? staticAssets["/index.html"] : null;
  const selected = asset || fallbackAsset;
  if (!selected) return null;

  return new Response(request.method === "HEAD" ? null : decodeBase64(selected.base64), {
    headers: {
      "content-type": selected.contentType,
      "cache-control": selected.contentType.startsWith("text/html")
        ? "no-cache"
        : "public, max-age=31536000, immutable"
    }
  });
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const asArray = (value) => Array.isArray(value) ? value : [];
const asString = (value, fallback = "") => typeof value === "string" ? value : fallback;
const asNumber = (value, fallback) => typeof value === "number" ? value : fallback;
const qwenTimeoutMs = (env) => Number(env.QWEN_HTTP_TIMEOUT_MS || 45000);

const encodeBase64Url = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
};

const signGatewayPayload = async (secret, payload) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  let binary = "";
  signature.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
};

const createGatewayToken = async (env, sessionId) => {
  const secret = String(env.AUDIO_GATEWAY_SHARED_SECRET || "");
  if (!secret) {
    const error = new Error("AUDIO_GATEWAY_SHARED_SECRET environment variable is missing.");
    error.status = 500;
    throw error;
  }
  const payload = encodeBase64Url(JSON.stringify({
    sessionId,
    exp: Math.floor(Date.now() / 1000) + 120,
    nonce: crypto.randomUUID()
  }));
  return payload + "." + await signGatewayPayload(secret, payload);
};

const stripJsonFences = (value) =>
  String(value || "")
    .trim()
    .replace(/^\\\`\\\`\\\`(?:json)?\\s*/i, "")
    .replace(/\\s*\\\`\\\`\\\`$/i, "")
    .trim();

const parseJson = (value, routeName) => {
  try {
    return JSON.parse(stripJsonFences(value));
  } catch {
    throw new Error(\`Qwen returned invalid JSON for \${routeName}.\`);
  }
};

const qwenJson = async (env, routeName, prompt) => {
  if (!env.DASHSCOPE_API_KEY) {
    const error = new Error("DASHSCOPE_API_KEY environment variable is missing.");
    error.status = 500;
    throw error;
  }

  const baseUrl = env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), qwenTimeoutMs(env));
  let response;
  try {
    response = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "authorization": \`Bearer \${env.DASHSCOPE_API_KEY}\`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env.QWEN_CHAT_MODEL || "qwen3.7-plus",
        temperature: 0.2,
        max_tokens: 1200,
        enable_thinking: false,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a precise bilingual academic assistant. Always return only valid JSON. Do not use markdown fences."
          },
          { role: "user", content: prompt }
        ]
      })
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || \`Qwen request failed for \${routeName}.\`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(\`Qwen returned an empty response for \${routeName}.\`);
  }
  return parseJson(content, routeName);
};

const apiError = (error, fallback) => {
  const message = error instanceof Error ? error.message : fallback;
  return json({ success: false, error: message }, error?.status || 502);
};

const getAudioFormat = (mimeType, explicitFormat) => {
  const format = explicitFormat || mimeType?.split(";")[0]?.split("/")[1] || "wav";
  if (format === "mpeg") return "mp3";
  if (format === "x-wav") return "wav";
  return format.toLowerCase();
};

const normalizeAudioData = (base64Audio, audioUrl, mimeType) => {
  const trimmedUrl = String(audioUrl || "").trim();
  if (trimmedUrl) return trimmedUrl;

  const trimmedAudio = String(base64Audio || "").trim();
  if (!trimmedAudio) return "";
  if (trimmedAudio.startsWith("data:") || /^https?:\\/\\//i.test(trimmedAudio)) return trimmedAudio;
  return \`data:\${mimeType || "audio/wav"};base64,\${trimmedAudio}\`;
};

const parseSseJsonLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const extractTextFromCompletionChunk = (chunk) => {
  const delta = chunk?.choices?.[0]?.delta;
  return [
    delta?.content,
    delta?.audio?.transcript,
    delta?.audio?.translation,
    chunk?.output_text,
    chunk?.text
  ]
    .filter((value) => typeof value === "string")
    .join("");
};

const transcribeAudioWithQwen = async (env, payload) => {
  const audioData = normalizeAudioData(payload?.base64Audio, payload?.audioUrl, payload?.mimeType);
  if (!audioData) {
    const error = new Error("Audio data is required.");
    error.status = 400;
    throw error;
  }

  if (!env.DASHSCOPE_API_KEY) {
    const error = new Error("DASHSCOPE_API_KEY environment variable is missing.");
    error.status = 500;
    throw error;
  }

  const baseUrl = (env.QWEN_AUDIO_BASE_URL || env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), qwenTimeoutMs(env));
  let response;
  try {
    response = await fetch(\`\${baseUrl}/chat/completions\`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "authorization": \`Bearer \${env.DASHSCOPE_API_KEY}\`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env.QWEN_AUDIO_HTTP_MODEL || "qwen3-livetranslate-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audioData,
                  format: getAudioFormat(payload?.mimeType, payload?.format)
                }
              }
            ]
          }
        ],
        modalities: ["text"],
        stream: true,
        stream_options: { include_usage: false },
        translation_options: {
          source_lang: payload?.sourceLang || "en",
          target_lang: payload?.targetLang || "zh"
        }
      })
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    const error = new Error(message || \`Qwen audio transcription failed with HTTP \${response.status}.\`);
    error.status = response.status;
    throw error;
  }
  if (!response.body) throw new Error("Qwen audio transcription returned an empty stream.");

  let translatedText = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split(/\\r?\\n/)) {
      const chunk = parseSseJsonLine(line);
      if (chunk) translatedText += extractTextFromCompletionChunk(chunk);
    }
  }

  const finalText = translatedText.trim();
  if (!finalText) throw new Error("Qwen audio transcription returned no text.");
  return finalText;
};

const normalizeTerms = (raw) => {
  const terms = asArray(raw?.terms ?? raw);
  return terms
    .map((term) => ({
      term: asString(term?.term),
      chinese: asString(term?.chinese),
      phonetic: asString(term?.phonetic),
      definitionEn: asString(term?.definitionEn, asString(term?.definitionZh)),
      definitionZh: asString(term?.definitionZh, asString(term?.definitionEn)),
      category: asString(term?.category, "Jargon")
    }))
    .filter((term) => term.term && term.chinese && term.definitionZh);
};

const normalizeAnalysis = (raw) => ({
  chineseSummary: asString(raw?.chineseSummary, "这段内容需要结合上下文进一步理解。"),
  difficulty: Math.min(5, Math.max(1, Math.round(asNumber(raw?.difficulty, 3)))),
  contextBridge: asString(raw?.contextBridge),
  detectedTerms: asArray(raw?.detectedTerms)
    .map((term) => ({
      term: asString(term?.term),
      chinese: asString(term?.chinese),
      definitionZh: asString(term?.definitionZh)
    }))
    .filter((term) => term.term && term.chinese)
});

const normalizeSummary = (raw) => ({
  title: asString(raw?.title, "课堂阶段小结"),
  bulletPoints: asArray(raw?.bulletPoints).filter(Boolean),
  keyConcepts: asArray(raw?.keyConcepts).filter(Boolean),
  quickCatchUp: asString(raw?.quickCatchUp)
});

const normalizeRescue = (raw) => ({
  plainChineseExplanation: asString(raw?.plainChineseExplanation, "暂时无法生成稳定解释，请稍后重试。"),
  sentenceDeconstruction: asString(raw?.sentenceDeconstruction),
  suggestedQuestion: asString(raw?.suggestedQuestion, "Could you please clarify that point again?"),
  analogy: asString(raw?.analogy),
  keyVocab: asArray(raw?.keyVocab)
    .map((item) => ({
      term: asString(item?.term),
      chinese: asString(item?.chinese),
      explanation: asString(item?.explanation)
    }))
    .filter((item) => item.term && item.chinese)
});

const normalizeNotes = (raw) => ({
  chineseSummary: asString(raw?.chineseSummary, "暂无概要。"),
  cueQuestions: asArray(raw?.cueQuestions)
    .map((item) => ({
      questionEn: asString(item?.questionEn),
      questionZh: asString(item?.questionZh),
      answerZh: asString(item?.answerZh)
    }))
    .filter((item) => item.questionEn && item.answerZh),
  detailedNotesMarkdown: asString(raw?.detailedNotesMarkdown),
  flashcards: asArray(raw?.flashcards)
    .map((item) => ({
      front: asString(item?.front),
      back: asString(item?.back)
    }))
    .filter((item) => item.front && item.back),
  quiz: asArray(raw?.quiz)
    .map((item) => ({
      question: asString(item?.question),
      options: asArray(item?.options).filter(Boolean),
      correctIndex: Math.max(0, Math.round(asNumber(item?.correctIndex, 0))),
      explanationZh: asString(item?.explanationZh)
    }))
    .filter((item) => item.question && item.options.length > 0)
});

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const buildRealtimeUrl = (env) => {
  const baseUrl = env.QWEN_REALTIME_WS_URL || "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
  const model = env.QWEN_REALTIME_MODEL || "qwen3.5-livetranslate-flash-realtime";
  const separator = baseUrl.includes("?") ? "&" : "?";
  return \`\${baseUrl}\${separator}model=\${encodeURIComponent(model)}\`;
};

const buildRealtimeFetchUrl = (env) => {
  return buildRealtimeUrl(env)
    .replace(/^wss:\\/\\//i, "https://")
    .replace(/^ws:\\/\\//i, "http://");
};

const buildRealtimeSessionUpdate = () => ({
  event_id: \`session-\${Date.now()}\`,
  type: "session.update",
  session: {
    modalities: ["text"],
    sample_rate: 16000,
    input_audio_format: "pcm",
    input_audio_transcription: {
      model: "qwen3-asr-flash-realtime",
      language: "en"
    },
    translation: {
      language: "zh"
    }
  }
});

const findTextValue = (value) => {
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

const shouldEmitTranscript = (event) => {
  const type = String(event?.type || "");
  return (
    type.includes("transcription") ||
    type.includes("translation") ||
    type === "response.text.done" ||
    type === "conversation.item.input_audio_transcription.completed"
  );
};

const handleLiveAudioWebSocket = async (request, env) => {
  if (request.headers.get("upgrade") !== "websocket") {
    return json({ success: false, error: "WebSocket upgrade required." }, 426);
  }
  if (!env.DASHSCOPE_API_KEY) {
    return json({ success: false, error: "DASHSCOPE_API_KEY environment variable is missing." }, 500);
  }
  if (typeof WebSocketPair !== "function") {
    return json({ success: false, error: "WebSocket runtime is not available in this deployment." }, 501);
  }

  const pair = new WebSocketPair();
  const [clientSocket, serverSocket] = Object.values(pair);
  serverSocket.accept();

  let qwenSocket = null;
  let sessionId = \`session-\${Date.now()}\`;
  let latestSeq = 0;

  const sendClient = (payload) => {
    try {
      serverSocket.send(JSON.stringify(payload));
    } catch {
      // Client has already disconnected.
    }
  };

  let qwenResponse;
  try {
    qwenResponse = await fetch(buildRealtimeFetchUrl(env), {
      headers: {
        "authorization": \`Bearer \${env.DASHSCOPE_API_KEY}\`,
        "upgrade": "websocket"
      }
    });
  } catch (error) {
    sendClient({
      type: "error",
      sessionId,
      seq: latestSeq,
      message: error instanceof Error ? error.message : "Qwen realtime connection failed."
    });
    serverSocket.close(1011, "Qwen realtime connection failed");
    return new Response(null, { status: 101, webSocket: clientSocket });
  }

  if (qwenResponse.status !== 101 || !qwenResponse.webSocket) {
    sendClient({ type: "error", message: \`Qwen realtime connection failed with HTTP \${qwenResponse.status}.\` });
    serverSocket.close(1011, "Qwen realtime connection failed");
    return new Response(null, { status: 101, webSocket: clientSocket });
  }

  qwenSocket = qwenResponse.webSocket;
  qwenSocket.accept();
  qwenSocket.send(JSON.stringify(buildRealtimeSessionUpdate()));
  sendClient({
    type: "ready",
    sessionId,
    model: env.QWEN_REALTIME_MODEL || "qwen3.5-livetranslate-flash-realtime"
  });

  qwenSocket.addEventListener("message", (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.type === "error") {
      sendClient({
        type: "error",
        sessionId,
        seq: latestSeq,
        message: payload.error?.message || payload.message || "Qwen realtime error."
      });
      return;
    }
    if (!shouldEmitTranscript(payload)) return;
    const text = findTextValue(payload);
    if (!text) return;
    sendClient({
      type: "transcript",
      sessionId,
      seq: latestSeq,
      textEn: text,
      punctuatedText: text,
      confidence: payload.confidence
    });
  });

  qwenSocket.addEventListener("close", () => {
    sendClient({ type: "closed", sessionId });
    try {
      serverSocket.close();
    } catch {
      // Ignore close races.
    }
  });

  qwenSocket.addEventListener("error", () => {
    sendClient({ type: "error", sessionId, seq: latestSeq, message: "Qwen realtime WebSocket error." });
  });

  serverSocket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message?.type !== "audio_chunk") return;
    sessionId = message.sessionId || sessionId;
    latestSeq = typeof message.seq === "number" ? message.seq : latestSeq + 1;

    if (!message.base64Audio) {
      sendClient({ type: "error", sessionId, seq: latestSeq, message: "Empty audio chunk skipped." });
      return;
    }
    if (!qwenSocket || qwenSocket.readyState !== 1) {
      sendClient({ type: "error", sessionId, seq: latestSeq, message: "Qwen realtime connection is not ready." });
      return;
    }

    qwenSocket.send(JSON.stringify({
      event_id: \`audio-\${sessionId}-\${latestSeq}\`,
      type: "input_audio_buffer.append",
      audio: message.base64Audio
    }));
  });

  serverSocket.addEventListener("close", () => {
    if (qwenSocket && qwenSocket.readyState === 1) qwenSocket.close();
  });

  return new Response(null, { status: 101, webSocket: clientSocket });
};

const handlePreloadSyllabus = async (request, env) => {
  try {
    const { courseTitle, rawContent } = await readJson(request);
    const sourceText = String(rawContent || courseTitle || "").trim();
    if (!sourceText) return json({ success: false, error: "Course material text is required." }, 400);
    const prompt = \`Analyze the following course material for Chinese international students taking English-taught university courses.

Course: "\${courseTitle || "General Academic Course"}"

Course content:
\${sourceText}

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

Extract 8 to 15 high-value technical academic terms likely to appear in lectures.\`;
    const raw = await qwenJson(env, "preload-syllabus", prompt);
    return json({ success: true, terms: normalizeTerms(raw) });
  } catch (error) {
    return apiError(error, "Failed to extract syllabus terms");
  }
};

const handleAnalyzeChunk = async (request, env) => {
  try {
    const { transcriptChunk, courseTitle, activeGlossary } = await readJson(request);
    const transcriptText = String(transcriptChunk || "").trim();
    if (!transcriptText) return json({ success: false, error: "Transcript chunk is required." }, 400);
    const glossaryContext = Array.isArray(activeGlossary)
      ? activeGlossary.map((g) => \`\${g.term} (\${g.chinese})\`).join(", ")
      : "";
    const prompt = \`You are a real-time classroom assistant for a Chinese student listening to an English lecture.

Course: "\${courseTitle || "University Lecture"}"
Current lecture English speech segment:
"\${transcriptText}"
Known course vocabulary context: [\${glossaryContext}]

Return JSON exactly in this shape:
{
  "chineseSummary": "1-sentence Chinese core takeaway",
  "difficulty": 1,
  "contextBridge": "Chinese context bridge if useful, otherwise empty string",
  "detectedTerms": [
    { "term": "English term", "chinese": "Chinese translation", "definitionZh": "Concise Chinese explanation" }
  ]
}\`;
    const raw = await qwenJson(env, "analyze-chunk", prompt);
    return json({ success: true, analysis: normalizeAnalysis(raw) });
  } catch (error) {
    return apiError(error, "Failed to analyze chunk");
  }
};

const handleProgressiveSummary = async (request, env) => {
  try {
    const { transcripts, courseTitle, minuteBlock } = await readJson(request);
    const fullText = Array.isArray(transcripts) ? transcripts.join("\\n").trim() : String(transcripts || "").trim();
    if (!fullText) return json({ success: false, error: "Transcript text is required." }, 400);
    const prompt = \`Summarize the recent lecture block for Chinese students.

Course: "\${courseTitle || "Lecture"}"
Block: \${minuteBlock || 1}

Transcript:
\${fullText}

Return JSON exactly in this shape:
{
  "title": "Chinese title for this block",
  "bulletPoints": ["Chinese key point 1", "Chinese key point 2", "Chinese key point 3"],
  "keyConcepts": ["Formula, term, or framework"],
  "quickCatchUp": "2-sentence Chinese recap for students who lost focus"
}\`;
    const raw = await qwenJson(env, "progressive-summary", prompt);
    return json({ success: true, summary: normalizeSummary(raw) });
  } catch (error) {
    return apiError(error, "Failed to generate summary");
  }
};

const handleRescueAnalysis = async (request, env) => {
  try {
    const { snippetText, courseTitle, timestamp } = await readJson(request);
    const snippet = String(snippetText || "").trim();
    if (!snippet) return json({ success: false, error: "Snippet text is required." }, 400);
    const prompt = \`A Chinese international student pressed the Rescue Button during an English lecture.

Course: "\${courseTitle || "Academic Lecture"}"
Timestamp: \${timestamp || "recent"}
Confusing lecture speech snippet:
"\${snippet}"

Return JSON exactly in this shape:
{
  "plainChineseExplanation": "Clear step-by-step Chinese explanation",
  "sentenceDeconstruction": "Breakdown of grammar, oral phrasing, idioms, or connected speech",
  "keyVocab": [
    { "term": "tricky vocabulary", "chinese": "Chinese translation", "explanation": "Chinese explanation" }
  ],
  "suggestedQuestion": "Polite English sentence the student can ask the professor or TA",
  "analogy": "Relatable Chinese analogy"
}\`;
    const raw = await qwenJson(env, "rescue-analysis", prompt);
    return json({ success: true, rescueData: normalizeRescue(raw) });
  } catch (error) {
    return apiError(error, "Failed to generate rescue analysis");
  }
};

const handleStudyNotes = async (request, env) => {
  try {
    const { fullTranscripts, courseTitle } = await readJson(request);
    const fullText = Array.isArray(fullTranscripts)
      ? fullTranscripts.join("\\n").trim()
      : String(fullTranscripts || "").trim();
    if (!fullText) return json({ success: false, error: "Full transcript text is required." }, 400);
    const prompt = \`Convert this English lecture transcript into a Cornell Note study guide and bilingual review system.

Course: "\${courseTitle || "Lecture"}"

Full transcript:
\${fullText}

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

Include 5 cue questions, 5 flashcards, and 3 quiz questions.\`;
    const raw = await qwenJson(env, "generate-study-notes", prompt);
    return json({ success: true, notesData: normalizeNotes(raw) });
  } catch (error) {
    return apiError(error, "Failed to generate study notes");
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        provider: "qwen",
        runtime: "sites-worker",
        chatModel: env.QWEN_CHAT_MODEL || "qwen3.7-plus",
        realtimeModel: env.QWEN_REALTIME_MODEL || "qwen3.5-livetranslate-flash-realtime",
        audioHttpModel: env.QWEN_AUDIO_HTTP_MODEL || "qwen3-livetranslate-flash",
        qwenConfigured: Boolean(env.DASHSCOPE_API_KEY),
        time: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/client-config" && request.method === "GET") {
      return json({
        audioGatewayUrl: env.PUBLIC_AUDIO_GATEWAY_URL || "",
        liveAudioMode: env.LIVE_AUDIO_MODE || "gateway-first",
        httpAudioFallback: env.HTTP_AUDIO_FALLBACK !== "false",
        gatewayTokenEndpoint: "/api/live-audio-token"
      });
    }

    if (url.pathname === "/api/live-audio-token" && request.method === "POST") {
      try {
        const body = await readJson(request);
        const sessionId = String(body.sessionId || "session-" + Date.now());
        return json({ success: true, token: await createGatewayToken(env, sessionId), expiresIn: 120 });
      } catch (error) {
        return apiError(error, "Failed to authorize live audio");
      }
    }

    if (url.pathname === "/api/auth/verify" && request.method === "POST") {
      const configuredCode = (env.INVITE_CODE || "").trim();
      if (!configuredCode || configuredCode === "CHANGE_ME") {
        return json({ success: true, accessRequired: false });
      }
      const body = await readJson(request);
      return json({
        success: String(body.code || "").trim() === configuredCode,
        accessRequired: true
      });
    }

    if (request.method === "POST" && url.pathname === "/api/preload-syllabus") return handlePreloadSyllabus(request, env);
    if (request.method === "POST" && url.pathname === "/api/analyze-chunk") return handleAnalyzeChunk(request, env);
    if (request.method === "POST" && url.pathname === "/api/progressive-summary") return handleProgressiveSummary(request, env);
    if (request.method === "POST" && url.pathname === "/api/rescue-analysis") return handleRescueAnalysis(request, env);
    if (request.method === "POST" && url.pathname === "/api/generate-study-notes") return handleStudyNotes(request, env);

    if (request.method === "POST" && url.pathname === "/api/transcribe-audio") {
      try {
        const body = await readJson(request);
        const text = await transcribeAudioWithQwen(env, body);
        return json({
          success: true,
          text,
          textEn: body.targetLang === "en" ? text : undefined,
          translatedText: text
        });
      } catch (error) {
        return apiError(error, "Failed to transcribe audio");
      }
    }

    if (url.pathname === "/api/live-audio") {
      return handleLiveAudioWebSocket(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ success: false, error: "API route not found." }, 404);
    }

    const assetResponse = staticResponse(request, url.pathname);
    if (assetResponse) return assetResponse;

    return new Response("Not found", { status: 404 });
  }
};
`;

mkdirSync("dist/server", { recursive: true });
writeFileSync("dist/server/index.js", workerSource);
