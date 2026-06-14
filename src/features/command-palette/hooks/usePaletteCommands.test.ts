import { afterEach, describe, it, expect } from 'vitest';
import { usePaletteCommands } from './usePaletteCommands';
import { useSettingsStore } from '../../settings/store';

describe('usePaletteCommands', () => {
  it('returns 12 commands total', () => {
    const commands = usePaletteCommands();
    expect(commands).toHaveLength(12);
  });

  it('includes all three groups', () => {
    const commands = usePaletteCommands();
    const groups = [...new Set(commands.map((c) => c.group))];
    expect(groups).toContain('Actions');
    expect(groups).toContain('Settings');
    expect(groups).toContain('Navigation');
  });

  it('has 4 action commands', () => {
    const commands = usePaletteCommands();
    const actions = commands.filter((c) => c.group === 'Actions');
    expect(actions).toHaveLength(4);
    expect(actions.map((c) => c.label)).toEqual([
      'New Note',
      'Search Notes',
      'Switch Workspace',
      'Move to Trash',
    ]);
  });

  it('has 2 navigation commands', () => {
    const commands = usePaletteCommands();
    const nav = commands.filter((c) => c.group === 'Navigation');
    expect(nav).toHaveLength(2);
    expect(nav.map((c) => c.label)).toEqual(['Open Note List', 'View Trash']);
  });

  it('has 6 settings commands', () => {
    const commands = usePaletteCommands();
    const settings = commands.filter((c) => c.group === 'Settings');
    expect(settings).toHaveLength(6);
    expect(settings.map((c) => c.label)).toEqual([
      'Toggle Theme',
      'Toggle Layout Mode',
      'Toggle Format',
      'Open Settings',
      'Export to Markdown',
      'Export to JSON',
    ]);
  });

  it('every command has an id and action function', () => {
    const commands = usePaletteCommands();
    for (const cmd of commands) {
      expect(cmd.id).toBeTruthy();
      expect(typeof cmd.action).toBe('function');
    }
  });

  it('sources configurable shortcut hints from the live bindings', () => {
    expect(usePaletteCommands().find((c) => c.id === 'search-notes')?.shortcut).toBe('Ctrl+F');

    useSettingsStore.setState({
      bindings: { ...useSettingsStore.getState().bindings, search: 'Ctrl+G' },
    });
    expect(usePaletteCommands().find((c) => c.id === 'search-notes')?.shortcut).toBe('Ctrl+G');
  });
});

afterEach(() => {
  useSettingsStore.getState().resetSettings();
});
