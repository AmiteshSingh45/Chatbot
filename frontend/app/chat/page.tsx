"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap, Globe, FileText, Code2, BookOpen, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { conversationsApi } from "@/lib/api";
import { useAuthStore, useChatStore } from "@/store";

const SUGGESTIONS = [
  { icon: Globe, label: "Search the web", prompt: "What are the latest AI news today?" },
  { icon: Code2, label: "Write code", prompt: "Write a Python async REST API with FastAPI" },
  { icon: FileText, label: "Analyze document", prompt: "Upload a PDF and I'll answer questions about it" },
  { icon: BookOpen, label: "Resume review", prompt: "Review my resume and suggest improvements" },
  { icon: Zap, label: "Explain a concept", prompt: "Explain how LangGraph works with a diagram" },
  { icon: Wrench, label: "Calculate something", prompt: "What is the compound interest on $10,000 at 7% over 20 years?" },
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
      if (prompt) {
        sessionStorage.setItem("starter_prompt", prompt);
      }
      router.push(path);
    } catch {}
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
      {/* Glow backdrop */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--accent-purple), transparent)" }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center max-w-2xl w-full relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex items-center justify-center mb-6"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg accent-glow"
            style={{ background: "var(--accent-gradient)" }}>
            N
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {greeting()}, {user?.username?.split(" ")[0] || "there"} 👋
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-base mb-10"
          style={{ color: "var(--text-secondary)" }}
        >
          I&apos;m NexusAI — a multi-agent AI assistant. How can I help you today?
        </motion.p>

        {/* Suggestion grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8"
        >
          {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => startNewChat(prompt)}
              className="p-4 text-left rounded-xl border transition-all duration-200 group hover:scale-[1.02]"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.4)";
                (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.06)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
              }}
            >
              <Icon className="w-5 h-5 mb-2 transition-colors"
                style={{ color: "var(--accent-purple)" }} />
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</div>
              <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{prompt}</div>
            </button>
          ))}
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => startNewChat()}
          className="px-6 py-3 btn-primary text-sm flex items-center gap-2 mx-auto"
        >
          <Sparkles className="w-4 h-4" />
          Start a new chat
        </motion.button>
      </motion.div>
    </div>
  );
}
