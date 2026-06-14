import { describe, it, expect } from 'vitest';
import { WINDOW_LAYOUT_MODES, normalizeLayoutMode, nextLayoutMode } from './layoutMode';

describe('normalizeLayoutMode', () => {
  it('passes through each canonical window mode', () => {
    for (const mode of WINDOW_LAYOUT_MODES) {
      expect(normalizeLayoutMode(mode)).toBe(mode);
    }
  });

  it('maps legacy density values to floating', () => {
    expect(normalizeLayoutMode('comfortable')).toBe('floating');
    expect(normalizeLayoutMode('compact')).toBe('floating');
  });

  it('maps unknown, empty, and nullish values to floating', () => {
    expect(normalizeLayoutMode('bogus')).toBe('floating');
    expect(normalizeLayoutMode('')).toBe('floating');
    expect(normalizeLayoutMode(null)).toBe('floating');
    expect(normalizeLayoutMode(undefined)).toBe('floating');
  });
});

describe('nextLayoutMode', () => {
  it('cycles Floating → Half-screen → Full-screen → Floating', () => {
    expect(nextLayoutMode('floating')).toBe('half-screen');
    expect(nextLayoutMode('half-screen')).toBe('full-screen');
    expect(nextLayoutMode('full-screen')).toBe('floating');
  });

  it('treats a legacy or unknown value as floating (next is half-screen)', () => {
    expect(nextLayoutMode('comfortable')).toBe('half-screen');
    expect(nextLayoutMode('compact')).toBe('half-screen');
    expect(nextLayoutMode(undefined)).toBe('half-screen');
  });
});
