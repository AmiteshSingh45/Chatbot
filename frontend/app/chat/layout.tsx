"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useChatStore } from "@/store";
import { conversationsApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar/Sidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { setConversations, sidebarOpen } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    conversationsApi.list().then(res => setConversations(res.data)).catch(() => {});
  }, [isAuthenticated, router, setConversations]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar — position relative so the expand toggle works */}
      <div className="relative flex-shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        className="flex-1 flex flex-col overflow-hidden min-w-0"
        data-sidebar-open={sidebarOpen}
      >
        {children}
      </main>
    </div>
  );
}
