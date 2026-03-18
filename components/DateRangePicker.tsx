"use client";

import { useState } from "react";

interface DateRangePickerProps {
  checkIn?: string;
  checkOut?: string;
  onSelect: (checkIn: string, checkOut: string) => void;
  onClose: () => void;
}

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DateRangePicker({ checkIn, checkOut, onSelect, onClose }: DateRangePickerProps) {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(checkIn ?? "");
  const [endDate, setEndDate] = useState(checkOut ?? "");

  function handleConfirm() {
    if (startDate && endDate) {
      onSelect(startDate, endDate);
      onClose();
    }
  }

  const nights =
    startDate && endDate
      ? Math.max(
          0,
          Math.round(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "20px 20px 0 0",
          padding: "20px 20px 32px",
          width: "100%",
          maxWidth: "480px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Select Dates
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Date inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginBottom: "6px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Check-in
            </label>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => {
                setStartDate(e.target.value);
                // Auto-advance end date if needed
                if (endDate && e.target.value >= endDate) {
                  const d = new Date(e.target.value + "T00:00:00");
                  d.setDate(d.getDate() + 1);
                  setEndDate(d.toISOString().split("T")[0]);
                }
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "0.5px solid var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginBottom: "6px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Check-out
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "0.5px solid var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Nights summary */}
        {nights > 0 && (
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "var(--gold)",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            {nights} night{nights > 1 ? "s" : ""} · {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
          </p>
        )}

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!startDate || !endDate || nights <= 0}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: startDate && endDate && nights > 0 ? "var(--gold)" : "var(--border)",
            color: startDate && endDate && nights > 0 ? "#fff" : "var(--text-secondary)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "14px",
            fontWeight: 500,
            cursor: startDate && endDate && nights > 0 ? "pointer" : "not-allowed",
          }}
        >
          Confirm Dates
        </button>
      </div>
    </div>
  );
}
