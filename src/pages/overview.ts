import type { GroupStatus, Incident, Maintenance, Service, Summary, UptimeHistory } from '../types/status';
import { groupStatus, groupStatusRank, sortIncidents } from '../utils/status';
import { base, dataUrl, effectiveServiceStatus, formatDate, incidentCard, layout, maintenanceCard, serviceCard, serviceName, statusClass, uptimeLevel } from './shared';
import { language, statusLabel, t } from '../i18n';
import { escapeHtml } from '../utils/status';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout('PulseStatus', `<section class="hero hero-enterprise"><div class="hero-copy"><p class="eyebrow">${t('publicStatus')}</p><h1>${escapeHtml(window.PulseStatusConfig?.heroTitle ?? window.PulseStatusConfig?.name ?? 'PulseStatus')}</h1><p class="hero-lede">${escapeHtml(window.PulseStatusConfig?.tagline ?? t('tagline'))}</p><p class="trust-line"><span class="trust-check">✓</span>${t('trustedUpdates')}</p></div><div class="hero-aside"><span class="hero-aside-label">${t('liveSnapshot')}</span><strong>${t('incidentCenter')}</strong><a href="${base}history.html">${t('history')} →</a></div></section><div id="status" class="status-banner unknown" aria-live="polite"><span class="status-dot"></span><div><strong>${t('limitedMonitoring')}</strong><span class="status-context">${t('dataFreshness')}</span></div></div><div id="notices"></div><section id="announcements-section" hidden><div class="section-heading"><div><p class="eyebrow">${t('announcements')}</p><h2>${t('announcements')}</h2></div></div><div id="announcements" class="announcement-grid"></div></section><section id="active-incidents-section"><div class="section-heading"><div><p class="eyebrow">${t('incidentCenter')}</p><h2>${t('activeIncidents')}</h2></div><div class="section-actions"><span id="incident-count" class="section-count"></span><a class="section-button" href="${base}history.html">${t('viewAllIncidents')}</a></div></div><div id="incidents" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section><section id="maintenance-section"><div class="section-heading"><div><p class="eyebrow">${t('maintenanceCenter')}</p><h2>${t('maintenance')}</h2></div><div class="section-actions"><span id="maintenance-countdown" class="section-note"></span><span id="maintenance-count" class="section-count"></span><a class="section-link" href="${base}maintenance.ics">${t('subscribeCalendar')}</a></div></div><div id="maintenance" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section><section><div class="section-heading"><div><p class="eyebrow">${t('serviceDirectory')}</p><h2>${t('services')}</h2></div><span class="section-note">${t('source')}: ${t('githubIssues')}</span></div><div id="services" class="service-directory"><p class="card muted">${t('limitedMonitoring')}…</p></div><div id="external-status" class="external-status" hidden></div></section><section id="incident-history-section"><div class="section-heading"><div><p class="eyebrow">${t('resolvedEvents')}</p><h2>${t('incidentHistory')}</h2></div><a class="section-button" href="${base}history.html">${t('viewIssueHistory')}</a></div><div id="recent-incidents" class="incident-list"><p class="card muted">${t('limitedMonitoring')}…</p></div></section>`);

async function load<T>(path: string): Promise<T> {
  const response = await fetch(dataUrl(path));
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json() as Promise<T>;
}

function uptimeStrip(uptime: UptimeHistory): string {
  const cells = uptime.days.map((day) => {
    const values = Object.values(day.services).filter((value): value is number => typeof value === 'number');
    if (!values.length) return '';
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    const label = `${day.date}: ${average.toFixed(3)}%`;
    return `<span class="uptime-day has-tooltip" data-level="${uptimeLevel(average)}" data-tooltip="${escapeHtml(label)}" tabindex="0" aria-label="${escapeHtml(label)}"></span>`;
  }).join('');
  const values = uptime.days.flatMap((day) => Object.values(day.services)).filter((value): value is number => typeof value === 'number');
  const average = values.length ? (values.reduce((total, value) => total + value, 0) / values.length).toFixed(2) : null;
  return `<div class="directory-uptime"><div class="directory-uptime-heading"><span>${t('uptime90days')}</span>${average ? `<strong>${average}%</strong>` : ''}</div><div class="uptime-days directory-uptime-strip" role="group" aria-label="${t('uptime90days')}">${cells}</div></div>`;
}

