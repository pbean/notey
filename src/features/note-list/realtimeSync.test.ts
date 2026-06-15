import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EventCallback } from '@tauri-apps/api/event';
import { commands, events, type NoteCreated } from '../../generated/bindings';
import { useWorkspaceStore } from '../workspace/store';
import { startNoteCreatedSync } from './realtimeSync';

/** Build a `note-created` event payload wrapper as Tauri delivers it. */
function noteCreatedEvent(noteId: number): Parameters<EventCallback<NoteCreated>>[0] {
  return {
    event: 'note-created',
    id: 1,
    payload: { timestamp: '2026-06-13T00:00:00+00:00', data: { noteId } },
  };
}

describe('startNoteCreatedSync', () => {
  let captured: EventCallback<NoteCreated> | null;
  let unlistenSpy: ReturnType<typeof vi.fn<() => void>>;
  let loadSpy: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let originalLoadFilteredNotes: ReturnType<typeof useWorkspaceStore.getState>['loadFilteredNotes'];

  beforeEach(() => {
    vi.useFakeTimers();
    captured = null;
    unlistenSpy = vi.fn<() => void>();
    originalLoadFilteredNotes = useWorkspaceStore.getState().loadFilteredNotes;
    // Capture the listener the sync module registers; resolve with a fake unlisten.
    vi.spyOn(events.noteCreated, 'listen').mockImplementation((cb) => {
      captured = cb;
      return Promise.resolve(unlistenSpy);
    });
    // Replace the refresh action so we observe calls without hitting the backend.
    loadSpy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ loadFilteredNotes: loadSpy });
  });

  afterEach(() => {
    useWorkspaceStore.getState().resetWorkspace();
    useWorkspaceStore.setState({ loadFilteredNotes: originalLoadFilteredNotes });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('refreshes the note list once after a single event (6.6-COMP-001)', async () => {
    const unlisten = await startNoteCreatedSync();
    expect(captured).not.toBeNull();

    captured!(noteCreatedEvent(42));
    expect(loadSpy).not.toHaveBeenCalled(); // debounced, not immediate

    vi.advanceTimersByTime(200);
    expect(loadSpy).toHaveBeenCalledTimes(1);

    unlisten();
  });

  it('refreshes using the active workspace filter (6.6-COMP-001)', async () => {
    useWorkspaceStore.setState({
      activeWorkspaceId: 7,
      isAllWorkspaces: false,
      loadFilteredNotes: originalLoadFilteredNotes,
    });
    const listNotesSpy = vi.spyOn(commands, 'listNotes').mockResolvedValue({
      status: 'ok',
      data: [],
    });

    const unlisten = await startNoteCreatedSync();
    captured!(noteCreatedEvent(42));
    await vi.advanceTimersByTimeAsync(200);

    expect(listNotesSpy).toHaveBeenCalledWith(7);

    unlisten();
  });

  it('batches a rapid burst into a single refresh (6.6-COMP-002)', async () => {
    const unlisten = await startNoteCreatedSync();

    for (let i = 0; i < 5; i++) {
      captured!(noteCreatedEvent(i));
      vi.advanceTimersByTime(20); // each within the 200ms window
    }
    expect(loadSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(loadSpy).toHaveBeenCalledTimes(1);

    unlisten();
  });

  it('schedules exactly one trailing refresh for an event that coalesces mid-flight', async () => {
    // First refresh stays in flight until released; later refreshes resolve at once.
    let releaseFirst!: () => void;
    const firstLoad = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const controllableLoad = vi.fn<() => Promise<void>>().mockImplementation(() => {
      calls += 1;
      return calls === 1 ? firstLoad : Promise.resolve();
    });
    useWorkspaceStore.setState({ loadFilteredNotes: controllableLoad });

    const unlisten = await startNoteCreatedSync();

    // Event 1 → debounce fires → refresh #1 starts and stays in flight.
    captured!(noteCreatedEvent(1));
    await vi.advanceTimersByTimeAsync(200);
    expect(controllableLoad).toHaveBeenCalledTimes(1);

    // Event 2 arrives mid-flight → its debounced runRefresh coalesces onto #1.
    captured!(noteCreatedEvent(2));
    await vi.advanceTimersByTimeAsync(200);
    expect(controllableLoad).toHaveBeenCalledTimes(1);

    // Release #1 → onCoalesced schedules exactly one trailing pass.
    releaseFirst();
    await vi.advanceTimersByTimeAsync(0); // flush settle → onCoalesced → scheduleRefresh
    await vi.advanceTimersByTimeAsync(200); // run the trailing debounce
    expect(controllableLoad).toHaveBeenCalledTimes(2);

    // Nothing piles up beyond the single trailing refresh.
    await vi.advanceTimersByTimeAsync(500);
    expect(controllableLoad).toHaveBeenCalledTimes(2);

    unlisten();
  });

  it('does not re-arm a trailing refresh after stop() when sync restarts mid-flight', async () => {
    let releaseFirst!: () => void;
    const firstLoad = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const controllableLoad = vi.fn<() => Promise<void>>().mockImplementation(() => {
      calls += 1;
      return calls === 1 ? firstLoad : Promise.resolve();
    });
    useWorkspaceStore.setState({ loadFilteredNotes: controllableLoad });

    // Session 1: start refresh #1, then coalesce a second event onto it.
    const unlisten1 = await startNoteCreatedSync();
    captured!(noteCreatedEvent(1));
    await vi.advanceTimersByTimeAsync(200); // refresh #1 in flight
    captured!(noteCreatedEvent(2));
    await vi.advanceTimersByTimeAsync(200); // coalesces onto #1
    expect(controllableLoad).toHaveBeenCalledTimes(1);

    // Tear down session 1 mid-flight, then restart (session 2).
    unlisten1();
    const unlisten2 = await startNoteCreatedSync();

    // Releasing the orphaned refresh #1 must NOT re-arm a trailing pass on the
    // new session — the stale coalesced marker belongs to a retired generation.
    releaseFirst();
    await vi.advanceTimersByTimeAsync(500);
    expect(controllableLoad).toHaveBeenCalledTimes(1);

    unlisten2();
  });

  it('unlisten cancels a pending refresh and detaches the listener', async () => {
    const unlisten = await startNoteCreatedSync();

    captured!(noteCreatedEvent(7));
    unlisten();
    vi.advanceTimersByTime(500);

    expect(loadSpy).not.toHaveBeenCalled();
    expect(unlistenSpy).toHaveBeenCalledTimes(1);
  });
});
