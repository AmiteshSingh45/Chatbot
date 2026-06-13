"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Square, Paperclip, Mic, MicOff, X, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { filesApi } from "@/lib/api";
import { useChatStore } from "@/store";
import type { UploadedFile } from "@/types";

interface ComposerProps {
  onSend: (content: string, fileIds: string[]) => Promise<void>;
  onStop: () => void;
  isStreaming: boolean;
  conversationId?: string;
}

export function Composer({ onSend, onStop, isStreaming, conversationId }: ComposerProps) {
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<unknown>(null);

  const canSend = value.trim().length > 0 && !isStreaming;

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    const content = value.trim();
    const fileIds = attachedFiles.map(f => f.id);
    setValue("");
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await onSend(content, fileIds);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File too large (max 20MB)");
      return;
    }

    setUploading(true);
    try {
      const res = await filesApi.upload(file, conversationId);
      setAttachedFiles(prev => [...prev, res.data]);
      toast.success(`${file.name} uploaded and processing...`);
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!(w.SpeechRecognition || w.webkitSpeechRecognition)) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    if (isListening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRConstructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SRConstructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("");
      setValue(transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="space-y-2">
      {/* Attached files */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 px-1"
          >
            {attachedFiles.map(file => (
              <div key={file.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <FileText className="w-3.5 h-3.5" style={{ color: "var(--accent-purple)" }} />
                <span className="max-w-[140px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {file.original_filename}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{
                    background: file.status === "ready" ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                    color: file.status === "ready" ? "#4ade80" : "#facc15",
                  }}>
                  {file.status}
                </span>
                <button onClick={() => removeFile(file.id)} className="hover:opacity-70">
                  <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input area */}
      <div className="relative chat-input p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "NexusAI is responding..." : "Message NexusAI... (Shift+Enter for new line)"}
          disabled={isStreaming}
          rows={1}
          className="w-full bg-transparent text-sm resize-none outline-none pr-2 min-h-[28px]"
          style={{ color: "var(--text-primary)", caretColor: "var(--accent-purple)" }}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between mt-2 pt-2"
          style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-1">
            {/* File upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach file (PDF, DOCX, TXT, CSV)"
              className="p-2 rounded-lg btn-ghost disabled:opacity-50"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent-purple)" }} />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>
            <input ref={fileInputRef} type="file" className="hidden"
              accept=".pdf,.docx,.txt,.csv" onChange={handleFileUpload} />

            {/* Voice input */}
            <button onClick={toggleVoice} title="Voice input"
              className="p-2 rounded-lg btn-ghost relative">
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" style={{ color: "#ef4444" }} />
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                </>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {value.length > 0 ? `${value.length} chars` : "Enter to send"}
            </span>

            {/* Send / Stop button */}
            {isStreaming ? (
              <button onClick={onStop} title="Stop generation"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
            ) : (
              <button onClick={handleSend} disabled={!canSend} title="Send message"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium btn-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none">
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
        NexusAI can make mistakes. Verify important information.
      </p>
    </div>
  );
}
