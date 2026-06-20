"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Sparkles, ChevronLeft } from "lucide-react";

import MessageBubble from "@/components/chat/MessageBubble";
import SkeletonMessage from "@/components/chat/SkeletonMessage";
import Composer from "@/components/chat/Composer";
import AgentSteps from "@/components/chat/AgentSteps";
import HumanApproval from "@/components/chat/HumanApproval";
import ModelSelector from "@/components/ui/ModelSelector";
import { Button } from "@/components/ui/Button";

import {
  startSSEStream, resumeHITL, stopGeneration, conversationApi,
} from "@/lib/api";
import {
  useAuthStore, useChatStore, useAgentStepsStore,
  useHITLStore, useSettingsStore,
} from "@/store";
import type { AgentStep, HITLRequest, Message } from "@/types";

// ── Sample prompts for empty state ────────────────────────────────────────────
const QUICK_PROMPTS = [
  { emoji: "🔍", text: "Search the web for latest LLM research" },
  { emoji: "📄", text: "Analyze my uploaded document" },
  { emoji: "💻", text: "Write a Python data pipeline script" },
  { emoji: "🧠", text: "What do you remember about me?" },
];

export default function ChatThreadPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params?.threadId as string;

  const { isAuthenticated } = useAuthStore();
  const {
    messages, isStreaming, streamingContent,
    addMessage, appendStreamToken, finalizeStream,
    setIsStreaming, setMessages, setActiveConversation,
  } = useChatStore();
  const { steps, addStep, clearSteps } = useAgentStepsStore();
  const { pendingRequest, setPendingRequest, clearRequest } = useHITLStore();
  const { settings } = useSettingsStore();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convTitle, setConvTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) router.replace("/auth/login");
  }, [isAuthenticated, router]);

  // ── Load conversation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!threadId) return;
    setLoading(true);

    const load = async () => {
      try {
        const res = await conversationApi.list();
        const conv = res.data.conversations?.find((c: any) => c.thread_id === threadId);
        if (!conv) { router.replace("/chat"); return; }

        setConversationId(conv.id);
        setConvTitle(conv.title || "Chat");
        setActiveConversation(conv.id);

        const msgRes = await conversationApi.messages(conv.id);
        setMessages(msgRes.data.messages || []);

        // Handle starter prompt from session storage
        const starter = sessionStorage.getItem("starter_prompt");
        if (starter) {
          sessionStorage.removeItem("starter_prompt");
          setTimeout(() => handleSend(starter, []), 200);
        }
      } catch (e) {
        console.error("Failed to load conversation:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, steps]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async (content: string, fileIds: string[]) => {
    if (!threadId || isStreaming) return;
    setError(null);

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
        threadId, content, fileIds, settings.model,
        {
          onToken: (token) => appendStreamToken(token),
          onAgentStep: (step: AgentStep) => { if (settings.showAgentSteps) addStep(step); },
          onHITL: (action, args, tid) => {
            setPendingRequest({ thread_id: tid, action, args, timestamp: new Date().toISOString() });
            setIsStreaming(false);
          },
          onDone: (metadata) => { finalizeStream(streamingContent || "", metadata); setIsStreaming(false); },
          onError: (message) => { setError(message); setIsStreaming(false); },
          onStopped: () => { finalizeStream(streamingContent || "[Generation stopped]"); setIsStreaming(false); },
        }
      );
      abortRef.current = controller;
    } catch (e: any) {
      setError(e.message || "Failed to start stream");
      setIsStreaming(false);
    }
  }, [
    threadId, isStreaming, settings.model, settings.showAgentSteps, streamingContent,
    addMessage, setIsStreaming, appendStreamToken, finalizeStream, clearSteps, addStep, setPendingRequest,
  ]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    abortRef.current?.abort();
    if (threadId) await stopGeneration(threadId);
  }, [threadId]);

  // ── HITL ──────────────────────────────────────────────────────────────────
  const handleHITLApprove = useCallback(async () => {
    if (!pendingRequest) return;
    clearRequest();
    setIsStreaming(true);
    clearSteps();

    try {
      const controller = await resumeHITL(
        pendingRequest.thread_id, "approved",
        {
          onToken: appendStreamToken,
          onAgentStep: (step) => settings.showAgentSteps && addStep(step),
          onHITL: () => {},
          onDone: (meta) => { finalizeStream(streamingContent || "", meta); setIsStreaming(false); },
          onError: (msg) => { setError(msg); setIsStreaming(false); },
          onStopped: () => {},
        }
      );
      abortRef.current = controller;
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
      onDone: () => {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Action was rejected. I'll proceed without executing that action.",
          created_at: new Date().toISOString(),
        });
      },
      onError: () => {},
      onStopped: () => {},
    });
    clearRequest();
  }, [pendingRequest, clearRequest, addMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          background: "rgba(8,8,14,0.90)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button */}
          <button
            onClick={() => router.push("/chat")}
            className="btn-ghost p-1.5 rounded-xl flex-shrink-0"
            title="All conversations"
            aria-label="Back to chat list"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Live status dot */}
          <motion.span
            animate={isStreaming ? { scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{
              background: isStreaming ? "#10b981" : "var(--border-strong)",
              boxShadow: isStreaming ? "0 0 8px #10b981" : "none",
              transition: "background 0.3s, box-shadow 0.3s",
            }}
          />
          <h2 className="text-sm font-semibold truncate max-w-[200px] md:max-w-xs"
            style={{ color: "var(--text-primary)" }}>
            {convTitle || "Chat"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector />
          {/* Agent steps toggle */}
          <button
            id="toggle-agent-steps"
            onClick={() => useSettingsStore.getState().updateSettings({
              showAgentSteps: !settings.showAgentSteps
            })}
            title={settings.showAgentSteps ? "Hide agent steps" : "Show agent steps"}
            className="p-2 rounded-xl transition-all duration-150 btn-ghost"
            style={{
              color: settings.showAgentSteps ? "var(--accent-purple)" : "var(--text-muted)",
              background: settings.showAgentSteps ? "rgba(139,92,246,0.08)" : "transparent",
              border: settings.showAgentSteps ? "1px solid rgba(139,92,246,0.16)" : "1px solid transparent",
            }}
          >
            {settings.showAgentSteps ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="chat-max-w px-4 md:px-6 py-6">

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-6">
              <SkeletonMessage />
              <SkeletonMessage isUser />
              <SkeletonMessage />
            </div>
          )}

          {/* Empty state */}
          {!loading && messages.length === 0 && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              {/* Ambient glow */}
              <div
                className="absolute pointer-events-none"
                style={{
                  width: 280,
                  height: 280,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)",
                  animation: "ambient-pulse 5s ease-in-out infinite",
                }}
              />

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative mb-6"
              >
                <div
                  className="w-16 h-16 rounded-3xl flex items-center justify-center text-2xl relative"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.12) 100%)",
                    border: "1px solid rgba(139,92,246,0.20)",
                    boxShadow: "0 0 40px rgba(139,92,246,0.10)",
                  }}
                >
                  <Sparkles className="w-7 h-7" style={{ color: "var(--accent-purple-light)" }} />
                </div>
              </motion.div>

              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Ready to assist
              </h2>
              <p className="text-sm max-w-xs leading-relaxed mb-7" style={{ color: "var(--text-secondary)" }}>
                I have access to web search, document analysis, code assistance,
                memory recall, and more.
              </p>

              {/* Quick prompt pills */}
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {QUICK_PROMPTS.map(({ emoji, text }) => (
                  <button
                    key={text}
                    onClick={() => handleSend(text, [])}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs transition-all duration-150"
                    style={{
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-tertiary)",
                      background: "var(--bg-elevated)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.30)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.05)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                    }}
                  >
                    <span>{emoji}</span>
                    {text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message list */}
          {!loading && (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <MessageBubble message={msg} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Agent steps */}
              <AnimatePresence>
                {(isStreaming || steps.length > 0) && settings.showAgentSteps && (
                  <AgentSteps steps={steps} isStreaming={isStreaming} />
                )}
              </AnimatePresence>

              {/* HITL */}
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <MessageBubble
                    message={{
                      id: "streaming",
                      role: "assistant",
                      content: streamingContent,
                      created_at: new Date().toISOString(),
                    }}
                    isStreaming
                  />
                </motion.div>
              )}

              {/* Streaming dots (no text yet) */}
              {isStreaming && !streamingContent && !pendingRequest && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3.5"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(59,130,246,0.12) 100%)",
                      border: "1px solid rgba(139,92,246,0.22)",
                      boxShadow: "0 0 12px rgba(139,92,246,0.18)",
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-sparkle" style={{ color: "var(--accent-purple-light)" }} />
                  </div>
                  <div className="flex gap-1.5 py-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="stream-dot"
                        style={{ animationDelay: `${i * 0.16}s` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 mx-auto max-w-sm rounded-2xl px-4 py-3 text-sm"
                  style={{
                    border: "1px solid rgba(244,63,94,0.20)",
                    background: "rgba(244,63,94,0.06)",
                    color: "#fb7185",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── Composer ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-5 pt-3">
        <div className="chat-max-w">
          <Composer
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            conversationId={conversationId}
          />
        </div>
      </div>
    </div>
  );
}
