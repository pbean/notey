import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

/**
 * Per-test mock handler for Tauri IPC invoke calls.
 * Override in individual tests via `mockInvoke.mockImplementation(...)`.
 */
export const mockInvoke = vi.fn().mockRejectedValue(new Error('unmocked invoke call'));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

/** Reset the invoke mock between tests to prevent bleed. */
beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockRejectedValue(new Error('unmocked invoke call'));
});
