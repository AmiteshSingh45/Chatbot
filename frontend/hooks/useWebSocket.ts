/**
 * WebSocket hook — manages the real-time streaming connection to the backend.
 * Handles connection, token streaming, stop, and reconnection.
 */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "@/store";
import type { StreamEvent } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useWebSocket(threadId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { appendStreamToken, finalizeStream, setIsStreaming } = useChatStore();

  const connect = useCallback(
    (token: string): Promise<WebSocket> => {
      return new Promise((resolve, reject) => {
        if (!threadId) return reject(new Error("No thread ID"));

        const ws = new WebSocket(`${WS_URL}/ws/chat/${threadId}`);
        wsRef.current = ws;

        ws.onopen = () => {
          // Send auth token as first message
          ws.send(JSON.stringify({ type: "auth", token }));
          resolve(ws);
        };

        ws.onerror = (err) => reject(err);
        ws.onclose = () => {
          wsRef.current = null;
        };
      });
    },
    [threadId]
  );

  const sendMessage = useCallback(
    async (
      content: string,
      fileIds: string[] = [],
      token: string
    ): Promise<void> => {
      if (!threadId) return;

      let ws = wsRef.current;

      // Connect or reconnect if needed
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = await connect(token);
      }

      setIsStreaming(true);
      let fullResponse = "";
      let finalMetadata: Record<string, unknown> = {};

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);

          if (data.type === "token" && data.data) {
            fullResponse += data.data;
            appendStreamToken(data.data);
          } else if (data.type === "done") {
            finalMetadata = data.metadata || {};
            finalizeStream(fullResponse, finalMetadata);
          } else if (data.type === "error") {
            finalizeStream(
              `❌ Error: ${data.message || "Something went wrong. Please try again."}`,
              {}
            );
          } else if (data.type === "stopped") {
            finalizeStream(fullResponse + " [stopped]", {});
          }
        } catch {
          // Ignore malformed events
        }
      };

      // Send the chat message
      ws.send(
        JSON.stringify({
          type: "message",
          content,
          token,
          file_ids: fileIds,
        })
      );
    },
    [threadId, connect, appendStreamToken, finalizeStream, setIsStreaming]
  );

  const stopGeneration = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // Cleanup on unmount or threadId change
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [threadId, disconnect]);

  return { sendMessage, stopGeneration, disconnect };
}
