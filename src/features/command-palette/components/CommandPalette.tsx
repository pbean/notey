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
import { usePaletteCommands } from '../hooks/usePaletteCommands';
import type { PaletteCommand, CommandGroup as GroupType } from '../types';

/** Group ordering for consistent display. */
const GROUP_ORDER: GroupType[] = ['Actions', 'Settings', 'Navigation'];

/**
 * Command palette overlay. Uses shadcn Command (wraps cmdk) for fuzzy search
 * and keyboard navigation. Commands are provided by the usePaletteCommands registry.
 */
export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const commands = usePaletteCommands();

  // Group commands by their group field
  const grouped = GROUP_ORDER.map((group) => ({
    heading: group,
    commands: commands.filter((cmd) => cmd.group === group),
  })).filter((g) => g.commands.length > 0);

  const focusEditor = () => {
    const editor = document.querySelector<HTMLElement>('.cm-content');
    editor?.focus();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      useCommandPaletteStore.getState().close();
      focusEditor();
    }
  };

  const handleSelect = async (cmd: PaletteCommand) => {
    if (cmd.id === 'open-settings') {
      await cmd.action();
      return;
    }

    useCommandPaletteStore.getState().close();
    focusEditor();
    await cmd.action();
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
            {grouped.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.commands.map((cmd) => (
                  <CommandItem key={cmd.id} onSelect={() => void handleSelect(cmd)}>
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
