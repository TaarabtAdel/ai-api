require("dotenv").config();

const express = require("express");
const { CATALOG, normalizeModelId, providerForModel } = require("./models");
const openai = require("./upstream/openai");
const anthropic = require("./upstream/anthropic");
const openaiAudio = require("./upstream/openai-audio");

const PORT = Number(process.env.PORT || 7861);
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || "").trim();
const ANTHROPIC_API_KEY = String(process.env.ANTHROPIC_API_KEY || "").trim();
const PROXY_API_KEY = String(process.env.PROXY_API_KEY || "").trim();
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 120000);

const app = express();
app.use(express.json({ limit: "20mb" }));

function authMiddleware(req, res, next) {
  if (!PROXY_API_KEY) return next();
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token !== PROXY_API_KEY) {
    return res.status(401).json({
      error: { message: "Invalid proxy API key", type: "authentication_error" },
    });
  }
  return next();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ai-api",
    openai: Boolean(OPENAI_API_KEY),
    anthropic: Boolean(ANTHROPIC_API_KEY),
  });
});

app.get("/v1/models", authMiddleware, (_req, res) => {
  res.json({
    object: "list",
    data: CATALOG.map((row) => ({
      id: row.id,
      object: "model",
      owned_by: row.provider,
      metadata: { label: row.label },
    })),
  });
});

/** Stub tương thích LMS prompt cache warm (gcli2api) */
app.post("/v1/prompt-cache/warm", authMiddleware, (req, res) => {
  res.json({
    success: true,
    partial: false,
    message: "ai-api: warm noop (OpenAI/Anthropic không dùng endpoint này)",
    data: { requests: req.body?.requests?.length || 0 },
  });
});

app.post("/v1/chat/completions", authMiddleware, async (req, res) => {
  const model = normalizeModelId(req.body?.model);
  const provider = providerForModel(model);
  const body = { ...req.body, model };

  try {
    if (provider === "anthropic") {
      if (!ANTHROPIC_API_KEY) {
        return res.status(503).json({
          error: {
            message:
              "Model Claude cần ANTHROPIC_API_KEY trong ai-api/.env (hiện chỉ có OpenAI key).",
            type: "configuration_error",
          },
        });
      }
      const result = await anthropic.chatCompletions({
        apiKey: ANTHROPIC_API_KEY,
        model,
        body,
        timeoutMs: UPSTREAM_TIMEOUT_MS,
      });
      return res.status(result.status).json(result.data);
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        error: {
          message: "Thiếu OPENAI_API_KEY (hoặc OPEN_AI_KEY) trong ai-api/.env",
          type: "configuration_error",
        },
      });
    }

    const result = await openai.chatCompletions({
      apiKey: OPENAI_API_KEY,
      model,
      body,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
    });
    return res.status(result.status).json(result.data);
  } catch (error) {
    const aborted = error.name === "AbortError";
    return res.status(504).json({
      error: {
        message: aborted ? "Upstream timeout" : error.message || "Upstream error",
        type: "upstream_error",
      },
    });
  }
});

function requireOpenAiKey(res) {
  if (OPENAI_API_KEY) return true;
  res.status(503).json({
    error: { message: "Thiếu OPENAI_API_KEY (hoặc OPEN_AI_KEY) trong ai-api/.env", type: "configuration_error" },
  });
  return false;
}

function upstreamFailure(res, error) {
  const aborted = error.name === "AbortError";
  return res.status(504).json({
    error: { message: aborted ? "Upstream timeout" : error.message || "Upstream error", type: "upstream_error" },
  });
}

/** Speech-to-text — body JSON: { audio_base64, mime_type, model?, language?, prompt? } */
app.post("/v1/audio/transcriptions", authMiddleware, async (req, res) => {
  if (!requireOpenAiKey(res)) return undefined;
  if (!req.body?.audio_base64) {
    return res.status(422).json({ error: { message: "Thiếu audio_base64", type: "invalid_request_error" } });
  }
  try {
    const result = await openaiAudio.transcribe({
      apiKey: OPENAI_API_KEY,
      audioBase64: req.body.audio_base64,
      mimeType: req.body.mime_type,
      model: req.body.model,
      language: req.body.language,
      prompt: req.body.prompt,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
    });
    return res.status(result.status).json(result.data);
  } catch (error) {
    return upstreamFailure(res, error);
  }
});

/** Text-to-speech — body JSON: { input, model?, voice?, response_format?, instructions? } → audio bytes */
app.post("/v1/audio/speech", authMiddleware, async (req, res) => {
  if (!requireOpenAiKey(res)) return undefined;
  if (!String(req.body?.input || "").trim()) {
    return res.status(422).json({ error: { message: "Thiếu input", type: "invalid_request_error" } });
  }
  try {
    const result = await openaiAudio.speech({
      apiKey: OPENAI_API_KEY,
      input: req.body.input,
      model: req.body.model,
      voice: req.body.voice,
      format: req.body.response_format,
      instructions: req.body.instructions,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
    });
    if (!result.audio) return res.status(result.status).json(result.data);
    res.setHeader("Content-Type", result.contentType);
    return res.status(200).send(result.audio);
  } catch (error) {
    return upstreamFailure(res, error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ai-api] listening on http://0.0.0.0:${PORT}`);
  console.log(`[ai-api] OpenAI: ${OPENAI_API_KEY ? "yes" : "NO KEY"}`);
  console.log(`[ai-api] Anthropic: ${ANTHROPIC_API_KEY ? "yes" : "optional"}`);
  if (PROXY_API_KEY) console.log("[ai-api] PROXY_API_KEY enabled");
});
