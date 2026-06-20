"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Square, Paperclip, Sparkles, Brain, Globe, Code2,
  FileText, Wrench, LogIn, Menu, X, Zap, Copy, Check,
  ArrowUp, Mic, ChevronRight
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS — hardcoded so they always render correctly
   ───────────────────────────────────────────────────────────── */
const T = {
  // Backgrounds
  bgBase:      "#0e0e14",
  bgPrimary:   "#13131a",
  bgSecondary: "#18181f",
  bgCard:      "#1e1e28",
  bgCardHover: "#242430",
  bgElevated:  "#252532",
  bgInput:     "#1e1e28",

  // Borders
  borderFaint:   "rgba(255,255,255,0.05)",
  borderSubtle:  "rgba(255,255,255,0.08)",
  borderDefault: "rgba(255,255,255,0.12)",
  borderStrong:  "rgba(255,255,255,0.20)",
  borderFocus:   "rgba(139,92,246,0.55)",

  // Text
  textPrimary:   "#f1f1f5",
  textSecondary: "#a0a0b8",
  textMuted:     "#6b6b84",
  textFaint:     "#4a4a60",

  // Accent
  purple:      "#8b5cf6",
  purpleLight: "#a78bfa",
  blue:        "#3b82f6",
  cyan:        "#06b6d4",
  emerald:     "#10b981",
  amber:       "#f59e0b",
  rose:        "#f43f5e",

  // Gradients
  gradientBrand: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0ea5e9 100%)",
  gradientGlow:  "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 70%)",
};

/* ─────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────── */
interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getGuestId(): string {
  if (typeof window === "undefined") return "guest_ssr";
  let id = localStorage.getItem("guest_session_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("guest_session_id", id); }
  return id;
}

/* ─────────────────────────────────────────────────────────────
   CAPABILITY CARDS
   ───────────────────────────────────────────────────────────── */
const CAPABILITIES = [
  { icon: Globe,    label: "Web Search",      desc: "Real-time internet access",       color: "#06b6d4", prompt: "What are the latest AI news today?" },
  { icon: Brain,    label: "Memory",          desc: "Remembers across conversations",  color: "#8b5cf6", prompt: "What do you know about me so far?" },
  { icon: Code2,    label: "Code",            desc: "Write & debug any language",      color: "#22c55e", prompt: "Write a Python FastAPI endpoint with JWT auth" },
  { icon: FileText, label: "Documents",       desc: "Analyze uploaded files",          color: "#f59e0b", prompt: "How do I use RAG with FAISS and LangChain?" },
  { icon: Wrench,   label: "Tools",           desc: "Calculator, stocks, weather",     color: "#f97316", prompt: "What is the weather in Mumbai today?" },
  { icon: Sparkles, label: "Research",        desc: "Deep dives & academic papers",    color: "#ec4899", prompt: "Explain LangGraph agents and state machines" },
];

const AGENT_COLORS: Record<string, string> = {
  general_chat: "#8b5cf6", web_search: "#06b6d4", code_assistant: "#22c55e",
  rag_agent: "#f59e0b", tool_calling: "#f97316", memory_retrieval: "#ec4899",
};

const SAMPLE_PROMPTS = [
  "Explain LangGraph in simple terms",
  "Write a React hook for debouncing",
  "Search for latest AI research papers",
  "What's the compound interest on $10k at 7%?",
];

/* ─────────────────────────────────────────────────────────────
   CODE BLOCK
   ───────────────────────────────────────────────────────────── */
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).trimEnd();
  const lang = /language-(\w+)/.exec(className || "")?.[1] || "text";
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden", margin: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#010409", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>{lang}</span>
        <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", color: copied ? "#4ade80" : "rgba(255,255,255,0.45)" }}>
          {copied ? <><Check style={{ width: 11, height: 11 }} />Copied!</> : <><Copy style={{ width: 11, height: 11 }} />Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "16px", overflowX: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.65, background: "#0d1117", color: "#c9d1d9" }}>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MESSAGE BUBBLE
   ───────────────────────────────────────────────────────────── */
