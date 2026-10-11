import type { Incident, Service, Summary } from '../types/status';
import { sortIncidents } from '../utils/status';
import { dataUrl, formatDate, incidentCard, layout, serviceCard, statusClass } from './shared';
import { statusLabel, t } from '../i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout('PulseStatus', `<section class="hero"><div><p class="muted">${t('serviceStatus')}</p><h1>PulseStatus</h1><p class="muted">${t('tagline')}</p></div></section><div id="status" class="status-banner unknown" aria-live="polite"><span class="status-dot"></span><strong>${t('limitedMonitoring')}</strong></div><section><div class="section-heading"><h2>${t('activeIncidents')}</h2><span id="incident-count" class="muted"></span></div><div id="incidents" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section><section><div class="section-heading"><h2>${t('services')}</h2></div><div id="services" class="service-grid"><p class="card muted">${t('limitedMonitoring')}…</p></div></section>`);

async function load<T>(path: string): Promise<T> {
  const response = await fetch(dataUrl(path));
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json() as Promise<T>;
}

async function render(): Promise<void> {
  try {
    const [summary, incidents, services] = await Promise.all([
      load<Summary>('summary.json'),
      load<{ schemaVersion: 1; generatedAt: string; incidents: Incident[] }>('incidents-active.json'),
      load<{ schemaVersion: 1; generatedAt: string; services: Service[] }>('services.json'),
    ]);
    const status = document.querySelector<HTMLDivElement>('#status')!;
    status.className = `status-banner ${statusClass(summary)}`;
    status.innerHTML = `<span class="status-dot"></span><div><strong>${statusLabel(summary.overall)}</strong><div class="muted">${t('updated')} ${formatDate(summary.generatedAt)}</div></div>`;
    const active = sortIncidents(incidents.incidents.filter((incident) => incident.isActive));
    document.querySelector('#incident-count')!.textContent = `${active.length} ${t('active')}`;
    document.querySelector('#incidents')!.innerHTML = active.length ? active.map(incidentCard).join('') : `<p class="card empty">${t('noActiveIncidents')}</p>`;
    document.querySelector('#services')!.innerHTML = services.services.length ? services.services.map(serviceCard).join('') : '<p class="card empty">No service data available</p>';
  } catch (error) {
    document.querySelector('#status')!.outerHTML = `<div class="status-banner unknown error" role="alert"><span class="status-dot"></span><strong>${t('statusUnavailable')}</strong></div>`;
    document.querySelector('#incidents')!.innerHTML = `<p class="card error">${t('dataUnavailable')}</p>`;
    document.querySelector('#services')!.innerHTML = '';
    console.error(error);
  }
}
void render();
