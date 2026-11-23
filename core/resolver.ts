// Map pages about an arXiv paper (abstract page, PDF, Hugging Face Papers,
// alphaXiv) to its arXiv HTML version, where PaperPeek works best.

// New-style ids (2101.00001, optional version) and old-style (hep-th/9901001, cs.LG/0101001).
const ID = String.raw`(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)`;

const PATTERNS: Array<[host: RegExp, path: RegExp]> = [
  [/^(?:www\.)?arxiv\.org$/, new RegExp(String.raw`^\/(?:abs|pdf)\/${ID}(?:\.pdf)?\/?$`)],
  [/^(?:www\.)?alphaxiv\.org$/, new RegExp(String.raw`^\/(?:[a-z]{2}\/)?abs\/${ID}\/?$`)],
  [/^huggingface\.co$/, new RegExp(String.raw`^\/papers\/${ID}\/?$`)],
];

/** The arXiv id this URL is about, or null. */
export function arxivIdFrom(url: string): string | null {
  if (!URL.canParse(url)) return null;
  const { hostname, pathname } = new URL(url);
  for (const [host, path] of PATTERNS) {
    if (!host.test(hostname)) continue;
    const id = path.exec(pathname)?.[1];
    if (id) return id;
  }
  return null;
}

export const arxivHtmlUrl = (id: string): string => `https://arxiv.org/html/${id}`;
