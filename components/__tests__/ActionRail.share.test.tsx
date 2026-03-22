import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ActionRail from "../ActionRail";
import type { PlanAction } from "@/lib/types";

const shareAction: PlanAction = {
  id: "share-1",
  type: "share_plan",
  label: "Share plan",
  description: "Copy share link",
};

const swapAction: PlanAction = {
  id: "swap-1",
  type: "swap_backup",
  label: "Try backup",
  description: "Swap to backup option",
  option_id: "opt-2",
};

describe("ActionRail", () => {
  afterEach(() => vi.useRealTimers());
  it("renders nothing when actions array is empty", () => {
    const { container } = render(
      <ActionRail actions={[]} onAction={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders action buttons", () => {
    render(<ActionRail actions={[shareAction]} onAction={vi.fn()} />);
    expect(screen.getByText("Share plan")).toBeTruthy();
  });

  it("calls onAction when button is clicked", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(<ActionRail actions={[shareAction]} onAction={onAction} />);
    fireEvent.click(screen.getByText("Share plan"));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith(shareAction));
  });

  it("shows loading indicator while onAction is pending", async () => {
    let resolveAction!: () => void;
    const onAction = vi.fn(
      () => new Promise<void>((res) => { resolveAction = res; })
    );
    render(<ActionRail actions={[shareAction]} onAction={onAction} />);
    fireEvent.click(screen.getByText("Share plan"));
    await waitFor(() => expect(screen.getByText("…")).toBeTruthy());
    resolveAction();
    await waitFor(() => expect(screen.getByText("Share plan")).toBeTruthy());
  });

  it("disables other buttons while one action is loading", async () => {
    let resolveAction!: () => void;
    const onAction = vi.fn(
      () => new Promise<void>((res) => { resolveAction = res; })
    );
    render(<ActionRail actions={[shareAction, swapAction]} onAction={onAction} />);
    fireEvent.click(screen.getByText("Share plan"));
    await waitFor(() => {
      const swapBtn = screen.getByTitle(swapAction.description);
      expect(swapBtn).toBeDisabled();
    });
    resolveAction();
  });

  it("shows error state when onAction rejects", async () => {
    const onAction = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<ActionRail actions={[shareAction]} onAction={onAction} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Share plan"));
    });
    expect(screen.getByText("Failed — tap to retry")).toBeTruthy();
  });

  it("clears error state after 3 seconds", async () => {
    vi.useFakeTimers();
    const onAction = vi.fn().mockRejectedValue(new Error("Oops"));
    render(<ActionRail actions={[shareAction]} onAction={onAction} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Share plan"));
    });
    expect(screen.getByText("Failed — tap to retry")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(screen.getByText("Share plan")).toBeTruthy();
  });

  it("prevents concurrent actions (second click ignored while loading)", async () => {
    let resolveAction!: () => void;
    const onAction = vi.fn(
      () => new Promise<void>((res) => { resolveAction = res; })
    );
    render(<ActionRail actions={[shareAction]} onAction={onAction} />);
    fireEvent.click(screen.getByText("Share plan"));
    await waitFor(() => expect(screen.getByText("…")).toBeTruthy());
    // Second click should be ignored
    fireEvent.click(screen.getByText("…"));
    expect(onAction).toHaveBeenCalledTimes(1);
    resolveAction();
  });
});
