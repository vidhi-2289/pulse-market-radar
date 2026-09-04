# PULSE — Your Market Change Radar

> A calm, high-signal market intelligence radar answering:  
> **"What meaningfully changed since I last checked, and what deserves my attention now?"**

---

## 1. Overview & Problem Statement

Conventional financial platforms (Yahoo Finance, TradingView, Robinhood, Apple Stocks) are designed as continuous telemetry firehoses: endless walls of blinking red and green ticks, raw percentage movements, and anxious notification bells.

For individual investors, portfolio watchers, and part-time traders, this creates **cognitive overload and continuous checking anxiety**. Most daily price movements are simply noise: broad market tide (beta) lifting or sinking all assets together.

**Pulse** transforms market monitoring from real-time noise surveillance into **calm, asynchronous delta detection**:
- It records your personal baseline (**Checkpoint**) when you last inspected the market.
- When you return hours or days later, it computes what actually moved relative to your baseline.
- It decouples company-specific moves (**idiosyncratic alpha**) from sector and market drift.
- It ranks movements by **Attention Score (0–100)** with clear, quantitative factor explanations.
- If everything is quiet or moving purely on market tide, it proudly presents: **"Nothing meaningful changed."**

---

## 2. Core User Experience

1. **"Since You Last Checked" Baseline Anchor:**  
   Every session opens with a clear anchor:  
   `Since you last checked (3h 42m ago): 2 anomalies detected across 8 tracked assets.`
2. **Attention-Ranked Feed:**  
   Assets are not ordered alphabetically or by raw percentage. They are ranked by their deterministic **Attention Score**, prioritized by urgency tiers (`NOMINAL`, `INFO`, `ELEVATED`, `CRITICAL`).
3. **"Why Am I Seeing This?" Factor Attribution:**  
   Clicking any flagged item opens an explainability drawer detailing the exact mathematical drivers:
   - **Idiosyncratic Alpha:** Stock change isolated from sector and benchmark drift.
   - **Abnormal Volume Multiple:** Observed volume versus time-of-day expected 20-day ADV.
   - **Opening Gap Persistence:** Whether morning institutional gap momentum held through the session.
4. **"Nothing Meaningful Changed" Calm State:**  
   When all tracked assets behave nominally ($Score < 30$), urgency cues disappear and the application presents a calm, reassuring state respecting the user's attention.
5. **Acknowledge / Checkpoint Reset:**  
   One-click *"Mark as Seen"* button updates the baseline to the present moment, instantly clearing the radar back to calm.
6. **Data Freshness & Transparency:**  
   Every asset and header displays clear freshness badges: `LIVE`, `DELAYED`, `STALE`, `CACHED_FALLBACK`, or `DEMO`.

---

## 3. Deterministic Meaningful-Change Engine

Pulse strictly avoids black-box LLMs or stochastic models for anomaly detection. All scoring is computed by a **pure mathematical engine**:

```
RawScore = (|R_idio| * C_alpha) + (max(0, V_ratio - 1.0) * C_vol) + (|Gap%| * C_gap * GapHeld)
AttentionScore = min(100, round(RawScore))
```

### Signal Decomposition
- **Idiosyncratic Return ($R_{idio}$):**  
  $$R_{idio} = R_{asset} - (w_{sec} \cdot R_{sector} + w_{mkt} \cdot R_{market})$$  
  *(A stock moving $+3\%$ when its sector ETF is $+3.1\%$ produces an idiosyncratic return near $0\%$, filtering out broad market noise).*
- **Volume Anomaly Ratio ($V_{ratio}$):**  
  $$V_{ratio} = \frac{V_{observed}}{ADV_{20} \times (\Delta t_{market\_minutes} / 390)}$$  
  *(Detects abnormal institutional participation during the elapsed interval).*
- **Opening Gap Persistence:**  
  Evaluates whether an opening morning gap ($P_{open} - P_{prev\_close}$) held or faded.
- **Severity Tiers:**  
  - `0 – 29`: **NOMINAL** (Filtered / collapsed in calm state)
  - `30 – 59`: **INFO** (Notable move worth a glance)
  - `60 – 84`: **ELEVATED** (Significant divergence or volume surge)
  - `85 – 100`: **CRITICAL** (Extreme anomaly / breakout dislocation)

