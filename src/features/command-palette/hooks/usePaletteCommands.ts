import type { PaletteCommand } from '../types';
import {
  createNewNote,
  openSearch,
  toggleTheme,
  toggleFormat,
  toggleLayoutMode,
  stubAction,
} from '../actions';

let _isMac: boolean | null = null;
function getIsMac(): boolean {
  if (_isMac === null) {
    _isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  }
  return _isMac;
}

/** Build the full palette command registry with real and stub actions. */
export function usePaletteCommands(): PaletteCommand[] {
  const mod = getIsMac() ? '⌘' : 'Ctrl';

  return [
    // Actions
    {
      id: 'new-note',
      label: 'New Note',
      group: 'Actions',
      shortcut: `${mod}+N`,
      action: createNewNote,
    },
    {
      id: 'search-notes',
      label: 'Search Notes',
      group: 'Actions',
      shortcut: `${mod}+F`,
      action: openSearch,
    },
    {
      id: 'switch-workspace',
      label: 'Switch Workspace',
      group: 'Actions',
      shortcut: `${mod}+Shift+W`,
      action: () => stubAction('Switch Workspace'),
    },

    // Navigation
    {
      id: 'open-note-list',
      label: 'Open Note List',
      group: 'Navigation',
      shortcut: '',
      action: () => stubAction('Open Note List'),
    },
    {
      id: 'view-trash',
      label: 'View Trash',
      group: 'Navigation',
      shortcut: '',
      action: () => stubAction('View Trash'),
    },

    // Settings
    {
      id: 'toggle-theme',
      label: 'Toggle Theme',
      group: 'Settings',
      shortcut: `${mod}+Shift+T`,
      action: toggleTheme,
    },
    {
      id: 'toggle-layout-mode',
      label: 'Toggle Layout Mode',
      group: 'Settings',
      shortcut: '',
      action: toggleLayoutMode,
    },
    {
      id: 'toggle-format',
      label: 'Toggle Format',
      group: 'Settings',
      shortcut: '',
      action: toggleFormat,
    },
    {
      id: 'open-settings',
      label: 'Open Settings',
      group: 'Settings',
      shortcut: `${mod}+,`,
      action: () => stubAction('Open Settings'),
    },
    {
      id: 'export-markdown',
      label: 'Export to Markdown',
      group: 'Settings',
      shortcut: '',
      action: () => stubAction('Export to Markdown'),
    },
    {
      id: 'export-json',
      label: 'Export to JSON',
      group: 'Settings',
      shortcut: '',
      action: () => stubAction('Export to JSON'),
    },
  ];
}
