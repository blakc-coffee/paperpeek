import { describe, expect, it } from 'vitest';
import { arxivHtmlUrl, arxivIdFrom } from './resolver';

describe('arxivIdFrom', () => {
  it.each([
    ['https://arxiv.org/abs/1706.03762', '1706.03762'],
    ['https://arxiv.org/abs/1706.03762v7', '1706.03762v7'],
    ['https://arxiv.org/pdf/2106.09685v2.pdf', '2106.09685v2'],
    ['https://www.alphaxiv.org/abs/2006.11239', '2006.11239'],
    ['https://www.alphaxiv.org/overview/2006.11239', null],
    ['https://huggingface.co/papers/2305.18290', '2305.18290'],
    ['https://arxiv.org/abs/hep-th/9901001', 'hep-th/9901001'],
    ['https://arxiv.org/html/1706.03762', null],
    ['https://example.com/abs/1706.03762', null],
    ['not a url', null],
  ])('%s → %s', (url, id) => {
    expect(arxivIdFrom(url)).toBe(id);
  });

  it('builds the HTML URL', () => {
    expect(arxivHtmlUrl('1706.03762v7')).toBe('https://arxiv.org/html/1706.03762v7');
  });
});
