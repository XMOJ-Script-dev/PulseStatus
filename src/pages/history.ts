import type { HistoryIndex, Incident, Maintenance, Service, UptimeHistory } from '../types/status';
import { dataUrl, formatDate, incidentCard, layout, maintenanceCard, serviceName, uptimeLevel } from './shared';
import { escapeHtml } from '../utils/status';
import { t } from '../i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout(`${t('uptimeHistory')} · PulseStatus`, `<section class="hero"><div><p class="eyebrow">${t('serviceStatus')}</p><h1>${t('uptimeHistory')}</h1><p class="muted">${t('uptimeIntro')}</p></div></section><section id="uptime-section" aria-labelledby="uptime-heading"><div class="section-heading"><div><p class="eyebrow">${t('uptimeLegend')}</p><h2 id="uptime-heading">${t('uptimeHistory')}</h2></div><span id="uptime-as-of" class="section-note"></span></div><div id="uptime-history" class="uptime-grid" aria-live="polite"><p class="card muted">${t('loadingHistory')}</p></div></section><section aria-labelledby="incidents-heading"><div class="section-heading"><div><p class="eyebrow">${t('resolvedEvents')}</p><h2 id="incidents-heading">${t('incidentHistory')}</h2></div></div><div id="history-status" aria-live="polite" class="muted">${t('loadingHistory')}</div><div id="months" class="incident-list"></div><button id="load-more" class="load-more" type="button" hidden>${t('loadMore')}</button></section>`);

let index: HistoryIndex;
let serviceCatalog: Service[] = [];
let cursor = 0;
const pageSize = Math.max(1, window.PulseStatusConfig?.history?.monthsPerLoad ?? 3);
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
  const months = index.months.slice(cursor, cursor + pageSize);
  try {
    const results = await Promise.all(months.filter((month) => !loaded.has(month.month)).map(async (month) => {
      const data = await fetchJson<{ incidents: Incident[]; maintenance?: Maintenance[] }>(dataUrl(month.url.replace(/^\.\/data\//, '').replace(/^\.?\//, '')));
      loaded.add(month.month);
      return { ...month, incidents: data.incidents, maintenance: data.maintenance ?? [] };
    }));
    results.forEach(({ month, incidents, maintenance }) => {
      const section = document.createElement('section');
      section.className = 'month-group';
      const summary = `${incidents.length} ${t('incidentsInMonth')}${maintenance.length ? ` · ${maintenance.length} ${t('maintenanceInMonth')}` : ''}`;
      const body = `${incidents.map((incident) => incidentCard(incident, serviceCatalog)).join('')}${maintenance.map((item) => maintenanceCard(item, serviceCatalog)).join('')}`;
      section.innerHTML = `<div class="section-heading"><h2>${month}</h2><span class="muted">${summary}</span></div>${body || `<p class="card empty">${t('noIncidentsInMonth')}</p>`}`;
      document.querySelector('#months')!.append(section);
    });
    cursor += months.length;    document.querySelector('#history-status')!.textContent = t('historyLoaded');
  } catch (error) {
    document.querySelector('#history-status')!.innerHTML = `<span class="error">${t('historyLoadFailed')}</span>`;
    console.error(error);
  } finally {
    button.disabled = false;
    button.hidden = cursor >= index.months.length;
  }
}

async function init(): Promise<void> {
  void loadUptime();
  try {
    [index, { services: serviceCatalog }] = await Promise.all([
      fetchJson<HistoryIndex>(dataUrl('history-index.json')),
      fetchJson<{ services: Service[] }>(dataUrl('services.json')),
    ]);
    if (index.months.length === 0) {
      document.querySelector('#history-status')!.textContent = '';
      document.querySelector('#months')!.innerHTML = `<p class="card empty">${t('noHistory')}</p>`;
      return;
    }
    const initialBatches = Math.max(1, Math.ceil((window.PulseStatusConfig?.history?.initialMonths ?? 3) / pageSize));
    for (let batch = 0; batch < initialBatches; batch += 1) await loadNext();
    document.querySelector<HTMLButtonElement>('#load-more')!.addEventListener('click', () => void loadNext());
  } catch (error) {
    document.querySelector('#history-status')!.innerHTML = `<span class="error">${t('historyUnavailable')}</span>`;
    console.error(error);
  }
}

async function loadUptime(): Promise<void> {
  try {
    const [uptime, services] = await Promise.all([
      fetchJson<UptimeHistory>(dataUrl('uptime.json')),
      fetchJson<{ services: Service[] }>(dataUrl('services.json')),
    ]);
    document.querySelector('#uptime-as-of')!.textContent = `${t('uptimeAsOf')}: ${formatDate(uptime.generatedAt)}`;
    const cards = services.services.map((service) => {
      const dailyUptime = uptime.days.map((day) => day.services[service.id]).filter((value): value is number => typeof value === 'number');
      const average = dailyUptime.reduce((total, value) => total + value, 0) / dailyUptime.length;
      const cells = uptime.days.map((day) => {
        const value = day.services[service.id];
        if (typeof value !== 'number') return '';
        const label = `${t('uptimeDay')} ${day.date}: ${value.toFixed(3)}%`;
        return `<span class="uptime-day has-tooltip" data-level="${uptimeLevel(value)}" data-tooltip="${escapeHtml(label)}" tabindex="0" aria-label="${escapeHtml(label)}"></span>`;
      }).join('');
      return `<article class="card uptime-card"><div class="uptime-card-heading"><h3>${serviceName(service)}</h3><span><strong>${average.toFixed(3)}%</strong><small>${t('uptimeAverage')}</small></span></div><div class="uptime-days" role="group" aria-label="${t('uptimeLegend')} — ${serviceName(service)}">${cells}</div></article>`;
    });
    document.querySelector('#uptime-history')!.innerHTML = cards.length ? cards.join('') : `<p class="card empty">${t('noServiceData')}</p>`;
  } catch (error) {
    document.querySelector('#uptime-history')!.innerHTML = `<p class="card error">${t('uptimeUnavailable')}</p>`;
    console.error(error);
  }
}
void init();
