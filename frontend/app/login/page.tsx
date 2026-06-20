"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ArrowRight, Check } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store";

// ── Feature list for the left panel ─────────────────────────────────────────
const FEATURES = [
  { emoji: "🤖", text: "Multi-agent AI with 7 specialized models" },
  { emoji: "⚡", text: "Real-time streaming responses via Groq" },
  { emoji: "📄", text: "File upload & document Q&A with RAG" },
  { emoji: "🧠", text: "Thread-based persistent memory" },
  { emoji: "🔍", text: "Web search & live data integration" },
  { emoji: "💻", text: "Code generation, review & debugging" },
];

// ── Input field component ─────────────────────────────────────────────────────
function FormField({
  id, label, type, placeholder, icon: Icon, value, onChange, required, minLength,
  right,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <div
        className="relative rounded-xl transition-all duration-200"
        style={{
          background: "var(--bg-tertiary)",
          border: `1px solid ${focused ? "rgba(139,92,246,0.50)" : "var(--border-default)"}`,
          boxShadow: focused ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
        }}
      >
        <Icon
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: focused ? "var(--accent-purple)" : "var(--text-muted)", transition: "color 0.2s" }}
        />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          minLength={minLength}
          className="w-full bg-transparent pl-10 py-3 text-sm outline-none"
          style={{
            color: "var(--text-primary)",
            paddingRight: right ? "2.75rem" : "1rem",
            caretColor: "var(--accent-purple)",
          }}
        />
        {right && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", username: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await authApi.register(form.email, form.password, form.username);
      } else {
        res = await authApi.login(form.email, form.password);
      }
      setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
      toast.success(isRegister ? "Account created! Welcome to NexusAI 🎉" : "Welcome back! 👋");
      router.push("/chat");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: { message?: string } } } })
          ?.response?.data?.detail?.message || "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex" style={{ background: "var(--bg-primary)" }}>

      {/* ── Left decorative panel ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[460px] p-12 relative overflow-hidden flex-shrink-0"
        style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border-faint)" }}
      >
        {/* Background glow orbs */}
        <div
          className="absolute top-1/3 -left-16 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(124,58,237,0.12)", animation: "ambient-pulse 6s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-1/3 right-0 w-60 h-60 rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(59,130,246,0.08)", animation: "ambient-pulse 8s ease-in-out infinite 2s" }}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage: "linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Logo + branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--gradient-brand)",
                boxShadow: "0 0 24px rgba(139,92,246,0.40)",
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold gradient-text leading-tight">NexusAI</p>
              <p className="text-xs leading-tight" style={{ color: "var(--text-muted)" }}>Multi-agent assistant</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-3 leading-snug" style={{ color: "var(--text-primary)" }}>
            The AI assistant<br />
            <span className="gradient-text">built for everyone</span>
          </h2>
          <p className="text-sm mb-10 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Powered by Groq + LangGraph with multi-agent reasoning, real-time web search, and persistent memory.
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 + 0.15 }}
                className="flex items-center gap-3"
              >
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{
                    background: "rgba(139,92,246,0.08)",
                    border: "1px solid rgba(139,92,246,0.14)",
                  }}
                >
                  {feat.emoji}
                </div>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{feat.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs" style={{ color: "var(--text-muted)" }}>
          © 2025 NexusAI · Production-grade AI platform
        </p>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,92,246,0.04) 0%, transparent 70%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-brand)", boxShadow: "0 0 20px rgba(139,92,246,0.35)" }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">NexusAI</span>
          </div>

          {/* Form card */}
          <div
            className="p-8 rounded-3xl"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Tab switcher */}
            <div
              className="flex p-1 mb-7 rounded-2xl"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-faint)" }}
            >
              {["Sign in", "Create account"].map((label, i) => {
                const active = isRegister ? i === 1 : i === 0;
                return (
                  <button
                    key={label}
                    onClick={() => setIsRegister(i === 1)}
                    className="flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200"
                    style={{
                      background: active ? "var(--bg-overlay)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      boxShadow: active ? "var(--shadow-sm)" : "none",
                      border: active ? "1px solid var(--border-default)" : "1px solid transparent",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Greeting */}
            <AnimatePresence mode="wait">
              <motion.div
                key={isRegister ? "register" : "login"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mb-7"
              >
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {isRegister ? "Create your account" : "Welcome back"}
                </h1>
                <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
                  {isRegister
                    ? "Join NexusAI and experience next-gen AI"
                    : "Sign in to continue your conversations"}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Form fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence>
                {isRegister && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-1">
                      <FormField
                        id="username-input"
                        label="Username"
                        type="text"
                        placeholder="johndoe"
                        icon={User}
                        value={form.username}
                        onChange={v => setForm(f => ({ ...f, username: v }))}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField
                id="email-input"
                label="Email address"
                type="email"
                placeholder="you@example.com"
                icon={Mail}
                value={form.email}
                onChange={v => setForm(f => ({ ...f, email: v }))}
                required
              />

              <FormField
                id="password-input"
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                icon={Lock}
                value={form.password}
                onChange={v => setForm(f => ({ ...f, password: v }))}
                required
                minLength={8}
                right={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn-ghost p-1 rounded-lg"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      : <Eye className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    }
                  </button>
                }
              />

              {!isRegister && (
                <div className="text-right -mt-1">
                  <Link
                    href="/forgot-password"
                    className="text-xs transition-colors"
                    style={{ color: "var(--accent-purple)" }}
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { opacity: 0.92, y: -1 } : {}}
                whileTap={!loading ? { scale: 0.98, y: 0 } : {}}
                id="auth-submit-btn"
                className="w-full py-3 px-4 text-sm font-semibold rounded-xl mt-2 flex items-center justify-center gap-2.5 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "var(--gradient-brand)",
                  color: "white",
                  boxShadow: "0 0 24px rgba(139,92,246,0.30)",
                }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                    {isRegister ? "Creating account…" : "Signing in…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                    {isRegister ? "Create account" : "Sign in to NexusAI"}
                    <ArrowRight className="w-4 h-4 flex-shrink-0 ml-auto" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Switch mode */}
            <p className="text-sm text-center mt-5" style={{ color: "var(--text-secondary)" }}>
              {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="font-semibold transition-colors"
                style={{ color: "var(--accent-purple-light)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--accent-purple)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--accent-purple-light)"}
              >
                {isRegister ? "Sign in" : "Sign up free"}
              </button>
            </p>
          </div>

          {/* Guest link */}
          <p className="text-center text-xs mt-5" style={{ color: "var(--text-muted)" }}>
            No account needed?{" "}
            <Link href="/" className="transition-colors" style={{ color: "var(--accent-purple)" }}>
              Try NexusAI as a guest →
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
