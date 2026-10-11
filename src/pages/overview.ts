import type { Incident, Service, Summary } from '../types/status';
import { sortIncidents } from '../utils/status';
import { dataUrl, formatDate, incidentCard, layout, serviceCard, statusClass } from './shared';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout('PulseStatus', '<section class="hero"><div><p class="muted">Service status</p><h1>PulseStatus</h1><p class="muted">A clear view of current incidents and service health.</p></div></section><div id="status" class="status-banner unknown" aria-live="polite"><span class="status-dot"></span><strong>Loading status…</strong></div><section><div class="section-heading"><h2>Active incidents</h2><span id="incident-count" class="muted"></span></div><div id="incidents" class="incident-list"><p class="card muted">Loading incidents…</p></div></section><section><div class="section-heading"><h2>Services</h2></div><div id="services" class="service-grid"><p class="card muted">Loading services…</p></div></section>');

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
    status.innerHTML = `<span class="status-dot"></span><div><strong>${summary.overall.replaceAll('_', ' ')}</strong><div class="muted">Updated ${formatDate(summary.generatedAt)}</div></div>`;
    const active = sortIncidents(incidents.incidents.filter((incident) => incident.isActive));
    document.querySelector('#incident-count')!.textContent = `${active.length} active`;
    document.querySelector('#incidents')!.innerHTML = active.length ? active.map(incidentCard).join('') : '<p class="card empty">No active incidents</p>';
    document.querySelector('#services')!.innerHTML = services.services.length ? services.services.map(serviceCard).join('') : '<p class="card empty">No service data available</p>';
  } catch (error) {
    document.querySelector('#status')!.outerHTML = '<div class="status-banner unknown error" role="alert"><span class="status-dot"></span><strong>Status temporarily unavailable</strong></div>';
    document.querySelector('#incidents')!.innerHTML = '<p class="card error">Status data could not be loaded. Please try again later.</p>';
    document.querySelector('#services')!.innerHTML = '';
    console.error(error);
  }
}
void render();
