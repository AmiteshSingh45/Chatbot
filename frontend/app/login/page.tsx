"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store";

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
      toast.success(isRegister ? "Account created!" : "Welcome back!");
      router.push("/chat");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message ||
        "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex" style={{ background: "var(--bg-primary)" }}>
      {/* Left panel — decorative */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] p-12 relative overflow-hidden"
        style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border-subtle)" }}>
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent-purple)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-15 blur-3xl"
          style={{ background: "var(--accent-blue)" }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: "var(--accent-gradient)" }}>N</div>
            <span className="text-xl font-bold gradient-text">NexusAI</span>
          </div>

          <div className="space-y-6">
            {["Multi-agent AI with 7 specialized models", "Real-time streaming responses", "File upload & document Q&A", "Thread-based persistent memory", "Web search & code execution"].map((feat, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)" }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-purple)" }} />
                </div>
                <span style={{ color: "var(--text-secondary)" }} className="text-sm">{feat}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: "var(--text-muted)" }}>
          © 2025 NexusAI. Production-grade AI platform.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ background: "var(--accent-gradient)" }}>N</div>
              <span className="text-xl font-bold gradient-text">NexusAI</span>
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {isRegister ? "Join NexusAI and experience next-gen AI" : "Sign in to continue your conversations"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input type="text" placeholder="johndoe" value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 text-sm chat-input"
                    style={{ color: "var(--text-primary)" }} />
                </div>
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input type="email" placeholder="you@example.com" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 text-sm chat-input"
                  style={{ color: "var(--text-primary)" }} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" required minLength={8}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full pl-10 pr-12 py-3 text-sm chat-input"
                  style={{ color: "var(--text-primary)" }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 btn-ghost rounded-md">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isRegister && (
              <div className="text-right">
                <Link href="/forgot-password" className="text-xs" style={{ color: "var(--accent-purple)" }}>
                  Forgot password?
                </Link>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 px-4 text-sm font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isRegister ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {isRegister ? "Create account" : "Sign in"}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setIsRegister(!isRegister)} className="text-sm"
              style={{ color: "var(--text-secondary)" }}>
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <span style={{ color: "var(--accent-purple)" }} className="font-medium">
                {isRegister ? "Sign in" : "Sign up"}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
