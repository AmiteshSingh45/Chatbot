"use client";

import { motion } from "framer-motion";
import {
  Sparkles, Zap, Globe, FileText, Code2, BookOpen,
  Wrench, ArrowRight, Brain, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { conversationsApi } from "@/lib/api";
import { useAuthStore, useChatStore } from "@/store";
import { Button } from "@/components/ui/Button";

const SUGGESTIONS = [
  {
    icon: Globe,
    label: "Web Search",
    desc: "Real-time internet access",
    prompt: "What are the latest AI news today?",
    color: "#06b6d4",
  },
  {
    icon: Code2,
    label: "Write Code",
    desc: "Any language, any framework",
    prompt: "Write a Python async REST API with FastAPI",
    color: "#22c55e",
  },
  {
    icon: FileText,
    label: "Analyze Documents",
    desc: "Upload PDFs, DOCX, CSV",
    prompt: "Upload a PDF and I'll answer questions about it",
    color: "#f59e0b",
  },
  {
    icon: BookOpen,
    label: "Resume Review",
    desc: "Get expert career advice",
    prompt: "Review my resume and suggest improvements",
    color: "#a3e635",
  },
  {
    icon: Zap,
    label: "Explain Concepts",
    desc: "Deep dives & research",
    prompt: "Explain how LangGraph works with a diagram",
    color: "#8b5cf6",
  },
  {
    icon: Wrench,
    label: "Use Tools",
    desc: "Calculator, stocks, weather",
    prompt: "What is the compound interest on $10,000 at 7% over 20 years?",
    color: "#f97316",
  },
];

export default function ChatIndexPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addConversation } = useChatStore();

  const startNewChat = async (prompt?: string) => {
    try {
      const res = await conversationsApi.create("New Chat");
      addConversation(res.data);
      const path = `/chat/${res.data.id}`;
      if (prompt) sessionStorage.setItem("starter_prompt", prompt);
      router.push(path);
    } catch {}
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 5)  return "Good night";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const name = user?.username?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto relative">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(139,92,246,0.07) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/3 left-1/4 pointer-events-none"
        style={{
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
          animation: "ambient-pulse 7s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-1/4 right-1/4 pointer-events-none"
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)",
          animation: "ambient-pulse 5s ease-in-out infinite 1s",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="text-center w-full relative z-10"
        style={{ maxWidth: 640 }}
      >
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex items-center justify-center mb-7"
        >
          <div className="relative">
            {/* Glow ring */}
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-50"
              style={{
                background: "var(--gradient-brand)",
                transform: "scale(1.3)",
              }}
            />
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--gradient-brand)",
                boxShadow: "0 0 40px rgba(139,92,246,0.35), 0 0 0 1px rgba(139,92,246,0.25)",
              }}
            >
              <Sparkles className="w-6 h-6 text-white animate-sparkle" />
            </div>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14 }}
          className="text-[28px] font-bold tracking-tight mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {greeting()},{" "}
          <span className="gradient-text">{name}</span> 👋
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.20 }}
          className="text-sm mb-9"
          style={{ color: "var(--text-secondary)" }}
        >
          I'm NexusAI — your multi-agent AI assistant. What can I help you with?
        </motion.p>

        {/* Capability grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-7">
          {SUGGESTIONS.map(({ icon: Icon, label, desc, prompt, color }, i) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.06, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => startNewChat(prompt)}
              className="group text-left p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${color}35`;
                (e.currentTarget as HTMLElement).style.background = `${color}07`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${color}10`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${color}14` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
                {label}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
              {/* Arrow hint on hover */}
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <span className="text-[10px]" style={{ color }}>Try this</span>
                <ChevronRight className="w-3 h-3" style={{ color }} />
              </div>
            </motion.button>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => startNewChat()}
            iconLeft={<Sparkles className="w-4 h-4" />}
            iconRight={<ArrowRight className="w-4 h-4" />}
            className="mx-auto"
          >
            Start a new conversation
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
