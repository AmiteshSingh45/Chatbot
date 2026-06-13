"use client";
/**
 * ModelSelector — Groq model picker with capability display.
 * Shows model name, speed, context window, and best-use capabilities.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GROQ_MODELS } from "@/types";
import { useSettingsStore } from "@/store";

const SPEED_LABELS: Record<string, { label: string; color: string }> = {
  fast: { label: "⚡ Fast", color: "text-emerald-400" },
  balanced: { label: "⚖️ Balanced", color: "text-blue-400" },
  slow: { label: "🧠 Deep", color: "text-purple-400" },
};

interface ModelSelectorProps {
  className?: string;
}

export default function ModelSelector({ className = "" }: ModelSelectorProps) {
  const { settings, updateSettings } = useSettingsStore();
  const [open, setOpen] = useState(false);

  const currentModel =
    GROQ_MODELS.find((m) => m.id === settings.model) || GROQ_MODELS[0];
  const speed = SPEED_LABELS[currentModel.speed];

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <button
        id="model-selector-trigger"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm
                   border border-white/10 bg-white/5 hover:bg-white/10
                   transition-all duration-200 text-white/80"
      >
        <span className="text-xs">{speed.label.split(" ")[0]}</span>
        <span className="font-medium">{currentModel.name}</span>
        <svg
          className={`h-3 w-3 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 w-80 z-20 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(12,12,16,0.97)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 -20px 60px rgba(0,0,0,0.4)",
              }}
            >
              <div className="p-2 space-y-1">
                {GROQ_MODELS.map((model) => {
                  const active = model.id === settings.model;
                  const spd = SPEED_LABELS[model.speed];

                  return (
                    <button
                      key={model.id}
                      id={`model-option-${model.id}`}
                      onClick={() => {
                        updateSettings({ model: model.id });
                        setOpen(false);
                      }}
                      className={`w-full text-left rounded-xl p-3 transition-all duration-150
                                  ${active
                                    ? "bg-purple-500/15 border border-purple-500/25"
                                    : "hover:bg-white/5 border border-transparent"
                                  }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold text-sm ${active ? "text-purple-300" : "text-white/90"}`}>
                          {model.name}
                        </span>
                        <span className={`text-xs ${spd.color}`}>{spd.label}</span>
                      </div>
                      <p className="text-xs text-white/40 mb-1.5">{model.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {model.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="inline-block text-[10px] px-1.5 py-0.5 rounded-md
                                       bg-white/5 text-white/40 border border-white/5"
                          >
                            {cap}
                          </span>
                        ))}
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md
                                         bg-white/5 text-white/30 border border-white/5 ml-auto">
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
