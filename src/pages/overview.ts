import type { Incident, Maintenance, Service, Summary } from '../types/status';
import { sortIncidents } from '../utils/status';
import { base, dataUrl, formatDate, incidentCard, layout, maintenanceCard, serviceCard, statusClass } from './shared';
import { language, statusLabel, t } from '../i18n';
import { escapeHtml } from '../utils/status';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout('PulseStatus', `<section class="hero hero-enterprise"><div class="hero-copy"><p class="eyebrow">${t('publicStatus')}</p><h1>PulseStatus</h1><p class="hero-lede">${t('tagline')}</p><p class="trust-line"><span class="trust-check">✓</span>${t('trustedUpdates')}</p></div><div class="hero-aside"><span class="hero-aside-label">${t('liveSnapshot')}</span><strong>${t('incidentCenter')}</strong><a href="${base}history.html">${t('history')} →</a></div></section><div id="status" class="status-banner unknown" aria-live="polite"><span class="status-dot"></span><div><strong>${t('limitedMonitoring')}</strong><span class="status-context">${t('dataFreshness')}</span></div></div><section><div class="section-heading"><div><p class="eyebrow">${t('incidentCenter')}</p><h2>${t('activeIncidents')}</h2></div><div class="section-actions"><span id="incident-count" class="section-count"></span><a class="section-button" href="${base}history.html">${t('viewAllIncidents')}</a></div></div><div id="incidents" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section><section><div class="section-heading"><div><p class="eyebrow">${t('maintenanceCenter')}</p><h2>${t('maintenance')}</h2></div><span id="maintenance-count" class="section-count"></span></div><div id="maintenance" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section><section><div class="section-heading"><div><p class="eyebrow">${t('serviceDirectory')}</p><h2>${t('services')}</h2></div><span class="section-note">${t('source')}: ${t('githubIssues')}</span></div><div id="services" class="service-directory"><p class="card muted">${t('limitedMonitoring')}…</p></div></section>`);

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
    const visibleMaintenance = [...maintenance.maintenance].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    document.querySelector('#maintenance-count')!.textContent = `${visibleMaintenance.length} ${t('maintenanceItems')}`;
    document.querySelector('#maintenance')!.innerHTML = visibleMaintenance.length ? visibleMaintenance.map((item) => maintenanceCard(item, services.services)).join('') : `<p class="card empty">${t('noMaintenance')}</p>`;
    const site = window.PulseStatusConfig;
    const groupConfig = site?.serviceGroups ?? {};
    const parentByGroup = new Map<string, string | undefined>();
    services.services.filter((service) => service.group).forEach((service) => parentByGroup.set(service.group!, service.parentGroup ?? groupConfig[service.group!]?.parentGroup));
    const groupLabel = (group: string): string => groupConfig[group]?.nameI18n?.[language] ?? groupConfig[group]?.nameI18n?.[language.split('-')[0]] ?? groupConfig[group]?.name ?? group;
    const renderGroup = (group: string, depth: number, visiting: Set<string>): string => {
      if (visiting.has(group)) return '';
      const members = services.services.filter((service) => service.group === group);
      const children = [...parentByGroup.entries()].filter(([name, parent]) => parent === group).map(([name]) => name).sort();
      const nested = children.map((child) => renderGroup(child, depth + 1, new Set([...visiting, group]))).join('');
      const expanded = groupConfig[group]?.defaultExpanded !== false;
      return `<details class="service-group" data-depth="${depth}"${expanded ? ' open' : ''}><summary>${escapeHtml(groupLabel(group))}</summary><div class="service-group-content">${members.length ? `<div class="service-grid">${members.map((service) => serviceCard(service, active)).join('')}</div>` : ''}${nested}</div></details>`;
    };
    const roots = [...parentByGroup.keys()].filter((group) => !parentByGroup.get(group) || !parentByGroup.has(parentByGroup.get(group)!)).sort();
    const ungrouped = services.services.filter((service) => !service.group);
    document.querySelector('#services')!.innerHTML = services.services.length ? `${ungrouped.length ? `<div class="service-grid">${ungrouped.map((service) => serviceCard(service, active)).join('')}</div>` : ''}${roots.map((group) => renderGroup(group, 0, new Set())).join('')}` : '<p class="card empty">No service data available</p>';
  } catch (error) {
    document.querySelector('#status')!.outerHTML = `<div class="status-banner unknown error" role="alert"><span class="status-dot"></span><strong>${t('statusUnavailable')}</strong></div>`;
    document.querySelector('#incidents')!.innerHTML = `<p class="card error">${t('dataUnavailable')}</p>`;
    document.querySelector('#services')!.innerHTML = '';
    document.querySelector('#maintenance')!.innerHTML = `<p class="card error">${t('dataUnavailable')}</p>`;
    console.error(error);
  }
}
void render();
