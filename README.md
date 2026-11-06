# Real-Time Multiplayer Ludo Platform

A high-performance, real-time multiplayer online Ludo web platform built with **Next.js**, **React**, **TypeScript**, **Tailwind CSS**, **Node.js**, **Express**, **Socket.IO**, **Redis**, and **PostgreSQL**.

Players from anywhere in the world can create and join game sessions using **only a 6-character Session ID** — no mandatory registration or login required.

---

## 🌟 Key Features

1. **Two-Player & Four-Player Modes**:
   - **2-Player Mode**: Opposing colors (Red vs Yellow, 4 tokens each, 8 total tokens).
   - **4-Player Mode**: Red, Green, Yellow, Blue (4 tokens each, 16 total tokens).

2. **Session ID Only Joining**:
   - The creator receives an unpredictable 6-character Session ID (e.g., `LUDO7A`, `7K9M2P`).
   - Other players simply type in that Session ID to join the same match. No URLs, emails, or accounts required.

3. **Guest Identity & Reconnection Resilience**:
   - Temporary guest identities with private 256-bit reconnection tokens stored securely.
   - Private recovery code (e.g. `RC-8924-1748`) allows cross-device identity recovery.
   - If a player disconnects, the match is paused, the player slot is preserved, and opponents are notified.
   - When all players disconnect, a 15-minute countdown grace period starts. Any player reconnecting resumes the match!

4. **Server-Authoritative Classic Ludo Game Engine**:
   - Server-side cryptographically secure dice generation (`crypto.randomInt(1, 7)`).
   - Require a **6** to bring a token out of the starting yard.
   - **8 Safe Squares**: 4 starting squares (0, 13, 26, 39) + 4 star/globe squares (8, 21, 34, 47). Tokens cannot be captured on safe squares.
   - **Capturing**: Landing on an opponent token on vulnerable squares captures it back to their yard and grants a **bonus turn**!
   - **Bonus Turn on 6**: Rolling a 6 grants an extra roll.
   - **Three-Consecutive-Sixes Penalty**: Rolling three 6s in a row forfeits the turn and passes immediately.
   - **Exact Roll Home**: Exact count required to reach the final home destination (overshoots rejected).
   - **Auto-Pass**: Turns pass automatically when no legal moves exist.

5. **Universal Responsive Design**:
   - Seamless, touch-friendly gameplay from small phones (320px) to ultrawide desktops (2560px).
   - Scalable vector 15x15 SVG board maintaining 1:1 aspect ratio without cropping or horizontal overflow.
   - Touch targets $\ge 44\text{px}$, eliminated mobile tap delays via `touch-action: manipulation`, and mobile safe-area insets.

6. **Performance & Scalability**:
   - Modular monolith architecture with npm workspaces.
   - Redis-backed session and presence tracking with in-memory automatic fallback.
   - Sub-100ms server action latency under load (benchmarked at ~2.5ms average latency for 25 concurrent matches).
   - Initial page bundle only 115 kB First Load JS.

---

## 📂 Project Structure

```
ludo-multiplayer/
├── apps/
│   ├── web/                     # Next.js 14 App Router, React, Tailwind CSS, Framer Motion
│   │   ├── app/                 # Pages, layout, globals.css, manifest.json
│   │   ├── components/          # LudoBoard, DiceWidget, PlayerCard, ActivityLog, LobbyView, HomeView
│   │   └── hooks/               # useLudoSocket, useSound (Web Audio API & haptics)
│   └── server/                  # Node.js, Express, Socket.IO, Redis, PostgreSQL
│       └── src/
│           ├── game-engine/     # Server-authoritative dice & movement rules
│           ├── sessions/        # Session lifecycle, slots, guest credentials
│           ├── sockets/         # Socket.IO event gateway
│           ├── reconnection/    # Presence tracker & 15-minute disconnect grace period
│           ├── security/        # Cryptographic generators, idempotency, rate limiter
│           └── storage/         # Redis adapter, In-Memory fallback adapter, PostgreSQL pool
├── packages/
│   ├── shared-types/            # Common domain types & Socket.IO contracts
│   ├── game-rules/              # Pure mathematical rules & board coordinate mapping
│   └── validation/              # Zod input validation schemas
├── tests/
│   ├── unit/                    # Game rules, validation, responsive viewports tests
│   ├── integration/             # Sessions, game engine, live socket sync tests
│   ├── e2e/                     # 2P & 4P match lifecycles, disconnect/reconnect tests
│   └── load/                    # 25 concurrent matches (50 players) throughput tests
├── Dockerfile.server            # Multi-stage production container for server
├── Dockerfile.web               # Multi-stage production container for web
├── docker-compose.yml           # Production stack (Web, Server, Redis, Postgres)
└── package.json                 # Monorepo workspaces configuration
```

