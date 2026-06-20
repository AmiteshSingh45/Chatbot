import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NexusAI — Intelligent Multi-Agent Assistant",
    template: "%s | NexusAI",
  },
  description:
    "NexusAI is a powerful AI assistant with multi-agent reasoning, real-time web search, document analysis, code generation, and persistent memory. No login required to start.",
  keywords: ["AI", "chatbot", "LangGraph", "LLM", "assistant", "Groq", "multi-agent", "NexusAI"],
  authors: [{ name: "Amitesh Kumar" }],
  openGraph: {
    type: "website",
    title: "NexusAI — Intelligent Multi-Agent Assistant",
    description: "Chat with a powerful multi-agent AI. No account needed to get started.",
    siteName: "NexusAI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0c10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 3500,
            style: {
              background: "#1e1e28",
              color: "#f2f2f7",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "14px",
              fontSize: "13.5px",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              boxShadow: "0 8px 32px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.30)",
              padding: "12px 16px",
              maxWidth: "380px",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#f2f2f7" },
              style: {
                borderLeft: "3px solid #10b981",
              },
            },
            error: {
              iconTheme: { primary: "#f43f5e", secondary: "#f2f2f7" },
              style: {
                borderLeft: "3px solid #f43f5e",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
