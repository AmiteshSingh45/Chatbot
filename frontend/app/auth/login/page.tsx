"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, ArrowRight, Sparkles, Brain,
  FileText, History, ArrowLeft, Mail, Lock, User,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bgPrimary:    "#0e0e14",
  bgSecondary:  "#13131a",
  bgCard:       "#1e1e28",
  bgElevated:   "#18181f",
  bgInput:      "#1c1c25",
  borderFaint:  "rgba(255,255,255,0.05)",
  borderSubtle: "rgba(255,255,255,0.09)",
  borderDefault:"rgba(255,255,255,0.13)",
  textPrimary:  "#f1f1f5",
  textSecondary:"#a0a0b8",
  textMuted:    "#52526a",
  textFaint:    "#3a3a52",
  purple:       "#8b5cf6",
  purpleLight:  "#a78bfa",
  gradient:     "linear-gradient(135deg,#7c3aed,#4f46e5,#0ea5e9)",
};

const PERKS = [
  { icon: Brain,    label: "Persistent Memory",     desc: "AI remembers you across sessions",   color: "#ec4899" },
  { icon: History,  label: "Conversation History",  desc: "Access all your past chats",         color: "#8b5cf6" },
  { icon: FileText, label: "Document Analysis",     desc: "Upload PDFs, DOCX, CSV for RAG",    color: "#f59e0b" },
  { icon: Sparkles, label: "Personalization",       desc: "AI adapts to your preferences",     color: "#06b6d4" },
];

/* ── Field component ─────────────────────────────────────────────────────── */
function Field({ id, label, type, placeholder, icon: Icon, value, onChange, required, right, hint }: {
  id:string; label:string; type:string; placeholder:string; icon:React.ElementType;
  value:string; onChange:(v:string)=>void; required?:boolean; right?:React.ReactNode; hint?:string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
        <label htmlFor={id} style={{ fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textMuted }}>
          {label}
        </label>
        {hint && <span style={{ fontSize:11,color:T.textFaint }}>{hint}</span>}
      </div>
      <div style={{ position:"relative",borderRadius:12,border:`1px solid ${focused?"rgba(139,92,246,0.50)":T.borderDefault}`,background:T.bgInput,transition:"border-color 0.2s,box-shadow 0.2s",boxShadow:focused?"0 0 0 3px rgba(139,92,246,0.08)":"none" }}>
        <Icon style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",width:15,height:15,pointerEvents:"none",color:focused?T.purple:T.textMuted,transition:"color 0.2s" }} />
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} required={required}
          style={{ width:"100%",background:"transparent",border:"none",outline:"none",paddingLeft:44,paddingRight:right?44:16,paddingTop:12,paddingBottom:12,fontSize:14,color:T.textPrimary,caretColor:T.purple,fontFamily:"inherit" }} />
        {right && <div style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)" }}>{right}</div>}
      </div>
    </div>
  );
}

