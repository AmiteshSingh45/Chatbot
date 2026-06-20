"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  Copy, Check, RefreshCw, Globe, Code2,
  FileText, Wrench, Brain, BookOpen, ExternalLink,
  ChevronDown, Sparkles, ThumbsUp, ThumbsDown, Edit3, User,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Message, Citation } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import "highlight.js/styles/github-dark.css";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

const AGENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  general_chat:     { label: "General",    icon: Sparkles, color: "#8b5cf6" },
  web_search:       { label: "Web Search", icon: Globe,    color: "#06b6d4" },
  code_assistant:   { label: "Code",       icon: Code2,    color: "#22c55e" },
  rag_agent:        { label: "Documents",  icon: FileText, color: "#f59e0b" },
  tool_calling:     { label: "Tools",      icon: Wrench,   color: "#f97316" },
  memory_retrieval: { label: "Memory",     icon: Brain,    color: "#ec4899" },
  resume_assistant: { label: "Resume",     icon: BookOpen, color: "#a3e635" },
  hitl_resumed:     { label: "Resumed",    icon: User,     color: "#14b8a6" },
};

// ── Code Block ────────────────────────────────────────────────────────────────
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).trimEnd();
  const lang = /language-(\w+)/.exec(className || "")?.[1] || "text";

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="code-block group my-4">
      <div className="code-block-header">
        <span className="code-block-lang">{lang}</span>
        <button
          onClick={copy}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150",
            copied
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
          )}
        >
          {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
        </button>
      </div>
      <pre className="!mt-0 !rounded-none overflow-x-auto !bg-[#0d1117] p-4 text-sm leading-relaxed">
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

// ── Citations ─────────────────────────────────────────────────────────────────
function Citations({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-faint)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
        style={{ color: "var(--text-muted)" }}>
        Sources
      </p>
      <div className="space-y-1.5">
        {citations.map((c) => (
          <div key={c.index} className="flex items-start gap-2 text-xs"
            style={{ color: "var(--text-tertiary)" }}>
            <span className="font-mono flex-shrink-0 mt-0.5" style={{ color: "var(--accent-purple)" }}>
              [{c.index}]
            </span>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-violet-400 transition-colors truncate group/link">
                <span className="truncate">{c.source || c.url}</span>
                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </a>
            ) : (
              <span className="truncate">{c.source}</span>
            )}
            {c.page && c.page !== "N/A" && (
              <span className="flex-shrink-0 opacity-50">p.{c.page}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feedback buttons (UI-only — no API) ──────────────────────────────────────
function FeedbackButtons() {
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => {
          setVote(v => v === "up" ? null : "up");
          if (vote !== "up") toast.success("Thanks for the feedback!", { icon: "👍" });
        }}
        className={cn(
          "btn-ghost p-1.5 rounded-lg transition-all duration-150",
          vote === "up" && "text-emerald-400"
        )}
        title="Good response"
        aria-label="Thumbs up"
      >
        <ThumbsUp className={cn("w-3 h-3", vote === "up" && "fill-current")} />
      </button>
      <button
        onClick={() => {
          setVote(v => v === "down" ? null : "down");
          if (vote !== "down") toast("Thanks for the feedback!", { icon: "📝" });
        }}
        className={cn(
          "btn-ghost p-1.5 rounded-lg transition-all duration-150",
          vote === "down" && "text-rose-400"
        )}
        title="Bad response"
        aria-label="Thumbs down"
      >
        <ThumbsDown className={cn("w-3 h-3", vote === "down" && "fill-current")} />
      </button>
    </div>
  );
}

// ── Main MessageBubble ────────────────────────────────────────────────────────
export function MessageBubble({ message, isStreaming, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(false);

  const isUser = message.role === "user";
  const agentInfo = message.agent_used ? AGENT_META[message.agent_used] : null;
  const hasCitations = message.citations && message.citations.length > 0;

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Format timestamp nicely
  const timeStr = (() => {
    try {
      const d = new Date(message.created_at);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  })();

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 group animate-fade-in-up">
        <div className="flex flex-col items-end gap-1.5 max-w-[75%] sm:max-w-[65%]">
          <div className="message-user px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--text-primary)" }}>
              {message.content}
            </p>
          </div>
          {/* Hover actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="text-[10px] px-1.5" style={{ color: "var(--text-muted)" }}>{timeStr}</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => toast("Edit not available in guest mode", { icon: "✏️" })}
              title="Edit message"
              className="h-6 w-6 p-0 flex items-center justify-center"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={copyMessage}
              title="Copy"
              className="h-6 w-6 p-0 flex items-center justify-center"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </div>
        <Avatar
          initials={<User className="w-3.5 h-3.5" />}
          variant="gradient"
          size="sm"
          aria-label="You"
        />
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3.5 group animate-fade-in-up">
      {/* AI Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(59,130,246,0.15) 100%)",
            border: "1px solid rgba(139,92,246,0.25)",
            boxShadow: isStreaming ? "0 0 16px rgba(139,92,246,0.25)" : "none",
            transition: "box-shadow 0.3s ease",
          }}
        >
          <Sparkles
            className="w-3.5 h-3.5"
            style={{
              color: "var(--accent-purple-light)",
              animation: isStreaming ? "sparkle-spin 2s ease-in-out infinite" : "none",
            }}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Agent badge */}
        {agentInfo && (
          <div className="mb-2">
            <Badge
              variant="custom"
              color={agentInfo.color}
              icon={<agentInfo.icon className="w-2.5 h-2.5" />}
            >
              {agentInfo.label}
            </Badge>
          </div>
        )}

        {/* Content */}
        <div className="message-assistant">
          <div className="prose max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: ({ className, children, ...props }) => {
                  const isBlock = /language-/.test(className || "");
                  if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
                  return (
                    <code
                      className={className}
                      style={{
                        background: "rgba(139,92,246,0.13)",
                        border: "1px solid rgba(139,92,246,0.20)",
                        borderRadius: "4px",
                        padding: "0.1em 0.4em",
                        fontSize: "0.84em",
                        color: "#c4b5fd",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="my-3 pl-4"
                    style={{
                      borderLeft: "2px solid rgba(139,92,246,0.38)",
                      color: "var(--text-secondary)",
                      fontStyle: "italic",
                      background: "rgba(139,92,246,0.04)",
                      borderRadius: "0 6px 6px 0",
                      padding: "0.4em 0.8em",
                    }}>
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-lg" style={{ border: "1px solid var(--border-subtle)" }}>
                    <table className="w-full" style={{ borderCollapse: "collapse" }}>
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                      borderBottom: "1px solid var(--border-default)"
                    }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-xs"
                    style={{
                      color: "var(--text-secondary)",
                      borderBottom: "1px solid var(--border-faint)"
                    }}>
                    {children}
                  </td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && <span className="typing-cursor" />}
          </div>

          {/* Citations toggle */}
          {hasCitations && (
            <div className="mt-3">
              <button
                onClick={() => setCitationsOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent-purple-light)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
              >
                <ExternalLink className="w-3 h-3" />
                {message.citations!.length} source{message.citations!.length !== 1 ? "s" : ""}
                <ChevronDown
                  className={cn("w-3 h-3 transition-transform duration-200", citationsOpen && "rotate-180")}
                />
              </button>
              <AnimatePresence>
                {citationsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <Citations citations={message.citations!} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Hover toolbar */}
        <div className="flex items-center gap-0.5 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Button
            variant="ghost"
            size="xs"
            onClick={copyMessage}
            title="Copy message"
            className="h-7 px-2"
            style={{ color: "var(--text-muted)" }}
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </Button>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRegenerate}
              title="Regenerate response"
              className="h-7 px-2"
              style={{ color: "var(--text-muted)" }}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}

          {/* Like / Dislike feedback */}
          <FeedbackButtons />

          <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>{timeStr}</span>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
