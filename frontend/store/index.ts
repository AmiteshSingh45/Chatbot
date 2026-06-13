/**
 * Zustand global stores — NexusAI v2.0
 * Auth, Chat, Settings, AgentSteps, HITL, Memory
 */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Conversation,
  Message,
  User,
  UploadedFile,
  ChatSettings,
  AgentStep,
  HITLRequest,
  Memory,
} from "@/types";

// ── Auth Store ──────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    {
      name: "nexusai-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ── Chat Store ──────────────────────────────────────────────────────────────
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  sidebarOpen: boolean;
  pendingFiles: UploadedFile[];

  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamToken: (token: string) => void;
  finalizeStream: (fullContent: string, metadata?: Record<string, unknown>) => void;
  setIsStreaming: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  addPendingFile: (file: UploadedFile) => void;
  removePendingFile: (id: string) => void;
  clearPendingFiles: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  sidebarOpen: true,
  pendingFiles: [],

  setConversations: (convs) => set({ conversations: convs }),

  addConversation: (conv) =>
    set((state) => ({ conversations: [conv, ...state.conversations] })),

  updateConversation: (id, data) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),

  deleteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId:
        state.activeConversationId === id ? null : state.activeConversationId,
      messages: state.activeConversationId === id ? [] : state.messages,
    })),

  setActiveConversation: (id) =>
    set({ activeConversationId: id, messages: [], streamingContent: "" }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendStreamToken: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),

  finalizeStream: (fullContent, metadata) =>
    set((state) => {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        agent_used: (metadata?.agent_used as string) || null,
        citations: (metadata?.citations as any[]) || [],
        created_at: new Date().toISOString(),
      };
      return {
        messages: [...state.messages, assistantMsg],
        streamingContent: "",
        isStreaming: false,
      };
    }),

  setIsStreaming: (v) => set({ isStreaming: v }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  addPendingFile: (file) =>
    set((state) => ({ pendingFiles: [...state.pendingFiles, file] })),
  removePendingFile: (id) =>
    set((state) => ({ pendingFiles: state.pendingFiles.filter((f) => f.id !== id) })),
  clearPendingFiles: () => set({ pendingFiles: [] }),
}));

// ── Agent Steps Store ────────────────────────────────────────────────────────
interface AgentStepsState {
  steps: AgentStep[];
  isVisible: boolean;
  addStep: (step: AgentStep) => void;
  clearSteps: () => void;
  setVisible: (v: boolean) => void;
}

export const useAgentStepsStore = create<AgentStepsState>()((set) => ({
  steps: [],
  isVisible: true,

  addStep: (step) =>
    set((state) => {
      // Replace existing step with same name (update status)
      const existing = state.steps.findIndex((s) => s.step === step.step);
      if (existing >= 0) {
        const updated = [...state.steps];
        updated[existing] = step;
        return { steps: updated };
      }
      return { steps: [...state.steps, step] };
    }),

  clearSteps: () => set({ steps: [] }),
  setVisible: (v) => set({ isVisible: v }),
}));

// ── HITL Store ───────────────────────────────────────────────────────────────
interface HITLState {
  pendingRequest: HITLRequest | null;
  setPendingRequest: (req: HITLRequest | null) => void;
  clearRequest: () => void;
}

export const useHITLStore = create<HITLState>()((set) => ({
  pendingRequest: null,
  setPendingRequest: (req) => set({ pendingRequest: req }),
  clearRequest: () => set({ pendingRequest: null }),
}));

// ── Memory Store ─────────────────────────────────────────────────────────────
interface MemoryState {
  memories: Memory[];
  isLoading: boolean;
  setMemories: (m: Memory[]) => void;
  addMemory: (m: Memory) => void;
  removeMemory: (id: string) => void;
  setLoading: (v: boolean) => void;
}

export const useMemoryStore = create<MemoryState>()((set) => ({
  memories: [],
  isLoading: false,

  setMemories: (m) => set({ memories: m }),
  addMemory: (m) => set((state) => ({ memories: [m, ...state.memories] })),
  removeMemory: (id) =>
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) })),
  setLoading: (v) => set({ isLoading: v }),
}));

// ── Settings Store ────────────────────────────────────────────────────────────
interface SettingsState {
  settings: ChatSettings;
  updateSettings: (s: Partial<ChatSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        memoryEnabled: true,
        reflectionEnabled: true,
        systemPrompt: "",
        showAgentSteps: true,
      },
      updateSettings: (s) =>
        set((state) => ({ settings: { ...state.settings, ...s } })),
    }),
    { name: "nexusai-settings", storage: createJSONStorage(() => localStorage) }
  )
);