export default function AuthLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login"|"register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode==="login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const body = mode==="login" ? {email,password} : {email,password,username:username||undefined};
      const res = await fetch(`${API_URL}${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.message||data.detail||"Authentication failed");
      localStorage.setItem("access_token",data.access_token);
      localStorage.setItem("refresh_token",data.refresh_token);
      localStorage.setItem("user",JSON.stringify(data.user));
      toast.success(mode==="login"?"Welcome back! 👋":"Account created! 🎉");
      router.push("/chat");
    } catch (err:any) {
      toast.error(err.message||"Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0 }
        body { font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased }
        input::placeholder { color:#3a3a52 }
        @keyframes ambient { 0%,100%{opacity:0.08} 50%{opacity:0.15} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ display:"flex",minHeight:"100dvh",background:T.bgPrimary }}>

        {/* ── Left decorative panel ─────────────────────────────────── */}
        <div style={{ display:"none",flexDirection:"column",justifyContent:"space-between",width:440,flexShrink:0,padding:44,position:"relative",overflow:"hidden",background:T.bgSecondary,borderRight:`1px solid ${T.borderFaint}` }}
          className="lg-flex">
          <style>{`.lg-flex { display: flex !important } @media (max-width:1023px){.lg-flex{display:none!important}}`}</style>

          {/* Ambient orbs */}
          <div style={{ position:"absolute",top:"30%",left:-80,width:360,height:360,borderRadius:"50%",background:"rgba(124,58,237,0.10)",filter:"blur(80px)",pointerEvents:"none",animation:"ambient 6s ease-in-out infinite" }} />
          <div style={{ position:"absolute",bottom:"25%",right:-40,width:240,height:240,borderRadius:"50%",background:"rgba(59,130,246,0.07)",filter:"blur(60px)",pointerEvents:"none",animation:"ambient 8s ease-in-out infinite 2s" }} />
          {/* Grid */}
          <div style={{ position:"absolute",inset:0,pointerEvents:"none",opacity:0.013,backgroundImage:"linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",backgroundSize:"28px 28px" }} />

          <div style={{ position:"relative",zIndex:1 }}>
            <Link href="/" style={{ display:"flex",alignItems:"center",gap:12,marginBottom:48,textDecoration:"none" }}>
              <div style={{ width:42,height:42,borderRadius:13,background:T.gradient,boxShadow:"0 0 24px rgba(139,92,246,0.40)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Sparkles style={{ width:19,height:19,color:"white" }} />
              </div>
              <div>
                <p style={{ fontSize:16,fontWeight:700,background:T.gradient,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:0 }}>NexusAI</p>
                <p style={{ fontSize:10,color:T.textMuted,margin:0 }}>Multi-agent assistant</p>
              </div>
            </Link>

            <h2 style={{ fontSize:26,fontWeight:800,marginBottom:12,letterSpacing:"-0.02em",lineHeight:1.25,color:T.textPrimary }}>
              Unlock the{" "}
              <span style={{ background:T.gradient,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>full experience</span>
            </h2>
            <p style={{ fontSize:14,color:T.textSecondary,marginBottom:36,lineHeight:1.7 }}>
              Sign in to get persistent memory, conversation history, and document analysis. Guest chat is always free.
            </p>

            <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
              {PERKS.map((perk,i) => {
                const Icon = perk.icon;
                return (
                  <motion.div key={perk.label} initial={{opacity:0,x:-14}} animate={{opacity:1,x:0}} transition={{delay:i*0.09+0.1}}
                    style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                    <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,marginTop:1,background:`${perk.color}12`,border:`1px solid ${perk.color}1e`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Icon style={{ width:15,height:15,color:perk.color }} />
                    </div>
                    <div>
                      <p style={{ fontSize:13,fontWeight:600,color:T.textPrimary,margin:"0 0 2px" }}>{perk.label}</p>
                      <p style={{ fontSize:12,color:T.textSecondary,margin:0 }}>{perk.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <p style={{ fontSize:11,color:T.textFaint,position:"relative",zIndex:1 }}>
            Powered by Groq · LangGraph · FAISS · No cloud lock-in
          </p>
        </div>

        {/* ── Right form panel ─────────────────────────────────────────── */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",position:"relative",overflow:"hidden" }}>
          {/* Background glow */}
          <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 50%,rgba(139,92,246,0.04) 0%,transparent 70%)",pointerEvents:"none" }} />

          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4}}
            style={{ width:"100%",maxWidth:380,position:"relative",zIndex:1 }}>

            {/* Back */}
            <Link href="/" style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:T.textMuted,textDecoration:"none",marginBottom:32,transition:"color 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color=T.textSecondary}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color=T.textMuted}>
              <ArrowLeft style={{ width:14,height:14 }} />Back to chat
            </Link>

            {/* Mobile logo */}
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:32 }} className="lg-hide">
              <style>{`.lg-hide { display:flex } @media (min-width:1024px){.lg-hide{display:none!important}}`}</style>
              <div style={{ width:36,height:36,borderRadius:10,background:T.gradient,boxShadow:"0 0 16px rgba(139,92,246,0.35)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Sparkles style={{ width:15,height:15,color:"white" }} />
              </div>
              <span style={{ fontSize:16,fontWeight:700,background:T.gradient,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>NexusAI</span>
            </div>

            {/* Form card */}
            <div style={{ background:T.bgCard,border:`1px solid ${T.borderSubtle}`,borderRadius:24,boxShadow:"0 8px 48px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",padding:28,overflow:"hidden" }}>

              {/* Mode tabs */}
              <div style={{ display:"flex",gap:4,padding:4,background:"#18181f",borderRadius:14,marginBottom:24,border:`1px solid ${T.borderFaint}` }}>
                {(["login","register"] as const).map(m => {
                  const active = mode===m;
                  return (
                    <button key={m} onClick={() => setMode(m)}
                      style={{ flex:1,padding:"8px",fontSize:13,fontWeight:500,borderRadius:10,border:active?`1px solid ${T.borderDefault}`:"1px solid transparent",background:active?"#1e1e28":"transparent",color:active?T.textPrimary:T.textMuted,cursor:"pointer",transition:"all 0.15s",boxShadow:active?"0 2px 6px rgba(0,0,0,0.25)":"none" }}>
                      {m==="login"?"Sign in":"Create account"}
                    </button>
                  );
                })}
              </div>

              {/* Heading */}
              <AnimatePresence mode="wait">
                <motion.div key={mode} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:0.18}} style={{ marginBottom:24 }}>
                  <h1 style={{ fontSize:22,fontWeight:700,color:T.textPrimary,margin:"0 0 6px",letterSpacing:"-0.01em" }}>
                    {mode==="login"?"Welcome back":"Create your account"}
                  </h1>
                  <p style={{ fontSize:13,color:T.textSecondary,margin:0 }}>
                    {mode==="login"?"Sign in to continue your conversations":"Takes 10 seconds — no email verification needed"}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Fields */}
              <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:16 }}>
                <AnimatePresence>
                  {mode==="register" && (
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={{duration:0.2}} style={{ overflow:"hidden" }}>
                      <Field id="username" label="Username" type="text" placeholder="johndoe" icon={User} value={username} onChange={setUsername} hint="optional" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field id="email" label="Email" type="email" placeholder="you@example.com" icon={Mail} value={email} onChange={setEmail} required />
                <Field id="password" label="Password" type={showPassword?"text":"password"} placeholder="Min 8 characters" icon={Lock} value={password} onChange={setPassword} required
                  right={
                    <button type="button" onClick={() => setShowPassword(p=>!p)}
                      style={{ background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:8,color:T.textMuted,display:"flex",alignItems:"center" }}>
                      {showPassword ? <EyeOff style={{width:15,height:15}}/> : <Eye style={{width:15,height:15}}/>}
                    </button>
                  }
                />

                {/* Submit */}
                <motion.button type="submit" disabled={loading||!email||!password}
                  whileHover={!loading?{opacity:0.9,y:-1}:{}} whileTap={!loading?{scale:0.98}:{}}
                  id="auth-submit-btn"
                  style={{ marginTop:4,padding:"13px 20px",fontSize:14,fontWeight:600,borderRadius:14,border:"none",cursor:loading||!email||!password?"not-allowed":"pointer",background:T.gradient,color:"white",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 0 24px rgba(139,92,246,0.28)",opacity:loading||!email||!password?0.5:1,transition:"opacity 0.15s" }}>
                  {loading ? (
                    <span style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <span style={{ width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} />
                      {mode==="login"?"Signing in…":"Creating account…"}
                    </span>
                  ) : (
                    <>
                      <Sparkles style={{ width:16,height:16,flexShrink:0 }} />
                      {mode==="login"?"Sign in to NexusAI":"Create account"}
                      <ArrowRight style={{ width:16,height:16,flexShrink:0,marginLeft:"auto" }} />
                    </>
                  )}
                </motion.button>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </form>

              <p style={{ textAlign:"center",fontSize:13,color:T.textSecondary,marginTop:20 }}>
                {mode==="login"?"Don't have an account? ":"Already have an account? "}
                <button onClick={() => setMode(mode==="login"?"register":"login")}
                  style={{ background:"none",border:"none",cursor:"pointer",fontWeight:600,color:T.purpleLight,fontSize:13 }}>
                  {mode==="login"?"Sign up free":"Sign in"}
                </button>
              </p>
            </div>

            {/* Guest */}
            <div style={{ marginTop:20,paddingTop:20,borderTop:`1px solid ${T.borderFaint}`,textAlign:"center" }}>
              <p style={{ fontSize:12,color:T.textMuted }}>
                No account needed?{" "}
                <Link href="/" style={{ color:T.purple,textDecoration:"none",fontWeight:500 }}>Continue as guest →</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
