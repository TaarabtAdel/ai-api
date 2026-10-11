const { sanitizeOpenAiMessages } = require("../messageUtils");

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function isReasoningModel(modelId = "") {
  return /^o\d/i.test(modelId) || modelId.startsWith("o1") || modelId.startsWith("o3");
}

async function chatCompletions({ apiKey, model, body, timeoutMs }) {
  const payload = { ...body, model, messages: sanitizeOpenAiMessages(body.messages || []) };

  delete payload.system;
  delete payload.session_id;

  if (isReasoningModel(model)) {
    if (payload.max_tokens != null && payload.max_completion_tokens == null) {
      payload.max_completion_tokens = payload.max_tokens;
      delete payload.max_tokens;
    }
    delete payload.temperature;
  }

  if (payload.response_format && isReasoningModel(model)) {
    delete payload.response_format;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatCompletions };
