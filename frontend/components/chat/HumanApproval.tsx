"use client";
/**
 * HumanApproval — HITL (Human-in-the-Loop) approval card.
 * Appears when the agent wants to execute a potentially risky action.
 *
 * ┌────────────────────────────────────────────────┐
 * │ ⚠️  Action Required                            │
 * │ NexusAI wants to execute a potentially         │
 * │ risky action and needs your approval.          │
 * │                                                │
 * │ Action: Execute tool: file_delete              │
 * │ Args:   { path: "/data/abc.pdf" }              │
 * │                                                │
 * │  [✅ Approve]    [❌ Reject]                   │
 * └────────────────────────────────────────────────┘
 */
import { motion } from "framer-motion";
import { useState } from "react";
import type { HITLRequest } from "@/types";

interface HumanApprovalProps {
  request: HITLRequest;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

export default function HumanApproval({
  request,
  onApprove,
  onReject,
}: HumanApprovalProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  const handleApprove = async () => {
    setLoading("approve");
    try {
      await onApprove();
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    try {
      await onReject();
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="my-4 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(239,68,68,0.05) 100%)",
        border: "1px solid rgba(245,158,11,0.2)",
      }}
    >
      {/* Header bar */}
      <div
        className="px-4 py-2 flex items-center gap-2"
        style={{ background: "rgba(245,158,11,0.1)" }}
      >
        <span className="text-amber-400 text-base">⚠️</span>
        <span className="text-amber-400 font-semibold text-sm tracking-wide">
          Human Approval Required
        </span>
        <span className="ml-auto">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400/80">Paused</span>
          </span>
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-white/60 leading-relaxed">
          NexusAI wants to perform an action that may have irreversible effects.
          Please review and decide whether to proceed.
        </p>

        {/* Action details */}
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-white/40 w-14 flex-shrink-0 pt-0.5">
              Action
            </span>
            <span className="text-sm text-white/80 font-mono">{request.action}</span>
          </div>

          {Object.keys(request.args).length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-white/40 w-14 flex-shrink-0 pt-0.5">
                Args
              </span>
              <pre className="text-xs text-white/60 font-mono bg-black/20 rounded-lg px-3 py-1.5 overflow-x-auto flex-1">
                {JSON.stringify(request.args, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            id="hitl-approve-btn"
            onClick={handleApprove}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-sm
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: loading === "approve"
                ? "rgba(16,185,129,0.3)"
                : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              boxShadow: "0 0 20px rgba(16,185,129,0.2)",
            }}
          >
            {loading === "approve" ? (
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <span>✅</span>
            )}
            <span className="text-white">Approve</span>
          </button>

          <button
            id="hitl-reject-btn"
            onClick={handleReject}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-sm
                       border border-red-500/30 text-red-400
                       hover:bg-red-500/10 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "reject" ? (
              <span className="h-4 w-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <span>❌</span>
            )}
            <span>Reject</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
