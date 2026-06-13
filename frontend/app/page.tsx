"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/chat");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex items-center justify-center h-dvh" style={{ background: "var(--bg-primary)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl gradient-text flex items-center justify-center text-2xl font-bold"
          style={{ background: "var(--accent-gradient)" }}>N</div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="pulse-dot w-2 h-2 rounded-full"
              style={{ background: "var(--accent-purple)", animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
