import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { commands } from "../../generated/bindings";
import { useToastStore } from "../toast/store";

/** Payload of the backend `export-markdown-progress` event. */
interface ExportProgress {
  /** Notes written so far. */
  current: number;
  /** Total notes to write. */
  total: number;
}

/** Show the progress toast only once an export is visibly slow (>2s). */
const PROGRESS_TOAST_DELAY_MS = 2000;

/** Auto-dismiss duration for the final "Exported N notes" toast. */
const RESULT_TOAST_DURATION_MS = 5000;

/** Guards against overlapping exports (e.g. double-triggering the command). */
let isExporting = false;

/**
 * Export all active notes to Markdown files in a user-chosen directory.
 *
 * Opens the native OS directory picker; if the user cancels, nothing happens.
 * Otherwise invokes the `export_markdown` command, surfacing a live
 * "Exporting... N/total" toast only when the export runs longer than
 * {@link PROGRESS_TOAST_DELAY_MS}, and a final success or failure toast when it
 * completes. Concurrent invocations are ignored while one export is in flight.
 */
export async function exportToMarkdown(): Promise<void> {
  if (isExporting) return;
  isExporting = true;

  let progressToastId: number | null = null;
  let unlisten: UnlistenFn | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Export notes to folder",
    });
    // Cancelled picker → null; defensively treat an array as cancel too.
    if (selected === null || Array.isArray(selected)) return;
    const directory = selected;

    let latest: ExportProgress = { current: 0, total: 0 };
    const progressMessage = (): string =>
      `Exporting... ${latest.current}/${latest.total}`;

    unlisten = await listen<ExportProgress>(
      "export-markdown-progress",
      (event) => {
        latest = event.payload;
        if (progressToastId !== null) {
          useToastStore
            .getState()
            .updateToast(progressToastId, progressMessage());
        }
      },
    );

    timer = setTimeout(() => {
      if (latest.total > 0) {
        progressToastId = useToastStore
          .getState()
          .addToast(progressMessage(), 0);
      }
    }, PROGRESS_TOAST_DELAY_MS);

    const result = await commands.exportMarkdown(directory);

    if (result.status === "ok") {
      useToastStore
        .getState()
        .addToast(
          `Exported ${result.data} notes to ${directory}`,
          RESULT_TOAST_DURATION_MS,
        );
    } else {
      console.error("exportMarkdown failed:", result.error);
      useToastStore.getState().addToast("Couldn't export notes");
    }
  } catch (err) {
    console.error("exportMarkdown threw:", err);
    useToastStore.getState().addToast("Couldn't export notes");
  } finally {
    if (timer !== null) clearTimeout(timer);
    if (unlisten) unlisten();
    if (progressToastId !== null)
      useToastStore.getState().dismissToast(progressToastId);
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
