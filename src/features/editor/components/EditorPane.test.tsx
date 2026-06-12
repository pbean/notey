import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockInvoke } from '../../../test-utils/setup';
import { buildNote } from '../../../test-utils/factories';
import { useTabStore } from '../../tabs/store';
import { useEditorStore } from '../store';
import { flushSave } from '../hooks/useAutoSave';
import { EditorPane } from './EditorPane';

const setStateSpy = vi.fn();

vi.mock('@codemirror/state', () => {
  class Compartment {
    reconfigure(value: unknown) {
      return value;
    }
  }

  return {
    Compartment,
    EditorState: {
      create: vi.fn(({ doc = '' }: { doc?: string }) => ({
        doc: { toString: () => doc },
      })),
    },
  };
});

vi.mock('@codemirror/view', () => {
  class EditorView {
    static lineWrapping = {};

    state: { doc: { toString: () => string } };
    scrollDOM = {
      scrollTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    constructor({ state }: { state: { doc: { toString: () => string } } }) {
      this.state = state;
    }

    setState(state: { doc: { toString: () => string } }) {
      this.state = state;
      setStateSpy(state.doc.toString());
    }

    dispatch() {}

    focus() {}

    destroy() {}
  }

  return { EditorView };
});

vi.mock('@codemirror/lang-markdown', () => ({
  markdown: vi.fn(() => ({})),
}));

vi.mock('../extensions', () => ({
  buildExtensions: vi.fn(() => ({
    extensions: [],
    langCompartment: { reconfigure: vi.fn(() => ({})) },
  })),
}));

vi.mock('../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
  flushSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hooks/useNoteHydration', () => ({
  useNoteHydration: vi.fn(),
}));

vi.mock('../hooks/useWindowFocus', () => ({
  useWindowFocus: vi.fn(),
}));

vi.mock('../../session/persistence', () => ({
  queueSessionSave: vi.fn(),
}));

describe('EditorPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    useEditorStore.getState().resetNote();
    useTabStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the right neighbor when closing the active tab at the same index', async () => {
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'get_note' && args?.id === 1) {
        return Promise.resolve(buildNote({ id: 1, title: 'Alpha', content: 'alpha' }));
      }
      if (cmd === 'get_note' && args?.id === 2) {
        return Promise.resolve(buildNote({ id: 2, title: 'Beta', content: 'beta' }));
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'Alpha' },
        { noteId: 2, title: 'Beta' },
      ],
      activeTabIndex: 0,
    });

    render(<EditorPane />);

    await vi.waitFor(() => {
      expect(useEditorStore.getState().activeNoteId).toBe(1);
      expect(useEditorStore.getState().content).toBe('alpha');
    });

    useTabStore.getState().closeTabByNoteId(1);

    await vi.waitFor(() => {
      expect(flushSave).toHaveBeenCalledTimes(1);
      expect(useEditorStore.getState().activeNoteId).toBe(2);
      expect(useEditorStore.getState().content).toBe('beta');
    });
  });
});
