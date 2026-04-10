import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandDialog,
} from '@/components/ui/command';
import { useCommandPaletteStore } from '../store';

let _isMac: boolean | null = null;
function getIsMac() {
  if (_isMac === null) {
    _isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  }
  return _isMac;
}
const mod = getIsMac() ? '⌘' : 'Ctrl';

/** Placeholder commands for UI verification. Replaced by real actions in Story 4.6. */
const COMMAND_GROUPS = [
  {
    heading: 'Actions',
    commands: [
      { label: 'New Note', shortcut: `${mod}+N` },
      { label: 'Search Notes', shortcut: `${mod}+F` },
    ],
  },
  {
    heading: 'Settings',
    commands: [
      { label: 'Toggle Theme', shortcut: `${mod}+Shift+T` },
    ],
  },
  {
    heading: 'Navigation',
    commands: [
      { label: 'Open Note List', shortcut: '' },
    ],
  },
] as const;

/**
 * Command palette overlay. Uses shadcn Command (wraps cmdk) for fuzzy search
 * and keyboard navigation. Renders via portal with backdrop.
 */
export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      useCommandPaletteStore.getState().close();
      const editor = document.querySelector<HTMLElement>('.cm-content');
      editor?.focus();
    }
  };

  const handleSelect = () => {
    // Placeholder: no-op. Real actions wired in Story 4.6.
    useCommandPaletteStore.getState().close();
    const editor = document.querySelector<HTMLElement>('.cm-content');
    editor?.focus();
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Command Palette"
      description="Search for a command to run"
      showCloseButton={false}
      className="top-[15%] max-w-[520px]"
    >
      <div data-testid="command-palette">
        <Command>
          <CommandInput
            placeholder="> Type a command..."
            data-testid="command-input"
          />
          <CommandList>
            <CommandEmpty>No commands found.</CommandEmpty>
            {COMMAND_GROUPS.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.commands.map((cmd) => (
                  <CommandItem key={cmd.label} onSelect={handleSelect}>
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </div>
    </CommandDialog>
  );
}
