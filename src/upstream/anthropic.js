const { openAiMessagesToAnthropic } = require("../messageUtils");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function anthropicToOpenAiShape(anthropicBody = {}) {
  const textBlocks = (anthropicBody.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const usage = anthropicBody.usage || {};
  return {
    id: anthropicBody.id || `chatcmpl-anthropic-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: anthropicBody.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: textBlocks },
        finish_reason: anthropicBody.stop_reason === "end_turn" ? "stop" : anthropicBody.stop_reason || "stop",
      },
    ],
    usage: {
      prompt_tokens: Number(usage.input_tokens || 0),
      completion_tokens: Number(usage.output_tokens || 0),
      total_tokens: Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0),
    },
  };
}

async function chatCompletions({ apiKey, model, body, timeoutMs }) {
  const { system, messages } = openAiMessagesToAnthropic(body.messages || [], body.system);

  const payload = {
    model,
    max_tokens: Number(body.max_tokens || body.max_completion_tokens || 4096),
    messages,
  };
  if (system) payload.system = system;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (response.status >= 400) {
      return { status: response.status, data };
    }
    return { status: 200, data: anthropicToOpenAiShape(data) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatCompletions };
