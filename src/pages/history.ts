import type { HistoryIndex, Incident, Maintenance, Service, UptimeHistory } from '../types/status';
import { dataUrl, formatDate, incidentCard, layout, maintenanceCard, serviceName, uptimeLevel } from './shared';
import { escapeHtml } from '../utils/status';
import { messages, t } from '../i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout(`${t('uptimeHistory')} · PulseStatus`, `<section class="hero"><div><p class="eyebrow">${t('serviceStatus')}</p><h1>${t('uptimeHistory')}</h1><p class="muted">${t('uptimeIntro')}</p></div></section><section id="uptime-section" aria-labelledby="uptime-heading"><div class="section-heading"><div><p class="eyebrow">${t('uptimeLegend')}</p><h2 id="uptime-heading">${t('uptimeHistory')}</h2></div><span id="uptime-as-of" class="section-note"></span></div><div id="uptime-history" class="uptime-grid" aria-live="polite"><p class="card muted">${t('loadingHistory')}</p></div></section><section aria-labelledby="incidents-heading"><div class="section-heading"><div><p class="eyebrow">${t('resolvedEvents')}</p><h2 id="incidents-heading">${t('incidentHistory')}</h2></div></div><div class="filter-bar"><input id="history-search" type="search" placeholder="${escapeHtml(t('searchIncidents'))}" aria-label="${escapeHtml(t('searchIncidents'))}"><select id="history-severity" aria-label="${escapeHtml(t('severityFilter'))}"><option value="">${escapeHtml(t('allSeverities'))}</option><option value="critical">${escapeHtml(messages.severity.critical)}</option><option value="major">${escapeHtml(messages.severity.major)}</option><option value="minor">${escapeHtml(messages.severity.minor)}</option></select><button id="export-csv" class="section-button" type="button">${escapeHtml(t('exportCsv'))}</button></div><div id="history-status" aria-live="polite" class="muted">${t('loadingHistory')}</div><div id="months" class="incident-list"></div><button id="load-more" class="load-more" type="button" hidden>${t('loadMore')}</button></section>`);

