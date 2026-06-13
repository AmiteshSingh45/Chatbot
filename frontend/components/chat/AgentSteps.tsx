"use client";
/**
 * AgentSteps — real-time execution step visibility panel.
 * Shows what NexusAI is doing during generation.
 *
 * Steps displayed:
 *   🧠 Retrieving memories...   ✅ done (12ms)
 *   🔍 Routing intent...        ✅ web_search
 *   📋 Planning execution...    ✅ [search, synthesize]
 *   🌐 Searching DuckDuckGo...  ⏳ running
 *   ✨ Reflecting on quality... ✅ score: 0.92
 *   💾 Updating memory...       ✅ 2 facts stored
 */
import { motion, AnimatePresence } from "framer-motion";
import type { AgentStep } from "@/types";

const STEP_ICONS: Record<string, string> = {
  memory_inject: "🧠",
  router: "🔍",
  planner: "📋",
  general_chat: "💬",
  rag_agent: "📄",
  web_search: "🌐",
  code_assistant: "💻",
  tool_calling: "🔧",
  resume_assistant: "📝",
  memory_retrieval: "💡",
  hitl: "⚠️",
  reflection: "✨",
  memory_update: "💾",
};

const STATUS_STYLES: Record<string, string> = {
  running: "text-blue-400",
  done: "text-emerald-400",
  error: "text-red-400",
};

const STATUS_ICONS: Record<string, string> = {
  running: "⏳",
  done: "✅",
  error: "❌",
};

interface AgentStepsProps {
  steps: AgentStep[];
  isStreaming: boolean;
}

export default function AgentSteps({ steps, isStreaming }: AgentStepsProps) {
  if (!steps.length && !isStreaming) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-3 overflow-hidden"
    >
      <div
        className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 backdrop-blur-sm"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.05) 0%, rgba(59,130,246,0.05) 100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-500/70 animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-blue-500/50 animate-pulse [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/50 animate-pulse [animation-delay:0.4s]" />
          </div>
          <span className="text-xs font-medium text-white/50 tracking-widest uppercase">
            Agent Execution
          </span>
        </div>

        {/* Steps */}
        <AnimatePresence initial={false}>
          <div className="space-y-1.5">
            {steps.map((step, i) => (
              <motion.div
                key={`${step.step}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 text-sm"
              >
                {/* Icon */}
                <span className="w-5 text-center text-base leading-none flex-shrink-0">
                  {STEP_ICONS[step.step] || "•"}
                </span>

                {/* Label */}
                <span className="flex-1 text-white/70 font-medium">{step.label}</span>

                {/* Detail */}
                {step.detail && (
                  <span className="text-xs text-white/30 truncate max-w-[160px]">
                    {step.detail}
                  </span>
                )}

                {/* Duration */}
                {step.duration_ms > 0 && step.status === "done" && (
                  <span className="text-xs text-white/20 flex-shrink-0">
                    {step.duration_ms < 1000
                      ? `${Math.round(step.duration_ms)}ms`
                      : `${(step.duration_ms / 1000).toFixed(1)}s`}
                  </span>
                )}

                {/* Status */}
                <span className={`flex-shrink-0 text-sm ${STATUS_STYLES[step.status]}`}>
                  {step.status === "running" ? (
                    <span className="inline-flex gap-0.5">
                      <span className="animate-bounce [animation-delay:0ms]">.</span>
                      <span className="animate-bounce [animation-delay:150ms]">.</span>
                      <span className="animate-bounce [animation-delay:300ms]">.</span>
                    </span>
                  ) : (
                    STATUS_ICONS[step.status]
                  )}
                </span>
              </motion.div>
            ))}

            {/* Current processing indicator */}
            {isStreaming && steps.length > 0 && steps[steps.length - 1]?.status !== "running" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-5 text-center">💬</span>
                <span className="text-white/50">Generating response</span>
                <span className="text-blue-400">
                  <span className="inline-flex gap-0.5">
                    <span className="animate-bounce [animation-delay:0ms]">.</span>
                    <span className="animate-bounce [animation-delay:150ms]">.</span>
                    <span className="animate-bounce [animation-delay:300ms]">.</span>
                  </span>
                </span>
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
