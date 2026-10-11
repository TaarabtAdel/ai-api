/** Gỡ cache_control / field lạ trước khi gửi OpenAI */
function stripCacheControlFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content;

  return content.map((part) => {
    if (!part || typeof part !== "object") return part;
    const { cache_control, ...rest } = part;
    return rest;
  });
}

function flattenTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return JSON.stringify(content ?? "");

  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      if (part.type === "text") return String(part.text || "");
      if (part.type === "image_url") return "[image]";
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function openAiMessagesToAnthropic(messages = [], systemFromBody = "") {
  let system = String(systemFromBody || "").trim();
  const out = [];

  for (const msg of messages) {
    if (!msg || !msg.role) continue;
    if (msg.role === "system") {
      system = [system, flattenTextContent(msg.content)].filter(Boolean).join("\n\n");
      continue;
    }

    const role = msg.role === "assistant" ? "assistant" : "user";
    const content = msg.content;

    if (typeof content === "string") {
      out.push({ role, content });
      continue;
    }

    if (Array.isArray(content)) {
      const blocks = [];
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        if (part.type === "text") {
          blocks.push({ type: "text", text: String(part.text || "") });
        } else if (part.type === "image_url") {
          const url = part.image_url?.url || part.image_url;
          if (typeof url === "string" && url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              blocks.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: match[1] || "image/jpeg",
                  data: match[2],
                },
              });
            }
          } else if (typeof url === "string" && url.startsWith("http")) {
            blocks.push({
              type: "image",
              source: { type: "url", url },
            });
          }
        }
      }
      out.push({ role, content: blocks.length ? blocks : "" });
      continue;
    }

    out.push({ role, content: String(content ?? "") });
  }

  return { system, messages: out };
}

function sanitizeOpenAiMessages(messages = []) {
  return messages.map((msg) => ({
    role: msg.role,
    content: stripCacheControlFromContent(msg.content),
  }));
}

module.exports = {
  stripCacheControlFromContent,
  flattenTextContent,
  openAiMessagesToAnthropic,
  sanitizeOpenAiMessages,
};
