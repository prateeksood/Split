Detailed Product Prompt: AI-Powered Expense Splitting App (Cross-Platform, Free AI, Premium UI)

🎯 Product Overview
Build a cross-platform expense splitting application targeting Android (Play Store), iOS (App Store), and Web — from a single codebase. The app replicates and extends the core feature set of Splitwise. The defining differentiator is a natural language expense entry system — users describe an expense in plain English (e.g., "I paid ₹1200 for dinner last night with Rahul and Priya, split equally"), the app uses AI to parse intent, previews the interpreted result for confirmation, and only saves to the database upon user approval.
The UI must feel premium, modern, and delightful — not a generic CRUD app. Every screen should feel considered. Think Splitwise meets Linear meets Raycast.

📱 Platform Targets
PlatformTargetDistributionAndroidAPI 26+ (Android 8.0+)Google Play StoreiOSiOS 15+Apple App StoreWebChrome, Safari, FirefoxPWA + hosted
Framework: React Native + Expo (TypeScript)

Use Expo SDK with Expo Router for file-based navigation across mobile and web. Shared business logic, hooks, and API layer. Platform-specific overrides only where needed.

🤖 AI Integration — Free Tier APIs
Use Google Gemini API via Google AI Studio as the primary free AI provider. It offers the most generous permanent free tier with no credit card required.
Primary: Google Gemini 2.5 Flash

500 requests/day on the free tier with no credit card required ToolHalla
Up to 1 million tokens of context on Gemini Flash, with multimodal input support (text, images, audio) OpenRouter
Fully sufficient for NL expense parsing at typical usage volumes
OpenAI-compatible endpoint available for simpler integration

Fallback: Groq (Free Tier)

Up to ~6,000 requests/day across models, with speeds of 300–800 tokens per second — 10–30x faster than GPU-based APIs Toolfreebie
Use Llama 3.3 70B or Qwen3 32B as the model
Fully OpenAI-compatible, making it a good pick for real-time chat and latency-sensitive UX OpenRouter
Switch to Groq if Gemini rate limits are hit

Secondary fallback: OpenRouter

20+ free models, a single API key, no credit card required OpenRouter
Acts as a unified router — if both Gemini and Groq rate limits are hit, OpenRouter routes to the next available free model automatically

Implementation Strategy
Primary:   Google Gemini 2.5 Flash (AI Studio free tier)
Fallback:  Groq → Llama 3.3 70B (free tier)
Emergency: OpenRouter → best available free model
Build an AIService abstraction layer so the underlying provider is swappable without changing application logic. Implement automatic fallback: if primary returns a rate limit error (429), retry on the next provider in the chain.
AI Task: NL Expense Parsing
Prompt the model to return structured JSON only. Example system prompt:
You are an expense parsing assistant. Extract expense details from natural language input and return ONLY valid JSON — no preamble, no markdown.

Return this exact schema:
{
  "payer": string | null,
  "amount": number | null,
  "currency": string,           // ISO 4217 (e.g. "INR", "USD")
  "date": string | null,        // ISO 8601 or "today", "yesterday"
  "description": string,
  "category": string,           // one of: Food, Transport, Accommodation, Entertainment, Utilities, Shopping, Health, Other
  "participants": string[],
  "split_type": "equal" | "exact" | "percentage" | "shares",
  "split_values": object | null,
  "group_hint": string | null,
  "confidence": {               // 0.0–1.0 per field
    "payer": number,
    "amount": number,
    "participants": number,
    "split_type": number
  },
  "ambiguities": string[]       // list of things the AI was unsure about
}
Flag fields where confidence < 0.7 in the UI. Show ambiguities array as inline warnings on the confirmation card.
Voice Input (Mobile)

Use expo-speech or device microphone via expo-av to capture audio
Transcribe via Google Cloud Speech-to-Text free tier (60 minutes/month free) or on-device transcription via @react-native-voice/voice
Pass transcript as text to the NL parsing pipeline above


🎨 UI Design System — The Core of the Product
This is where the product must stand out. Every design decision should feel intentional, not templated. The goal: a financial app that users want to open.

