# 🤖 NexusAI — Production AI Chatbot Platform

A production-grade, SaaS-quality AI conversational platform built with **Next.js 15**, **FastAPI**, **LangGraph**, and **Groq**.

> Architecture quality: Staff Engineer level. Resume-worthy. ChatGPT-rival.

## Architecture

```
frontend/   →  Next.js 15, TypeScript, TailwindCSS, shadcn/ui, Zustand
backend/    →  FastAPI, LangGraph, LangChain, SQLAlchemy, Redis
```

## Quick Start (Local Dev)

```bash
# 1. Clone and install
git clone <repo>

# 2. Start all services
docker-compose up -d

# 3. Frontend
cd frontend && npm install && npm run dev

# 4. Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## Features

- 🧠 Multi-agent LangGraph system (7 specialized agents)
- 💬 Real-time streaming via WebSockets
- 📂 File upload + RAG (PDF, DOCX, TXT, CSV)
- 🔐 Auth (Google, GitHub, Email/Password)
- 🧵 Thread-based persistent memory
- 🔍 Web search, code execution, resume assistant
- 📊 LangSmith observability
- 🎨 Premium ChatGPT-like UI

## Deployment

| Service | Platform |
|---------|----------|
| Frontend | Vercel |
| Backend | Railway |
| Database | Neon PostgreSQL |
| Cache | Upstash Redis |
| Storage | Cloudinary |

## Docs

See `/docs` for architecture diagrams and API documentation.
