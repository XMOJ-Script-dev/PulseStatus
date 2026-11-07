import '../styles/main.css';
import '../styles/custom.css';
import type { Incident, Maintenance, Service, SiteConfig, Summary } from '../types/status';
import { escapeHtml } from '../utils/status';
import { language, statusLabel, t } from '../i18n';

export const base = import.meta.env.BASE_URL;
export const dataUrl = (path: string) => `${base}data/${path}`;
const defaultSite: SiteConfig = {
  name: 'PulseStatus',
  locale: 'en',
  timezone: 'UTC',
  favicon: 'favicon.png',
  companyName: 'PulseStatus',
  showGithub: true,
  githubUrl: 'https://github.com/XMOJ-Script-dev/PulseStatus',
  theme: 'modern',
};
const site = window.PulseStatusConfig ?? defaultSite;

export function layout(title: string, content: string): string {
  document.title = title.replace('PulseStatus', site.name);
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.style = site.theme;
  for (const [key, value] of Object.entries(site.colors ?? {})) {
    if (value) document.documentElement.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  }
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = `${base}${site.favicon.replace(/^\.?\//, '')}`;
  const company = site.companyUrl ? `<a href="${escapeHtml(site.companyUrl)}" rel="noreferrer">${escapeHtml(site.companyName)}</a>` : escapeHtml(site.companyName);
  const footerLinks = (site.footerLinks ?? []).map((link) => `<a href="${escapeHtml(link.url)}" rel="noreferrer">${escapeHtml(link.label)}</a>`).join('');
  const githubNav = site.showGithub === false || !site.githubUrl ? '' : `<a href="${escapeHtml(site.githubUrl)}" rel="noreferrer">${escapeHtml(site.githubLabel ?? t('github'))}</a>`;
  const navLinks = (site.navLinks ?? []).map((link) => `<a href="${escapeHtml(link.url)}" rel="noreferrer">${escapeHtml(link.label)}</a>`).join('');
  const brandMark = site.logo
    ? `<img class="brand-logo" src="${base}${site.logo.replace(/^\.?\//, '')}" alt="${escapeHtml(site.name)}">`
    : `<span class="brand-mark">P</span>`;
  return `<div class="site-shell">
    <header class="site-header"><a class="brand" href="${base}">${brandMark}<span>${escapeHtml(site.name)}</span></a>
      <div class="header-controls"><nav aria-label="Primary navigation"><a href="${base}">${t('overview')}</a><a href="${base}history.html">${t('history')}</a>${githubNav}${navLinks}</nav></div>
    </header>${site.headerText ? `<p class="site-header-note muted">${escapeHtml(site.headerText)}</p>` : ''}<main>${content}</main><footer class="site-footer"><p>${site.footerText ? `${escapeHtml(site.footerText)} ` : ''}${company}</p>${footerLinks ? `<div class="footer-links">${footerLinks}</div>` : ''}</footer>
  </div>`;
}

export function formatDate(value?: string): string {
  if (!value) return t('limitedMonitoring');
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? t('limitedMonitoring') : date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function incidentCard(incident: Incident, services: Service[] = [], backServiceId?: string): string {
  const names = incident.serviceIds.map((id) => {
    const service = services.find((item) => item.id === id);
    return service ? serviceName(service) : id;
  });
  const serviceQuery = backServiceId ? `&serviceId=${encodeURIComponent(backServiceId)}` : '';
  return `<a class="card incident-card severity-${incident.severity}" href="${base}incident.html?number=${incident.number}${serviceQuery}">
    <div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(statusLabel(incident.severity))}</span><span class="pill">${escapeHtml(statusLabel(incident.state))}</span></div>
    <h3>${escapeHtml(incident.title)}</h3><p class="muted">${escapeHtml(incident.bodySummary)}</p>
    <small class="muted">${formatDate(incident.startedAt)} · ${names.map(escapeHtml).join(', ')}</small>
  </a>`;
}

export function maintenanceCard(item: Maintenance, services: Service[] = []): string {
  const names = item.serviceIds.map((id) => {
    const service = services.find((candidate) => candidate.id === id);
    return service ? serviceName(service) : id;
  });
  return `<article class="card incident-card maintenance-card"><div class="incident-meta"><span class="pill">${escapeHtml(statusLabel(item.state))}</span></div><h3>${escapeHtml(item.title)}</h3><p class="muted">${formatDate(item.startsAt)} → ${formatDate(item.endsAt)}</p><small class="muted">${names.map(escapeHtml).join(', ')}</small><a href="${escapeHtml(item.url)}" rel="noreferrer">${t('viewOnGithub')}</a></article>`;
}

export function uptimeLevel(uptime: number): string {
  if (uptime >= 99.9) return 'excellent';
  if (uptime >= 99) return 'good';
  if (uptime >= 95) return 'fair';
  if (uptime >= 90) return 'low';
  if (uptime >= 75) return 'poor';
  return 'critical';
}

export function effectiveServiceStatus(service: Service, incidents: Incident[] = [], maintenance: Maintenance[] = []): string {
  const activeIncidents = incidents.filter((incident) => incident.isActive && incident.serviceIds.includes(service.id));
  return activeIncidents.some((incident) => incident.severity !== 'minor')
    ? 'down'
    : activeIncidents.length
      ? 'degraded'
      : maintenance.some((item) => item.state === 'in_progress' && item.serviceIds.includes(service.id))
        ? 'maintenance'
        : service.status;
}

export function serviceCard(service: Service, incidents: Incident[] = [], maintenance: Maintenance[] = []): string {
  const name = serviceName(service);
  const description = service.descriptionI18n?.[language] ?? service.descriptionI18n?.[language.split('-')[0]] ?? service.description;
  const status = effectiveServiceStatus(service, incidents, maintenance);
  const detail = service.lastCheckedAt ? `${t('checked')} ${formatDate(service.lastCheckedAt)}` : t('manualMonitoring');
  return `<a class="service-row" href="${base}service.html?id=${encodeURIComponent(service.id)}" title="${escapeHtml(`${name} — ${description} · ${detail}`)}"><span class="service-row-name">${escapeHtml(name)}</span><span class="pill ${status.replace('_', '-')}">${escapeHtml(statusLabel(status))}</span></a>`;
}

export function serviceName(service: Service): string {
  return service.nameI18n?.[language] ?? service.nameI18n?.[language.split('-')[0]] ?? service.name;
}

export function statusClass(summary: Summary): string {
  if (summary.overall === 'unknown' || summary.overall === 'monitoring') return 'unknown';
  if (summary.overall === 'operational') return '';
  if (summary.overall === 'major_outage' || summary.overall === 'partial_outage') return 'danger';
  return 'warning';
}
