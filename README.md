# NexusAI — Production-Grade AI Agent Platform

> A full-stack AI agent system built with **LangGraph**, **Groq**, **FAISS**, and **Next.js**.  
> Designed as a portfolio/resume project demonstrating deep expertise in Agentic AI engineering.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     LangGraph Agent Pipeline                          │
│                                                                      │
│  START → memory_inject → router → planner → [agent] → hitl_check    │
│               ↓              ↓         ↓                  ↓          │
│          FAISS recall    Groq LLM  Plan + tools      human gate      │
│                                                           ↓          │
│                                                     reflection        │
│                                                           ↓          │
│                                                     memory_update     │
│                                                           ↓          │
│                                                         END          │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Implementation |
|---|---|
| **Multi-Agent Routing** | LangGraph conditional edges, Groq-powered router |
| **Persistent Memory** | FAISS per-user vector indexes + SQLite metadata |
| **RAG** | Local FAISS, RecursiveCharacterTextSplitter, SentenceTransformers |
| **HITL** | LangGraph `interrupt_before`, SSE resume flow |
| **Reflection** | Self-evaluation node with retry loop |
| **MCP Tools** | `MultiServerMCPClient` with hot-reload |
| **Streaming** | SSE with `astream_events`, token + step events |
| **Observability** | LangSmith optional tracing, structured logging |
| **Auth** | JWT (access + refresh), BCrypt passwords |
| **Zero Cloud** | SQLite + FAISS + local disk (no Redis/PG/Chroma) |

---

## 🧠 Agents

| Route | Agent | Purpose |
|---|---|---|
| `general` | General Chat | Everyday Q&A, analysis, writing |
| `rag` | RAG Agent | Query uploaded documents (FAISS) |
| `web_search` | Web Search | Real-time info via DuckDuckGo |
| `code` | Code Assistant | Coding, debugging, architecture |
| `resume` | Resume Assistant | Career advice, CV optimization |
| `tool` | Tool Calling | Calculator, stock, weather, arXiv |
| `memory` | Memory Retrieval | Recall what user has shared |

---

## 📦 Stack

### Backend
- **FastAPI** — async REST API with SSE streaming
- **LangChain / LangGraph** — agent orchestration and state machine
- **Groq API** — free LLM inference (Llama 3.3, DeepSeek R1)
- **FAISS** — local vector search (RAG + memory)
- **SQLite + aiosqlite** — no database server needed
- **SentenceTransformers** — local embeddings (all-MiniLM-L6-v2)
- **DuckDuckGo Search** — free web search
- **LangSmith** — optional observability tracing

### Frontend
- **Next.js 14** (App Router)
- **Zustand** — state management
- **Framer Motion** — animations
- **ReactMarkdown + rehype-highlight** — syntax-highlighted AI responses
- **TailwindCSS** — utility styling

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Free Groq API key](https://console.groq.com)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

npm install

# Configure API URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📡 API Reference

### Chat (SSE Streaming)
```
POST /api/v1/chat/stream
POST /api/v1/chat              (sync)
POST /api/v1/chat/approve      (HITL resume)
POST /api/v1/chat/stop
```

### Memory
```
GET    /api/v1/memory          (list all)
POST   /api/v1/memory          (add fact)
POST   /api/v1/memory/search   (semantic search)
DELETE /api/v1/memory/{id}
```

### MCP Tools
```
GET  /api/v1/mcp/tools
POST /api/v1/mcp/reload
GET  /api/v1/mcp/status
```

### Conversations
```
GET    /api/v1/conversations
POST   /api/v1/conversations
GET    /api/v1/conversations/{id}
GET    /api/v1/conversations/{id}/messages
PATCH  /api/v1/conversations/{id}
DELETE /api/v1/conversations/{id}
```

### Files (RAG)
```
POST /api/v1/files/upload
GET  /api/v1/files
DELETE /api/v1/files/{id}
```

---

## 🔧 Configuration

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | — | **Required**. Get free at console.groq.com |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Primary model |
| `GROQ_MODEL_FAST` | `llama-3.1-8b-instant` | Routing/fast tasks |
| `GROQ_MODEL_REASONING` | `deepseek-r1-distill-llama-70b` | Complex reasoning |
| `SQLITE_PATH` | `nexusai.db` | SQLite database path |
| `FAISS_INDEX_DIR` | `faiss_indexes/` | Vector index directory |
| `UPLOAD_DIR` | `uploads/` | Uploaded files directory |
| `USE_TAVILY` | `false` | Set true + TAVILY_API_KEY for Tavily search |
| `LANGCHAIN_TRACING_V2` | `false` | Enable LangSmith tracing |
| `MCP_CONFIG_PATH` | `mcp_config.json` | MCP servers config |

---

## 🧪 Adding MCP Servers

Edit `backend/mcp_config.json`:

```json
{
  "servers": [
    {
      "name": "my_tools",
      "transport": "stdio",
      "command": "python",
      "args": ["mcp_servers/my_tool_server.py"]
    },
    {
      "name": "remote_api",
      "transport": "streamable_http",
      "url": "https://your-mcp-server.com/mcp"
    }
  ]
}
```

Then call `POST /api/v1/mcp/reload` to hot-reload without restarting.

---

## 📁 Project Structure

```
AiChatBot/
├── backend/
│   ├── app/
│   │   ├── agents/          # 7 specialized agents
│   │   │   ├── tools/       # calculator, ddg, arxiv, weather, stock, url
│   │   │   ├── general_chat.py
│   │   │   ├── rag_agent.py
│   │   │   ├── web_search.py
│   │   │   ├── code_assistant.py
│   │   │   └── specialized.py  (memory, resume, tool_calling)
│   │   ├── graph/
│   │   │   ├── graph.py     # LangGraph pipeline assembly
│   │   │   ├── state.py     # AgentState TypedDict
│   │   │   ├── router.py    # Intent classifier
│   │   │   └── nodes/       # memory_inject, planner, hitl, reflection, memory_update
│   │   ├── services/
│   │   │   ├── memory_service.py  # FAISS long-term memory
│   │   │   ├── rag_service.py     # FAISS document RAG
│   │   │   ├── file_service.py    # Upload + chunking pipeline
│   │   │   └── mcp_service.py     # MCP server orchestration
│   │   ├── api/v1/          # REST + SSE endpoints
│   │   ├── models/          # SQLAlchemy ORM models
│   │   └── core/            # Config, logging, exceptions
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── chat/[threadId]/  # Chat thread pages
    │   └── auth/             # Login/register
    ├── components/
    │   ├── chat/             # MessageBubble, Composer, AgentSteps, HumanApproval
    │   └── ui/               # ModelSelector, Sidebar
    ├── store/                # Zustand stores
    ├── lib/api.ts            # API client + SSE streaming
    └── types/                # TypeScript type definitions
```

---

## 📜 License

MIT — Built by Amitesh Kumar for portfolio purposes.
