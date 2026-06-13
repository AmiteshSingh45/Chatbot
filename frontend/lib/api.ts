/**
 * API client — Axios instance + all API calls + SSE streaming helper.
 * NexusAI v2.0 — full SSE, memory, MCP, HITL support.
 */
import axios from "axios";
import type { StreamEvent, AgentStep, Memory, MCPTool, MCPServer } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Axios Instance ───────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

// Inject auth token on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token } = res.data;
          localStorage.setItem("access_token", access_token);
          error.config.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(error.config);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── SSE Streaming Helper ─────────────────────────────────────────────────────
export interface SSEStreamOptions {
  onToken: (token: string) => void;
  onAgentStep: (step: AgentStep) => void;
  onHITL: (action: string, args: Record<string, unknown>, threadId: string) => void;
  onDone: (metadata: Record<string, unknown>) => void;
  onError: (message: string) => void;
  onStopped?: () => void;
}

/**
 * Start an SSE chat stream. Returns an AbortController to stop early.
 *
 * Why fetch instead of EventSource?
 * EventSource doesn't support POST requests or custom headers (auth token).
 * We use fetch with ReadableStream for full control.
 */
export async function startSSEStream(
  threadId: string,
  content: string,
  fileIds: string[],
  model: string | undefined,
  callbacks: SSEStreamOptions
): Promise<AbortController> {
  const controller = new AbortController();
  const token = localStorage.getItem("access_token");

  const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      thread_id: threadId,
      content,
      file_ids: fileIds,
      model,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    callbacks.onError(`Request failed: ${response.statusText}`);
    return controller;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Read stream
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event: StreamEvent = JSON.parse(jsonStr);

            switch (event.type) {
              case "token":
                callbacks.onToken(event.content || "");
                break;
              case "agent_step":
                if (event.step) callbacks.onAgentStep(event.step);
                break;
              case "hitl":
                callbacks.onHITL(
                  event.action || "",
                  event.args || {},
                  threadId
                );
                break;
              case "done":
                callbacks.onDone(event.metadata || {});
                break;
              case "error":
                callbacks.onError(event.message || "Unknown error");
                break;
              case "stopped":
                callbacks.onStopped?.();
                break;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        callbacks.onError("Stream disconnected unexpectedly.");
      }
    }
  })();

  return controller;
}

/**
 * Resume HITL-interrupted graph via SSE.
 */
export async function resumeHITL(
  threadId: string,
  decision: "approved" | "rejected",
  callbacks: SSEStreamOptions
): Promise<AbortController> {
  const controller = new AbortController();
  const token = localStorage.getItem("access_token");

  const response = await fetch(`${API_BASE}/api/v1/chat/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ thread_id: threadId, decision }),
    signal: controller.signal,
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: StreamEvent = JSON.parse(line.slice(6).trim());
            if (event.type === "token") callbacks.onToken(event.content || "");
            else if (event.type === "agent_step" && event.step) callbacks.onAgentStep(event.step);
            else if (event.type === "done") callbacks.onDone(event.metadata || {});
            else if (event.type === "error") callbacks.onError(event.message || "");
          } catch {}
        }
      }
    } catch {}
  })();

  return controller;
}

// ── Memory API ───────────────────────────────────────────────────────────────
export const memoryApi = {
  list: (memoryType?: string) =>
    apiClient.get<{ memories: Memory[]; total: number }>("/api/v1/memory", {
      params: memoryType ? { memory_type: memoryType } : undefined,
    }),

  search: (query: string, topK = 5) =>
    apiClient.post<{ results: Memory[]; count: number }>("/api/v1/memory/search", {
      query,
      top_k: topK,
    }),

  add: (memoryText: string, memoryType = "semantic", category = "general") =>
    apiClient.post<{ id: string; status: string }>("/api/v1/memory", {
      memory_text: memoryText,
      memory_type: memoryType,
      category,
    }),

  delete: (id: string) => apiClient.delete(`/api/v1/memory/${id}`),
};

// ── MCP API ──────────────────────────────────────────────────────────────────
export const mcpApi = {
  tools: () =>
    apiClient.get<{ tools: MCPTool[]; total: number }>("/api/v1/mcp/tools"),

  reload: () => apiClient.post("/api/v1/mcp/reload"),

  status: () =>
    apiClient.get<{ servers: MCPServer[]; total_tools: number }>("/api/v1/mcp/status"),
};

// ── Conversation API ─────────────────────────────────────────────────────────
export const conversationApi = {
  list: () => apiClient.get("/api/v1/conversations"),
  create: (model?: string) =>
    apiClient.post("/api/v1/conversations", { model }),
  get: (id: string) => apiClient.get(`/api/v1/conversations/${id}`),
  update: (id: string, data: { title?: string; model?: string; is_pinned?: boolean }) =>
    apiClient.patch(`/api/v1/conversations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/conversations/${id}`),
  messages: (id: string, limit = 50) =>
    apiClient.get(`/api/v1/conversations/${id}/messages`, { params: { limit } }),
};

// ── File API ─────────────────────────────────────────────────────────────────
export const fileApi = {
  upload: (formData: FormData) =>
    apiClient.post("/api/v1/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  list: (conversationId?: string) =>
    apiClient.get("/api/v1/files", {
      params: conversationId ? { conversation_id: conversationId } : undefined,
    }),
  delete: (id: string) => apiClient.delete(`/api/v1/files/${id}`),
};

// ── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post("/api/v1/auth/login", { email, password }),
  register: (email: string, password: string, username?: string) =>
    apiClient.post("/api/v1/auth/register", { email, password, username }),
  logout: () => apiClient.post("/api/v1/auth/logout"),
  me: () => apiClient.get("/api/v1/auth/me"),
};

// ── Stop Generation ──────────────────────────────────────────────────────────
export const stopGeneration = (threadId: string) =>
  apiClient.post(`/api/v1/chat/stop?thread_id=${threadId}`);
