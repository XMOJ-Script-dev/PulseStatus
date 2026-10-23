import '../styles/main.css';
import '../styles/custom.css';
import type { Incident, Service, SiteConfig, Summary } from '../types/status';
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
  theme: 'modern',
};
const site = window.PulseStatusConfig ?? defaultSite;

export function layout(title: string, content: string): string {
  document.title = title.replace('PulseStatus', site.name);
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.style = site.theme;
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = `${base}${site.favicon.replace(/^\.?\//, '')}`;
  const company = site.companyUrl ? `<a href="${escapeHtml(site.companyUrl)}" rel="noreferrer">${escapeHtml(site.companyName)}</a>` : escapeHtml(site.companyName);
  const footerLinks = (site.footerLinks ?? []).map((link) => `<a href="${escapeHtml(link.url)}" rel="noreferrer">${escapeHtml(link.label)}</a>`).join('');
  return `<div class="site-shell">
    <header class="site-header"><a class="brand" href="${base}"><span class="brand-mark">P</span><span>${escapeHtml(site.name)}</span></a>
      <div class="header-controls"><nav aria-label="Primary navigation"><a href="${base}">${t('overview')}</a><a href="${base}history.html">${t('history')}</a><a href="https://github.com/XMOJ-Script-dev/PulseStatus">${t('github')}</a></nav></div>
    </header>${site.headerText ? `<p class="site-header-note muted">${escapeHtml(site.headerText)}</p>` : ''}<main>${content}</main><footer class="site-footer"><p>${site.footerText ? `${escapeHtml(site.footerText)} ` : ''}${company}</p>${footerLinks ? `<div class="footer-links">${footerLinks}</div>` : ''}</footer>
  </div>`;
}

export function formatDate(value?: string): string {
  if (!value) return t('limitedMonitoring');
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? t('limitedMonitoring') : date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function incidentCard(incident: Incident, services: Service[] = []): string {
  const names = incident.serviceIds.map((id) => {
    const service = services.find((item) => item.id === id);
    return service ? serviceName(service) : id;
  });
  return `<a class="card incident-card" href="${base}incident.html?number=${incident.number}">
    <div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(statusLabel(incident.severity))}</span><span class="pill">${escapeHtml(statusLabel(incident.state))}</span></div>
    <h3>${escapeHtml(incident.title)}</h3><p class="muted">${escapeHtml(incident.bodySummary)}</p>
    <small class="muted">${formatDate(incident.startedAt)} · ${names.map(escapeHtml).join(', ')}</small>
  </a>`;
}

export function serviceCard(service: Service): string {
  const name = serviceName(service);
  const description = service.descriptionI18n?.[language] ?? service.descriptionI18n?.[language.split('-')[0]] ?? service.description;
  return `<a class="service-card-link" href="${base}service.html?id=${encodeURIComponent(service.id)}"><article class="card service-card"><div class="service-card-heading"><h3>${escapeHtml(name)}</h3><span class="pill ${service.status.replace('_', '-')}">${escapeHtml(statusLabel(service.status))}</span></div><p class="muted">${escapeHtml(description)}</p><small class="muted">${service.lastCheckedAt ? `${t('checked')} ${formatDate(service.lastCheckedAt)}` : t('manualMonitoring')}</small></article></a>`;
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
