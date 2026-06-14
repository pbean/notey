import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('waits for startup config before mounting the app', async () => {
    const render = vi.fn();
    const createRoot = vi.fn(() => ({ render }));
    const applyBootTheme = vi.fn();
    let resolveStartup: (() => void) | undefined;
    const applyStartupConfig = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveStartup = resolve;
        }),
    );

    vi.doMock('react-dom/client', () => ({
      default: { createRoot },
      createRoot,
    }));
    vi.doMock('./features/command-palette/actions', () => ({
      applyBootTheme,
      applyStartupConfig,
    }));
    vi.doMock('./App', () => ({
      default: () => null,
    }));
    vi.doMock('./index.css', () => ({}));

    await import('./main');

    expect(applyBootTheme).toHaveBeenCalledTimes(1);
    expect(applyStartupConfig).toHaveBeenCalledTimes(1);
    expect(createRoot).not.toHaveBeenCalled();

    resolveStartup?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
