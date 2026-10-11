/** Model LMS / bảng định mức thường dùng — alias → id upstream */
const MODEL_ALIASES = {
  "gpt-4o mini": "gpt-4o-mini",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4o": "gpt-4o",
  "o1-mini": "o1-mini",
  "o3-mini": "o3-mini",
  "claude 3.5 sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
  "gemini-2.5-flash": "gpt-4o-mini",
};

/** Catalog trả về GET /v1/models (theo cột Model AI trong spec) */
const CATALOG = [
  { id: "gpt-4o-mini", provider: "openai", label: "GPT-4o mini" },
  { id: "o1-mini", provider: "openai", label: "o1-mini (hoặc o3-mini)" },
  { id: "o3-mini", provider: "openai", label: "o3-mini" },
  { id: "gpt-4o", provider: "openai", label: "GPT-4o" },
  { id: "claude-3-5-sonnet-20241022", provider: "anthropic", label: "Claude 3.5 Sonnet" },
];

function normalizeModelId(raw = "") {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^models\//, "");
  if (!key) return "gpt-4o-mini";
  return MODEL_ALIASES[key] || String(raw).trim().replace(/^models\//, "");
}

function providerForModel(modelId = "") {
  const id = normalizeModelId(modelId);
  if (/claude/i.test(id)) return "anthropic";
  return "openai";
}

module.exports = { MODEL_ALIASES, CATALOG, normalizeModelId, providerForModel };