> **Role of AI:** AI is never used to determine scores, detect anomalies, or evaluate severity. If enabled in stretch scope, an LLM call is strictly confined to generating a 1-sentence natural language summary of verified structured facts.

---

## 4. Architecture & System Design

Pulse is built as a **modular monolith** to maximize reliability, maintainability, and operational clarity.

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Frontend (React)                   │
│   Radar Feed • Checkpoint Banner • Factor Drawer • Calm Hero │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON / REST
┌──────────────────────────────▼──────────────────────────────┐
│                Next.js API Route Handlers                   │
│      /api/radar • /api/watchlist • /api/checkpoint          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│               Core Application Services                     │
│  ┌───────────────────────┐       ┌──────────────────────┐   │
│  │ CheckpointService     │       │ ChangeEngine (Pure)  │   │
│  └───────────────────────┘       └──────────────────────┘   │
│  ┌───────────────────────┐       ┌──────────────────────┐   │
│  │ WatchlistService      │       │ FactorAttribution    │   │
│  └───────────────────────┘       └──────────────────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│               Market Data Abstraction Layer                 │
│         IMarketDataProvider (Adapter / Hexagonal)           │
│    ├── DemoMarketDataProvider (6 Deterministic Scenarios)    │
│    └── DelayedMarketDataProvider (Market Data API Free Tier) │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│               Storage & Persistence Layer                   │
│           Prisma ORM • PostgreSQL                           │
│   Users • Watchlists • Items • Checkpoints                  │
└─────────────────────────────────────────────────────────────┘
```

### Market Data Provider Abstraction & Freshness Contract

Pulse uses a vendor-agnostic hexagonal market data abstraction where both Demo Mode and the local external delayed feed adhere to the exact same normalized contract:

1. **Explicit Runtime Provider Modes:**
   - **`DEMO` (Public / Judging Path):** Guaranteed deterministic built-in market fixtures. Completely safe for public deployment, presentations, and automated evaluations. Always available without network dependencies.
   - **`MARKETDATA_LOCAL` (Local Development Only):** Supplemental external delayed feed via Market Data API (`Market Data · 24H Delayed`). Only activated when running in local development with a valid `MARKETDATA_API_TOKEN`. **Strictly refused in production runtimes** to comply with exchange non-redistribution policies.
   - **Guaranteed Safe Fallback:** If `MARKETDATA_API_TOKEN` is missing, or if `MARKETDATA_LOCAL` is requested in a production environment, the provider router safely and automatically enforces `DEMO` mode, ensuring zero runtime crashes.

2. **`DelayedMarketDataProvider` ($0 Cost Free Tier, Local Only):**
   - Consumes the free delayed stock quote endpoint from [Market Data API](https://www.marketdata.app/): `https://api.marketdata.app/v1/stocks/bulkquotes/?symbols=...`.
   - **Local Developer Diagnostic Scope:** Strictly intended for local developer evaluation and debugging. This free feed is **not licensed for public redistribution**.
   - **Aggressive Daily Credit Minimization:** Requests are batched across all tracked watchlist items and benchmark ETFs into a single HTTP request with ticker deduplication.
   - **In-Memory Server-Side Caching:** Utilizes a process-wide 60-second TTL cache to eliminate redundant requests and conserve free API credits without introducing external infrastructure like Redis.
   - **Resilient Circuit-Breaker Fallback:** Maintains a last-known-good snapshot store (`CACHED_FALLBACK`) to serve graceful fallbacks during upstream provider outages or rate limits.

3. **Normalized `MarketSnapshot` Contract & Zero Fabrication:**
   - Strictly separates **market quote execution time** (`timestamp`) from **Pulse ingest time** (`fetchedAt`), critical for correctly classifying delayed and stale feeds.
   - **Zero Fabricated Metrics:** Maps only metrics supplied by the provider (`last`, `changepct`, `volume`, `updated`). When `volume`, `avgDailyVolume`, `openPrice`, or `previousClose` are omitted, they remain `undefined`, allowing the Change Engine's graceful degradation behavior to handle them cleanly.

