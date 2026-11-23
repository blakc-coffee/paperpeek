// AI/ML term matching: one case-insensitive regex alternation compiled from the
// glossary, longest names first, so "multi-head attention" wins over "attention".

export interface GlossaryEntry {
  id: string;
  term: string;
  aliases?: string[];
  short: string;
  formula?: string;
  diagram?: string;
  /** Key into ui/demos DEMOS: an interactive widget behind "Try it". */
  demo?: string;
  /** Attribution for entries not written for PaperPeek (defaults: PaperPeek glossary, CC BY 4.0). */
  source?: string;
  license?: string;
  url?: string;
}

export interface TermMatch {
  start: number;
  end: number;
  entry: GlossaryEntry;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Case, hyphens, en dashes and spacing don't matter: "Self-Attention" ≡ "self attention". */
const normalize = (s: string): string => s.toLowerCase().replace(/[-–\s]+/g, ' ').trim();

export function compileMatcher(entries: readonly GlossaryEntry[]): (text: string) => TermMatch[] {
  const byName = new Map<string, GlossaryEntry>();
  for (const entry of entries) {
    for (const name of [entry.term, ...(entry.aliases ?? [])]) byName.set(normalize(name), entry);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map((n) => escape(n).replace(/ /g, '[-–\\s]+'));
  const pattern = new RegExp(`(?<![\\w-])(?:${names.join('|')})(?:e?s)?(?![\\w-])`, 'gi');

  const lookup = (found: string): GlossaryEntry | undefined => {
    const n = normalize(found);
    return byName.get(n) ?? byName.get(n.replace(/es$/, '')) ?? byName.get(n.replace(/s$/, ''));
  };

  return (text) => {
    const out: TermMatch[] = [];
    for (const m of text.matchAll(pattern)) {
      const entry = lookup(m[0]);
      if (entry) out.push({ start: m.index, end: m.index + m[0].length, entry });
    }
    return out;
  };
}
