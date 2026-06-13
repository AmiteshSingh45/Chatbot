"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Cpu, Thermometer, Brain, Palette, User, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore, useSettingsStore } from "@/store";

const MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "Recommended" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",  badge: "Fast" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B",  badge: "Creative" },
  { id: "gemma2-9b-it",            label: "Gemma 2 9B",    badge: "" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();
  const [local, setLocal] = useState({ ...settings });

  const save = () => {
    updateSettings(local);
    toast.success("Settings saved!");
  };

  const Section = ({ title, icon: Icon, children }: { title: string; icon: typeof Cpu; children: React.ReactNode }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6 glass mb-4">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 rounded-lg" style={{ background: "rgba(139,92,246,0.1)" }}>
          <Icon className="w-4 h-4" style={{ color: "var(--accent-purple)" }} />
        </div>
        <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      {children}
    </motion.div>
  );

  return (
    <div className="min-h-dvh overflow-auto" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back button */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 mb-6 text-sm btn-ghost px-3 py-2 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-2xl font-bold mb-6 gradient-text">Settings</h1>

        {/* Profile */}
        <Section title="Profile" icon={User}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
              style={{ background: "var(--accent-gradient)" }}>
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {user?.username || "User"}
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{user?.email}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {user?.provider === "credentials" ? "Email/Password" : `via ${user?.provider}`}
              </p>
            </div>
          </div>
        </Section>

        {/* Model */}
        <Section title="AI Model" icon={Cpu}>
          <div className="space-y-2">
            {MODELS.map(m => (
              <button key={m.id} onClick={() => setLocal(s => ({ ...s, model: m.id }))}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
                style={{
                  background: local.model === m.id ? "rgba(139,92,246,0.1)" : "var(--bg-elevated)",
                  border: `1px solid ${local.model === m.id ? "rgba(139,92,246,0.4)" : "var(--border-subtle)"}`,
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: local.model === m.id ? "var(--accent-purple)" : "var(--border-default)" }}>
                    {local.model === m.id && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-purple)" }} />
                    )}
                  </div>
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{m.label}</span>
                </div>
                {m.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(139,92,246,0.15)", color: "var(--accent-purple)" }}>
                    {m.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* Temperature */}
        <Section title="Temperature" icon={Thermometer}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Controls response creativity
              </p>
              <span className="text-sm font-mono font-bold" style={{ color: "var(--accent-purple)" }}>
                {local.temperature.toFixed(1)}
              </span>
            </div>
            <input type="range" min="0" max="1" step="0.1"
              value={local.temperature}
              onChange={e => setLocal(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent-purple)", background: "var(--bg-elevated)" }} />
            <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
              <span>Precise (0.0)</span>
              <span>Creative (1.0)</span>
            </div>
          </div>
        </Section>

        {/* Memory */}
        <Section title="Memory" icon={Brain}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Long-term Memory</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                NexusAI remembers facts across conversations
              </p>
            </div>
            <button
              onClick={() => setLocal(s => ({ ...s, memoryEnabled: !s.memoryEnabled }))}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: local.memoryEnabled ? "var(--accent-purple)" : "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
              <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: local.memoryEnabled ? "translateX(20px)" : "translateX(0)" }} />
            </button>
          </div>
        </Section>

        {/* Save */}
        <button onClick={save}
          className="w-full py-3 btn-primary flex items-center justify-center gap-2 text-sm font-semibold">
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
