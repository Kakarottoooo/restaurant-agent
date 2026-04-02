"use client";

import { useState, useEffect, useCallback } from "react";

const SERVICES = [
  {
    id: "expedia",
    label: "Expedia",
    icon: "✈",
    description: "Used for flights via Kayak — log in once to skip Expedia's sign-in at checkout.",
  },
  {
    id: "booking_com",
    label: "Booking.com",
    icon: "🏨",
    description: "Used for hotels — log in once to land directly on the reservation page.",
  },
  {
    id: "opentable",
    label: "OpenTable",
    icon: "🍽",
    description: "Used for restaurant reservations — log in once to skip the contact info step.",
  },
  {
    id: "kayak",
    label: "Kayak",
    icon: "🔍",
    description: "Optional — helps with Kayak's personalised pricing and saved searches.",
  },
] as const;

type ServiceId = (typeof SERVICES)[number]["id"];
type ConnectState = "idle" | "connecting" | "done" | "error";

interface ServiceStatus {
  connected: boolean;
  savedAt?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConnectAccountsModal({ open, onClose }: Props) {
  const [statuses, setStatuses] = useState<Record<ServiceId, ServiceStatus>>({
    expedia: { connected: false },
    booking_com: { connected: false },
    opentable: { connected: false },
    kayak: { connected: false },
  });
  const [connectState, setConnectState] = useState<Record<ServiceId, ConnectState>>({
    expedia: "idle",
    booking_com: "idle",
    opentable: "idle",
    kayak: "idle",
  });

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/booking-autopilot/status");
      const data = await res.json();
      setStatuses(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) fetchStatuses();
  }, [open, fetchStatuses]);

  async function connect(serviceId: ServiceId) {
    setConnectState((prev) => ({ ...prev, [serviceId]: "connecting" }));

    try {
      // This request is long-running (up to 3 min) — user logs in in the opened window
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180_000);
      const res = await fetch("/api/booking-autopilot/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceId }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.success) {
        setConnectState((prev) => ({ ...prev, [serviceId]: "done" }));
        await fetchStatuses();
      } else {
        setConnectState((prev) => ({ ...prev, [serviceId]: "error" }));
      }
    } catch {
      setConnectState((prev) => ({ ...prev, [serviceId]: "error" }));
    }
  }

  async function disconnect(serviceId: ServiceId) {
    await fetch("/api/booking-autopilot/connect", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: serviceId }),
    });
    setConnectState((prev) => ({ ...prev, [serviceId]: "idle" }));
    await fetchStatuses();
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--card, #fff)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          border: "0.5px solid var(--border, #e5e7eb)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "0.5px solid var(--border, #e5e7eb)",
          }}
        >
          <div>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
              🔑 Connect booking accounts
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
              Log in once — autopilot handles the rest
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted, #888)", lineHeight: 1, padding: "0 4px" }}
          >
            ×
          </button>
        </div>

        {/* How it works banner */}
        <div
          style={{
            margin: "16px 20px 0",
            padding: "10px 14px",
            borderRadius: 10,
            backgroundColor: "rgba(212,163,75,0.07)",
            border: "0.5px solid rgba(212,163,75,0.25)",
          }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-primary, #111)", lineHeight: 1.6 }}>
            Click <strong>Connect</strong> — a browser window opens on your screen. Log in normally.
            The window closes automatically and your session is saved.
            All future bookings skip the login step.
          </p>
        </div>

        {/* Service list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {SERVICES.map((svc) => {
            const status = statuses[svc.id];
            const cState = connectState[svc.id];
            const isConnecting = cState === "connecting";
            const isConnected = status.connected;

            return (
              <div
                key={svc.id}
                style={{
                  borderRadius: 12,
                  border: isConnected
                    ? "0.5px solid rgba(212,163,75,0.4)"
                    : "0.5px solid var(--border, #e5e7eb)",
                  backgroundColor: isConnected
                    ? "rgba(212,163,75,0.05)"
                    : "var(--card-2, #f9f9f9)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {/* Icon */}
                <span style={{ fontSize: 20, flexShrink: 0 }}>{svc.icon}</span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 600, fontSize: 13 }}>
                      {svc.label}
                    </p>
                    {isConnected && (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-dm-sans)",
                          color: "var(--gold, #D4A34B)",
                          border: "0.5px solid var(--gold, #D4A34B)",
                          borderRadius: 4,
                          padding: "1px 5px",
                          lineHeight: 1.4,
                        }}
                      >
                        Connected
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)", lineHeight: 1.5 }}>
                    {isConnected && status.savedAt
                      ? `Session saved ${formatRelativeDate(status.savedAt)}`
                      : svc.description}
                  </p>
                </div>

                {/* Action button */}
                {isConnected ? (
                  <button
                    onClick={() => disconnect(svc.id)}
                    style={{
                      flexShrink: 0,
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: "0.5px solid var(--border, #e5e7eb)",
                      background: "transparent",
                      color: "var(--text-muted, #aaa)",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: 11,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Disconnect
                  </button>
                ) : isConnecting ? (
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <ConnectingDots />
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-secondary, #666)", whiteSpace: "nowrap" }}>
                      Waiting for login…
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => connect(svc.id)}
                    style={{
                      flexShrink: 0,
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "0.5px solid var(--gold, #D4A34B)",
                      background: "transparent",
                      color: "var(--gold, #D4A34B)",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "0.5px solid var(--border, #e5e7eb)",
          }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)", textAlign: "center", lineHeight: 1.5 }}>
            Sessions are saved locally on your machine only. Nothing is sent to any server.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectingDots() {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--gold, #D4A34B)",
            animation: `cpulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes cpulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
