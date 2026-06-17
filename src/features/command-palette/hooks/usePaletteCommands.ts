import type { PaletteCommand } from "../types";
import {
  createNewNote,
  openSearch,
  toggleTheme,
  toggleFormat,
  toggleLayoutMode,
  toggleAutostart,
  trashActiveNote,
  stubAction,
} from "../actions";
import { useNoteListStore } from "../../note-list/store";
import { useTrashStore } from "../../trash/store";
import { useSettingsStore } from "../../settings/store";
import { displayShortcut } from "../../settings/shortcuts";
import { exportToMarkdown } from "../../export/exportMarkdown";
import { exportToJson } from "../../export/exportJson";

let _isMac: boolean | null = null;
function getIsMac(): boolean {
  if (_isMac === null) {
    _isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/.test(navigator.platform);
  }
  return _isMac;
}

/** Build the full palette command registry with real and stub actions. */
export function usePaletteCommands(): PaletteCommand[] {
  const mod = getIsMac() ? "⌘" : "Ctrl";
  // Configurable shortcuts: source hint labels from the live bindings so the
  // palette reflects any rebinding (localized to ⌘ on macOS). Read non-reactively
  // — the palette re-renders on each open and is never visible at the same time
  // as the settings overlay, so a getState() snapshot is always current.
  const bindings = useSettingsStore.getState().bindings;

  return [
    // Actions
    {
      id: "new-note",
      label: "New Note",
      group: "Actions",
      shortcut: displayShortcut(bindings.newNote),
      action: createNewNote,
    },
    {
      id: "search-notes",
      label: "Search Notes",
      group: "Actions",
      shortcut: displayShortcut(bindings.search),
      action: openSearch,
    },
    {
      id: "switch-workspace",
      label: "Switch Workspace",
      group: "Actions",
      shortcut: `${mod}+Shift+W`,
      action: () => stubAction("Switch Workspace"),
    },
    {
      id: "move-to-trash",
      label: "Move to Trash",
      group: "Actions",
      shortcut: "",
      action: trashActiveNote,
    },

    // Navigation
    {
      id: "open-note-list",
      label: "Open Note List",
      group: "Navigation",
      shortcut: displayShortcut(bindings.toggleNoteList),
      action: () => useNoteListStore.getState().open(),
    },
    {
      id: "view-trash",
      label: "View Trash",
      group: "Navigation",
      shortcut: "",
      action: () => useTrashStore.getState().open(),
    },

    // Settings
    {
      id: "toggle-theme",
      label: "Toggle Theme",
      group: "Settings",
      shortcut: displayShortcut(bindings.toggleTheme),
      action: toggleTheme,
    },
    {
      id: "toggle-layout-mode",
      label: "Toggle Layout Mode",
      group: "Settings",
      shortcut: "",
      action: toggleLayoutMode,
    },
    {
      id: "toggle-format",
      label: "Toggle Format",
      group: "Settings",
      shortcut: "",
      action: toggleFormat,
    },
    {
      id: "toggle-autostart",
      label: "Toggle Auto-Start on Login",
      group: "Settings",
      shortcut: "",
      action: toggleAutostart,
    },
    {
      id: "open-settings",
      label: "Open Settings",
      group: "Settings",
      shortcut: `${mod}+,`,
      action: () => useSettingsStore.getState().open(),
    },
    {
      id: "export-markdown",
      label: "Export to Markdown",
      group: "Settings",
      shortcut: "",
      action: exportToMarkdown,
    },
    {
      id: "export-json",
      label: "Export to JSON",
      group: "Settings",
      shortcut: "",
      action: exportToJson,
    },
  ];
}
