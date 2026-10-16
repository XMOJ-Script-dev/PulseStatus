import type { Incident, Maintenance, Service, UptimeHistory } from '../types/status';
import { dataUrl, formatDate, incidentCard, layout, serviceName } from './shared';
import { escapeHtml } from '../utils/status';
import { language, statusLabel, t } from '../i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout(`${t('serviceDetails')} · PulseStatus`, `<div id="service-content" class="card">${t('loadingHistory')}</div>`);
const serviceId = new URLSearchParams(location.search).get('id');

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(dataUrl(path));
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json() as Promise<T>;
}

function uptimeLevel(uptime: number): string {
  if (uptime >= 99.9) return 'excellent';
  if (uptime >= 99) return 'good';
  if (uptime >= 95) return 'fair';
  if (uptime >= 90) return 'low';
  if (uptime >= 75) return 'poor';
  return 'critical';
}

async function init(): Promise<void> {
  try {
    const [servicesData, uptime, incidentsData, maintenanceData] = await Promise.all([
      fetchJson<{ services: Service[] }>('services.json'),
      fetchJson<UptimeHistory>('uptime.json'),
      fetchJson<{ incidents: Incident[] }>('incidents-all.json'),
      fetchJson<{ maintenance: Maintenance[] }>('maintenance.json'),
    ]);
    const service = servicesData.services.find((item) => item.id === serviceId);
    if (!service) {
      document.querySelector('#service-content')!.innerHTML = `<div class="empty"><h1>${t('incidentNotFound')}</h1><p>${t('noServiceData')}</p></div>`;
      return;
    }
    const name = serviceName(service);
    document.title = `${name} · PulseStatus`;
    const daily = uptime.days.map((day) => day.services[service.id]).filter((value): value is number => typeof value === 'number');
    const average = daily.length ? daily.reduce((total, value) => total + value, 0) / daily.length : null;
    const cells = uptime.days.map((day) => {
      const value = day.services[service.id];
      if (typeof value !== 'number') return '';
      const label = `${t('uptimeDay')} ${day.date}: ${value.toFixed(3)}%`;
      return `<span class="uptime-day" data-level="${uptimeLevel(value)}" title="${label}" aria-label="${label}"></span>`;
    }).join('');
    const incidents = incidentsData.incidents.filter((incident) => incident.serviceIds.includes(service.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const maintenance = maintenanceData.maintenance.filter((item) => item.serviceIds.includes(service.id)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    const maintenanceCards = maintenance.map((item) => `<article class="card incident-card"><div class="incident-meta"><span class="pill">${escapeHtml(statusLabel(item.state))}</span></div><h3>${escapeHtml(item.title)}</h3><p class="muted">${formatDate(item.startsAt)} → ${formatDate(item.endsAt)}</p><a href="${escapeHtml(item.url)}" rel="noreferrer">${t('viewOnGithub')}</a></article>`).join('');
    const description = service.descriptionI18n?.[language] ?? service.descriptionI18n?.[language.split('-')[0]] ?? service.description;
    document.querySelector('#service-content')!.outerHTML = `<div class="service-detail"><a class="back-link" href="${import.meta.env.BASE_URL}">← ${t('overview')}</a><section class="service-detail-header"><div><p class="eyebrow">${t('serviceDetails')}</p><h1>${escapeHtml(name)}</h1><p class="muted">${escapeHtml(description)}</p></div><span class="pill ${service.status.replace('_', '-')}">${escapeHtml(statusLabel(service.status))}</span></section><dl class="detail-list"><div><dt>${t('uptimeAverage')}</dt><dd>${average === null ? t('limitedMonitoring') : `${average.toFixed(3)}%`}</dd></div><div><dt>${t('checked')}</dt><dd>${service.lastCheckedAt ? formatDate(service.lastCheckedAt) : t('manualMonitoring')}</dd></div>${service.publicUrl ? `<div><dt>URL</dt><dd><a href="${escapeHtml(service.publicUrl)}" rel="noreferrer">${escapeHtml(service.publicUrl)}</a></dd></div>` : ''}</dl><section class="service-detail-section"><div class="section-heading"><h2>${t('uptimeHistory')}</h2><span class="section-note">${t('uptimeAsOf')}: ${formatDate(uptime.generatedAt)}</span></div><div class="uptime-days uptime-detail-grid" role="img" aria-label="${t('uptimeLegend')} — ${escapeHtml(name)}">${cells}</div></section><section class="service-detail-section"><h2>${t('relatedIncidents')}</h2><div class="incident-list">${incidents.map(incidentCard).join('') || `<p class="card empty">${t('noRelatedIncidents')}</p>`}</div></section><section class="service-detail-section"><h2>${t('relatedMaintenance')}</h2><div class="incident-list">${maintenanceCards || `<p class="card empty">${t('noRelatedMaintenance')}</p>`}</div></section></div>`;
  } catch (error) {
    document.querySelector('#service-content')!.innerHTML = `<div class="error">${t('uptimeUnavailable')}</div>`;
    console.error(error);
  }
}
void init();
