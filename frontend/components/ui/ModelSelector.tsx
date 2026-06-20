"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Zap, Scale, Brain } from "lucide-react";
import { GROQ_MODELS } from "@/types";
import { useSettingsStore } from "@/store";
import { cn } from "@/lib/utils";

const SPEED_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  fast:     { label: "Fast",     icon: Zap,   color: "#10b981" },
  balanced: { label: "Balanced", icon: Scale,  color: "#3b82f6" },
  slow:     { label: "Deep",     icon: Brain,  color: "#8b5cf6" },
};

interface ModelSelectorProps {
  className?: string;
}

export default function ModelSelector({ className = "" }: ModelSelectorProps) {
  const { settings, updateSettings } = useSettingsStore();
  const [open, setOpen] = useState(false);

  const current = GROQ_MODELS.find(m => m.id === settings.model) || GROQ_MODELS[0];
  const speedCfg = SPEED_CONFIG[current.speed] || SPEED_CONFIG.balanced;
  const SpeedIcon = speedCfg.icon;

  return (
    <div className={cn("relative", className)}>
      <button
        id="model-selector-trigger"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150",
          "border bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] border-[var(--border-subtle)] hover:border-[var(--border-default)]",
          open && "border-violet-500/30 bg-violet-500/8"
        )}
        style={{ color: "var(--text-secondary)" }}
      >
        <SpeedIcon className="w-3 h-3 flex-shrink-0" style={{ color: speedCfg.color }} />
        <span className="max-w-[80px] truncate" style={{ color: "var(--text-primary)" }}>
          {current.name.split(" ").slice(0, 2).join(" ")}
        </span>
        <ChevronDown
          className={cn("w-3 h-3 flex-shrink-0 transition-transform duration-200", open && "rotate-180")}
          style={{ color: "var(--text-muted)" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
              className="absolute bottom-full left-0 mb-2 w-[300px] z-20 rounded-2xl overflow-hidden"
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-default)",
                backdropFilter: "blur(20px)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="p-1.5 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2"
                  style={{ color: "var(--text-muted)" }}>
                  Select Model
                </p>
                {GROQ_MODELS.map(model => {
                  const active = model.id === settings.model;
                  const spd = SPEED_CONFIG[model.speed];
                  const Icon = spd.icon;

                  return (
                    <button
                      key={model.id}
                      id={`model-option-${model.id}`}
                      onClick={() => { updateSettings({ model: model.id }); setOpen(false); }}
                      className={cn(
                        "w-full text-left rounded-xl p-3 transition-all duration-150",
                        active
                          ? "bg-violet-500/12 border border-violet-500/20"
                          : "border border-transparent hover:bg-[var(--bg-hover)]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color: spd.color }} />
                          <span
                            className="font-semibold text-sm"
                            style={{ color: active ? "var(--accent-purple-light)" : "var(--text-primary)" }}
                          >
                            {model.name}
                          </span>
                        </div>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: `${spd.color}15`, color: spd.color }}
                        >
                          {spd.label}
                        </span>
                      </div>
                      <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                        {model.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {model.capabilities.map(cap => (
                          <span
                            key={cap}
                            className="inline-block text-[10px] px-1.5 py-0.5 rounded-md"
                            style={{
                              background: "var(--bg-elevated)",
                              color: "var(--text-tertiary)",
                              border: "1px solid var(--border-faint)",
                            }}
                          >
                            {cap}
                          </span>
                        ))}
                        <span
                          className="inline-block text-[10px] px-1.5 py-0.5 rounded-md ml-auto"
                          style={{
                            background: "var(--bg-elevated)",
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-faint)",
                          }}
                        >
                          {(model.contextWindow / 1000).toFixed(0)}K ctx
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
