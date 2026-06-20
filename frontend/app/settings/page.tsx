"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Cpu, Thermometer, Brain, User,
  Check, Zap, Scale, Sparkles, Shield,
  Moon, Sun, Monitor, ChevronRight, ChevronLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore, useSettingsStore } from "@/store";
import { Avatar } from "@/components/ui/Avatar";

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

const MODELS = [
  { id:"llama-3.3-70b-versatile", label:"Llama 3.3 70B",     desc:"Best overall. Great for complex tasks.",    badge:"Recommended", icon:Sparkles, color:"#8b5cf6" },
  { id:"llama-3.1-8b-instant",    label:"Llama 3.1 8B",      desc:"Fastest responses for simple tasks.",       badge:"Fast",        icon:Zap,      color:"#10b981" },
  { id:"deepseek-r1-distill-llama-70b", label:"DeepSeek R1",  desc:"Strongest reasoning and math.",            badge:"Reasoning",   icon:Brain,    color:"#3b82f6" },
  { id:"mixtral-8x7b-32768",      label:"Mixtral 8×7B",      desc:"Creative and diverse brainstorming.",       badge:"Creative",    icon:Scale,    color:"#f59e0b" },
];

const TEMP_LABELS = [
  { value:0,   emoji:"🎯", label:"Precise" },
  { value:0.3, emoji:"⚖️", label:"Balanced" },
  { value:0.7, emoji:"✨", label:"Creative" },
  { value:1.0, emoji:"🔥", label:"Wild" },
];

const TABS = [
  { id:"profile",     label:"Profile",     icon:User },
  { id:"ai",          label:"AI Model",    icon:Cpu },
  { id:"memory",      label:"Memory",      icon:Brain },
  { id:"appearance",  label:"Appearance",  icon:Moon },
];

/* ── Toggle ────────────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, id }: { checked:boolean; onChange:()=>void; id?:string }) {
  return (
    <button id={id} role="switch" aria-checked={checked} onClick={onChange}
      style={{ width:44,height:24,borderRadius:999,border:`1px solid ${checked?"rgba(139,92,246,0.5)":"rgba(255,255,255,0.12)"}`,background:checked?T.purple:"#1c1c25",flexShrink:0,cursor:"pointer",position:"relative",transition:"background 0.2s,border-color 0.2s",boxShadow:checked?"0 0 12px rgba(139,92,246,0.3)":"none" }}>
      <motion.div animate={{ translateX:checked?20:0 }} transition={{ type:"spring",stiffness:500,damping:30 }}
        style={{ position:"absolute",top:2,left:2,width:18,height:18,borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
    </button>
  );
}

/* ── Section header ────────────────────────────────────────────────────────── */
function SectionHeader({ icon:Icon, title, description }: { icon:React.ElementType; title:string; description?:string }) {
  return (
    <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:20 }}>
      <div style={{ width:34,height:34,borderRadius:10,flexShrink:0,marginTop:1,background:"rgba(139,92,246,0.10)",border:"1px solid rgba(139,92,246,0.18)",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <Icon style={{ width:15,height:15,color:T.purple }} />
      </div>
      <div>
        <p style={{ fontSize:14,fontWeight:600,color:T.textPrimary,margin:"0 0 2px" }}>{title}</p>
        {description && <p style={{ fontSize:12,color:T.textMuted,margin:0 }}>{description}</p>}
      </div>
    </div>
  );
}

