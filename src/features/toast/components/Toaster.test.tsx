import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useToastStore } from "../store";
import { Toaster } from "./Toaster";

describe("Toaster", () => {
  beforeEach(() => {
    useToastStore.getState().reset();
  });

  afterEach(() => {
    useToastStore.getState().reset();
  });

  it("renders active toasts", () => {
    useToastStore.getState().addToast("hello", 0);
    render(<Toaster />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("dismisses a (persistent) toast when clicked", () => {
    // A persistent toast (durationMs <= 0) never auto-dismisses; clicking is the
    // only way to clear it.
    useToastStore.getState().addToast("persistent notice", 0);
    render(<Toaster />);

    const toast = screen.getByText("persistent notice");
    fireEvent.click(toast);

    expect(screen.queryByText("persistent notice")).not.toBeInTheDocument();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("renders toast cards as accessible dismiss buttons", () => {
    useToastStore.getState().addToast("persistent notice", 0);
    render(<Toaster />);

    expect(
      screen.getByRole("button", {
        name: "Dismiss notification: persistent notice",
      }),
    ).toBeInTheDocument();
  });
});
