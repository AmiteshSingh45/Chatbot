"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import type { HITLRequest } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface HumanApprovalProps {
  request: HITLRequest;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

export default function HumanApproval({ request, onApprove, onReject }: HumanApprovalProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  const handleApprove = async () => {
    setLoading("approve");
    try { await onApprove(); } finally { setLoading(null); }
  };

  const handleReject = async () => {
    setLoading("reject");
    try { await onReject(); } finally { setLoading(null); }
  };

  const hasArgs = Object.keys(request.args).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="my-3"
    >
      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(239,68,68,0.04) 100%)",
          borderColor: "rgba(245,158,11,0.18)",
        }}
      >
        {/* Header strip */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5"
          style={{ background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.12)" }}
        >
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-400">Human Approval Required</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400/70">Paused</span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            NexusAI wants to perform an action that may have irreversible effects.
            Please review and decide whether to proceed.
          </p>

          {/* Action details */}
          <div
            className="rounded-xl p-3.5 space-y-2.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="text-xs font-semibold uppercase tracking-wider pt-0.5 flex-shrink-0 w-12"
                style={{ color: "var(--text-muted)" }}
              >
                Action
              </span>
              <span
                className="text-sm font-mono break-all"
                style={{ color: "var(--text-primary)" }}
              >
                {request.action}
              </span>
            </div>

            {hasArgs && (
              <div className="flex items-start gap-3">
                <span
                  className="text-xs font-semibold uppercase tracking-wider pt-0.5 flex-shrink-0 w-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  Args
                </span>
                <pre
                  className="text-xs font-mono flex-1 overflow-x-auto rounded-lg px-3 py-2 leading-relaxed"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-faint)",
                  }}
                >
                  {JSON.stringify(request.args, null, 2)}
                </pre>
              </div>
            )}

            {request.timestamp && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0 w-12"
                  style={{ color: "var(--text-muted)" }}>
                  Time
                </span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(request.timestamp).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-1">
            <Button
              id="hitl-approve-btn"
              variant="primary"
              size="md"
              loading={loading === "approve"}
              disabled={loading !== null}
              onClick={handleApprove}
              iconLeft={loading !== "approve" ? <CheckCircle className="w-4 h-4" /> : undefined}
              className="flex-1"
            >
              Approve
            </Button>
            <Button
              id="hitl-reject-btn"
              variant="danger"
              size="md"
              loading={loading === "reject"}
              disabled={loading !== null}
              onClick={handleReject}
              iconLeft={loading !== "reject" ? <XCircle className="w-4 h-4" /> : undefined}
              className="flex-1"
            >
              Reject
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