/* ── Card wrapper ──────────────────────────────────────────────────────────── */
function Card({ children }: { children:React.ReactNode }) {
  return (
    <div style={{ background:T.bgCard,border:`1px solid ${T.borderSubtle}`,borderRadius:18,padding:22,boxShadow:"0 2px 12px rgba(0,0,0,0.3)" }}>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const save = () => {
    updateSettings(local);
    setSaved(true); toast.success("Settings saved!");
    setTimeout(() => setSaved(false), 2500);
  };

  const userInitial = user?.email?.[0]?.toUpperCase() || "U";
  const tempLabel = TEMP_LABELS.reduce((prev,curr) =>
    Math.abs(curr.value-local.temperature) < Math.abs(prev.value-local.temperature) ? curr : prev);

  return (
    <>
      <style>{`
        * { box-sizing:border-box }
        body { font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased }
        input[type=range] { -webkit-appearance:none; appearance:none; height:4px; border-radius:99px; cursor:pointer; background:transparent; width:100% }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#8b5cf6; box-shadow:0 0 8px rgba(139,92,246,0.4); cursor:pointer }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ minHeight:"100dvh",overflowY:"auto",background:T.bgPrimary }}>
        {/* Ambient glow */}
        <div style={{ position:"fixed",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse 60% 30% at 50% 0%,rgba(139,92,246,0.05) 0%,transparent 70%)",zIndex:0 }} />

        <div style={{ maxWidth:640,margin:"0 auto",padding:"32px 20px",position:"relative",zIndex:1 }}>

          {/* Back nav */}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:28,fontSize:13,color:T.textMuted }}>
            <button onClick={() => router.back()} id="settings-back-btn"
              style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"6px 10px",borderRadius:10,color:T.textMuted,fontSize:13,transition:"background 0.12s,color 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color=T.textSecondary; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color=T.textMuted; }}>
              <ArrowLeft style={{ width:15,height:15 }} />Back
            </button>
            <ChevronRight style={{ width:13,height:13,opacity:0.3 }} />
            <span style={{ color:T.textFaint }}>Settings</span>
          </div>

          {/* Title */}
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:26,fontWeight:800,letterSpacing:"-0.02em",color:T.textPrimary,margin:"0 0 6px" }}>Settings</h1>
            <p style={{ fontSize:14,color:T.textSecondary,margin:0 }}>Customize your NexusAI experience</p>
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.05}}
            style={{ display:"flex",gap:4,padding:4,marginBottom:20,borderRadius:16,background:T.bgCard,border:`1px solid ${T.borderFaint}`,overflowX:"auto" }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab===tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:10,border:active?`1px solid rgba(139,92,246,0.22)`:"1px solid transparent",background:active?"rgba(139,92,246,0.10)":"transparent",color:active?T.purpleLight:T.textMuted,fontSize:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.14s",flexShrink:0 }}>
                  <Icon style={{ width:14,height:14,flexShrink:0 }} />{tab.label}
                </button>
              );
            })}
          </motion.div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.18}}
              style={{ display:"flex",flexDirection:"column",gap:12 }}>

              {/* ── PROFILE ──────────────────────────────────────────── */}
              {activeTab==="profile" && <>
                <Card>
                  <SectionHeader icon={User} title="Profile" />
                  <div style={{ display:"flex",alignItems:"center",gap:14 }}>
                    <div style={{ position:"relative",flexShrink:0 }}>
                      <Avatar initials={userInitial} variant="gradient" size="md" aria-label={user?.username||"User"} />
                      <span style={{ position:"absolute",bottom:-1,right:-1,width:12,height:12,borderRadius:"50%",background:"#22c55e",border:`2px solid ${T.bgCard}`,boxShadow:"0 0 8px rgba(34,197,94,0.5)" }} />
                    </div>
                    <div>
                      <p style={{ fontSize:15,fontWeight:600,color:T.textPrimary,margin:"0 0 3px" }}>{user?.username||"User"}</p>
                      <p style={{ fontSize:13,color:T.textSecondary,margin:"0 0 8px" }}>{user?.email}</p>
                      <span style={{ fontSize:11,padding:"3px 10px",borderRadius:999,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.18)",color:T.purpleLight,fontWeight:500 }}>
                        {user?.provider==="credentials"?"Email / Password":`via ${user?.provider}`}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <SectionHeader icon={Shield} title="Account" description="Manage your account security" />
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {[
                      { label:"Change Password", desc:"Update your login credentials", danger:false },
                      { label:"Delete Account",  desc:"Permanently remove your data", danger:true },
                    ].map(item => (
                      <div key={item.label}
                        style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:12,background:T.bgElevated,border:`1px solid ${T.borderFaint}`,cursor:"pointer",transition:"background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background="#242430"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=T.bgElevated}>
                        <div>
                          <p style={{ fontSize:13,fontWeight:500,color:item.danger?"#fb7185":T.textPrimary,margin:"0 0 2px" }}>{item.label}</p>
                          <p style={{ fontSize:12,color:T.textMuted,margin:0 }}>{item.desc}</p>
                        </div>
                        <ChevronRight style={{ width:15,height:15,color:T.textFaint }} />
                      </div>
                    ))}
                  </div>
                </Card>
              </>}

              {/* ── AI MODEL ─────────────────────────────────────────── */}
              {activeTab==="ai" && <>
                <Card>
                  <SectionHeader icon={Cpu} title="AI Model" description="Choose the language model" />
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {MODELS.map(m => {
                      const active = local.model===m.id;
                      const Icon = m.icon;
                      return (
                        <motion.button key={m.id} id={`model-option-${m.id}`} onClick={() => setLocal(s=>({...s,model:m.id}))}
                          whileHover={{scale:1.005}} whileTap={{scale:0.998}}
                          style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,border:`1px solid ${active?`${m.color}38`:T.borderFaint}`,background:active?`${m.color}08`:T.bgElevated,cursor:"pointer",width:"100%",textAlign:"left",transition:"all 0.14s",boxShadow:active?`0 0 16px ${m.color}10`:"none" }}>
                          <div style={{ width:14,height:14,borderRadius:"50%",border:`2px solid ${active?m.color:"rgba(255,255,255,0.18)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"border-color 0.15s" }}>
                            {active && <motion.div initial={{scale:0}} animate={{scale:1}} style={{ width:6,height:6,borderRadius:"50%",background:m.color }} />}
                          </div>
                          <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:`${m.color}15`,border:`1px solid ${m.color}22`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                            <Icon style={{ width:16,height:16,color:m.color }} />
                          </div>
                          <div style={{ flex:1,minWidth:0 }}>
                            <p style={{ fontSize:13,fontWeight:600,color:active?T.textPrimary:T.textSecondary,margin:"0 0 2px" }}>{m.label}</p>
                            <p style={{ fontSize:11,color:T.textMuted,margin:0 }}>{m.desc}</p>
                          </div>
                          <span style={{ fontSize:10,padding:"2px 8px",borderRadius:999,background:`${m.color}15`,color:m.color,border:`1px solid ${m.color}25`,fontWeight:500,flexShrink:0 }}>{m.badge}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </Card>

                <Card>
                  <SectionHeader icon={Thermometer} title="Temperature" description="Controls response creativity vs precision" />
                  <div style={{ marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                    <div>
                      <p style={{ fontSize:14,fontWeight:600,color:T.textPrimary,margin:"0 0 2px" }}>
                        {tempLabel.emoji} {tempLabel.label}
                      </p>
                      <p style={{ fontSize:12,color:T.textMuted,margin:0 }}>
                        {tempLabel.value===0?"Deterministic, factual":tempLabel.value<=0.3?"Slight variation":tempLabel.value<=0.7?"More variation":"Maximum randomness"}
                      </p>
                    </div>
                    <span style={{ fontSize:28,fontWeight:800,color:T.purple,fontFamily:"monospace",lineHeight:1 }}>
                      {local.temperature.toFixed(1)}
                    </span>
                  </div>

                  <div style={{ position:"relative",marginBottom:16 }}>
                    <div style={{ position:"absolute",left:0,right:0,top:"50%",transform:"translateY(-50%)",height:4,borderRadius:99,background:T.bgElevated,border:`1px solid ${T.borderFaint}` }} />
                    <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",height:4,borderRadius:99,background:T.gradient,width:`${local.temperature*100}%`,transition:"width 0.1s" }} />
                    <input type="range" min="0" max="1" step="0.1" value={local.temperature}
                      onChange={e => setLocal(s=>({...s,temperature:parseFloat(e.target.value)}))}
                      style={{ position:"relative",width:"100%",background:"transparent" }} />
                  </div>

                  <div style={{ display:"flex",justifyContent:"space-between" }}>
                    {TEMP_LABELS.map(t => (
                      <button key={t.value} onClick={() => setLocal(s=>({...s,temperature:t.value}))}
                        style={{ background:"none",border:"none",cursor:"pointer",textAlign:"center",fontSize:11,color:Math.abs(local.temperature-t.value)<0.05?T.purpleLight:T.textMuted,fontWeight:Math.abs(local.temperature-t.value)<0.05?600:400,transition:"color 0.15s" }}>
                        <span style={{ display:"block",fontSize:18,marginBottom:2 }}>{t.emoji}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Card>
              </>}

              {/* ── MEMORY ───────────────────────────────────────────── */}
              {activeTab==="memory" && (
                <Card>
                  <SectionHeader icon={Brain} title="Memory & Intelligence" description="Configure AI behavior and memory" />
                  <div style={{ display:"flex",flexDirection:"column" }}>
                    {[
                      { id:"memory-toggle",     key:"memoryEnabled" as const,    label:"Long-term Memory",    desc:"NexusAI remembers facts across conversations", color:"#ec4899" },
                      { id:"reflection-toggle", key:"reflectionEnabled" as const, label:"Quality Reflection",  desc:"AI self-reviews before sending (slightly slower)", color:"#818cf8" },
                      { id:"agent-steps-toggle",key:"showAgentSteps" as const,   label:"Show Agent Steps",    desc:"Display reasoning process while AI is thinking", color:"#06b6d4" },
                    ].map((item,i) => (
                      <div key={item.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 0",borderTop:i>0?`1px solid ${T.borderFaint}`:"none" }}>
                        <div style={{ flex:1,marginRight:16 }}>
                          <p style={{ fontSize:13,fontWeight:500,color:T.textPrimary,margin:"0 0 3px" }}>{item.label}</p>
                          <p style={{ fontSize:12,color:T.textSecondary,margin:0,lineHeight:1.5 }}>{item.desc}</p>
                        </div>
                        <Toggle id={item.id} checked={local[item.key] as boolean} onChange={() => setLocal(s=>({...s,[item.key]:!s[item.key]}))} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── APPEARANCE ───────────────────────────────────────── */}
              {activeTab==="appearance" && (
                <Card>
                  <SectionHeader icon={Moon} title="Appearance" description="Personalize the look and feel" />
                  <p style={{ fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textFaint,marginBottom:10 }}>Theme</p>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:24 }}>
                    {[
                      { label:"Dark",   icon:Moon,    current:true },
                      { label:"Light",  icon:Sun,     current:false },
                      { label:"System", icon:Monitor, current:false },
                    ].map(t => {
                      const Icon = t.icon;
                      return (
                        <button key={t.label} onClick={() => !t.current && toast("Coming soon!", {icon:"🎨"})}
                          style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"14px 8px",borderRadius:12,border:`1px solid ${t.current?"rgba(139,92,246,0.28)":T.borderSubtle}`,background:t.current?"rgba(139,92,246,0.08)":T.bgElevated,cursor:"pointer",transition:"all 0.14s",boxShadow:t.current?"0 0 16px rgba(139,92,246,0.08)":"none" }}>
                          <Icon style={{ width:20,height:20,color:t.current?T.purpleLight:T.textMuted }} />
                          <span style={{ fontSize:12,fontWeight:500,color:t.current?T.purpleLight:T.textSecondary }}>{t.label}</span>
                          {t.current && <span style={{ fontSize:9,padding:"1px 6px",borderRadius:999,background:"rgba(139,92,246,0.15)",color:T.purpleLight,fontWeight:600 }}>Active</span>}
                        </button>
                      );
                    })}
                  </div>

                  <p style={{ fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textFaint,marginBottom:10 }}>Density</p>
                  <div style={{ display:"flex",gap:8 }}>
                    {["Compact","Default","Comfortable"].map((d,i) => (
                      <button key={d} onClick={() => toast("Coming soon!",{icon:"📐"})}
                        style={{ flex:1,padding:"8px",borderRadius:10,border:`1px solid ${i===1?"rgba(139,92,246,0.22)":T.borderSubtle}`,background:i===1?"rgba(139,92,246,0.08)":T.bgElevated,color:i===1?T.purpleLight:T.textSecondary,fontSize:12,fontWeight:500,cursor:"pointer",transition:"all 0.14s" }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Save button */}
              <motion.button initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.15}}
                id="save-settings-btn" onClick={save}
                whileHover={{opacity:0.9,y:-1}} whileTap={{scale:0.98}}
                style={{ width:"100%",padding:"14px",fontSize:14,fontWeight:600,borderRadius:14,border:"none",cursor:"pointer",background:T.gradient,color:"white",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 0 24px rgba(139,92,246,0.22)" }}>
                {saved ? <><Check style={{width:17,height:17}} />Saved!</> : <>Save Settings</>}
              </motion.button>

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
