import type { Note, AppConfig } from '../generated/bindings';

/** Build a Note with sensible defaults. Override any field via the partial. */
export function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 1,
    title: 'Test Note',
    content: '',
    format: 'markdown',
    workspaceId: null,
    createdAt: '2026-01-01T00:00:00+00:00',
    updatedAt: '2026-01-01T00:00:00+00:00',
    deletedAt: null,
    isTrashed: false,
    ...overrides,
  };
}

/** Build an AppConfig with sensible defaults. Override nested sections via the partial. */
export function buildConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    general: { theme: 'system', layoutMode: 'compact' },
    editor: { fontSize: 14 },
    hotkey: { globalShortcut: 'Ctrl+Shift+N' },
    ...overrides,
  };
}
