import type { HistoryIndex, Incident } from '../types/status';
import { dataUrl, formatDate, incidentCard, layout } from './shared';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout('History · PulseStatus', '<section class="hero"><div><p class="muted">Resolved events</p><h1>Incident history</h1><p class="muted">Events are grouped by the UTC month in which they started.</p></div></section><div id="history-status" aria-live="polite" class="muted">Loading history…</div><div id="months" class="incident-list"></div><button id="load-more" class="load-more" type="button" hidden>Load more</button>');

let index: HistoryIndex;
let cursor = 0;
const loaded = new Set<string>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load history (${response.status})`);
  return response.json() as Promise<T>;
}

async function loadNext(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('#load-more')!;
  button.disabled = true;
  document.querySelector('#history-status')!.textContent = 'Loading older months…';
  const months = index.months.slice(cursor, cursor + 3);
  try {
    const results = await Promise.all(months.filter((month) => !loaded.has(month.month)).map(async (month) => {
      const data = await fetchJson<{ incidents: Incident[] }>(dataUrl(month.url.replace(/^\.\/data\//, '').replace(/^\.?\//, '')));
      loaded.add(month.month);
      return { ...month, incidents: data.incidents };
    }));
    results.forEach(({ month, count, incidents }) => {
      const section = document.createElement('section');
      section.className = 'month-group';
      section.innerHTML = `<div class="section-heading"><h2>${month}</h2><span class="muted">${count} incident${count === 1 ? '' : 's'}</span></div>${incidents.map(incidentCard).join('') || '<p class="card empty">No incidents in this month.</p>'}`;
      document.querySelector('#months')!.append(section);
    });
    cursor += months.length;
    document.querySelector('#history-status')!.textContent = 'History loaded.';
  } catch (error) {
    document.querySelector('#history-status')!.innerHTML = '<span class="error">This part of history could not be loaded. Try again.</span>';
    console.error(error);
  } finally {
    button.disabled = false;
    button.hidden = cursor >= index.months.length;
  }
}

async function init(): Promise<void> {
  try {
    index = await fetchJson<HistoryIndex>(dataUrl('history-index.json'));
    await loadNext();
    document.querySelector<HTMLButtonElement>('#load-more')!.addEventListener('click', () => void loadNext());
  } catch (error) {
    document.querySelector('#history-status')!.innerHTML = '<span class="error">History is temporarily unavailable.</span>';
    console.error(error);
  }
}
void init();