4. **Centralized Freshness Rules (`classifyFreshness`):**
   - `DEMO`: Synthetic/fixture data for reproducible demonstrations and automated tests.
   - `CACHED_FALLBACK`: Served from cached baseline store due to upstream provider outage or rate-limiting.
   - `LIVE`: Real-time market print, received within $\le 60\text{s}$ of exchange execution.
   - `DELAYED`: Standard exchange-delayed market print (`Market Data · 24H Delayed`). External free-tier quotes are strictly classified as `DELAYED` (or `STALE` if older than 20 minutes) and are **never** labeled `LIVE`.
   - `STALE`: Market quote age $> 20\text{m}$, indicating a frozen feed, closed market, or stale print.

5. **UI Mode Display:**
   - In Demo Mode: Displays **`Demo Mode: [Scenario Name]`** with instant scenario switching.
   - In Local External Provider: Displays **`Market Data · 24H Delayed`** with a clear `Local Only` indicator. The feed is never labeled `LIVE`.

6. **Typed Provider Failure Semantics:**
   - Standardized error hierarchy: `ProviderUnauthorizedError` (401), `ProviderRateLimitError` (429), `ProviderUnavailableError` (503/500), `ProviderTimeoutError` (504), `ProviderMalformedDataError` (502).
   - Exposes typed metadata (`code`, `statusCode`, `retryable`, `retryAfterSeconds`) enabling clean fallback handling without crashing the UI.

---

## 5. Reliability & Fallback Strategy

Financial APIs suffer from aggressive rate-limiting, off-market hour closures, and intermittent timeouts. Pulse implements a resilient multi-tier fallback:

1. **In-Memory & Snapshot Cache:** Quotes are coalesced across unique symbols. If multiple users track `AAPL`, it is queried once per cache TTL.
2. **Circuit Breaker Fallback:** If upstream live APIs return `429 Too Many Requests` or `5xx Server Error`, the system automatically serves the latest persisted `MarketSnapshot` with an amber `CACHED_FALLBACK` badge and clear timestamp indicators.
3. **Market Hours Awareness:** Detects after-hours and weekends, automatically anchoring comparison baselines to official market close prints.
4. **Sanity Filtering:** Outlier prints ($> 50\%$ variance in $< 1\text{min}$ with no volume) are flagged as suspect to prevent false anomaly triggers.

---

## 6. Deterministic Demo Mode (For Evaluation & Judging)

Stock markets operate 9:30 AM – 4:00 PM EST Monday through Friday. To enable full, comprehensive evaluation at any hour without API quota dependencies, Pulse features an integrated **Demo Scenario Switcher**:

| Scenario | Market Behavior Simulated | Radar Outcome |
| :--- | :--- | :--- |
| **Quiet Market** | All assets drift $\pm 0.2\%$, volumes normal, benchmark flat. | Triggers serene **"Nothing Meaningful Changed"** hero screen. |
| **Single-Stock Spike** | SPY/XLK flat; NVDA surges $+6.4\%$ on $3.2\times$ volume with gap. | **NVDA flags CRITICAL (Score: 94)** with 3 explainability chips. |
| **Sector-Wide Run** | Energy rally: XOM $+4.2\%$, CVX $+3.9\%$, Sector ETF XLE $+4.1\%$. | Identifies sector beta; groups assets under sector headline. |
| **Market Crash** | Macro selloff: SPY drops $-3.2\%$, tech stocks fall together. | Identifies broad market beta rather than company-specific failures. |
| **Stale Data** | 45-minute delayed stream with missing prints. | Displays prominent orange `STALE` badge with confidence markers. |
| **Provider Outage** | Simulated HTTP 500 upstream failure. | Gracefully engages circuit breaker; displays cached data banner. |

---