function Message({ msg, isStreaming }: { msg: Msg; isStreaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "flex-end" }}>
        <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(79,70,229,0.15) 100%)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: "18px 18px 4px 18px", padding: "12px 16px" }}>
            <p style={{ color: T.textPrimary, fontSize: 14, lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
          </div>
          <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, opacity: 0.5, color: T.textMuted, fontSize: 11 }} title="Copy">
            {copied ? <Check style={{ width: 12, height: 12, color: "#4ade80" }} /> : <Copy style={{ width: 12, height: 12 }} />}
          </button>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>U</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(59,130,246,0.18) 100%)", border: "1px solid rgba(139,92,246,0.30)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isStreaming ? "0 0 16px rgba(139,92,246,0.30)" : "none" }}>
        <Sparkles style={{ width: 14, height: 14, color: T.purpleLight }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {msg.agent && AGENT_COLORS[msg.agent] && (
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, padding: "2px 8px", borderRadius: 999, background: `${AGENT_COLORS[msg.agent]}18`, color: AGENT_COLORS[msg.agent], border: `1px solid ${AGENT_COLORS[msg.agent]}30`, marginBottom: 8, fontWeight: 500, textTransform: "capitalize" }}>
            {msg.agent.replace(/_/g, " ")}
          </span>
        )}
        <div style={{ color: T.textPrimary, fontSize: 14.5, lineHeight: 1.8 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            code: ({ className, children }) => {
              const isBlock = /language-/.test(className || "");
              if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
              return <code style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 4, padding: "1px 6px", fontSize: "0.85em", color: "#c4b5fd", fontFamily: "monospace" }}>{children}</code>;
            },
            p: ({ children }) => <p style={{ margin: "8px 0", color: T.textPrimary }}>{children}</p>,
            strong: ({ children }) => <strong style={{ color: T.textPrimary, fontWeight: 600 }}>{children}</strong>,
            li: ({ children }) => <li style={{ color: T.textSecondary, marginBottom: 4 }}>{children}</li>,
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: T.purpleLight, textDecoration: "underline", textDecorationColor: "rgba(167,139,250,0.35)" }}>{children}</a>,
          }}>
            {msg.content}
          </ReactMarkdown>
          {isStreaming && <span style={{ display: "inline-block", color: T.purple, animation: "blink 0.72s ease infinite", fontSize: "0.9em" }}>▋</span>}
        </div>
        <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", marginTop: 8, padding: "2px 6px", borderRadius: 6, opacity: 0.45, color: T.textMuted, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }} title="Copy">
          {copied ? <><Check style={{ width: 11, height: 11, color: "#4ade80" }} />Copied</> : <><Copy style={{ width: 11, height: 11 }} />Copy</>}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CAPABILITY CARD
   ───────────────────────────────────────────────────────────── */
