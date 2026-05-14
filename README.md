# Vidispine QA Assistant

Internal AI tool for the Vidispine QA team. Built on Next.js + Anthropic API. Deployed on Vercel.

## Features

- 💬 Chat with Claude (skills baked into system prompt)
- 📎 Upload PDF / image files for analysis
- ⚡ One-click workflows: Extract Test Cases, Test Design Doc, Playwright Script, Optimize Framework, API Analysis, Corporate Email
- 🌊 Streaming responses
- 🖥️ Clean dark UI

---

## Deploy to Vercel (15 minutes)

### Step 1 — Get Anthropic API Key
1. Go to https://console.anthropic.com
2. Create an account (or log in)
3. Go to **API Keys** → Create new key
4. Copy the key — you'll need it in Step 3

### Step 2 — Push to GitHub
```bash
# Initialize git in this folder
git init
git add .
git commit -m "initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/vidispine-ai.git
git push -u origin main
```

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com → Sign up with GitHub
2. Click **Add New Project**
3. Import your `vidispine-ai` repo
4. Under **Environment Variables**, add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (your key from Step 1)
5. Click **Deploy**

Done. Vercel gives you a URL like `https://vidispine-ai.vercel.app`

### Step 4 — Share with team
Share the Vercel URL with your team. No login needed (or add Vercel password protection for security).

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
# Open http://localhost:3000
```

---

## Add / Edit Workflows

All workflows are in `lib/workflows.ts`. To add a new one:

```typescript
{
  id: "your-workflow-id",
  label: "Workflow Name",
  icon: "🔧",
  description: "Short description shown in sidebar",
  prompt: `Your detailed system prompt here...`
}
```

The prompt gets injected as additional system instructions when the workflow is active.

---

## Update Skills / System Prompt

The base system prompt is in `lib/workflows.ts` → `SYSTEM_PROMPT` constant.
Edit it to reflect your team's context, domain knowledge, or tool preferences.

---

## Cost Estimate

Using `claude-sonnet-4` at ~1000 tokens per message:
- 10 people × 20 messages/day = ~200 API calls/day
- Roughly **$2–5/day** depending on file uploads
- Anthropic bills by usage — no flat monthly fee for the API

---

## Security Note

The Vercel URL is public by default. To restrict access:
1. Vercel dashboard → Project → Settings → **Password Protection** (Pro plan)
2. Or add basic auth middleware to `middleware.ts`

For a small internal team, sharing the URL internally is usually sufficient.
