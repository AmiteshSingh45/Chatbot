"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Search, MessageSquare, FileText, Globe, Code2,
  Wrench, BookOpen, Lightbulb, RefreshCw, CheckCircle2,
  XCircle, ChevronDown, Zap,
} from "lucide-react";
import type { AgentStep } from "@/types";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<string, React.ElementType> = {
  memory_inject:    Brain,
  router:           Search,
  planner:          Lightbulb,
  general_chat:     MessageSquare,
  rag_agent:        FileText,
  web_search:       Globe,
  code_assistant:   Code2,
  tool_calling:     Wrench,
  resume_assistant: BookOpen,
  memory_retrieval: Brain,
  hitl:             Zap,
  reflection:       RefreshCw,
  memory_update:    Brain,
};

const STEP_COLORS: Record<string, string> = {
  memory_inject:    "#ec4899",
  router:           "#8b5cf6",
  planner:          "#a78bfa",
  general_chat:     "#8b5cf6",
  rag_agent:        "#f59e0b",
  web_search:       "#06b6d4",
  code_assistant:   "#22c55e",
  tool_calling:     "#f97316",
  resume_assistant: "#a3e635",
  memory_retrieval: "#ec4899",
  hitl:             "#f59e0b",
  reflection:       "#818cf8",
  memory_update:    "#ec4899",
};

interface AgentStepsProps {
  steps: AgentStep[];
  isStreaming: boolean;
}

export default function AgentSteps({ steps, isStreaming }: AgentStepsProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!steps.length && !isStreaming) return null;

  const doneCount = steps.filter(s => s.status === "done").length;
  const totalCount = steps.length;
  const hasRunning = steps.some(s => s.status === "running");
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="mb-4"
    >
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.04) 0%, rgba(59,130,246,0.03) 100%)",
          borderColor: "rgba(139,92,246,0.12)",
        }}
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Animated status dots */}
            <div className="flex gap-1 flex-shrink-0">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  animate={hasRunning ? {
                    scale: [1, 1.4, 1],
                    opacity: [0.5, 1, 0.5],
                  } : {}}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: hasRunning
                      ? i === 0 ? "#8b5cf6" : i === 1 ? "#3b82f6" : "#06b6d4"
                      : "#22c55e",
                    opacity: hasRunning ? undefined : 0.7,
                  }}
                />
              ))}
            </div>

            <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-tertiary)" }}>
              Agent Execution
            </span>

            {/* Progress pill */}
            {totalCount > 0 && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold tabular-nums ml-1"
                style={{
                  background: "rgba(139,92,246,0.10)",
                  color: "var(--accent-purple-light)",
                }}
              >
                {doneCount}/{totalCount}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn("w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0", collapsed && "-rotate-90")}
            style={{ color: "var(--text-muted)" }}
          />
        </button>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="px-4 pb-1" style={{ marginTop: -4 }}>
            <div
              className="h-px rounded-full overflow-hidden"
              style={{ background: "var(--border-faint)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #7c3aed, #3b82f6)" }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Steps */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-2 space-y-2">
                {steps.map((step, i) => {
                  const Icon = STEP_ICONS[step.step] || Zap;
                  const color = STEP_COLORS[step.step] || "#8b5cf6";
                  const isLast = i === steps.length - 1;
                  const isRunning = step.status === "running";

                  return (
                    <motion.div
                      key={`${step.step}-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="relative flex items-start gap-3"
                    >
                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className="absolute left-[15px] top-7 bottom-0 w-px"
                          style={{
                            background: `linear-gradient(to bottom, ${color}30, transparent)`,
                          }}
                        />
                      )}

                      {/* Icon with pulse ring on running */}
                      <div className="relative flex-shrink-0 mt-0.5">
                        {isRunning && (
                          <motion.div
                            className="absolute inset-0 rounded-xl"
                            animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                            style={{ background: color }}
                          />
                        )}
                        <div
                          className="w-[30px] h-[30px] rounded-xl flex items-center justify-center relative"
                          style={{
                            background: `${color}14`,
                            border: `1px solid ${isRunning ? color + "40" : color + "22"}`,
                            boxShadow: isRunning ? `0 0 12px ${color}30` : "none",
                          }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: isRunning ? "var(--text-primary)" : "var(--text-secondary)" }}
                          >
                            {step.label}
                          </span>

                          {/* Status indicator */}
                          {isRunning ? (
                            <span className="flex items-center gap-0.5 ml-auto flex-shrink-0">
                              {[0, 1, 2].map(i => (
                                <motion.span
                                  key={i}
                                  animate={{ y: [0, -4, 0] }}
                                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                                  className="w-1 h-1 rounded-full"
                                  style={{ background: "#3b82f6", display: "inline-block" }}
                                />
                              ))}
                            </span>
                          ) : step.status === "done" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-rose-400" />
                          )}

                          {/* Duration */}
                          {step.duration_ms > 0 && step.status === "done" && (
                            <span className="text-[10px] tabular-nums flex-shrink-0"
                              style={{ color: "var(--text-muted)" }}>
                              {step.duration_ms < 1000
                                ? `${Math.round(step.duration_ms)}ms`
                                : `${(step.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                          )}
                        </div>

                        {/* Detail */}
                        {step.detail && (
                          <p className="text-[11px] mt-0.5 truncate"
                            style={{ color: "var(--text-muted)" }}>
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Live generating indicator */}
                {isStreaming && steps.length > 0 && steps[steps.length - 1]?.status !== "running" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 pt-1"
                  >
                    <div className="w-[30px] h-[30px] rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.18)" }}>
                      <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--accent-purple)" }} />
                    </div>
                    <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                      Generating response
                    </span>
                    <span className="flex items-center gap-0.5 ml-auto">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="stream-dot" style={{ animationDelay: `${i * 0.16}s` }} />
                      ))}
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
