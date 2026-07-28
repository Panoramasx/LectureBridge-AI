import { mkdirSync, writeFileSync } from "node:fs";

const workerSource = `const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const apiUnavailable = (feature) =>
  json({
    success: false,
    provider: "qwen",
    error: \`\${feature} is waiting for production Qwen API configuration.\`
  }, 503);

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
        qwenConfigured: Boolean(env.DASHSCOPE_API_KEY),
        time: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/auth/verify" && request.method === "POST") {
      const configuredCode = (env.INVITE_CODE || "").trim();
      if (!configuredCode || configuredCode === "CHANGE_ME") {
        return json({ success: true, accessRequired: false });
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      return json({
        success: String(body.code || "").trim() === configuredCode,
        accessRequired: true
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return apiUnavailable(url.pathname);
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return new Response("LectureBridge AI static assets are not available in this runtime.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
`;

mkdirSync("dist/server", { recursive: true });
writeFileSync("dist/server/index.js", workerSource);