## 7. Technology Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict mode, end-to-end type safety)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (High-contrast dark mode financial radar aesthetic)
- **ORM & Database:** [Prisma](https://www.prisma.io/) with [PostgreSQL](https://www.postgresql.org/) (and local SQLite compatibility)
- **Schema Validation:** [Zod](https://zod.dev/) (Strict validation on all API boundaries)
- **Visualizations:** [Recharts](https://recharts.org/) (Intraday delta sparklines and factor contribution charts)
- **Icons:** [Lucide React](https://lucide.dev/)

---

## 8. Project Structure

```
pulse-market-radar/
├── docs/
│   └── PROJECT_SPEC.md         # Canonical single source-of-truth architecture specification
├── prisma/
│   └── schema.prisma           # Data models (User, Watchlist, Snapshot, Checkpoint)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── checkpoint/     # Checkpoint reset & acknowledge route
│   │   │   ├── health/         # System & provider status route
│   │   │   ├── radar/          # Core attention engine evaluation route
│   │   │   └── watchlist/      # Watchlist & item CRUD routes
│   │   ├── layout.tsx          # Root app shell
│   │   └── page.tsx            # Main Radar dashboard
│   ├── components/
│   │   ├── radar/              # Attention-ranked feed & anomaly cards
│   │   ├── checkpoint/         # "Since You Last Checked" banner
│   │   ├── explainability/     # "Why am I seeing this?" factor drawer
│   │   ├── empty-state/        # "Nothing Meaningful Changed" calm component
│   │   ├── demo/               # Demo scenario switcher toolbar
│   │   └── shared/             # Badges, status pills, navigation
│   ├── lib/
│   │   └── db.ts               # Prisma client singleton
│   └── server/
│       ├── engine/             # Deterministic change engine & scoring math
│       ├── providers/          # Market data provider adapters (Live & Mock)
│       └── services/           # Watchlist, Checkpoint, and Snapshot services
├── tests/
│   ├── engine.test.ts          # Pure math unit tests (scoring, relative returns)
│   └── scenarios.test.ts       # Demo scenario verification tests
├── package.json
├── tsconfig.json
└── README.md
```

---

## 9. Getting Started & Setup

### Prerequisites
- Node.js 18.x or 20.x
- npm / pnpm / yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/pulse-market-radar.git
cd pulse-market-radar

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Variables (`.env`)
```env
# Database connection
DATABASE_URL="postgresql://user:password@localhost:5432/pulse"

# External Delayed Market Data Provider (Free Tier from https://api.marketdata.app/)
# Obtain a free token from https://www.marketdata.app/
# If absent or empty, Pulse automatically and safely defaults to guaranteed deterministic DEMO mode.
MARKETDATA_API_TOKEN=""

# Global Instrument Discovery (Free Tier from https://www.alphavantage.co/)
# Used server-side for global company & ticker autocomplete search (SYMBOL_SEARCH).
# Optional: if absent or empty, Pulse safely uses the built-in smart local catalog (NVDA, AAPL, MSFT, etc.).
ALPHAVANTAGE_API_KEY=""

# Application Mode ("production" | "development" | "demo")
NEXT_PUBLIC_APP_MODE="demo"
```

### Database Migration & Seed
```bash
# Push Prisma schema
npx prisma db push

# Seed initial default watchlist and baseline snapshots
npm run db:seed
```

### Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the radar.

---

## 10. Testing & Verification

```bash
# Run all unit, provider, scenario, persistence, and instrument search tests (92 tests)
npm test

# Verify zero lint errors or warnings
npm run lint

# Compile production build
npm run build
```

---

## 11. Design & Engineering Trade-Offs

| Decision | What We Chose | Alternative Rejected | Rationale |
| :--- | :--- | :--- | :--- |
| **Architecture** | Modular Monolith | Microservices / Kafka | Eliminates distributed failure modes, serialization overhead, and operational complexity while maintaining clean internal boundaries. |
| **Anomaly Scoring** | Deterministic Math Engine | Black-Box LLM Evaluation | Financial telemetry requires inspectable, reproducible mathematical attribution. LLMs are non-deterministic, slow, and prone to hallucinated calculations. |
| **User Interaction** | Asynchronous Checkpoint Radar | Realtime WebSocket Ticker Firehose | Continuous tickers induce anxiety and over-trading. Pulse is designed to answer "what changed while I was away," celebrating quiet markets. |
| **Market Data** | Hexagonal Adapter Pattern | Hardcoded External API | Decouples business logic from upstream provider APIs; allows instantaneous switching between live data and offline demo fixtures. |

---

## 12. Principles & Compliance

- **No Financial Advice:** Pulse provides observational delta analytics, not investment recommendations or trade signals.
- **Privacy First:** Guest sessions use local UUID tokens without tracking personally identifiable information (PII).
- **Accessibility:** High-contrast dark mode palette adhering to WCAG 2.1 AA standards; all semantic colors are accompanied by explicit text and icons.
