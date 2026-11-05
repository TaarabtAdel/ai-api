const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const SPEECH_URL = "https://api.openai.com/v1/audio/speech";

const EXTENSION_BY_MIME = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/** Nhận audio base64 (JSON) → multipart lên OpenAI /audio/transcriptions */
async function transcribe({ apiKey, audioBase64, mimeType, model, language, prompt, timeoutMs }) {
  const mime = String(mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
  const buffer = Buffer.from(String(audioBase64 || ""), "base64");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), `speech.${EXTENSION_BY_MIME[mime] || "webm"}`);
  form.append("model", model || "gpt-4o-mini-transcribe");
  if (language) form.append("language", language);
  if (prompt) form.append("prompt", prompt);
  form.append("response_format", "json");

  const { signal, done } = withTimeout(timeoutMs);
  try {
    const response = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } finally {
    done();
  }
}

/** Text → audio (mp3) qua OpenAI /audio/speech */
async function speech({ apiKey, input, model, voice, format, instructions, timeoutMs }) {
  const payload = {
    model: model || "gpt-4o-mini-tts",
    input: String(input || "").slice(0, 4000),
    voice: voice || "alloy",
    response_format: format || "mp3",
  };
  if (instructions) payload.instructions = instructions;

  const { signal, done } = withTimeout(timeoutMs);
  try {
    const response = await fetch(SPEECH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { status: response.status, data };
    }
    const audio = Buffer.from(await response.arrayBuffer());
    return { status: 200, audio, contentType: response.headers.get("content-type") || "audio/mpeg" };
  } finally {
    done();
  }
}

module.exports = { transcribe, speech };
