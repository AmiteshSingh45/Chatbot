"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Pin, Archive, Trash2, Edit2, Check, X,
  ChevronLeft, ChevronRight, MessageSquare, LogOut, Settings,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { conversationsApi, authApi } from "@/lib/api";
import { useAuthStore, useChatStore } from "@/store";
import type { Conversation } from "@/types";

export function Sidebar() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const {
    conversations, addConversation, updateConversation,
    deleteConversation, activeConversationId, sidebarOpen, toggleSidebar,
  } = useChatStore();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleNewChat = async () => {
    try {
      const res = await conversationsApi.create("New Chat", "llama-3.3-70b-versatile");
      addConversation(res.data);
      router.push(`/chat/${res.data.id}`);
    } catch {
      toast.error("Failed to create new chat");
    }
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await conversationsApi.search(q);
        setSearchResults(res.data);
      } catch { setSearchResults([]); }
    }, 300);
  };

  const handleRename = async (id: string, title: string) => {
    try {
      await conversationsApi.update(id, { title });
      updateConversation(id, { title });
      setEditingId(null);
      toast.success("Renamed");
    } catch { toast.error("Failed to rename"); }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    try {
      await conversationsApi.update(id, { is_pinned: !pinned });
      updateConversation(id, { is_pinned: !pinned });
    } catch { toast.error("Failed"); }
  };

  const handleArchive = async (id: string, archived: boolean) => {
    try {
      await conversationsApi.update(id, { is_archived: !archived });
      updateConversation(id, { is_archived: !archived });
      if (!archived) toast.success("Archived");
    } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    try {
      await conversationsApi.delete(id);
      deleteConversation(id);
      if (activeConversationId === id) router.push("/chat");
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    router.push("/login");
  };

  const displayList = searchResults ?? conversations.filter(c => !c.is_archived);
  const pinned = displayList.filter(c => c.is_pinned);
  const recent = displayList.filter(c => !c.is_pinned);

  const ConvItem = ({ conv }: { conv: Conversation }) => {
    const isActive = conv.id === activeConversationId;
    const isEditing = editingId === conv.id;

    return (
      <div className={`sidebar-item px-3 py-2.5 flex items-start gap-2.5 ${isActive ? "active" : ""}`}
        onClick={() => !isEditing && router.push(`/chat/${conv.id}`)}>
        <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
          style={{ color: isActive ? "var(--accent-purple)" : "var(--text-muted)" }} />

        {isEditing ? (
          <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleRename(conv.id, editTitle);
                if (e.key === "Escape") setEditingId(null);
              }}
              className="flex-1 text-xs bg-transparent outline-none border-b"
              style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }} />
            <button onClick={() => handleRename(conv.id, editTitle)}>
              <Check className="w-3 h-3 text-green-400" />
            </button>
            <button onClick={() => setEditingId(null)}>
              <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate"
              style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {conv.title}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
            </p>
          </div>
        )}

        {/* Action buttons — visible on hover */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setEditingId(conv.id); setEditTitle(conv.title); }}
              className="p-1 rounded btn-ghost"><Edit2 className="w-3 h-3" /></button>
            <button onClick={() => handlePin(conv.id, conv.is_pinned)}
              className="p-1 rounded btn-ghost">
              <Pin className={`w-3 h-3 ${conv.is_pinned ? "fill-current" : ""}`}
                style={{ color: conv.is_pinned ? "var(--accent-purple)" : undefined }} />
            </button>
            <button onClick={() => handleDelete(conv.id)}
              className="p-1 rounded btn-ghost hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.aside
      animate={{ width: sidebarOpen ? 260 : 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col flex-shrink-0 h-full overflow-hidden"
      style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border-subtle)" }}
    >
      <div className="flex flex-col h-full w-[260px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "var(--accent-gradient)" }}>N</div>
            <span className="font-bold text-sm gradient-text">NexusAI</span>
          </div>
          <button onClick={toggleSidebar} className="p-1.5 rounded-lg btn-ghost">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 mb-3">
          <button onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ background: "var(--accent-gradient)", color: "white" }}>
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }} />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {pinned.length > 0 && (
            <>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}>Pinned</p>
              {pinned.map(c => (
                <div key={c.id} className="group"><ConvItem conv={c} /></div>
              ))}
              <div className="my-2 mx-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />
            </>
          )}
          {recent.length > 0 && (
            <>
              {pinned.length > 0 && (
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}>Recent</p>
              )}
              {recent.map(c => (
                <div key={c.id} className="group"><ConvItem conv={c} /></div>
              ))}
            </>
          )}
          {displayList.length === 0 && (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {search ? "No chats found" : "No conversations yet"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "var(--accent-gradient)" }}>
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {user?.username || user?.email}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => router.push("/settings")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs btn-ghost">
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs btn-ghost hover:text-red-400">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