---

## 🚀 Quickstart (Local Development)

### Prerequisites
- **Node.js**: v18+ (tested on Node v22 and v24)
- **npm**: v9+

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend Server
```bash
npm run dev:server
```
The server will start on `http://localhost:4000`. If Redis is not running locally, the server automatically uses the high-performance in-memory adapter without any extra configuration!

### 3. Start the Frontend Application
In a separate terminal:
```bash
npm run dev:web
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Production Deployment with Docker Compose

To deploy the entire production stack including **Web**, **Server**, **Redis**, and **PostgreSQL**:

```bash
docker compose up -d --build
```

Services will be accessible at:
- **Web Application**: `http://localhost:3000`
- **Socket.IO Backend API**: `http://localhost:4000` (Health check: `/health`)
- **Redis**: `localhost:6379`
- **PostgreSQL**: `localhost:5432`

To view logs:
```bash
docker compose logs -f
```

---

## 🧪 Automated Test Suite

Run all test suites across the monorepo:

```bash
# Run all unit, integration, e2e, and load tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run load tests only
npm run test:load
```

### Test Coverage Breakdown:
- **Unit Tests**:
  - `game-rules.test.ts`: Track coordinates, distance calculations, yard entry, safe squares, overshoot rejection, captures, bonus turns, win condition.
  - `validation.test.ts`: Zod schema validations for Session IDs, player names, move and roll inputs.
  - `responsive-viewports.test.ts`: Aspect ratio and touch targets across 11 device viewports (320px to 2560px).
- **Integration Tests**:
  - `session-management.test.ts`: Slot assignments, lobby capacity, private credential isolation, disconnect & grace period expiration, reconnect & recovery code restoration.
  - `game-engine.test.ts`: Server-authoritative dice generation, turn validation, double-roll prevention, idempotency cache.
  - `socket-sync.test.ts`: Live client-server Socket.IO event broadcasting and latency measurement.
- **End-to-End Tests**:
  - `multiplayer-match.test.ts`: 2-player and 4-player complete game cycles, disconnect/reconnect simulation with fresh client sockets.
- **Load Tests**:
  - `concurrency.test.ts`: 25 simultaneous matches (50 players) executing concurrent actions with measured latency under 3ms.

---

## 📱 Cross-Device Acceptance Test Guide

To verify seamless cross-device play:
1. Open [http://localhost:3000](http://localhost:3000) on your desktop or laptop.
2. Click **Create New Game** $\rightarrow$ select **2-Player Game**.
3. Note the generated 6-character **Session ID** (e.g. `LUDO7A`).
4. On your mobile phone (Android or iPhone on the same network or port-forwarded URL), open the site, enter your name, type the **Session ID**, and tap **Join Game**.
5. Observe:
   - The game immediately activates on both devices simultaneously.
   - Device 1 rolls the dice; Device 2 sees the die roll and settle on the exact same value in real time.
   - Device 1 selects a highlighted token; both devices animate the move.
   - Toggle airplane mode on Device 2: Device 1 sees the pause banner with countdown. Reconnect Device 2: the game seamlessly resumes where it left off!
"# Ludo_Multiplayer" 
