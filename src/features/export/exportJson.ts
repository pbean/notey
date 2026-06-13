import { save } from "@tauri-apps/plugin-dialog";
import { commands } from "../../generated/bindings";
import { useToastStore } from "../toast/store";

/** Auto-dismiss duration for the final "Exported N notes" toast. */
const RESULT_TOAST_DURATION_MS = 5000;

/** Default filename suggested in the save dialog. */
const DEFAULT_FILENAME = "notey-export.json";

/** Guards against overlapping exports (e.g. double-triggering the command). */
let isExporting = false;

/**
 * Export all active notes to a single JSON file at a user-chosen path.
 *
 * Opens the native OS file-save dialog; if the user cancels, nothing happens.
 * Otherwise invokes the `export_json` command and shows a final success or
 * failure toast. Concurrent invocations are ignored while one export is in
 * flight. Unlike Markdown export this writes one file, so there is no progress
 * toast.
 */
export async function exportToJson(): Promise<void> {
  if (isExporting) return;
  isExporting = true;

  try {
    const path = await save({
      title: "Export notes to JSON",
      defaultPath: DEFAULT_FILENAME,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    // Cancelled dialog → null.
    if (path === null) return;

    const result = await commands.exportJson(path);

    if (result.status === "ok") {
      useToastStore
        .getState()
        .addToast(
          `Exported ${result.data} notes to ${path}`,
          RESULT_TOAST_DURATION_MS,
        );
    } else {
      console.error("exportJson failed:", result.error);
      useToastStore.getState().addToast("Couldn't export notes");
    }
  } catch (err) {
    console.error("exportJson threw:", err);
    useToastStore.getState().addToast("Couldn't export notes");
  } finally {
    isExporting = false;
  }
}

/**
 * Test-only reset for the module-level export guard. Called from the global
 * test cleanup so an in-flight marker never leaks between tests.
 */
export function resetExportGuard(): void {
  isExporting = false;
}
