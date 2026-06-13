import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NexusAI — Your Intelligent AI Assistant",
    template: "%s | NexusAI",
  },
  description:
    "NexusAI is a production-grade AI chatbot platform with multi-agent reasoning, RAG, real-time streaming, and persistent memory.",
  keywords: ["AI", "chatbot", "LangGraph", "LLM", "assistant", "NexusAI"],
  authors: [{ name: "NexusAI Team" }],
  openGraph: {
    type: "website",
    title: "NexusAI — Your Intelligent AI Assistant",
    description: "Multi-agent AI platform with real-time streaming and RAG.",
    siteName: "NexusAI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e1e2e",
              color: "#f0f0f8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#8b5cf6", secondary: "#f0f0f8" },
            },
          }}
        />
      </body>
    </html>
  );
}
