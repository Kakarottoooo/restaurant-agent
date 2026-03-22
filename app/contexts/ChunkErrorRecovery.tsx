"use client";

import { useEffect } from "react";

const RECOVERY_WINDOW_MS = 15_000;
const RECOVERY_STORAGE_KEY = "folio_chunk_recovery_ts";

function isChunkLoadFailureMessage(message: string) {
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Failed to load chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Loading chunk") ||
    message.includes("/_next/static/chunks/")
  );
}

function attemptRecovery() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const lastAttempt = Number(window.sessionStorage.getItem(RECOVERY_STORAGE_KEY) ?? "0");
  if (now - lastAttempt < RECOVERY_WINDOW_MS) {
    return;
  }

  window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(now));
  window.location.reload();
}

export function ChunkErrorRecovery() {
  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      const message =
        event.error instanceof Error
          ? event.error.message
          : typeof event.message === "string"
          ? event.message
          : "";

      if (isChunkLoadFailureMessage(message)) {
        attemptRecovery();
      }
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
          ? reason
          : "";

      if (isChunkLoadFailureMessage(message)) {
        attemptRecovery();
      }
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
