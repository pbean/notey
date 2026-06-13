import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockInvoke } from "../../test-utils/setup";
import { useToastStore } from "../toast/store";
import { exportToJson, resetExportGuard } from "./exportJson";

// `vi.hoisted` so the mock fn exists when the (hoisted) `vi.mock` factory runs
// during module import — a plain top-level const would still be in its TDZ.
const { mockSave } = vi.hoisted(() => ({ mockSave: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mockSave }));

describe("exportToJson", () => {
  beforeEach(() => {
    mockSave.mockReset();
    resetExportGuard();
    useToastStore.getState().reset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does nothing when the save dialog is cancelled", async () => {
    mockSave.mockResolvedValue(null);

    await exportToJson();

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "export_json",
      expect.anything(),
    );
  });

  it("shows a success toast with the exported count and path", async () => {
    mockSave.mockResolvedValue("/tmp/notes.json");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_json") return Promise.resolve(3);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await exportToJson();

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Exported 3 notes to /tmp/notes.json");
  });

  it("shows a failure toast when the command errors", async () => {
    mockSave.mockResolvedValue("/tmp/notes.json");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_json") return Promise.reject({ type: "Io" });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await exportToJson();

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Couldn't export notes");
  });

  it("ignores concurrent invocations while one export is in flight", async () => {
    mockSave.mockResolvedValue("/tmp/notes.json");
    let resolveInvoke: (value: number) => void = () => {};
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "export_json") {
        return new Promise<number>((resolve) => {
          resolveInvoke = resolve;
        });
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const first = exportToJson();
    // Let the first call advance through the save await to the pending invoke.
    await Promise.resolve();
    await Promise.resolve();
    const second = exportToJson();

    resolveInvoke(1);
    await Promise.all([first, second]);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});
