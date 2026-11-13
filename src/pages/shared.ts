import '../styles/main.css';
import '../styles/custom.css';
import type { Incident, Maintenance, Service, SiteConfig, Summary, UptimeHistory } from '../types/status';
import { durationParts, escapeHtml } from '../utils/status';
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

const THEME_STORAGE_KEY = 'pulsestatus-theme';
export function applyStoredTheme(): void {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
  } catch { /* localStorage unavailable */ }
}
applyStoredTheme();

const THEME_ORDER = ['auto', 'light', 'dark'] as const;
const THEME_ICONS: Record<(typeof THEME_ORDER)[number], string> = { auto: '◐', light: '☀', dark: '☾' };
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('#theme-toggle');
  if (!button) return;
  const current = (document.documentElement.dataset.theme ?? 'auto') as (typeof THEME_ORDER)[number];
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  if (next === 'auto') {
    delete document.documentElement.dataset.theme;
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* ignore */ }
  } else {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* ignore */ }
  }
  button.textContent = THEME_ICONS[next];
});

function upsertHead(selector: string, create: () => HTMLElement): void {
  if (document.head.querySelector(selector)) return;
  document.head.appendChild(create());
}

export function layout(title: string, content: string): string {
  document.title = title.replace('PulseStatus', site.name);
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.style = site.theme;
  for (const [key, value] of Object.entries(site.colors ?? {})) {
    if (value) document.documentElement.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  }
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = `${base}${site.favicon.replace(/^\.?\//, '')}`;
  if (site.url) {
    upsertHead('meta[property="og:title"]', () => Object.assign(document.createElement('meta'), { property: 'og:title', content: site.name }));
    upsertHead('meta[property="og:description"]', () => Object.assign(document.createElement('meta'), { property: 'og:description', content: site.tagline ?? site.headerText ?? site.name }));
    upsertHead('meta[property="og:type"]', () => Object.assign(document.createElement('meta'), { property: 'og:type', content: 'website' }));
  }
  upsertHead('link[rel="alternate"][type="application/atom+xml"]', () => Object.assign(document.createElement('link'), { rel: 'alternate', type: 'application/atom+xml', title: site.name, href: `${base}feed.xml` }));
  if (site.headHtml && !document.head.querySelector('[data-pulsestatus-head]')) {
    const holder = document.createElement('div');
    holder.dataset.pulsestatusHead = '';
    holder.innerHTML = site.headHtml;
    while (holder.firstChild) document.head.appendChild(holder.firstChild);
  }
  const company = site.companyUrl ? `<a href="${escapeHtml(site.companyUrl)}" rel="noreferrer">${escapeHtml(site.companyName)}</a>` : escapeHtml(site.companyName);
  const footerLinks = [
    ...(site.footerLinks ?? []).map((link) => `<a href="${escapeHtml(link.url)}" rel="noreferrer">${escapeHtml(link.label)}</a>`),
    `<a href="${base}feed.xml">${escapeHtml(t('feed'))}</a>`,
  ].join('');
  const githubNav = site.showGithub === false || !site.githubUrl ? '' : `<a href="${escapeHtml(site.githubUrl)}" rel="noreferrer">${escapeHtml(site.githubLabel ?? t('github'))}</a>`;
  const navLinks = (site.navLinks ?? []).map((link) => `<a href="${escapeHtml(link.url)}" rel="noreferrer">${escapeHtml(link.label)}</a>`).join('');
  const brandMark = site.logo
    ? `<img class="brand-logo" src="${base}${site.logo.replace(/^\.?\//, '')}" alt="${escapeHtml(site.name)}">`
    : `<span class="brand-mark">P</span>`;
  const currentTheme = (document.documentElement.dataset.theme ?? 'auto') as (typeof THEME_ORDER)[number];
  return `<div class="site-shell">
    <header class="site-header"><a class="brand" href="${base}">${brandMark}<span>${escapeHtml(site.name)}</span></a>
      <div class="header-controls"><nav aria-label="Primary navigation"><a href="${base}">${t('overview')}</a><a href="${base}history.html">${t('history')}</a>${githubNav}${navLinks}</nav><button id="theme-toggle" class="theme-toggle" type="button" title="${escapeHtml(t('themeToggle'))}" aria-label="${escapeHtml(t('themeToggle'))}">${THEME_ICONS[currentTheme]}</button></div>
    </header>${site.headerText ? `<p class="site-header-note muted">${escapeHtml(site.headerText)}</p>` : ''}<main>${content}</main><footer class="site-footer"><p>${site.footerText ? `${escapeHtml(site.footerText)} ` : ''}${company}</p>${footerLinks ? `<div class="footer-links">${footerLinks}</div>` : ''}</footer>
  </div>`;
}

