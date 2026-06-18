import { describe, it, expect } from "vitest";
import type { Update } from "@tauri-apps/plugin-updater";
import { useUpdateStore } from "./store";

/** Minimal stand-in for the plugin's Update handle (only fields the store reads). */
function fakeUpdate(version: string): Update {
  return { available: true, version } as unknown as Update;
}

describe("useUpdateStore", () => {
  it("starts idle with no update", () => {
    const s = useUpdateStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.update).toBeNull();
    expect(s.version).toBeNull();
  });

  it("setAvailable records the update and mirrors its version", () => {
    useUpdateStore.getState().setAvailable(fakeUpdate("0.2.0"));
    const s = useUpdateStore.getState();
    expect(s.phase).toBe("available");
    expect(s.version).toBe("0.2.0");
    expect(s.update).not.toBeNull();
  });

  it("setInstalling and setError transition phase, error clears on install", () => {
    useUpdateStore.getState().setAvailable(fakeUpdate("0.2.0"));
    useUpdateStore.getState().setError("boom");
    expect(useUpdateStore.getState().phase).toBe("error");
    expect(useUpdateStore.getState().error).toBe("boom");

    useUpdateStore.getState().setInstalling();
    expect(useUpdateStore.getState().phase).toBe("installing");
    expect(useUpdateStore.getState().error).toBeNull();
  });

  it("dismiss resets back to idle", () => {
    useUpdateStore.getState().setAvailable(fakeUpdate("0.2.0"));
    useUpdateStore.getState().dismiss();
    const s = useUpdateStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.update).toBeNull();
    expect(s.version).toBeNull();
  });
});