let index: HistoryIndex;
let serviceCatalog: Service[] = [];
let uptimeData: UptimeHistory | null = null;
let cursor = 0;
const pageSize = Math.max(1, window.PulseStatusConfig?.history?.monthsPerLoad ?? 3);
const loaded = new Set<string>();
const monthData = new Map<string, { month: string; incidents: Incident[]; maintenance: Maintenance[] }>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load history (${response.status})`);
  return response.json() as Promise<T>;
}

function matchesFilters(incident: Incident, query: string, severity: string): boolean {
  if (severity && incident.severity !== severity) return false;
  if (!query) return true;
  const haystack = `${incident.title} ${incident.bodySummary}`.toLowerCase();
  return haystack.includes(query);
}

function monthSummary(month: string, incidents: Incident[], maintenance: Maintenance[]): string {
  const counts = { critical: 0, major: 0, minor: 0 };
  incidents.forEach((incident) => { counts[incident.severity] += 1; });
  const parts: string[] = [];
  (['critical', 'major', 'minor'] as const).forEach((severity) => {
    if (counts[severity]) parts.push(`<span><span class="dot ${severity}"></span>${counts[severity]} ${escapeHtml(messages.severity[severity])}</span>`);
  });
  if (maintenance.length) parts.push(`<span><span class="dot maintenance"></span>${maintenance.length} ${escapeHtml(t('maintenance'))}</span>`);
  if (uptimeData) {
    const dayValues = uptimeData.days
      .filter((day) => day.date.startsWith(month))
      .flatMap((day) => Object.values(day.services))
      .filter((value): value is number => typeof value === 'number');
    if (dayValues.length) parts.push(`<span>${escapeHtml(t('uptimeDay'))} ${month}: ${Math.min(...dayValues).toFixed(3)}%</span>`);
  }
  return parts.join('');
}

function renderMonths(): void {
  const query = (document.querySelector<HTMLInputElement>('#history-search')?.value ?? '').trim().toLowerCase();
  const severity = document.querySelector<HTMLSelectElement>('#history-severity')?.value ?? '';
  const container = document.querySelector('#months')!;
  const sections = [...monthData.values()].map(({ month, incidents, maintenance }) => {
    const visibleIncidents = incidents.filter((incident) => matchesFilters(incident, query, severity));
    const visibleMaintenance = query
      ? maintenance.filter((item) => `${item.title}`.toLowerCase().includes(query))
      : maintenance;
    const body = `${visibleIncidents.map((incident) => incidentCard(incident, serviceCatalog)).join('')}${visibleMaintenance.map((item) => maintenanceCard(item, serviceCatalog)).join('')}`;
    const summary = monthSummary(month, incidents, maintenance);
    return `<section class="month-group"><div class="section-heading"><h2>${month}</h2><span class="muted">${incidents.length} ${t('incidentsInMonth')}${maintenance.length ? ` · ${maintenance.length} ${t('maintenanceInMonth')}` : ''}</span></div>${summary ? `<div class="month-summary">${summary}</div>` : ''}${body || `<p class="card empty">${t('noIncidentsInMonth')}</p>`}</section>`;
  });
  container.innerHTML = sections.join('');
}

async function loadNext(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('#load-more')!;
  button.disabled = true;
  document.querySelector('#history-status')!.textContent = t('loadingOlder');
  const months = index.months.slice(cursor, cursor + pageSize);
  try {
    await Promise.all(months.filter((month) => !loaded.has(month.month)).map(async (month) => {
      const data = await fetchJson<{ incidents: Incident[]; maintenance?: Maintenance[] }>(dataUrl(month.url.replace(/^\.\/data\//, '').replace(/^\.?\//, '')));
      loaded.add(month.month);
      monthData.set(month.month, { month: month.month, incidents: data.incidents, maintenance: data.maintenance ?? [] });
    }));
    cursor += months.length;
    renderMonths();
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
    document.querySelector('#history-search')!.addEventListener('input', renderMonths);
    document.querySelector('#history-severity')!.addEventListener('change', renderMonths);
    document.querySelector('#export-csv')!.addEventListener('click', exportCsv);
  } catch (error) {
    document.querySelector('#history-status')!.innerHTML = `<span class="error">${t('historyUnavailable')}</span>`;
    console.error(error);
  }
}

async function exportCsv(): Promise<void> {
  try {
    const uptime = uptimeData ?? await fetchJson<UptimeHistory>(dataUrl('uptime.json'));
    const ids = serviceCatalog.map((service) => service.id);
    const lines = [`date,${ids.join(',')}`];
    uptime.days.forEach((day) => lines.push(`${day.date},${ids.map((id) => day.services[id] ?? '').join(',')}`));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'uptime.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error(error);
  }
}

function uptimeLevelLabel(uptime: number): string {
  return uptimeLevel(uptime);
}

async function loadUptime(): Promise<void> {
  try {
    const [uptime, services] = await Promise.all([
      fetchJson<UptimeHistory>(dataUrl('uptime.json')),
      fetchJson<{ services: Service[] }>(dataUrl('services.json')),
    ]);
    uptimeData = uptime;
    document.querySelector('#uptime-as-of')!.textContent = `${t('uptimeAsOf')}: ${formatDate(uptime.generatedAt)}`;
    const cards = services.services.map((service) => {
      const dailyUptime = uptime.days.map((day) => day.services[service.id]).filter((value): value is number => typeof value === 'number');
      const average = dailyUptime.reduce((total, value) => total + value, 0) / dailyUptime.length;
      const cells = uptime.days.map((day) => {
        const value = day.services[service.id];
        if (typeof value !== 'number') return '';
        const label = `${t('uptimeDay')} ${day.date}: ${value.toFixed(3)}%`;
        return `<span class="uptime-day has-tooltip" data-level="${uptimeLevelLabel(value)}" data-tooltip="${escapeHtml(label)}" tabindex="0" aria-label="${escapeHtml(label)}"></span>`;
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
