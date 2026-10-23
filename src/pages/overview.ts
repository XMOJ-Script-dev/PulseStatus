import type { Incident, Maintenance, Service, Summary } from '../types/status';
import { sortIncidents } from '../utils/status';
import { base, dataUrl, formatDate, incidentCard, layout, maintenanceCard, serviceCard, statusClass } from './shared';
import { statusLabel, t } from '../i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout('PulseStatus', `<section class="hero hero-enterprise"><div class="hero-copy"><p class="eyebrow">${t('publicStatus')}</p><h1>PulseStatus</h1><p class="hero-lede">${t('tagline')}</p><p class="trust-line"><span class="trust-check">✓</span>${t('trustedUpdates')}</p></div><div class="hero-aside"><span class="hero-aside-label">${t('liveSnapshot')}</span><strong>${t('incidentCenter')}</strong><a href="${base}history.html">${t('history')} →</a></div></section><div id="status" class="status-banner unknown" aria-live="polite"><span class="status-dot"></span><div><strong>${t('limitedMonitoring')}</strong><span class="status-context">${t('dataFreshness')}</span></div></div><section><div class="section-heading"><div><p class="eyebrow">${t('incidentCenter')}</p><h2>${t('activeIncidents')}</h2></div><div class="section-actions"><span id="incident-count" class="section-count"></span><a class="section-button" href="${base}history.html">${t('viewAllIncidents')}</a></div></div><div id="incidents" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section><section><div class="section-heading"><div><p class="eyebrow">${t('maintenanceCenter')}</p><h2>${t('maintenance')}</h2></div><span id="maintenance-count" class="section-count"></span></div><div id="maintenance" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section><section><div class="section-heading"><div><p class="eyebrow">${t('serviceDirectory')}</p><h2>${t('services')}</h2></div><span class="section-note">${t('source')}: ${t('githubIssues')}</span></div><div id="services" class="service-grid"><p class="card muted">${t('limitedMonitoring')}…</p></div></section>`);

async function load<T>(path: string): Promise<T> {
  const response = await fetch(dataUrl(path));
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json() as Promise<T>;
}

async function render(): Promise<void> {
  try {
    const [summary, incidents, services, maintenance] = await Promise.all([
      load<Summary>('summary.json'),
      load<{ schemaVersion: 1; generatedAt: string; incidents: Incident[] }>('incidents-active.json'),
      load<{ schemaVersion: 1; generatedAt: string; services: Service[] }>('services.json'),
      load<{ schemaVersion: 1; generatedAt: string; maintenance: Maintenance[] }>('maintenance.json'),
    ]);
    const status = document.querySelector<HTMLDivElement>('#status')!;
    status.className = `status-banner ${statusClass(summary)}`;
    const outageWithoutIncident = summary.activeIncidentCount === 0 && ['major_outage', 'partial_outage', 'degraded_performance'].includes(summary.overall);
    status.innerHTML = `<span class="status-dot"></span><div><strong>${statusLabel(summary.overall)}</strong><span class="status-context">${outageWithoutIncident ? t('noPublishedIncidentForOutage') : `${t('updated')} ${formatDate(summary.generatedAt)}`}</span></div>`;
    const active = sortIncidents(incidents.incidents.filter((incident) => incident.isActive));
    document.querySelector('#incident-count')!.textContent = `${active.length} ${t('active')}`;
    document.querySelector('#incidents')!.innerHTML = active.length ? active.map((incident) => incidentCard(incident, services.services)).join('') : `<p class="card empty"><strong>${t('noActiveIncidents')}</strong><span>${outageWithoutIncident ? t('noPublishedIncidentForOutage') : t('noIncidentsNote')}</span></p>`;
    const visibleMaintenance = maintenance.maintenance.filter((item) => item.state === 'scheduled' || item.state === 'in_progress').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    document.querySelector('#maintenance-count')!.textContent = `${visibleMaintenance.length} ${t('maintenanceItems')}`;
    document.querySelector('#maintenance')!.innerHTML = visibleMaintenance.length ? visibleMaintenance.map((item) => maintenanceCard(item, services.services)).join('') : `<p class="card empty">${t('noMaintenance')}</p>`;
    document.querySelector('#services')!.innerHTML = services.services.length ? services.services.map((service) => serviceCard(service, active)).join('') : '<p class="card empty">No service data available</p>';
  } catch (error) {
    document.querySelector('#status')!.outerHTML = `<div class="status-banner unknown error" role="alert"><span class="status-dot"></span><strong>${t('statusUnavailable')}</strong></div>`;
    document.querySelector('#incidents')!.innerHTML = `<p class="card error">${t('dataUnavailable')}</p>`;
    document.querySelector('#services')!.innerHTML = '';
    document.querySelector('#maintenance')!.innerHTML = `<p class="card error">${t('dataUnavailable')}</p>`;
    console.error(error);
  }
}
void render();
