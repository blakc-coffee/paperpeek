import { describe, expect, it } from 'vitest';
import { enabledPatterns, originPattern } from './sites';

describe('originPattern', () => {
  it('maps web pages to a per-host pattern and rejects the rest', () => {
    expect(originPattern('https://en.wikipedia.org/wiki/Softmax_function#x')).toBe('https://en.wikipedia.org/*');
    expect(originPattern('http://localhost:5173/post')).toBe('http://localhost/*');
    expect(originPattern('chrome://extensions')).toBeNull();
    expect(originPattern(undefined)).toBeNull();
  });
});

describe('enabledPatterns', () => {
  it('keeps per-host grants, dropping built-in arXiv hosts and wildcards', () => {
    expect(
      enabledPatterns([
        'https://lilianweng.github.io/*',
        'https://arxiv.org/*',
        'https://*/*',
        'https://en.wikipedia.org/*',
        'https://en.wikipedia.org/*',
      ]),
    ).toEqual(['https://en.wikipedia.org/*', 'https://lilianweng.github.io/*']);
    expect(enabledPatterns(undefined)).toEqual([]);
  });
});
