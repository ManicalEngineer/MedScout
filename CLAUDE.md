# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

ADHDBuddy is a monorepo with three sub-projects:

| Directory | Stack | Purpose |
|---|---|---|
| `landing/` | Next.js 16, TypeScript, Tailwind v4 | Marketing landing page |
| `mobile/` | Expo SDK 54, React Native 0.81, TypeScript | iOS/Android mobile app |
| `backend/` | Python, FastAPI, SQLAlchemy, Alembic | REST API (port 8000) |

---

## Landing Page (`landing/`)

> **Note:** This project uses Next.js 16, which has breaking API changes from prior versions. Read `node_modules/next/dist/docs/` before writing any Next.js-specific code.

### Commands
```bash
cd landing
npm run dev       # Dev server → http://localhost:3000
npm run build
npm run lint      # eslint
```

### Architecture
App Router with `src/app/` layout. Tailwind v4 (PostCSS plugin — no `tailwind.config.js`; configuration lives in `globals.css`).

---

## Mobile App (`mobile/`)

### Commands
```bash
cd mobile
npx expo start           # Start dev server (scan QR with Expo Go)
npx expo start --android
npx expo start --ios     # macOS only
npx expo start --web
```

### Architecture
Bare Expo + TypeScript scaffold. Entry point is `index.ts` → `App.tsx`. No navigation or state management installed yet — add as needed.

---

## Backend (`backend/`)

### Setup (first time)
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

### Commands
```bash
cd backend
python main.py                                      # Dev server with reload → http://localhost:8000
                                                    # Swagger UI: http://localhost:8000/docs

# Database migrations (run from backend/ with venv active)
alembic revision --autogenerate -m "<description>"  # Generate migration from model changes
alembic upgrade head                                # Apply migrations
alembic downgrade -1                                # Roll back one migration
```

### Architecture

**Request flow:** `main.py` → `routers/__init__.py` (aggregates routers) → individual router files → SQLAlchemy models via `get_db()` dependency.

- `main.py` — FastAPI app, CORS middleware, mounts `api_router` at `/api/v1`
- `database.py` — SQLAlchemy engine, `SessionLocal`, `Base`, `get_db()` dependency
- `models.py` — SQLAlchemy ORM models (all inherit from `Base`)
- `routers/` — one file per domain; register new routers in `routers/__init__.py`
- `migrations/` — Alembic; `env.py` reads `DATABASE_URL` from env and imports `Base.metadata` from `models.py` for autogenerate

**Adding a new domain:** create `routers/<domain>.py`, add its `router` to `routers/__init__.py`, and add any new models to `models.py` before generating a migration.

**Env vars** (see `.env.example`):
- `DATABASE_URL` — defaults to `sqlite:///./adhd_buddy.db`
- `SECRET_KEY` — used for JWT signing
