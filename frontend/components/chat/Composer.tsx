"use client";

import { useState, useRef, useCallback, useEffect, DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paperclip, Mic, MicOff, X, FileText, ArrowUp, Square,
} from "lucide-react";
import toast from "react-hot-toast";
import { fileApi } from "@/lib/api";
import ModelSelector from "@/components/ui/ModelSelector";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "@/types";

interface ComposerProps {
  onSend: (content: string, fileIds: string[]) => Promise<void>;
  onStop: () => void;
  isStreaming: boolean;
  conversationId?: string | null;
}

const FILE_STATUS_STYLES = {
  ready:      { bg: "rgba(34,197,94,0.12)",  color: "#4ade80",  dot: "#22c55e" },
  failed:     { bg: "rgba(239,68,68,0.12)",  color: "#f87171",  dot: "#ef4444" },
  processing: { bg: "rgba(234,179,8,0.12)",  color: "#facc15",  dot: "#eab308" },
  pending:    { bg: "rgba(234,179,8,0.12)",  color: "#facc15",  dot: "#eab308" },
};

export function Composer({ onSend, onStop, isStreaming, conversationId }: ComposerProps) {
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
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

  // File upload
  const uploadFile = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20MB)"); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "docx", "txt", "csv", "md"].includes(ext)) {
      toast.error(`Unsupported type: .${ext}`); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (conversationId) fd.append("conversation_id", conversationId);
      const res = await fileApi.upload(fd);
      setAttachedFiles(prev => [...prev, res.data]);
      toast.success(`${file.name} attached`);
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [conversationId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const removeFile = (id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id));

  // Voice input
  const toggleVoice = () => {
    const w = window as any;
    if (!(w.SpeechRecognition || w.webkitSpeechRecognition)) {
      toast.error("Voice input not supported"); return;
    }
    if (isListening) {
      (recognitionRef.current as any)?.stop();
      setIsListening(false);
      return;
    }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    const rec: any = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join("");
      setValue(t);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  useEffect(() => { textareaRef.current?.focus(); }, []);

  return (
    <div className="space-y-2">
      {/* File chips */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            {attachedFiles.map(file => {
              const styles = FILE_STATUS_STYLES[file.status] || FILE_STATUS_STYLES.pending;
              const sizeKB = file.file_size ? Math.round(file.file_size / 1024) : null;
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--accent-purple)" }} />
                  <span className="max-w-[120px] truncate">{file.original_filename}</span>
                  {sizeKB && (
                    <span style={{ color: "var(--text-muted)" }}>{sizeKB}KB</span>
                  )}
                  {/* Status dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: styles.dot }}
                    title={file.status}
                  />
                  <button
                    onClick={() => removeFile(file.id)}
                    className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${file.original_filename}`}
                  >
                    <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container */}
      <div
        className={cn("relative transition-all duration-200")}
        style={{
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-2xl)",
          border: `1px solid ${isDragging
            ? "rgba(139,92,246,0.55)"
            : isFocused
              ? "rgba(139,92,246,0.45)"
              : "var(--border-default)"
          }`,
          boxShadow: isDragging
            ? "0 0 0 3px rgba(139,92,246,0.12), var(--shadow-md)"
            : isFocused
              ? "0 0 0 3px rgba(139,92,246,0.07), var(--shadow-md)"
              : "none",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Animated top border glow when focused */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              className="absolute top-0 left-4 right-4 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.5), rgba(59,130,246,0.4), rgba(139,92,246,0.5), transparent)",
                borderRadius: "var(--r-full)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-[24px] flex flex-col items-center justify-center z-10 gap-2"
              style={{ background: "rgba(139,92,246,0.06)", border: "2px dashed rgba(139,92,246,0.35)" }}
            >
              <Paperclip className="w-6 h-6" style={{ color: "var(--accent-purple)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--accent-purple-light)" }}>
                Drop to attach
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 pt-3.5 pb-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              isStreaming
                ? "NexusAI is responding…"
                : "Message NexusAI… (Enter to send, Shift+Enter for newline)"
            }
            disabled={isStreaming}
            rows={1}
            id="chat-composer-textarea"
            className="w-full bg-transparent text-sm resize-none outline-none min-h-[26px] leading-relaxed"
            style={{
              color: "var(--text-primary)",
              caretColor: "var(--accent-purple)",
            }}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            {/* Attach */}
            <button
              id="attach-file-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach file (PDF, DOCX, TXT, CSV, MD)"
              className="p-2 rounded-xl btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <Spinner size="xs" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.csv,.md"
              onChange={handleFileChange}
            />

            {/* Voice */}
            <button
              id="voice-input-btn"
              onClick={toggleVoice}
              title={isListening ? "Stop listening" : "Voice input"}
              className="p-2 rounded-xl btn-ghost relative"
              style={isListening ? { color: "#ef4444" } : undefined}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                </>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Model selector */}
            <ModelSelector className="ml-1" />
          </div>

          <div className="flex items-center gap-2">
            {value.length > 0 && (
              <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                {value.length}
              </span>
            )}

            {/* Stop / Send */}
            {isStreaming ? (
              <Button
                id="stop-generation-btn"
                variant="danger"
                size="sm"
                onClick={onStop}
                title="Stop generation"
                iconLeft={<Square className="w-3.5 h-3.5 fill-current" />}
              >
                Stop
              </Button>
            ) : (
              <motion.button
                id="send-message-btn"
                onClick={handleSend}
                disabled={!canSend}
                title="Send message (Enter)"
                whileHover={canSend ? { scale: 1.05 } : {}}
                whileTap={canSend ? { scale: 0.95 } : {}}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150"
                style={canSend
                  ? {
                      background: "var(--gradient-brand)",
                      boxShadow: "var(--shadow-glow-sm)",
                      color: "white",
                    }
                  : {
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-subtle)",
                      cursor: "not-allowed",
                    }
                }
              >
                <ArrowUp className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        NexusAI can make mistakes. Verify important information.
        <span className="mx-2 opacity-40">·</span>
        <span className="opacity-60">Enter to send</span>
        <span className="mx-1 opacity-40">·</span>
        <span className="opacity-60">Shift+Enter for newline</span>
      </p>
    </div>
  );
}

export default Composer;
