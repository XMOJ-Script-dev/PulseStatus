import type { HistoryIndex, Incident } from '../types/status';
import { dataUrl, formatDate, incidentCard, layout } from './shared';
import { t } from '../i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout(`${t('incidentHistory')} · PulseStatus`, `<section class="hero"><div><p class="muted">${t('resolvedEvents')}</p><h1>${t('incidentHistory')}</h1><p class="muted">${t('historyIntro')}</p></div></section><div id="history-status" aria-live="polite" class="muted">${t('loadingHistory')}</div><div id="months" class="incident-list"></div><button id="load-more" class="load-more" type="button" hidden>${t('loadMore')}</button>`);

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
  document.querySelector('#history-status')!.textContent = t('loadingOlder');
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
      section.innerHTML = `<div class="section-heading"><h2>${month}</h2><span class="muted">${count} ${t('incidentsInMonth')}</span></div>${incidents.map(incidentCard).join('') || `<p class="card empty">${t('noIncidentsInMonth')}</p>`}`;
      document.querySelector('#months')!.append(section);
    });
    cursor += months.length;
    document.querySelector('#history-status')!.textContent = t('historyLoaded');
  } catch (error) {
    document.querySelector('#history-status')!.innerHTML = `<span class="error">${t('historyLoadFailed')}</span>`;
    console.error(error);
  } finally {
    button.disabled = false;
    button.hidden = cursor >= index.months.length;
  }
}

async function init(): Promise<void> {
  try {
    index = await fetchJson<HistoryIndex>(dataUrl('history-index.json'));
    if (index.months.length === 0) {
      document.querySelector('#history-status')!.textContent = '';
      document.querySelector('#months')!.innerHTML = `<p class="card empty">${t('noHistory')}</p>`;
      return;
    }
    await loadNext();
    document.querySelector<HTMLButtonElement>('#load-more')!.addEventListener('click', () => void loadNext());
  } catch (error) {
    document.querySelector('#history-status')!.innerHTML = `<span class="error">${t('historyUnavailable')}</span>`;
    console.error(error);
  }
}
void init();
