import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfig } from '../../../test-utils/factories';
import { useCommandPaletteStore } from '../../command-palette/store';
import * as paletteActions from '../../command-palette/actions';
import { useNoteListStore } from '../../note-list/store';
import { useSearchStore } from '../../search/store';
import { useSettingsStore } from '../../settings/store';
import { useTrashStore } from '../../trash/store';
import { CaptureWindow } from './CaptureWindow';

vi.mock('./EditorPane', () => ({
  EditorPane: () => <div data-testid="editor-pane" />,
}));

vi.mock('./StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}));

vi.mock('../../tabs/components/TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}));

vi.mock('../../search/components/SearchOverlay', () => ({
  SearchOverlay: () => <div data-testid="search-overlay" />,
}));

vi.mock('../../command-palette/components/CommandPalette', () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));

vi.mock('../../note-list/components/NoteListPanel', () => ({
  NoteListPanel: () => <div data-testid="note-list-panel" />,
}));

vi.mock('../../trash/components/TrashPanel', () => ({
  TrashPanel: () => <div data-testid="trash-panel" />,
}));

vi.mock('../../settings/components/SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel" />,
}));

vi.mock('../../tabs/hooks/useTabKeyboardNav', () => ({
  useTabKeyboardNav: () => {},
}));

vi.mock('../../command-palette/actions', async () => {
  const actual = await vi.importActual<typeof import('../../command-palette/actions')>('../../command-palette/actions');
  return {
    ...actual,
    createNewNote: vi.fn().mockResolvedValue(undefined),
    toggleTheme: vi.fn().mockResolvedValue(undefined),
  };
});

function pressKey(key: string, init: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

describe('CaptureWindow', () => {
  beforeEach(() => {
    useCommandPaletteStore.getState().resetCommandPalette();
    useSearchStore.getState().resetSearch();
    useNoteListStore.getState().resetNoteList();
    useTrashStore.getState().resetTrash();
    useSettingsStore.getState().resetSettings();
    vi.clearAllMocks();
  });

  afterEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  it('suppresses global create/toggle shortcuts while settings is open', () => {
    useSettingsStore.setState({ isOpen: true, config: buildConfig() });
    render(<CaptureWindow />);

    pressKey(',', { ctrlKey: true });
    pressKey('f', { ctrlKey: true });
    pressKey('p', { ctrlKey: true });
    pressKey('b', { ctrlKey: true });
    pressKey('n', { ctrlKey: true });
    pressKey('T', { ctrlKey: true, shiftKey: true });

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(useSearchStore.getState().isOpen).toBe(false);
    expect(useNoteListStore.getState().isOpen).toBe(false);
    expect(paletteActions.createNewNote).not.toHaveBeenCalled();
    expect(paletteActions.toggleTheme).not.toHaveBeenCalled();
  });

  it('still handles global create/toggle shortcuts when settings is closed', () => {
    render(<CaptureWindow />);

    pressKey('n', { ctrlKey: true });
    pressKey('T', { ctrlKey: true, shiftKey: true });

    expect(paletteActions.createNewNote).toHaveBeenCalledOnce();
    expect(paletteActions.toggleTheme).toHaveBeenCalledOnce();
  });
});
