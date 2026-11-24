import { describe, expect, it, vi } from 'vitest';
import { effectiveMode } from './consent';

describe('effectiveMode', () => {
  it('leaves Chrome untouched and never asks the background', async () => {
    const granted = vi.fn(async () => false);
    expect(await effectiveMode('ask', false, granted)).toBe('ask');
    expect(await effectiveMode('always', false, granted)).toBe('always');
    expect(granted).not.toHaveBeenCalled();
  });

  it('asks for consent on Firefox until searchTerms is granted', async () => {
    expect(await effectiveMode('ask', true, async () => false)).toBe('consent');
    expect(await effectiveMode('always', true, async () => false)).toBe('consent');
    expect(await effectiveMode('ask', true, async () => true)).toBe('ask');
    expect(await effectiveMode('always', true, async () => true)).toBe('always');
  });

  it('needs no consent when lookups are off', async () => {
    const granted = vi.fn(async () => false);
    expect(await effectiveMode('never', true, granted)).toBe('never');
    expect(granted).not.toHaveBeenCalled();
  });
});
