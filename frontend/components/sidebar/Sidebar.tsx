"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Pin, Trash2, Edit2, X,
  MessageSquare, LogOut, Settings, ChevronLeft, ChevronRight,
  Sparkles, Clock, Calendar, MessageCircle, Hash
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { conversationsApi, authApi } from "@/lib/api";
import { useAuthStore, useChatStore } from "@/store";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bgSecondary:  "#13131a",
  bgCard:       "#1e1e28",
  bgCardHover:  "#242430",
  borderFaint:  "rgba(255,255,255,0.05)",
  borderSubtle: "rgba(255,255,255,0.09)",
  textPrimary:  "#f1f1f5",
  textSecondary:"#a0a0b8",
  textMuted:    "#52526a",
  purple:       "#8b5cf6",
  purpleLight:  "#a78bfa",
  gradient:     "linear-gradient(135deg,#7c3aed,#4f46e5,#0ea5e9)",
};

function groupByDate(convs: Conversation[]) {
  const today:Conversation[]=[], yesterday:Conversation[]=[], last7:Conversation[]=[], older:Conversation[]=[];
  const week = subDays(new Date(), 7);
  for (const c of convs) {
    const d = new Date(c.updated_at);
    if (isToday(d)) today.push(c);
    else if (isYesterday(d)) yesterday.push(c);
    else if (isAfter(d, week)) last7.push(c);
    else older.push(c);
  }
  return { today, yesterday, last7, older };
}

/* ── Conversation item ────────────────────────────────────────────────────── */
function ConvItem({ conv, isActive, onNavigate, onRename, onPin, onDelete }: {
  conv: Conversation; isActive: boolean;
  onNavigate:(id:string)=>void; onRename:(id:string,t:string)=>void;
  onPin:(id:string,p:boolean)=>void; onDelete:(id:string)=>void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conv.title);
  const [showActions, setShowActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); setIsEditing(true); setEditTitle(conv.title);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const commitEdit = () => {
    if (editTitle.trim() && editTitle !== conv.title) onRename(conv.id, editTitle.trim());
    setIsEditing(false);
  };

  return (
    <motion.div
      layout initial={{ opacity:0,x:-6 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-6 }}
      transition={{ duration:0.14 }}
      onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}
      onClick={() => !isEditing && onNavigate(conv.id)}
      style={{
        position:"relative", display:"flex", alignItems:"flex-start", gap:8,
        padding:"8px 10px", margin:"1px 6px", borderRadius:10, cursor:"pointer",
        transition:"background 0.12s",
        background: isActive ? "rgba(139,92,246,0.10)" : showActions ? "rgba(255,255,255,0.04)" : "transparent",
        border: isActive ? "1px solid rgba(139,92,246,0.18)" : "1px solid transparent",
      }}
    >
      {isActive && (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:2.5, height:"55%", borderRadius:"0 2px 2px 0", background:T.gradient }} />
      )}
      <MessageSquare style={{ width:13,height:13,flexShrink:0,marginTop:2,color: isActive ? T.purple : T.textMuted }} />
      <div style={{ flex:1,minWidth:0,paddingRight:4 }}>
        {isEditing ? (
          <div onClick={e => e.stopPropagation()}>
            <input ref={inputRef} value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter")commitEdit(); if(e.key==="Escape")setIsEditing(false); }}
              onBlur={commitEdit}
              style={{ width:"100%", fontSize:12, background:"transparent", border:"none", borderBottom:`1px solid ${T.purple}`, outline:"none", color:T.textPrimary, paddingBottom:2 }} />
          </div>
        ) : (
          <>
            <p style={{ fontSize:12,fontWeight:500,color:isActive?T.textPrimary:T.textSecondary,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.4 }}>
              {conv.is_pinned && <Pin style={{ width:9,height:9,marginRight:4,display:"inline",color:T.purple,fill:T.purple }} />}
              {conv.title || "New Chat"}
            </p>
            <p style={{ fontSize:10,color:T.textMuted,margin:0,marginTop:1 }}>
              {formatDistanceToNow(new Date(conv.updated_at),{addSuffix:true})}
            </p>
          </>
        )}
      </div>

      <AnimatePresence>
        {showActions && !isEditing && (
          <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}}
            transition={{duration:0.1}}
            onClick={e => e.stopPropagation()}
            style={{ position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",display:"flex",gap:2,background:T.bgCard,border:`1px solid ${T.borderSubtle}`,borderRadius:8,padding:2,boxShadow:"0 2px 8px rgba(0,0,0,0.3)",zIndex:10 }}>
            <ActionIconBtn onClick={startEdit} title="Rename"><Edit2 style={{width:10,height:10}} /></ActionIconBtn>
            <ActionIconBtn onClick={() => onPin(conv.id,conv.is_pinned)} title={conv.is_pinned?"Unpin":"Pin"} active={conv.is_pinned}>
              <Pin style={{width:10,height:10,fill:conv.is_pinned?"currentColor":"none"}} />
            </ActionIconBtn>
            <ActionIconBtn onClick={() => onDelete(conv.id)} title="Delete" danger>
              <Trash2 style={{width:10,height:10}} />
            </ActionIconBtn>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ActionIconBtn({ children, onClick, title, active, danger }: { children:React.ReactNode; onClick:()=>void; title:string; active?:boolean; danger?:boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: danger&&hov?"rgba(244,63,94,0.15)":hov?"rgba(255,255,255,0.08)":"transparent", border:"none", cursor:"pointer", padding:5, borderRadius:6, color:danger&&hov?"#fb7185":active?T.purple:hov?"#a0a0b8":T.textMuted, display:"flex",alignItems:"center" }}>
      {children}
    </button>
  );
}