Design Language: "Clarity with Character"
The aesthetic is dark-primary with vibrant accent — premium and focused, like a fintech app built by designers who care. Clean enough to be trusted with money, expressive enough to feel alive.
Color Palette
Background Primary:   #0F0F14   (near-black with subtle blue undertone)
Background Secondary: #17171F   (card surfaces)
Background Tertiary:  #1E1E2A   (elevated surfaces, modals)
Border Subtle:        #2A2A38   (dividers, input borders)
Text Primary:         #F0F0F6   (headings, labels)
Text Secondary:       #8A8A9E   (subtext, placeholders)
Accent Primary:       #7C6FFF   (electric violet — primary actions, highlights)
Accent Success:       #34D399   (positive balances, settled states)
Accent Danger:        #FF6B6B   (you owe, negative balances)
Accent Warning:       #FBBF24   (low confidence AI fields)
Accent Muted:         #3D3A5C   (secondary button fills, tags)
Why this palette: Violet as the primary accent is rare in fintech (most use blue or green), making the app visually distinctive. The dark base communicates seriousness and trust. Emerald green for "you're owed" and coral red for "you owe" are immediately legible without being aggressive.
Typography
Display:  Inter (700, 800) — headings, balance numbers, hero amounts
Body:     Inter (400, 500) — all regular text
Mono:     JetBrains Mono (400) — amounts, transaction IDs, currency values
Set a strict type scale:
xs:   11px / 1.4  — captions, timestamps
sm:   13px / 1.5  — secondary labels
base: 15px / 1.6  — body text
lg:   17px / 1.5  — primary labels
xl:   20px / 1.4  — card titles
2xl:  24px / 1.3  — screen titles
3xl:  32px / 1.2  — balance hero numbers
4xl:  44px / 1.1  — dashboard total
Spacing Grid: 4px base unit. All padding/margin values multiples of 4. Component padding follows 12/16/20/24 for tight/regular/comfortable/spacious contexts.
Border Radius:
sm:   6px   — tags, badges, small buttons
md:   12px  — inputs, list items
lg:   16px  — cards
xl:   24px  — bottom sheets, modals
full: 9999px — avatar chips, FAB

Signature Visual Element
The balance number on the dashboard uses an animated radial "debt arc" — a thin, glowing ring around the user's avatar that fills proportionally between green (fully owed to you) and red (you owe everything). This single element communicates financial standing at a glance without any text, and is the one thing users will remember about the app.

Component Specifications
Bottom Tab Bar (Mobile)