async function renderAnnouncements(): Promise<void> {
  try {
    const data = await load<{ available?: boolean; announcements?: Array<{ id: string; title: string; body: string; url: string; createdAt: string; category: { name: string } }> }>('announcements.json');
    const announcements = (data.announcements ?? []).slice(0, 3);
    if (!announcements.length) return;
    document.querySelector('#announcements')!.innerHTML = announcements.map((announcement) => `<a class="card incident-card" href="${escapeHtml(announcement.url)}" rel="noreferrer"><h3>${escapeHtml(announcement.title)}</h3><p class="muted">${escapeHtml(announcement.body.slice(0, 220))}</p><small class="muted">${escapeHtml(announcement.category.name)} · ${formatDate(announcement.createdAt)}</small></a>`).join('');
    document.querySelector<HTMLElement>('#announcements-section')!.hidden = false;
  } catch { /* announcements are optional */ }
}

function countdownText(startsAt: string): string {
  const ms = new Date(startsAt).valueOf() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes - days * 1440) / 60);
  const rest = minutes - days * 1440 - hours * 60;
  const units: string[] = [];
  if (days) units.push(`${days}${t('durationDays')}`);
  if (hours) units.push(`${hours}${t('durationHours')}`);
  if (rest || !units.length) units.push(`${rest}${t('durationMinutes')}`);
  return t('maintenanceStartsIn').replace('{duration}', units.join(' '));
}

async function renderExternalStatus(): Promise<void> {
  const endpoints = window.PulseStatusConfig?.externalStatus ?? [];
  const container = document.querySelector<HTMLElement>('#external-status')!;
  if (!endpoints.length) return;
  const results = await Promise.all(endpoints.map(async (endpoint) => {
    try {
      const response = await fetch(endpoint.apiUrl);
      if (!response.ok) return { name: endpoint.name, indicator: 'unknown', description: 'HTTP ' + response.status };
      const data = await response.json() as { status?: { indicator?: string; description?: string } };
      return { name: endpoint.name, indicator: data.status?.indicator ?? 'unknown', description: data.status?.description ?? '' };
    } catch {
      return { name: endpoint.name, indicator: 'unknown', description: '' };
    }
  }));
  const dotClass = (indicator: string) => (indicator === 'none' ? 'operational' : indicator === 'minor' ? 'degraded' : ['major', 'critical'].includes(indicator) ? 'down' : 'unknown');
  container.innerHTML = `<span class="muted">${escapeHtml(t('externalStatus'))}:</span>${results.map((result) => `<span class="ext-chip" title="${escapeHtml(result.description)}"><span class="board-dot ${dotClass(result.indicator)}"></span>${escapeHtml(result.name)}</span>`).join('')}`;
  container.hidden = false;
}

