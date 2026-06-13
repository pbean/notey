import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockInvoke } from "../../test-utils/setup";
import { useToastStore } from "../toast/store";
import { exportToMarkdown, resetExportGuard } from "./exportMarkdown";

// `vi.hoisted` so the mock fns exist when the (hoisted) `vi.mock` factories run
// during module import — a plain top-level const would still be in its TDZ.
const { mockOpen, mockListen } = vi.hoisted(() => ({
  mockOpen: vi.fn(),
  mockListen: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mockListen }));

describe("exportToMarkdown", () => {
  beforeEach(() => {
    mockOpen.mockReset();
    mockListen.mockReset();
    // Default: listen resolves to a no-op unlisten function.
    mockListen.mockResolvedValue(() => {});
    resetExportGuard();
    useToastStore.getState().reset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does nothing when the picker is cancelled", async () => {
    mockOpen.mockResolvedValue(null);

    await exportToMarkdown();

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "export_markdown",
      expect.anything(),
    );
  });

  it("shows a success toast with the exported count and path", async () => {
    mockOpen.mockResolvedValue("/tmp/export");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_markdown") return Promise.resolve(3);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await exportToMarkdown();

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Exported 3 notes to /tmp/export");
  });

  it("shows a failure toast when the command errors", async () => {
    mockOpen.mockResolvedValue("/tmp/export");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_markdown") return Promise.reject({ type: "Io" });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await exportToMarkdown();

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Couldn't export notes");
  });

  it("does not show a progress toast for a fast export", async () => {
    mockOpen.mockResolvedValue("/tmp/export");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_markdown") return Promise.resolve(2);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await exportToMarkdown();

    // The 2s progress timer never fires for a fast export — only the result toast.
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Exported 2 notes to /tmp/export");
  });

  it("shows a delayed progress toast with real totals and dismisses it on success", async () => {
    vi.useFakeTimers();
    mockOpen.mockResolvedValue("/tmp/export");

    type ProgressHandler = (event: {
      payload: { current: number; total: number };
    }) => void;
    let onProgress: ProgressHandler = () => {};
    mockListen.mockImplementation(async (_eventName, handler) => {
      onProgress = handler as ProgressHandler;
      return () => {};
    });

    let resolveInvoke: (value: number) => void = () => {};
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_markdown") {
        return new Promise<number>((resolve) => {
          resolveInvoke = resolve;
        });
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const run = exportToMarkdown();
    await Promise.resolve();
    await Promise.resolve();

    onProgress({ payload: { current: 0, total: 3 } });
    vi.advanceTimersByTime(2000);
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      "Exporting... 0/3",
    );

    onProgress({ payload: { current: 2, total: 3 } });
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      "Exporting... 2/3",
    );

    resolveInvoke(3);
    await run;

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Exported 3 notes to /tmp/export");
    vi.useRealTimers();
  });

  it("ignores concurrent invocations while one export is in flight", async () => {
    mockOpen.mockResolvedValue("/tmp/export");
    let resolveInvoke: (value: number) => void = () => {};
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_markdown") {
        return new Promise<number>((resolve) => {
          resolveInvoke = resolve;
        });
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const first = exportToMarkdown();
    // Let the first call advance through the picker/listen awaits to the
    // pending command invocation.
    await Promise.resolve();
    await Promise.resolve();
    const second = exportToMarkdown();

    resolveInvoke(1);
    await Promise.all([first, second]);

    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});
