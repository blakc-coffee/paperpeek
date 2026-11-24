import { JUMP_MESSAGE, SYMBOLS_MESSAGE, type SymbolRow } from '../../ui/symbol-list';

const list = document.getElementById('list')!;
const paper = document.getElementById('paper')!;
const filter = document.getElementById('filter') as HTMLInputElement;
let rows: SymbolRow[] = [];
let tabId: number | undefined;

function empty(text: string): void {
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = text;
  list.replaceChildren(p);
}

function render(): void {
  const q = filter.value.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.key.toLowerCase().includes(q) || (r.gloss ?? '').toLowerCase().includes(q)) : rows;
  if (!rows.length) return empty('No symbols found on this page.');
  if (!shown.length) return empty(`No symbols match “${filter.value.trim()}”.`);
  // Group by section in reading order.
  const groups = new Map<string, SymbolRow[]>();
  for (const row of shown) {
    const name = row.section || 'Other';
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  list.replaceChildren(
    ...[...groups].map(([section, items]) => {
      const block = document.createElement('section');
      const h = document.createElement('h2');
      h.textContent = section;
      const ul = document.createElement('ul');
      for (const row of items) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'row';
        button.title = row.sentence || 'Jump to its first use';
        button.setAttribute('aria-label', `${row.key}: ${row.gloss ?? 'not defined'}. Jump to ${row.gloss ? 'definition' : 'first use'}`);
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = row.key;
        const gloss = document.createElement('span');
        gloss.className = row.gloss ? 'gloss' : 'gloss missing';
        gloss.textContent = row.gloss ?? 'Not defined in the text';
        const count = document.createElement('span');
        count.className = 'count';
        count.textContent = `×${row.count}`;
        button.append(key, gloss, count);
        button.addEventListener('click', () => {
          if (tabId !== undefined) void browser.tabs.sendMessage(tabId, { type: JUMP_MESSAGE, order: row.order });
        });
        li.appendChild(button);
        ul.appendChild(li);
      }
      block.append(h, ul);
      return block;
    }),
  );
}

async function load(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  paper.textContent = '';
  rows = [];
  try {
    const reply = (await browser.tabs.sendMessage(tabId!, { type: SYMBOLS_MESSAGE })) as { title: string; rows: SymbolRow[] } | undefined;
    if (!reply) throw new Error('no reply');
    rows = reply.rows;
    paper.textContent = reply.title;
    render();
  } catch {
    // No PaperPeek content script on this tab.
    empty('Open an arXiv HTML paper, or a site you enabled from the toolbar button, then press Refresh.');
  }
}

filter.addEventListener('input', render);
filter.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    filter.value = '';
    render();
  }
});
document.getElementById('refresh')!.addEventListener('click', () => void load());
browser.tabs.onActivated.addListener(() => void load());
browser.tabs.onUpdated.addListener((id, info) => {
  if (id === tabId && info.status === 'complete') void load();
});
void load();
