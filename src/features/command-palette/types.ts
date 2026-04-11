/** Group heading for command palette sections. */
export type CommandGroup = 'Actions' | 'Settings' | 'Navigation';

/** A single command in the command palette registry. */
export interface PaletteCommand {
  /** Unique identifier for the command. */
  id: string;
  /** Display label shown in the palette. */
  label: string;
  /** Group this command belongs to. */
  group: CommandGroup;
  /** Platform-aware shortcut string for display (e.g. "Ctrl+N" or "⌘N"). */
  shortcut: string;
  /** Action to execute when the command is selected. */
  action: () => void | Promise<void>;
}
