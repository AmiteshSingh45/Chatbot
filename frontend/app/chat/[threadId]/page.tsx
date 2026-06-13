"use client";
/**
 * Chat Thread Page — full SSE streaming with AgentSteps + HITL.
 * Uses SSE (fetch-based) instead of WebSocket for simpler integration.
 * Handles: streaming tokens, agent steps, HITL interrupts, stop generation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import MessageBubble from "@/components/chat/MessageBubble";
import Composer from "@/components/chat/Composer";
import AgentSteps from "@/components/chat/AgentSteps";
import HumanApproval from "@/components/chat/HumanApproval";
import ModelSelector from "@/components/ui/ModelSelector";

import {
  startSSEStream,
  resumeHITL,
  stopGeneration,
  conversationApi,
} from "@/lib/api";

import {
  useAuthStore,
  useChatStore,
  useAgentStepsStore,
  useHITLStore,
  useSettingsStore,
} from "@/store";

import type { AgentStep, HITLRequest, Message } from "@/types";

export default function ChatThreadPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params?.threadId as string;

  const { isAuthenticated } = useAuthStore();
  const {
    messages,
    isStreaming,
    streamingContent,
    addMessage,
    appendStreamToken,
    finalizeStream,
    setIsStreaming,
    setMessages,
    setActiveConversation,
  } = useChatStore();

  const { steps, addStep, clearSteps } = useAgentStepsStore();
  const { pendingRequest, setPendingRequest, clearRequest } = useHITLStore();
  const { settings } = useSettingsStore();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, router]);

  // ── Load conversation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!threadId) return;

    const load = async () => {
      try {
        // Find conversation by thread_id
        const res = await conversationApi.list();
        const conv = res.data.conversations?.find(
          (c: any) => c.thread_id === threadId
        );

        if (!conv) {
          router.replace("/chat");
          return;
        }

        setConversationId(conv.id);
        setActiveConversation(conv.id);

        // Load messages
        const msgRes = await conversationApi.messages(conv.id);
        setMessages(msgRes.data.messages || []);
      } catch (e) {
        console.error("Failed to load conversation:", e);
      }
    };
    load();
  }, [threadId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, steps]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, fileIds: string[]) => {
      if (!threadId || isStreaming) return;
      setError(null);

      // Add user message to UI
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      addMessage(userMsg);
      setIsStreaming(true);
      clearSteps();

      try {
        const controller = await startSSEStream(
          threadId,
          content,
          fileIds,
          settings.model,
          {
            onToken: (token) => {
              appendStreamToken(token);
            },

            onAgentStep: (step: AgentStep) => {
              if (settings.showAgentSteps) {
                addStep(step);
              }
            },

            onHITL: (action, args, tid) => {
              const req: HITLRequest = {
                thread_id: tid,
                action,
                args,
                timestamp: new Date().toISOString(),
              };
              setPendingRequest(req);
              setIsStreaming(false);
            },

            onDone: (metadata) => {
              finalizeStream(streamingContent || "", metadata);
              setIsStreaming(false);
            },

            onError: (message) => {
              setError(message);
              setIsStreaming(false);
            },

            onStopped: () => {
              finalizeStream(streamingContent || "[Generation stopped]");
              setIsStreaming(false);
            },
          }
        );
        abortControllerRef.current = controller;
      } catch (e: any) {
        setError(e.message || "Failed to start stream");
        setIsStreaming(false);
      }
    },
    [
      threadId,
      isStreaming,
      settings.model,
      settings.showAgentSteps,
      streamingContent,
      addMessage,
      setIsStreaming,
      appendStreamToken,
      finalizeStream,
      clearSteps,
      addStep,
      setPendingRequest,
    ]
  );

  // ── Stop generation ───────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (threadId) {
      await stopGeneration(threadId);
    }
  }, [threadId]);

  // ── HITL handlers ─────────────────────────────────────────────────────────
  const handleHITLApprove = useCallback(async () => {
    if (!pendingRequest) return;
    clearRequest();
    setIsStreaming(true);
    clearSteps();

    try {
      const controller = await resumeHITL(
        pendingRequest.thread_id,
        "approved",
        {
          onToken: appendStreamToken,
          onAgentStep: (step) => settings.showAgentSteps && addStep(step),
          onHITL: () => {},
          onDone: (meta) => {
            finalizeStream(streamingContent || "", meta);
            setIsStreaming(false);
          },
          onError: (msg) => {
            setError(msg);
            setIsStreaming(false);
          },
        }
      );
      abortControllerRef.current = controller;
    } catch (e: any) {
      setError(e.message);
      setIsStreaming(false);
    }
  }, [pendingRequest, streamingContent, appendStreamToken, finalizeStream, addStep, clearRequest, clearSteps, setIsStreaming, settings.showAgentSteps]);

  const handleHITLReject = useCallback(async () => {
    if (!pendingRequest) return;
    await resumeHITL(pendingRequest.thread_id, "rejected", {
      onToken: () => {},
      onAgentStep: () => {},
      onHITL: () => {},
      onDone: (meta) => {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Action was rejected. I'll proceed without executing that action.",
          created_at: new Date().toISOString(),
        });
      },
      onError: () => {},
    });
    clearRequest();
  }, [pendingRequest, clearRequest, addMessage]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/5"
        style={{ background: "rgba(8,8,12,0.8)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-white/60 font-medium">
            Thread: <span className="text-white/40 font-mono text-xs">{threadId?.slice(0, 16)}…</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector />
          {/* Agent Steps toggle */}
          <button
            id="toggle-agent-steps"
            onClick={() => useSettingsStore.getState().updateSettings({
              showAgentSteps: !settings.showAgentSteps
            })}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
              settings.showAgentSteps
                ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                : "border-white/10 text-white/40 bg-transparent"
            }`}
          >
            🔍 Steps
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        {/* Empty state */}
        {messages.length === 0 && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center py-16"
          >
            <div
              className="mb-6 h-20 w-20 rounded-3xl flex items-center justify-center text-4xl"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.2) 100%)",
                border: "1px solid rgba(139,92,246,0.2)",
              }}
            >
              ⚡
            </div>
            <h2 className="text-2xl font-bold text-white/80 mb-2">Ready to assist</h2>
            <p className="text-white/40 text-sm max-w-sm">
              I have access to web search, document analysis, code assistance, 
              memory recall, and more. What can I help you with?
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                "🔍 Search the web for LLM research",
                "📄 Analyze my uploaded document",
                "💻 Write a Python script",
                "🧠 What do you know about me?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt.replace(/^[^\s]+ /, ""), [])}
                  className="px-3 py-1.5 rounded-xl text-xs text-white/50 border border-white/10
                             hover:border-purple-500/40 hover:text-white/80 transition-all duration-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageBubble message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Agent Steps (shown during streaming) */}
        <AnimatePresence>
          {(isStreaming || steps.length > 0) && settings.showAgentSteps && (
            <AgentSteps steps={steps} isStreaming={isStreaming} />
          )}
        </AnimatePresence>

        {/* HITL Approval Card */}
        <AnimatePresence>
          {pendingRequest && (
            <HumanApproval
              request={pendingRequest}
              onApprove={handleHITLApprove}
              onReject={handleHITLReject}
            />
          )}
        </AnimatePresence>

        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div
              className="max-w-[80%] rounded-2xl rounded-tl-sm px-5 py-4"
              style={{
                background: "linear-gradient(135deg, rgba(20,20,30,0.9) 0%, rgba(25,25,40,0.9) 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block ml-0.5 h-4 w-0.5 bg-purple-400 animate-pulse align-text-bottom" />
              </p>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto max-w-sm rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 text-center"
          >
            ⚠️ {error}
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 pt-2">
        <Composer
          onSend={sendMessage}
          onStop={handleStop}
          isStreaming={isStreaming}
          conversationId={conversationId}
        />
      </div>
    </div>
  );
}