4 tabs: Home, Groups, Friends, Activity
Tab bar background: #0F0F14 with a 1px #2A2A38 top border
Active tab: accent violet icon + label, with a 2px violet underline pill
Inactive: muted grey icons, no label
FAB floats above center of tab bar — circular, 56px, violet gradient (#7C6FFF → #5B4FE8), shadow glow: 0 0 20px rgba(124,111,255,0.4)

Dashboard Screen
┌─────────────────────────────────┐
│  👋 Hey Prateek          [🔔] [👤]  │  ← greeting + notification bell
│                                 │
│  ┌─────────────────────────────┐│
│  │   Total Balance             ││  ← hero card, full width
│  │   ₹4,250                   ││  ← 44px mono font, green
│  │   You are owed overall      ││  ← secondary label
│  │   [Settle Up] [Add Expense] ││
│  └─────────────────────────────┘│
│                                 │
│  ┌──────────┐  ┌──────────┐    │
│  │ Goa Trip │  │ Flat 3B  │    │  ← group cards, horizontal scroll
│  │ ₹1,200   │  │ -₹300    │    │
│  │ owed     │  │ you owe  │    │
│  └──────────┘  └──────────┘    │
│                                 │
│  Recent Activity                │
│  ┌─────────────────────────────┐│
│  │ 🍕 Dinner · Aman · ₹400    ││  ← activity list items
│  │ 2h ago · you owe ₹133      ││
│  └─────────────────────────────┘│
│                                 │
│          [+]  ← FAB             │
└─────────────────────────────────┘
Group Cards (Horizontal Scroll)

160×100px cards
Background: #17171F with a subtle left-border accent (4px, group color)
Each group gets a deterministic accent color from a palette of 6 (violet, teal, amber, rose, sky, emerald)
Group name: 13px semi-bold; balance: 20px bold mono; status label: 11px muted

Expense List Item
[Category Icon]  Description          Amount
                 Group · Payer        You owe/get
                 Timestamp

64px height, 16px horizontal padding
Category icon: 36px circle with category-specific background tint
Amount: right-aligned, 15px bold mono, green (owed) or red (owe)
Swipe left → quick settle; Swipe right → edit

AI Confirmation Bottom Sheet
This is the most important screen in the app — it must feel magical, not technical.
┌─────────────────────────────────┐
│  ▬  (drag handle)               │
│                                 │
│  ✨ Here's what I understood    │  ← friendly header
│                                 │
│  ┌─────────────────────────────┐│
│  │ 🍕 Dinner                  ││  ← description (editable)
│  │                             ││
│  │ Paid by    [You ▾]         ││  ← pill dropdowns (editable)
│  │ Amount     [₹1,200 ▾]      ││
│  │ Split      [Equally ▾]      ││
│  │ Group      [Goa Trip ▾]     ││
│  │ Date       [Today ▾]        ││
│  └─────────────────────────────┘│
│                                 │
│  Splitting between:             │
│  [You] [Rahul] [Priya]         │  ← avatar chips
│                                 │
│  ⚠️ Not sure about "Priya"     │  ← amber warning, low confidence
│     Did you mean Priya Sharma? │
│     [Yes] [Add new contact]    │
│                                 │
│  ┌─────────────────────────────┐│
│  │  Looks good — Save Expense  ││  ← primary CTA, violet
│  └─────────────────────────────┘│
│       Edit  ·  Cancel           │  ← ghost actions
└─────────────────────────────────┘

Bottom sheet slides up with spring animation (damping: 20, stiffness: 180)
Blurred backdrop behind sheet
Editable fields are tappable pill-shaped chips with a subtle violet border on focus
Low-confidence fields highlighted with amber left border + ⚠️ icon
Haptic feedback on open and on save confirm

Input Command Bar (NL Entry)
┌─────────────────────────────────────┐
│  ✨  Try: "Paid ₹500 for pizza..."  │  [🎤]
└─────────────────────────────────────┘

Pinned below header on Home and Group screens
48px height, #17171F background, #7C6FFF left accent line (3px)
Placeholder text cycles through 3–4 example phrases with a fade transition every 4s
Mic button on right → triggers voice input flow
On submit: full-screen loading overlay with animated dots + "Thinking..." label (not a spinner — feels more AI-native)

Balance Chip

Compact pill showing net balance per person: [Avatar] Rahul  ₹400
Green fill for owed, red fill for owing
Tap → expand into settlement suggestion

Empty States

Each empty state has a minimal illustration (SVG, thematic) and a clear CTA:

No groups: illustration of three overlapping circles → "Create your first group"
No expenses: illustration of a receipt → "Add your first expense" or "Try the AI bar above"
All settled: illustration of a checkmark with confetti dots → "You're all square! 🎉"


Motion & Interaction

Navigation transitions: shared element transitions between list item and detail screen (card expands to fill screen)
Balance counter: animates (counts up/down) when the screen first loads — 600ms ease-out
FAB: morphs into the NL input bar on tap (circular → pill shape, 300ms spring)
Expense save confirmation: micro-celebration — the saved expense card flies in from the bottom with a brief green flash
Swipe actions: rubber-band effect at threshold, icon reveals on swipe with color fill
Skeleton loaders: pulsing gradient shimmer on all list views during data fetch (never show blank screens)
Haptics: light tap on item press, medium on save, success pattern on settle
All animations respect prefers-reduced-motion / accessibility settings


Dark / Light Mode
Default: dark. Light mode available, toggled in settings or via system preference.
Light mode palette:
Background Primary:   #FAFAFA
Background Secondary: #FFFFFF
Background Tertiary:  #F4F4F8
Text Primary:         #0F0F14
Text Secondary:       #6B6B80
Accent Primary:       #6355E8   (slightly darker violet for contrast on light)

Typography in Practice

All currency amounts: JetBrains Mono, never Inter — creates immediate visual distinction between data and prose
Headings: Inter 700, tracked at −0.3px
Body: Inter 400, line-height 1.6 for readability
Timestamps and captions: Inter 400, 11px, text-secondary color, always relative ("2h ago", "Yesterday")


👥 Core Features (Splitwise Parity)
User & Auth

Email/password registration and login with JWT-based auth
OAuth: Google Sign-In (native SDK on mobile, web OAuth on browser)
Biometric login via Expo LocalAuthentication
Password reset via email

Groups

Create/archive groups with categories (Home, Trip, Couple, Friends, Other)
Add members by email, username, or phone contact picker
Each group gets a deterministic color accent
Group activity feed with avatar-first design

Expenses

Manual entry and NL entry
Split types: Equal, Exact, Percentage, Shares, Adjustment
Multi-currency with real-time exchange rates
Receipt attachment (camera on mobile, upload on web)
Edit/delete with soft-delete audit trail
Categories with colored icons

Balances & Settlements

Real-time balance calculation
Debt simplification algorithm
Record settlements with optional payment reference (UPI ID, note)
Settled vs. unsettled history

Friends

1:1 balance tracking outside groups
Invite via share link or SMS (native share sheet)

Notifications

Push notifications via Expo Notifications (FCM + APNs)
Deep linking from notification → relevant screen
In-app notification center with read/unread state

Reports

Spending by category (donut chart)
Spending over time (line/bar chart — Recharts/Victory Native)
Export to CSV/PDF
Share via native share sheet


🏗️ Tech Stack
Frontend / Mobile

React Native + Expo SDK (TypeScript)
Expo Router (file-based navigation, web + mobile)
Zustand (state management)
React Query / TanStack Query (server state, caching)
React Native Reanimated 3 (animations)
React Native Gesture Handler (swipe actions)
Victory Native XL (charts)
expo-secure-store (token storage — never AsyncStorage for auth)
expo-local-authentication (biometrics)
expo-notifications (push)
expo-camera (receipt capture)
expo-av (voice input)

Backend

Node.js + NestJS (TypeScript)
Prisma ORM + PostgreSQL
Redis (sessions, rate limiting, caching)
BullMQ (async: emails, push notifications)
AWS S3 / Cloudflare R2 (receipt storage)
JWT + refresh tokens

AI Layer
AIService (abstraction)
  ├── GeminiProvider    → Google AI Studio (primary, free)
  ├── GroqProvider      → Groq free tier (fallback 1)
  └── OpenRouterProvider → OpenRouter free models (fallback 2)

🔒 Security

Secrets never in client code — all AI API keys in backend .env
expo-secure-store for tokens on device
Input sanitization before sending to AI (strip PII patterns, limit length to 500 chars)
All endpoints authenticated; authorization checks on every resource
Rate limiting on NL endpoint: 30 requests/user/hour (protects free AI quota)
Soft deletes only — no permanent data loss
HTTPS enforced; Expo handles certificate management


🚀 Play Store Deployment

EAS Build generates signed .aab
eas.json with development / preview / production profiles
Auto-increment versionCode via EAS
EAS Submit for automated Play Console upload
Required assets: 512×512 icon, 1024×500 feature graphic, 2+ phone screenshots
Privacy Policy static page hosted (required by Play Store)
Permissions declared: CAMERA, READ_CONTACTS, USE_FINGERPRINT, RECEIVE_BOOT_COMPLETED, VIBRATE
Target API level: 34+ (current Google requirement)


📦 Monorepo Structure
/
├── apps/
│   ├── mobile/           # Expo app (iOS + Android + Web)
│   │   ├── app/          # Expo Router screens
│   │   ├── components/   # UI components
│   │   ├── services/     # AIService, API client
│   │   ├── stores/       # Zustand stores
│   │   └── theme/        # Design tokens, colors, typography
│   └── api/              # NestJS backend
│       ├── src/
│       │   ├── ai/       # AIService with provider abstraction
│       │   ├── expenses/
│       │   ├── groups/
│       │   ├── users/
│       │   └── settlements/
├── packages/
│   └── shared/           # Types, schemas, validation (Zod)
├── eas.json
├── docker-compose.yml
└── .github/workflows/

⚙️ CI/CD

GitHub Actions: lint + typecheck + tests on every PR
On merge to main: trigger EAS Build → EAS Submit to Play Store internal track
Deploy backend to Railway or Render (free tier eligible for prototype)
Environment validation via Zod on startup — fails fast if any required env var is missing


📋 Deliverables Checklist

 Expo React Native app (Android, iOS, Web) with full design system implemented
 Design token file (theme/tokens.ts) — all colors, spacing, typography as constants
 NestJS backend API with Swagger docs
 AIService with Gemini → Groq → OpenRouter fallback chain
 PostgreSQL schema + Prisma migrations + seed data
 Docker Compose for local dev
 eas.json with all build profiles
 app.json with Android package config, adaptive icon, permissions
 Play Store assets (icon, feature graphic, screenshots, privacy policy)
 .env.example with all required keys (including GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY)
 Unit tests: balance calculation, debt simplification, AI JSON parsing
 Integration tests: NL parse + confirm + save flow
 README: local setup, EAS build, AI API setup instructions