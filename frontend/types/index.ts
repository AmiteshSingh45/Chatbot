/**
 * Core TypeScript types for NexusAI v2.0
 * Single source of truth — shared across all components.
 */

export interface User {
  id: string;
  email: string;
  username: string | null;
  profile_image: string | null;
  provider: string;
  is_verified: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  thread_id: string;
  model: string;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface Citation {
  index: number;
  source?: string;
  page?: string | number;
  score?: number;
  file_id?: string;
  url?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  agent_used?: string | null;
  token_count?: number | null;
  metadata?: Record<string, unknown> | null;
  citations?: Citation[];
  agent_steps?: AgentStep[];
  created_at: string;
}

export interface UploadedFile {
  id: string;
  original_filename: string;
  file_type: string;
  local_path?: string;
  status: "pending" | "processing" | "ready" | "failed";
  chunk_count?: number | null;
  file_size?: number | null;
  conversation_id?: string | null;
  faiss_index_name?: string | null;
  created_at: string;
}

// ── Agent Execution Steps ─────────────────────────────────────────────────────
export interface AgentStep {
  step: string;
  label: string;
  status: "running" | "done" | "error";
  detail: string;
  duration_ms: number;
}

// ── HITL (Human-in-the-Loop) ──────────────────────────────────────────────────
export interface HITLRequest {
  thread_id: string;
  action: string;
  args: Record<string, unknown>;
  timestamp?: string;
}

// ── Memory ────────────────────────────────────────────────────────────────────
export interface Memory {
  id: string;
  memory_text: string;
  memory_type: "semantic" | "episodic" | "procedural" | "working";
  category?: string;
  importance_score: number;
  access_count: number;
  similarity_score?: number;
  source_conversation_id?: string;
  created_at?: string;
}

// ── MCP ───────────────────────────────────────────────────────────────────────
export interface MCPTool {
  name: string;
  description: string;
  args_schema?: string;
}

export interface MCPServer {
  name: string;
  transport: string;
  status: "connected" | "error" | "disconnected" | "unknown";
}

// ── SSE Streaming ─────────────────────────────────────────────────────────────
export type StreamEventType =
  | "token"
  | "done"
  | "error"
  | "stopped"
  | "agent_step"
  | "hitl";

export interface StreamEvent {
  type: StreamEventType;
  // token
  content?: string;
  // agent_step
  step?: AgentStep;
  // hitl
  action?: string;
  args?: Record<string, unknown>;
  // done
  metadata?: {
    agent_used?: string;
    latency_ms?: number;
    thread_id?: string;
    citations?: Citation[];
    hitl_decision?: string;
  };
  // error
  message?: string;
}

// ── Agent Routing ─────────────────────────────────────────────────────────────
export type AgentRoute =
  | "general"
  | "rag"
  | "web_search"
  | "code"
  | "resume"
  | "tool"
  | "memory";

export const AGENT_ROUTE_LABELS: Record<AgentRoute, string> = {
  general: "General Chat",
  rag: "Document Analysis",
  web_search: "Web Search",
  code: "Code Assistant",
  resume: "Resume Help",
  tool: "Tools",
  memory: "Memory Recall",
};

// ── Model Config ──────────────────────────────────────────────────────────────
export interface GroqModel {
  id: string;
  name: string;
  contextWindow: number;
  speed: "fast" | "balanced" | "slow";
  capabilities: string[];
  description: string;
}

export const GROQ_MODELS: GroqModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    contextWindow: 128000,
    speed: "balanced",
    capabilities: ["reasoning", "coding", "writing", "analysis"],
    description: "Best overall. Great for complex tasks.",
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    contextWindow: 128000,
    speed: "fast",
    capabilities: ["chat", "simple-tasks", "fast-responses"],
    description: "Fastest. Best for simple questions.",
  },
  {
    id: "deepseek-r1-distill-llama-70b",
    name: "DeepSeek R1 (Reasoning)",
    contextWindow: 128000,
    speed: "slow",
    capabilities: ["math", "reasoning", "step-by-step", "research"],
    description: "Best reasoning. Use for complex problem-solving.",
  },
];

// ── Settings ──────────────────────────────────────────────────────────────────
export interface ChatSettings {
  model: string;
  temperature: number;
  memoryEnabled: boolean;
  reflectionEnabled: boolean;
  systemPrompt?: string;
  showAgentSteps: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}
