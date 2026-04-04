import { EditorPane } from './EditorPane';
import { StatusBar } from './StatusBar';

/**
 * Root application shell. Full-screen flex column containing
 * the editor pane and status bar.
 */
export function CaptureWindow() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <EditorPane className="flex-1 min-h-0" />
      <StatusBar />
    </div>
  );
}