function CapCard({ cap, onSend }: { cap: typeof CAPABILITIES[0]; onSend: (p: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const Icon = cap.icon;
  return (
    <button
      onClick={() => onSend(cap.prompt)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgCardHover : T.bgCard,
        border: `1px solid ${hovered ? `${cap.color}35` : T.borderSubtle}`,
        borderRadius: 16,
        padding: "20px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: hovered ? `0 4px 24px ${cap.color}14, 0 0 0 1px ${cap.color}20` : "0 2px 8px rgba(0,0,0,0.25)",
        transform: hovered ? "translateY(-2px)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cap.color}1a`, border: `1px solid ${cap.color}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, flexShrink: 0 }}>
        <Icon style={{ width: 18, height: 18, color: cap.color }} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0, marginBottom: 4 }}>{cap.label}</p>
      <p style={{ fontSize: 12, color: T.textMuted, margin: 0, lineHeight: 1.5 }}>{cap.desc}</p>
      {hovered && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 11, color: cap.color, fontWeight: 500 }}>
          <span>Try this</span>
          <ChevronRight style={{ width: 12, height: 12 }} />
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [threadId] = useState(() => crypto.randomUUID());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText]);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  const send = useCallback(async (content: string) => {
    if (!content.trim() || streaming) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreaming(true);
    setStreamingText("");
    const guestId = getGuestId();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${API_URL}/api/v1/chat/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-ID": guestId },
        body: JSON.stringify({ content, thread_id: threadId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let agentUsed = "general_chat";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "token") { fullText += data.content; setStreamingText(fullText); }
            else if (data.type === "done") agentUsed = data.metadata?.agent_used || agentUsed;
            else if (data.type === "error") toast.error(data.message || "Something went wrong");
          } catch {}
        }
      }
      if (fullText) setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: fullText, agent: agentUsed }]);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        try {
          const syncRes = await fetch(`${API_URL}/api/v1/chat/guest/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Session-ID": getGuestId() },
            body: JSON.stringify({ content, thread_id: threadId }),
          });
          if (syncRes.ok) {
            const data = await syncRes.json();
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.response || "I couldn't generate a response.", agent: data.agent_used }]);
          } else toast.error("Backend error. Is the server running?");
        } catch { toast.error("Cannot connect to backend."); }
      }
    } finally { setStreaming(false); setStreamingText(""); }
  }, [streaming, threadId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
    if (e.key === "Escape") { setInput(""); if (textareaRef.current) textareaRef.current.style.height = "auto"; }
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamingText) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: streamingText }]);
      setStreamingText("");
    }
  };

  const hasMessages = messages.length > 0;
  const canSend = input.trim().length > 0 && !streaming;

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ambient { 0%,100%{opacity:0.06} 50%{opacity:0.12} }
        @keyframes sparkle { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        body { margin:0; font-family:'Inter','Geist',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:99px; }
        textarea::placeholder { color:#4a4a60; }
      `}</style>
      <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: T.bgPrimary, color: T.textPrimary }}>

        {/* ── Mobile Sidebar Overlay ────────────────────────────────── */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                onClick={() => setSidebarOpen(false)} />
              <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 30, width: 280, display: "flex", flexDirection: "column", background: T.bgSecondary, borderRight: `1px solid ${T.borderSubtle}` }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${T.borderFaint}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: T.gradientBrand, boxShadow: "0 0 16px rgba(139,92,246,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Sparkles style={{ width: 14, height: 14, color: "white" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, margin: 0, background: T.gradientBrand, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NexusAI</p>
                      <p style={{ fontSize: 10, color: T.textFaint, margin: 0 }}>Multi-agent assistant</p>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: T.textMuted }}>
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textFaint, padding: "4px 10px 8px", margin: 0 }}>Quick actions</p>
                  {CAPABILITIES.map(cap => {
                    const Icon = cap.icon;
                    return (
                      <button key={cap.label} onClick={() => { send(cap.prompt); setSidebarOpen(false); }}
                        style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginBottom: 2, transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = T.bgCard)}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cap.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon style={{ width: 14, height: 14, color: cap.color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, margin: 0 }}>{cap.label}</p>
                          <p style={{ fontSize: 11, color: T.textFaint, margin: 0 }}>{cap.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: 16, borderTop: `1px solid ${T.borderFaint}` }}>
                  <a href="/auth/login" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.20)", color: "#c4b5fd", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                    <LogIn style={{ width: 15, height: 15 }} />Sign in for personalization
                  </a>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main Content ───────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, flexShrink: 0, background: "rgba(14,14,20,0.92)", borderBottom: `1px solid ${T.borderFaint}`, backdropFilter: "blur(16px)", position: "relative", zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 8, color: T.textMuted, display: "flex", alignItems: "center" }}>
                <Menu style={{ width: 18, height: 18 }} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: T.gradientBrand, boxShadow: "0 0 14px rgba(139,92,246,0.40)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Sparkles style={{ width: 13, height: 13, color: "white" }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, background: T.gradientBrand, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NexusAI</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)", color: "#a78bfa", fontWeight: 500 }}>
                  Groq + LangGraph
                </span>
              </div>
            </div>
            <a href="/auth/login" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 10, border: `1px solid ${T.borderSubtle}`, color: T.textMuted, textDecoration: "none", fontSize: 13, fontWeight: 500, transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c4b5fd"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textMuted; (e.currentTarget as HTMLElement).style.borderColor = T.borderSubtle; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <LogIn style={{ width: 14, height: 14 }} />
              <span>Sign in</span>
            </a>
          </header>

          {/* ── Messages / Empty State ───────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
            {!hasMessages && !streaming ? (
              /* EMPTY STATE */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100%", padding: "40px 20px", position: "relative" }}>
                {/* Ambient glows */}
                <div style={{ position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)", width: 500, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)", pointerEvents: "none", animation: "ambient 5s ease-in-out infinite" }} />
                <div style={{ position: "absolute", top: "25%", left: "30%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(59,130,246,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

                {/* Logo mark */}
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }} style={{ position: "relative", marginBottom: 32 }}>
                  <div style={{ position: "absolute", inset: -10, borderRadius: 28, background: T.gradientBrand, opacity: 0.3, filter: "blur(20px)", transform: "scale(1.3)" }} />
                  <div style={{ position: "relative", width: 72, height: 72, borderRadius: 22, background: T.gradientBrand, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 48px rgba(139,92,246,0.45), 0 0 0 1px rgba(139,92,246,0.30)" }}>
                    <Sparkles style={{ width: 32, height: 32, color: "white", animation: "sparkle 8s linear infinite" }} />
                  </div>
                </motion.div>

                <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  style={{ fontSize: 38, fontWeight: 800, textAlign: "center", margin: "0 0 12px", background: T.gradientBrand, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
                  What can I help with?
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
                  style={{ fontSize: 15, color: T.textSecondary, textAlign: "center", margin: "0 0 44px", maxWidth: 380, lineHeight: 1.65 }}>
                  Powered by Groq + LangGraph. Multi-agent AI with web search, code, and more. No account needed.
                </motion.p>

                {/* Capability Cards Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 680, marginBottom: 36 }}>
                  {CAPABILITIES.map((cap, i) => (
                    <motion.div key={cap.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
                      <CapCard cap={cap} onSend={send} />
                    </motion.div>
                  ))}
                </div>

                {/* Sample Prompts */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                  style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 640 }}>
                  {SAMPLE_PROMPTS.map(p => (
                    <SamplePill key={p} text={p} onClick={() => send(p)} />
                  ))}
                </motion.div>
              </div>
            ) : (
              /* MESSAGE THREAD */
              <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 28 }}>
                <AnimatePresence initial={false}>
                  {messages.map(msg => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                      <Message msg={msg} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Streaming */}
                {streaming && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    {streamingText ? (
                      <Message msg={{ id: "streaming", role: "assistant", content: streamingText }} isStreaming />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(59,130,246,0.18))", border: "1px solid rgba(139,92,246,0.30)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(139,92,246,0.25)" }}>
                          <Sparkles style={{ width: 14, height: 14, color: T.purpleLight }} />
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.purple, animation: `bounce 1s ease infinite ${i * 0.16}s` }} />)}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Composer ────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, padding: "16px 20px 20px", background: T.bgPrimary }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <div style={{ background: T.bgInput, border: `1px solid ${focused ? "rgba(139,92,246,0.50)" : T.borderDefault}`, borderRadius: 20, boxShadow: focused ? "0 0 0 3px rgba(139,92,246,0.08), 0 4px 24px rgba(0,0,0,0.3)" : "0 4px 24px rgba(0,0,0,0.25)", transition: "border-color 0.2s, box-shadow 0.2s", position: "relative" }}>
                {/* Focus glow line */}
                {focused && (
                  <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.5), rgba(59,130,246,0.4), rgba(139,92,246,0.5), transparent)", borderRadius: 999 }} />
                )}
                <div style={{ padding: "16px 18px 12px" }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={autoResize}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={streaming ? "NexusAI is responding…" : "Message NexusAI… (Enter to send, Shift+Enter for newline)"}
                    disabled={streaming}
                    rows={1}
                    id="chat-input"
                    style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 15, color: T.textPrimary, lineHeight: 1.65, minHeight: 26, maxHeight: 200, fontFamily: "inherit", caretColor: T.purple }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ActionBtn title="Attach file (sign in required)" onClick={() => toast("Sign in to upload files", { icon: "🔒" })}>
                      <Paperclip style={{ width: 16, height: 16 }} />
                    </ActionBtn>
                    <ActionBtn title="Voice input (sign in required)" onClick={() => toast("Sign in to use voice", { icon: "🔒" })}>
                      <Mic style={{ width: 16, height: 16 }} />
                    </ActionBtn>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6, padding: "3px 8px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}>
                      <Zap style={{ width: 11, height: 11, color: "#f59e0b" }} />
                      <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>Groq</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {input.length > 0 && <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "monospace" }}>{input.length}</span>}
                    {streaming ? (
                      <button onClick={stop} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 10, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        <Square style={{ width: 12, height: 12, fill: "currentColor" }} />Stop
                      </button>
                    ) : (
                      <button onClick={() => send(input)} disabled={!canSend} title="Send (Enter)"
                        style={{ width: 36, height: 36, borderRadius: 12, border: "none", cursor: canSend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", background: canSend ? T.gradientBrand : T.bgCard, boxShadow: canSend ? "0 0 16px rgba(139,92,246,0.30)" : "none", color: canSend ? "white" : T.textFaint }}>
                        <ArrowUp style={{ width: 17, height: 17 }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p style={{ textAlign: "center", fontSize: 11, color: T.textFaint, marginTop: 10 }}>
                NexusAI can make mistakes. Verify important info. ·{" "}
                <a href="/auth/login" style={{ color: T.purple, textDecoration: "none" }}>Sign in</a> for memory & history
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* Tiny helper components */
function ActionBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "rgba(255,255,255,0.06)" : "transparent", border: "none", cursor: "pointer", padding: 8, borderRadius: 10, color: hov ? "#a0a0b8" : "#4a4a60", display: "flex", alignItems: "center", transition: "all 0.15s" }}>
      {children}
    </button>
  );
}

function SamplePill({ text, onClick }: { text: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `1px solid ${hov ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.08)"}`, background: hov ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.03)", color: hov ? "#c4b5fd" : "#6b6b84", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}>
      {text}
    </button>
  );
}
