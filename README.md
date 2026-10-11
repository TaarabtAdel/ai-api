# ai-api

Proxy **OpenAI-compatible** cho LMS (`ai-teach-be` gọi `POST {AI_API_BASE_URL}/v1/chat/completions`).

- Port mặc định: **7861** (khớp `AI_API_BASE_URL` trong BE).
- **OpenAI**: `OPENAI_API_KEY` hoặc `OPEN_AI_KEY`.
- **Claude**: `ANTHROPIC_API_KEY` (tùy chọn).
- **PROXY_API_KEY**: key LMS đặt trong admin **AI API Key** (Bearer).

## Chạy local

```bash
cd ai-api
cp .env.example .env
# Sửa OPENAI_API_KEY và PROXY_API_KEY
npm install
npm run dev
```

## Cấu hình LMS

Trong `ai-teach-be/.env` (hoặc admin Settings):

```env
AI_API_BASE_URL=http://127.0.0.1:7861
AI_API_KEY=<cùng PROXY_API_KEY trong ai-api/.env>
```

## Model

`GET /v1/models` — danh sách model trong catalog (GPT-4o mini, o1-mini, o3-mini, GPT-4o, Claude 3.5 Sonnet).

Request `model` có thể là alias (vd. `claude-3-5-sonnet`, `gpt-4o-mini`).

## Docker (VPS)

Thêm service trong `docker-compose.yml` hoặc chạy riêng:

```bash
docker compose up -d ai-api
```

BE trong Docker trỏ: `AI_API_BASE_URL=http://ai-api:7861`.