export function formatDate(value?: string): string {
  if (!value) return t('limitedMonitoring');
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? t('limitedMonitoring') : date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDuration(startedAt: string, endedAt: string): string {
  const parts = durationParts(startedAt, endedAt);
  if (!parts) return '';
  const units: string[] = [];
  if (parts.days) units.push(`${parts.days}${t('durationDays')}`);
  if (parts.hours) units.push(`${parts.hours}${t('durationHours')}`);
  if (parts.minutes || !units.length) units.push(`${parts.minutes}${t('durationMinutes')}`);
  return units.join(' ');
}

export function incidentCard(incident: Incident, services: Service[] = [], backServiceId?: string): string {
  const names = incident.serviceIds.map((id) => {
    const service = services.find((item) => item.id === id);
    return service ? serviceName(service) : id;
  });
  const serviceQuery = backServiceId ? `&serviceId=${encodeURIComponent(backServiceId)}` : '';
  const duration = !incident.isActive ? formatDuration(incident.startedAt, incident.closedAt ?? incident.updatedAt) : '';
  return `<a class="card incident-card severity-${incident.severity}" href="${base}incident.html?number=${incident.number}${serviceQuery}">
    <div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(statusLabel(incident.severity))}</span><span class="pill">${escapeHtml(statusLabel(incident.state))}</span></div>
    <h3>${escapeHtml(incident.title)}</h3><p class="muted">${escapeHtml(incident.bodySummary)}</p>
    <small class="muted">${formatDate(incident.startedAt)} · ${names.map(escapeHtml).join(', ')}${duration ? ` · ${escapeHtml(t('incidentDuration').replace('{duration}', duration))}` : ''}</small>
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

export function effectiveServiceStatus(service: Service, incidents: Incident[] = [], maintenance: Maintenance[] = [], allServices: Service[] = []): string {
  const activeIncidents = incidents.filter((incident) => incident.isActive && incident.serviceIds.includes(service.id));
  const own = activeIncidents.some((incident) => incident.severity !== 'minor')
    ? 'down'
    : activeIncidents.length
      ? 'degraded'
      : maintenance.some((item) => item.state === 'in_progress' && item.serviceIds.includes(service.id))
        ? 'maintenance'
        : service.status;
  if (own !== 'down' && service.dependsOn && allServices.length) {
    const dependency = allServices.find((candidate) => candidate.id === service.dependsOn);
    if (dependency && effectiveServiceStatus(dependency, incidents, maintenance, []) === 'down') {
      return own === 'operational' ? 'degraded' : own;
    }
  }
  return own;
}

export function serviceCard(service: Service, incidents: Incident[] = [], maintenance: Maintenance[] = [], uptimeDays: UptimeHistory['days'] = [], allServices: Service[] = []): string {
  const name = serviceName(service);
  const description = service.descriptionI18n?.[language] ?? service.descriptionI18n?.[language.split('-')[0]] ?? service.description;
  const status = effectiveServiceStatus(service, incidents, maintenance, allServices);
  const dependency = service.dependsOn ? allServices.find((candidate) => candidate.id === service.dependsOn) : undefined;
  const depLabel = dependency ? ` <small class="service-row-dep muted">${escapeHtml(t('dependsOn').replace('{name}', serviceName(dependency)))}</small>` : '';
  const daily = uptimeDays.map((day) => day.services[service.id]).filter((value): value is number => typeof value === 'number');
  const average = daily.length ? (daily.reduce((total, value) => total + value, 0) / daily.length).toFixed(2) : null;
  const detail = service.lastCheckedAt ? `${t('checked')} ${formatDate(service.lastCheckedAt)}` : t('manualMonitoring');
  return `<a class="service-row" href="${base}service.html?id=${encodeURIComponent(service.id)}" title="${escapeHtml(`${name} — ${description} · ${detail}`)}"><span class="service-row-name">${escapeHtml(name)}${depLabel}</span>${average ? `<span class="service-row-uptime muted">${average}%</span>` : ''}<span class="pill ${status.replace('_', '-')}">${escapeHtml(statusLabel(status))}</span></a>`;
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