async function render(): Promise<void> {
  try {
    const [summary, incidents, services, maintenance, uptime] = await Promise.all([
      load<Summary>('summary.json'),
      load<{ schemaVersion: 1; generatedAt: string; incidents: Incident[] }>('incidents-all.json'),
      load<{ schemaVersion: 1; generatedAt: string; services: Service[] }>('services.json'),
      load<{ schemaVersion: 1; generatedAt: string; maintenance: Maintenance[] }>('maintenance.json'),
      load<UptimeHistory>('uptime.json'),
    ]);
    const status = document.querySelector<HTMLDivElement>('#status')!;
    status.className = `status-banner ${statusClass(summary)}`;
    const outageWithoutIncident = summary.activeIncidentCount === 0 && ['major_outage', 'partial_outage', 'degraded_performance'].includes(summary.overall);
    status.innerHTML = `<span class="status-dot"></span><div><strong>${statusLabel(summary.overall)}</strong><span class="status-context">${outageWithoutIncident ? t('noPublishedIncidentForOutage') : `${t('updated')} ${formatDate(summary.generatedAt)}`}</span></div>`;
    const site = window.PulseStatusConfig;
    const notices: string[] = [];
    if (summary.isDemo) notices.push(`<div class="notice-banner demo" role="status">⚠ ${escapeHtml(t('demoBanner'))}</div>`);
    const dataAgeMinutes = (Date.now() - new Date(summary.generatedAt).valueOf()) / 60_000;
    if (Number.isFinite(dataAgeMinutes) && dataAgeMinutes > 2 * (site?.probeIntervalMinutes ?? 15)) {
      notices.push(`<div class="notice-banner stale" role="status">⏱ ${escapeHtml(t('staleData').replace('{time}', formatDate(summary.generatedAt)))}</div>`);
    }
    document.querySelector('#notices')!.innerHTML = notices.join('');
    void renderAnnouncements();
    const active = sortIncidents(incidents.incidents.filter((incident) => incident.isActive));
    document.querySelector('#incident-count')!.textContent = `${active.length} ${t('active')}`;
    document.querySelector<HTMLElement>('#active-incidents-section')!.hidden = active.length === 0;
    document.querySelector('#incidents')!.innerHTML = active.map((incident) => incidentCard(incident, services.services)).join('');
    const visibleMaintenance = [...maintenance.maintenance].filter((item) => item.state === 'scheduled' || item.state === 'in_progress').sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    document.querySelector('#maintenance-count')!.textContent = `${visibleMaintenance.length} ${t('maintenanceItems')}`;
    document.querySelector<HTMLElement>('#maintenance-section')!.hidden = visibleMaintenance.length === 0;
    document.querySelector('#maintenance')!.innerHTML = visibleMaintenance.map((item) => maintenanceCard(item, services.services)).join('');
    const upcoming = visibleMaintenance.filter((item) => item.state === 'scheduled').sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    document.querySelector('#maintenance-countdown')!.textContent = upcoming ? countdownText(upcoming.startsAt) : '';
    void renderExternalStatus();
    const recentIncidents = incidents.incidents.filter((incident) => !incident.isActive)
      .sort((a, b) => (b.closedAt ?? b.updatedAt).localeCompare(a.closedAt ?? a.updatedAt))
      .slice(0, 5);
    document.querySelector('#recent-incidents')!.innerHTML = recentIncidents.map((incident) => incidentCard(incident, services.services)).join('') || `<p class="card empty">${t('noHistory')}</p>`;
    const groupConfig = site?.serviceGroups ?? {};
    const parentByGroup = new Map<string, string | undefined>();
    services.services.filter((service) => service.group).forEach((service) => parentByGroup.set(service.group!, service.parentGroup ?? groupConfig[service.group!]?.parentGroup));
    const groupLabel = (group: string): string => groupConfig[group]?.nameI18n?.[language] ?? groupConfig[group]?.nameI18n?.[language.split('-')[0]] ?? groupConfig[group]?.name ?? group;
    const groupChildren = (group: string): string[] => [...parentByGroup.entries()].filter(([, parent]) => parent === group).map(([name]) => name);
    const aggregateStatus = (memberStatus: GroupStatus, childStatuses: GroupStatus[]): GroupStatus => [memberStatus, ...childStatuses].reduce((worst, status) => (groupStatusRank[status] < groupStatusRank[worst] ? status : worst), memberStatus);
    const statusByGroup = new Map<string, GroupStatus>();
    const computeGroupStatus = (group: string, visiting: Set<string>): GroupStatus => {
      if (visiting.has(group)) return 'unknown';
      const memoized = statusByGroup.get(group);
      if (memoized !== undefined) return memoized;
      const members = services.services.filter((service) => service.group === group);
      const childStatuses = groupChildren(group).map((child) => computeGroupStatus(child, new Set([...visiting, group])));
      const status = aggregateStatus(groupStatus(members, active), childStatuses);
      statusByGroup.set(group, status);
      return status;
    };
    [...parentByGroup.keys()].forEach((group) => computeGroupStatus(group, new Set()));
    const bySeverity = (a: string, b: string): number => groupStatusRank[statusByGroup.get(a) ?? 'unknown'] - groupStatusRank[statusByGroup.get(b) ?? 'unknown'] || a.localeCompare(b);
    const renderGroup = (group: string, depth: number, visiting: Set<string>): string => {
      if (visiting.has(group)) return '';
      const members = services.services.filter((service) => service.group === group);
      const children = groupChildren(group).sort(bySeverity);
      const nested = children.map((child) => renderGroup(child, depth + 1, new Set([...visiting, group]))).join('');
      const status = statusByGroup.get(group) ?? 'unknown';
      return `<div class="service-group" data-depth="${depth}"><div class="service-group-header"><span class="service-group-name">${escapeHtml(groupLabel(group))}</span><span class="pill ${status.replace('_', '-')}">${escapeHtml(statusLabel(status))}</span></div>${members.map((service) => serviceCard(service, active, maintenance.maintenance, uptime.days, services.services)).join('')}${nested}</div>`;
    };
    const roots = [...parentByGroup.keys()].filter((group) => !parentByGroup.get(group) || !parentByGroup.has(parentByGroup.get(group)!)).sort(bySeverity);
    const ungrouped = services.services.filter((service) => !service.group);
    if (site?.layout === 'fused') {
      const renderFusedService = (service: Service): string => {
        const raw = effectiveServiceStatus(service, active, maintenance.maintenance, services.services);
        const status = raw.replace('_', '-');
        const daily = uptime.days.map((day) => day.services[service.id]).filter((value): value is number => typeof value === 'number');
        const average = daily.length ? (daily.reduce((total, value) => total + value, 0) / daily.length).toFixed(2) : null;
        return `<a class="board-row" href="${base}service.html?id=${encodeURIComponent(service.id)}"><span class="board-dot ${status}"></span><span class="board-row-name">${escapeHtml(serviceName(service))}</span>${average ? `<span class="board-uptime muted">${average}%</span>` : ''}<span class="board-status ${status}">${escapeHtml(statusLabel(raw))}</span></a>`;
      };
      const renderFusedGroup = (group: string, depth: number, visiting: Set<string>): string => {
        if (visiting.has(group)) return '';
        const members = services.services.filter((service) => service.group === group);
        const children = groupChildren(group).sort(bySeverity);
        const nested = children.map((child) => renderFusedGroup(child, depth + 1, new Set([...visiting, group]))).join('');
        const raw = statusByGroup.get(group) ?? 'unknown';
        const status = raw.replace('_', '-');
        return `<div class="board-group" data-depth="${depth}"><div class="board-group-header"><span class="board-dot ${status}"></span><span class="board-group-name">${escapeHtml(groupLabel(group))}</span><span class="board-status ${status}">${escapeHtml(statusLabel(raw))}</span></div>${members.map(renderFusedService).join('')}${nested}</div>`;
      };
      document.querySelector('#services')!.innerHTML = services.services.length ? `<div class="system-board">${uptimeStrip(uptime)}${ungrouped.map(renderFusedService).join('')}${roots.map((group) => renderFusedGroup(group, 0, new Set())).join('')}</div>` : '<p class="card empty">No service data available</p>';
    } else {
      document.querySelector('#services')!.innerHTML = services.services.length ? `${uptimeStrip(uptime)}${ungrouped.map((service) => serviceCard(service, active, maintenance.maintenance, uptime.days, services.services)).join('')}${roots.map((group) => renderGroup(group, 0, new Set())).join('')}` : '<p class="card empty">No service data available</p>';
    }
  } catch (error) {
    document.querySelector('#status')!.outerHTML = `<div class="status-banner unknown error" role="alert"><span class="status-dot"></span><strong>${t('statusUnavailable')}</strong></div>`;
    document.querySelector('#incidents')!.innerHTML = `<p class="card error">${t('dataUnavailable')}</p>`;
    document.querySelector('#services')!.innerHTML = '';
    document.querySelector('#maintenance')!.innerHTML = `<p class="card error">${t('dataUnavailable')}</p>`;
    console.error(error);
  }
}
void render();
