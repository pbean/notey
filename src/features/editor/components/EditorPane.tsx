import { useEffect, useRef, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState as CMEditorState, type Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { useEditorStore } from '../store';
import { useAutoSave, flushSave } from '../hooks/useAutoSave';
import { useNoteHydration } from '../hooks/useNoteHydration';
import { useWindowFocus } from '../hooks/useWindowFocus';
import { useTabStore } from '../../tabs/store';
import { buildExtensions } from '../extensions';
import { commands } from '../../../generated/bindings';
import type { NoteFormat } from '../store';
import { editorViewRef } from '../editorViewRef';
import { queueSessionSave } from '../../session/persistence';

/** Props for the CodeMirror editor pane component. */
interface EditorPaneProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * CodeMirror 6 editor pane with multi-tab support. Maintains a single
 * EditorView and swaps EditorState when the active tab changes.
 * Flushes auto-save before each switch to prevent data loss.
 */
export function EditorPane({ className, style }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const setContent = useEditorStore((s) => s.setContent);
  const format = useEditorStore((s) => s.format);
  const activeTabIndex = useTabStore((s) => s.activeTabIndex);
  const activeTabNoteId = useTabStore((s) => (
    s.activeTabIndex === null ? null : s.tabs[s.activeTabIndex]?.noteId ?? null
  ));

  const prevTabIndexRef = useRef<number | null>(null);
  const prevTabNoteIdRef = useRef<number | null>(null);
  const langCompartmentRef = useRef<Compartment | null>(null);
  /** Monotonic ID incremented on each switch — stale switches abort when their ID doesn't match. */
  const switchIdRef = useRef(0);
  /** True while a tab switch is actively swapping state — guards update listener. */
  const isSwitchingRef = useRef(false);

  useAutoSave();
  useNoteHydration(viewRef);
  useWindowFocus(viewRef);

  const onEscape = useCallback(() => {
    void flushSave()
      .then(() => commands.dismissWindow())
      .then((result) => {
        if (result.status === 'error') {
          console.error('dismissWindow failed:', result.error);
        }
      })
      .catch((e: unknown) => console.error('Esc save flush failed:', e));
  }, []);

  const onDocChanged = useCallback(
    (content: string) => {
      // Guard: don't feed content back during tab switch or hydration
      if (isSwitchingRef.current || useEditorStore.getState().isHydrating) return;
      setContent(content);
    },
    [setContent],
  );

  // Create the EditorView once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const initialFormat = useEditorStore.getState().format;
    const { extensions, langCompartment } = buildExtensions(initialFormat, {
      onEscape,
      onDocChanged,
      onSessionActivity: queueSessionSave,
    });
    langCompartmentRef.current = langCompartment;

    const view = new EditorView({
      state: CMEditorState.create({ doc: '', extensions }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    editorViewRef.current = view;

    const onScroll = () => {
      queueSessionSave();
    };
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener('scroll', onScroll);
      view.destroy();
      viewRef.current = null;
      editorViewRef.current = null;
    };
  }, [onEscape, onDocChanged]);

  // React to activeTabIndex changes — perform state swap
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const prevIndex = prevTabIndexRef.current;
    const prevNoteId = prevTabNoteIdRef.current;

    // Skip only when both the numeric slot and the note in that slot are unchanged.
    if (activeTabIndex === prevIndex && activeTabNoteId === prevNoteId) return;

    // Cancellation: increment switchId; stale switches abort after each await
    const switchId = ++switchIdRef.current;
    const isStale = () => switchIdRef.current !== switchId;

    // Update prev ref for the next switch
    prevTabIndexRef.current = activeTabIndex;
    prevTabNoteIdRef.current = activeTabNoteId;

    void (async () => {
      // 1. Save current tab state before switching
      if (prevNoteId !== null) {
        await flushSave();
        if (isStale()) return;

        const currentTabs = useTabStore.getState().tabs;
        const prevTabIndex = currentTabs.findIndex((tab) => tab.noteId === prevNoteId);
        if (prevTabIndex !== -1) {
          useTabStore.getState().saveTabState(
            prevTabIndex,
            view.state,
            view.scrollDOM.scrollTop,
            langCompartmentRef.current ?? undefined,
          );
        }
      }

      // 2. No active tab → reset to empty
      if (activeTabIndex === null || activeTabNoteId === null) {
        useEditorStore.getState().resetNote();
        const { extensions, langCompartment } = buildExtensions('markdown', {
          onEscape,
          onDocChanged,
          onSessionActivity: queueSessionSave,
        });
        langCompartmentRef.current = langCompartment;
        isSwitchingRef.current = true;
        view.setState(CMEditorState.create({ doc: '', extensions }));
        isSwitchingRef.current = false;
        return;
      }

      const activeTab = useTabStore.getState().getActiveTab();
      if (!activeTab) return;

      // 3. Restore saved state or create new
      if (activeTab.editorState) {
        // Existing tab — restore saved EditorState
        isSwitchingRef.current = true;
        view.setState(activeTab.editorState);
        isSwitchingRef.current = false;
        if (activeTab.langCompartment) {
          langCompartmentRef.current = activeTab.langCompartment;
        }

        // Sync editor store from saved tab
        useEditorStore.setState({
          activeNoteId: activeTab.noteId,
          content: view.state.doc.toString(),
          format: activeTab.format ?? 'markdown',
          saveStatus: 'idle',
          isHydrating: false,
        });
      } else {
        // New tab — fetch note and create fresh EditorState
        const result = await commands.getNote(activeTab.noteId);
        if (isStale()) return; // User switched away during fetch

        if (result.status === 'error') {
          console.error('getNote failed:', result.error);
          useEditorStore.getState().setSaveStatus('failed');
          return;
        }

        const note = result.data;
        const noteFormat: NoteFormat =
          note.format === 'plaintext' ? 'plaintext' : 'markdown';

        const { extensions, langCompartment } = buildExtensions(noteFormat, {
          onEscape,
          onDocChanged,
          onSessionActivity: queueSessionSave,
        });
        langCompartmentRef.current = langCompartment;

        // Seed the cursor from a restored session, clamped to the current doc.
        const restoredCursor = activeTab.cursorPos;
        const newState = CMEditorState.create({
          doc: note.content,
          ...(restoredCursor != null
            ? { selection: { anchor: Math.min(Math.max(restoredCursor, 0), note.content.length) } }
            : {}),
          extensions,
        });
        isSwitchingRef.current = true;
        view.setState(newState);
        isSwitchingRef.current = false;

        // Save initial state to tab store
        if (!isStale()) {
          const currentIndex = useTabStore.getState().activeTabIndex;
          if (currentIndex !== null) {
            useTabStore.getState().saveTabState(
              currentIndex, newState, 0, langCompartment,
            );
            const tabs = useTabStore.getState().tabs;
            if (currentIndex < tabs.length) {
              const newTabs = [...tabs];
              newTabs[currentIndex] = { ...newTabs[currentIndex], format: noteFormat };
              useTabStore.setState({ tabs: newTabs });
            }
          }
        }

        // Sync editor store
        useEditorStore.setState({
          activeNoteId: activeTab.noteId,
          content: note.content,
          format: noteFormat,
          saveStatus: 'idle',
          lastSavedAt: note.updatedAt,
          isHydrating: false,
        });
      }

      // 4. Restore scroll position and focus
      if (!isStale()) {
        const scrollTop = activeTab.scrollTop ?? 0;
        requestAnimationFrame(() => {
          if (viewRef.current) {
            viewRef.current.scrollDOM.scrollTop = scrollTop;
            viewRef.current.focus();
          }
        });
      }
    })();
  }, [activeTabIndex, activeTabNoteId, onEscape, onDocChanged]);

  // Reconfigure language compartment when format changes within a tab
  useEffect(() => {
    const view = viewRef.current;
    const compartment = langCompartmentRef.current;
    if (!view || !compartment) return;
    view.dispatch({
      effects: compartment.reconfigure(format === 'markdown' ? markdown() : []),
    });
  }, [format]);

  return <div ref={containerRef} className={className} style={{ height: '100%', ...style }} />;
}
