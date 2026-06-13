"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { motion } from "framer-motion";
import { Copy, Check, RefreshCw, User, Bot, Globe, Code2, FileText, Wrench, Brain, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import type { Message } from "@/types";
import "highlight.js/styles/github-dark.css";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

const AGENT_META: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  general_chat:       { label: "General",    icon: Bot,      color: "#8b5cf6" },
  web_search:         { label: "Web Search", icon: Globe,    color: "#06b6d4" },
  code_assistant:     { label: "Code",       icon: Code2,    color: "#22c55e" },
  rag_agent:          { label: "Documents",  icon: FileText, color: "#f59e0b" },
  tool_calling:       { label: "Tools",      icon: Wrench,   color: "#f97316" },
  memory_retrieval:   { label: "Memory",     icon: Brain,    color: "#ec4899" },
  resume_assistant:   { label: "Resume",     icon: BookOpen, color: "#a3e635" },
};

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).trimEnd();
  const lang = /language-(\w+)/.exec(className || "")?.[1] || "text";

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 rounded-t-lg text-xs"
        style={{ background: "#161b22", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }}>
        <span className="font-mono">{lang}</span>
        <button onClick={copy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none overflow-x-auto">
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

export function MessageBubble({ message, isStreaming, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const agentInfo = message.agent_used ? AGENT_META[message.agent_used] : null;

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isUser ? "" : ""}`}
        style={{
          background: isUser
            ? "linear-gradient(135deg, #8b5cf6, #3b82f6)"
            : "var(--bg-elevated)",
          border: isUser ? "none" : "1px solid var(--border-default)",
        }}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <span className="gradient-text text-xs font-bold">N</span>}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1.5 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Agent badge */}
        {!isUser && agentInfo && (
          <div className="flex items-center gap-1 agent-badge"
            style={{ background: `${agentInfo.color}18`, color: agentInfo.color, border: `1px solid ${agentInfo.color}30` }}>
            <agentInfo.icon className="w-3 h-3" />
            {agentInfo.label}
          </div>
        )}

        {/* Bubble */}
        <div className={`px-4 py-3 text-sm leading-relaxed ${isUser ? "message-user" : "message-assistant"}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{message.content}</p>
          ) : (
            <div className={`prose prose-sm max-w-none ${isStreaming && !message.content ? "" : ""}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code: ({ className, children, ...props }) => {
                    const isBlock = /language-/.test(className || "");
                    if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="typing-cursor" />}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <button onClick={copyMessage} title="Copy"
            className="p-1.5 rounded-md btn-ghost text-xs flex items-center gap-1">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          {!isUser && onRegenerate && (
            <button onClick={onRegenerate} title="Regenerate"
              className="p-1.5 rounded-md btn-ghost text-xs flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
          <span className="text-[10px] px-1" style={{ color: "var(--text-muted)" }}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