/* ── Section label ────────────────────────────────────────────────────────── */
function SectionLabel({ label, icon:Icon, count }: { label:string; icon:React.ElementType; count?:number }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:6,padding:"12px 14px 4px" }}>
      <Icon style={{ width:9,height:9,color:"#3a3a52" }} />
      <span style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em",color:"#3a3a52" }}>{label}</span>
      {count!==undefined && count>0 && (
        <span style={{ marginLeft:"auto",fontSize:9,padding:"1px 6px",borderRadius:999,background:"rgba(139,92,246,0.10)",color:T.purpleLight,fontWeight:600 }}>{count}</span>
      )}
    </div>
  );
}

/* ── Main Sidebar ─────────────────────────────────────────────────────────── */
export function Sidebar() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { conversations, addConversation, updateConversation, deleteConversation, activeConversationId, sidebarOpen, toggleSidebar } = useChatStore();

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[]|null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);

  const handleNewChat = async () => {
    setIsCreating(true);
    try {
      const res = await conversationsApi.create("New Chat","llama-3.3-70b-versatile");
      addConversation(res.data); router.push(`/chat/${res.data.id}`);
    } catch { toast.error("Failed to create new chat"); }
    finally { setIsCreating(false); }
  };

  const handleSearch = (q: string) => {
    setSearch(q); clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimeout.current = setTimeout(() => {
      setSearchResults(conversations.filter(c => c.title.toLowerCase().includes(q.toLowerCase())));
    }, 200);
  };

  const handleRename = async (id:string, title:string) => {
    try { await conversationsApi.update(id,{title}); updateConversation(id,{title}); }
    catch { toast.error("Failed to rename"); }
  };
  const handlePin = async (id:string, pinned:boolean) => {
    try { await conversationsApi.update(id,{is_pinned:!pinned}); updateConversation(id,{is_pinned:!pinned}); }
    catch { toast.error("Failed"); }
  };
  const handleDelete = useCallback(async (id:string) => {
    if (!confirm("Delete this conversation?")) return;
    try {
      await conversationsApi.delete(id); deleteConversation(id);
      if (activeConversationId===id) router.push("/chat");
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  }, [activeConversationId,deleteConversation,router]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth(); router.push("/login");
  };

  const displayList = searchResults ?? conversations.filter(c => !c.is_archived);
  const pinned = displayList.filter(c => c.is_pinned);
  const unpinned = displayList.filter(c => !c.is_pinned);
  const grouped = groupByDate(unpinned);
  const convItemProps = {
    onNavigate:(id:string) => router.push(`/chat/${id}`),
    onRename:handleRename, onPin:handlePin, onDelete:handleDelete,
  };

  const userInitial = user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const userName = user?.username || user?.email?.split("@")[0] || "User";

  return (
    <>
      <motion.aside
        animate={{ width: sidebarOpen ? 268 : 0 }}
        transition={{ duration:0.25, ease:[0.4,0,0.2,1] }}
        style={{ position:"relative",display:"flex",flexDirection:"column",flexShrink:0,height:"100%",overflow:"hidden",background:T.bgSecondary,borderRight:`1px solid ${T.borderFaint}` }}
      >
        <div style={{ display:"flex",flexDirection:"column",height:"100%",width:268,minWidth:268 }}>

          {/* Header */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 14px",borderBottom:`1px solid ${T.borderFaint}`,flexShrink:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:32,height:32,borderRadius:10,flexShrink:0,background:T.gradient,boxShadow:"0 0 16px rgba(139,92,246,0.35)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Sparkles style={{ width:14,height:14,color:"white" }} />
              </div>
              <div>
                <p style={{ fontSize:14,fontWeight:700,margin:0,background:T.gradient,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>NexusAI</p>
                <p style={{ fontSize:9,color:T.textMuted,margin:0 }}>Multi-agent assistant</p>
              </div>
            </div>
            <button onClick={toggleSidebar} title="Collapse" style={{ background:"transparent",border:"none",cursor:"pointer",padding:6,borderRadius:8,color:T.textMuted }}>
              <ChevronLeft style={{ width:16,height:16 }} />
            </button>
          </div>

          {/* New Chat */}
          <div style={{ padding:"12px 10px 6px",flexShrink:0 }}>
            <button
              onClick={handleNewChat} disabled={isCreating} id="new-chat-btn"
              style={{ width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:12,border:"none",cursor:isCreating?"not-allowed":"pointer",background:T.gradient,color:"white",fontSize:13,fontWeight:600,boxShadow:"0 0 16px rgba(139,92,246,0.25)",opacity:isCreating?0.65:1,transition:"opacity 0.15s, transform 0.15s" }}
              onMouseEnter={e => { if(!isCreating)(e.currentTarget as HTMLElement).style.opacity="0.88" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity=isCreating?"0.65":"1" }}
            >
              <Plus style={{ width:16,height:16,flexShrink:0 }} />
              <span>{isCreating?"Creating…":"New Chat"}</span>
            </button>
          </div>

          {/* Search */}
          <div style={{ padding:"4px 10px 8px",flexShrink:0 }}>
            <div style={{ position:"relative" }}>
              <Search style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",width:12,height:12,color:T.textMuted,pointerEvents:"none" }} />
              <input
                id="conversation-search" value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Search conversations…"
                onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                style={{ width:"100%",paddingLeft:30,paddingRight:search?30:10,paddingTop:8,paddingBottom:8,fontSize:12,borderRadius:10,border:`1px solid ${searchFocused?"rgba(139,92,246,0.40)":"rgba(255,255,255,0.08)"}`,background:"#1e1e28",color:T.textPrimary,outline:"none",boxShadow:searchFocused?"0 0 0 2px rgba(139,92,246,0.07)":"none",transition:"border-color 0.2s,box-shadow 0.2s" }}
              />
              {search && (
                <button onClick={() => handleSearch("")} style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:2,color:T.textMuted,display:"flex",alignItems:"center" }}>
                  <X style={{ width:11,height:11 }} />
                </button>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex:1,overflowY:"auto",paddingBottom:8 }}>
            <AnimatePresence mode="popLayout">
              {pinned.length > 0 && (
                <div key="pinned">
                  <SectionLabel label="Pinned" icon={Pin} count={pinned.length} />
                  {pinned.map(c => <ConvItem key={c.id} conv={c} isActive={c.id===activeConversationId} {...convItemProps} />)}
                </div>
              )}
              {grouped.today.length > 0 && (
                <div key="today">
                  <SectionLabel label="Today" icon={Clock} count={grouped.today.length} />
                  {grouped.today.map(c => <ConvItem key={c.id} conv={c} isActive={c.id===activeConversationId} {...convItemProps} />)}
                </div>
              )}
              {grouped.yesterday.length > 0 && (
                <div key="yesterday">
                  <SectionLabel label="Yesterday" icon={Calendar} />
                  {grouped.yesterday.map(c => <ConvItem key={c.id} conv={c} isActive={c.id===activeConversationId} {...convItemProps} />)}
                </div>
              )}
              {grouped.last7.length > 0 && (
                <div key="last7">
                  <SectionLabel label="Last 7 days" icon={Calendar} />
                  {grouped.last7.map(c => <ConvItem key={c.id} conv={c} isActive={c.id===activeConversationId} {...convItemProps} />)}
                </div>
              )}
              {grouped.older.length > 0 && (
                <div key="older">
                  <SectionLabel label="Older" icon={Hash} />
                  {grouped.older.map(c => <ConvItem key={c.id} conv={c} isActive={c.id===activeConversationId} {...convItemProps} />)}
                </div>
              )}

              {displayList.length === 0 && (
                <motion.div key="empty" initial={{opacity:0}} animate={{opacity:1}}
                  style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"48px 24px",textAlign:"center" }}>
                  <div style={{ width:48,height:48,borderRadius:14,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14 }}>
                    <MessageCircle style={{ width:20,height:20,color:T.purple }} />
                  </div>
                  <p style={{ fontSize:12,fontWeight:600,color:"#52526a",margin:"0 0 4px" }}>
                    {search?"No results":"No conversations"}
                  </p>
                  <p style={{ fontSize:11,color:"#3a3a52",margin:0 }}>
                    {search?"Try different keywords":"Start a new chat above"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div style={{ padding:"12px 10px",borderTop:`1px solid ${T.borderFaint}`,flexShrink:0 }}>
            {/* User card */}
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:12,marginBottom:6,background:"rgba(255,255,255,0.03)" }}>
              <div style={{ position:"relative",flexShrink:0 }}>
                <Avatar initials={userInitial} variant="gradient" size="sm" aria-label={userName} />
                <span style={{ position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:"#22c55e",border:`2px solid ${T.bgSecondary}`,boxShadow:"0 0 6px rgba(34,197,94,0.5)" }} />
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:12,fontWeight:600,color:T.textPrimary,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{userName}</p>
                <p style={{ fontSize:10,color:T.textMuted,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user?.email}</p>
              </div>
            </div>
            <div style={{ display:"flex",gap:4 }}>
              {[
                { id:"settings-btn", icon:Settings, label:"Settings", action:() => router.push("/settings") },
                { id:"logout-btn", icon:LogOut, label:"Sign out", action:handleLogout, danger:true },
              ].map(btn => {
                const Icon = btn.icon;
                return (
                  <button key={btn.id} id={btn.id} onClick={btn.action}
                    style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"7px",borderRadius:10,border:"none",background:"transparent",cursor:"pointer",fontSize:11,color:T.textMuted,transition:"background 0.12s,color 0.12s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color=btn.danger?"#fb7185":T.textSecondary; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color=T.textMuted; }}>
                    <Icon style={{ width:12,height:12 }} />{btn.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Collapse toggle when sidebar closed */}
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.button initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-8}}
            onClick={toggleSidebar}
            style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",zIndex:20,width:20,height:40,borderRadius:"0 10px 10px 0",border:`1px solid rgba(255,255,255,0.08)`,borderLeft:"none",background:"#13131a",color:T.textMuted,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"width 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.width="28px"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.width="20px"}
            title="Open sidebar" aria-label="Open sidebar">
            <ChevronRight style={{ width:12,height:12 }} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
