import { describe, it, expect } from 'vitest';
import { buildExtensions } from './extensions';

describe('buildExtensions', () => {
  const stubCallbacks = {
    onEscape: () => {},
    onDocChanged: () => {},
    onSessionActivity: () => {},
  };

  it('returns an extensions array and a langCompartment', () => {
    const result = buildExtensions('markdown', stubCallbacks);
    expect(result.extensions).toBeInstanceOf(Array);
    expect(result.extensions.length).toBeGreaterThan(0);
    expect(result.langCompartment).toBeDefined();
  });

  it('creates a unique Compartment per call', () => {
    const result1 = buildExtensions('markdown', stubCallbacks);
    const result2 = buildExtensions('markdown', stubCallbacks);
    expect(result1.langCompartment).not.toBe(result2.langCompartment);
  });

  it('accepts plaintext format without error', () => {
    const result = buildExtensions('plaintext', stubCallbacks);
    expect(result.extensions).toBeInstanceOf(Array);
    expect(result.extensions.length).toBeGreaterThan(0);
  });
});
