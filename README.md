# Split — AI-Powered Expense Splitting

Cross-platform expense splitting app (Android, iOS, Web) with natural language expense entry powered by Google Gemini.

## Monorepo Structure

```
├── apps/
│   ├── mobile/     # Expo React Native app (iOS + Android + Web)
│   └── api/        # NestJS backend API
├── packages/
│   └── shared/     # Shared types, Zod schemas, balance utilities
├── docker-compose.yml
├── eas.json
└── .github/workflows/ci.yml
```

## Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL + Redis)
- [Google AI Studio API key](https://aistudio.google.com/apikey) (free tier)

## Quick Start

### 1. Clone and install

```bash
npm install
```

### 2. Environment setup

```bash
cp .env.example .env
# Edit .env — set JWT secrets and GEMINI_API_KEY at minimum
```

### 3. Start infrastructure

```bash
npm run docker:up
```

### 4. Database setup

```bash
cd apps/api
npx prisma migrate dev --name init
npm run db:seed
cd ../..
```

### 5. Start the API

```bash
npm run dev:api
```

API runs at `http://localhost:3000` — Swagger docs at `http://localhost:3000/api/docs`

### 6. Start the mobile app

```bash
npm run dev:mobile
```

Press `w` for web, `a` for Android emulator, or scan QR code with Expo Go.

**Demo login:** `prateek@example.com` / `password123`

## AI API Setup

The NL expense parser uses a fallback chain (all keys are server-side only):

| Priority | Provider | Env var | Get Key |
|----------|----------|---------|---------|
| 1 | Google Gemini 2.5 Flash | `GEMINI_API_KEY` | [AI Studio](https://aistudio.google.com/apikey) |
| 2 | xAI Grok | `GROK_API_KEY` | [xAI Console](https://console.x.ai) |
| 3 | Groq (Llama 3.3 70B) | `GROQ_API_KEY` | [Groq Console](https://console.groq.com) |
| 4 | OpenRouter | `OPENROUTER_API_KEY` | [OpenRouter](https://openrouter.ai) |

Set keys in the repo root `.env` or `apps/api/.env`. On failure or rate limits (429), the API tries the next provider automatically. Optional: `GROK_MODEL`, `OPENROUTER_MODEL`.

## EAS Build (Play Store)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login and configure
eas login
cd apps/mobile
eas build:configure

# Development build
eas build --profile development --platform android

# Production (generates signed .aab)
eas build --profile production --platform android

# Submit to Play Store internal track
eas submit --platform android
```

Update `app.json` → `extra.eas.projectId` with your EAS project ID after `eas init`.

## Design System

All design tokens live in `apps/mobile/theme/tokens.ts`:

- Dark-primary palette with violet accent (`#7C6FFF`)
- Inter (body/headings) + JetBrains Mono (currency amounts)
- 4px spacing grid, signature debt arc on dashboard

## Testing

```bash
# Shared package unit tests (balance calc, debt simplification, AI JSON parsing)
npm run test --workspace=@split/shared
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login |
| GET | `/users/dashboard` | Dashboard summary |
| GET | `/groups` | List groups with balances |
| POST | `/expenses` | Create expense |
| POST | `/ai/parse-expense` | NL expense parsing (30/hr rate limit) |

Full docs: `http://localhost:3000/api/docs`

## Deployment

- **Backend:** Railway or Render (set `DATABASE_URL`, `REDIS_URL`, JWT secrets, AI keys)
- **Mobile:** EAS Build → EAS Submit
- **Web:** `npx expo export --platform web` → host static files

## License

Private — All rights reserved.
