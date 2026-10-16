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
  favicon: 'favicon.svg',
  companyName: 'PulseStatus',
};
const site = window.PulseStatusConfig ?? defaultSite;

type StylePreference = 'modern' | 'compact' | 'vivid' | 'mono';

function preferredStyle(): StylePreference {
  const fallback: StylePreference = 'modern';
  try {
    const saved = localStorage.getItem('pulsestatus-style');
    return saved === 'compact' || saved === 'vivid' || saved === 'mono' ? saved : fallback;
  } catch (error) {
    console.warn('Could not read the saved display style.', error);
    return fallback;
  }
}

function applyStyle(style: StylePreference): void {
  document.documentElement.dataset.style = style;
}

export function layout(title: string, content: string): string {
  document.title = title.replace('PulseStatus', site.name);
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = `${base}${site.favicon.replace(/^\.?\//, '')}`;
  const style = preferredStyle();
  applyStyle(style);
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.id !== 'style-picker') return;
    const selected = target.value as StylePreference;
    applyStyle(selected);
    try {
      localStorage.setItem('pulsestatus-style', selected);
    } catch (error) {
      console.warn('Could not save the display style preference.', error);
    }
  }, { once: true });
  const company = site.companyUrl ? `<a href="${escapeHtml(site.companyUrl)}" rel="noreferrer">${escapeHtml(site.companyName)}</a>` : escapeHtml(site.companyName);
  const footerLinks = (site.footerLinks ?? []).map((link) => `<a href="${escapeHtml(link.url)}" rel="noreferrer">${escapeHtml(link.label)}</a>`).join('');
  return `<div class="site-shell">
    <header class="site-header"><a class="brand" href="${base}"><span class="brand-mark">P</span><span>${escapeHtml(site.name)}</span></a>
      <div class="header-controls"><nav aria-label="Primary navigation"><a href="${base}">${t('overview')}</a><a href="${base}history.html">${t('history')}</a><a href="https://github.com/XMOJ-Script-dev/PulseStatus">${t('github')}</a></nav><label class="style-picker" for="style-picker"><span>${t('style')}</span><select id="style-picker"><option value="modern"${style === 'modern' ? ' selected' : ''}>${t('styleModern')}</option><option value="compact"${style === 'compact' ? ' selected' : ''}>${t('styleCompact')}</option><option value="vivid"${style === 'vivid' ? ' selected' : ''}>${t('styleVivid')}</option><option value="mono"${style === 'mono' ? ' selected' : ''}>${t('styleMono')}</option></select></label></div>
    </header>${site.headerText ? `<p class="site-header-note muted">${escapeHtml(site.headerText)}</p>` : ''}<main>${content}</main><footer class="site-footer"><p>${site.footerText ? `${escapeHtml(site.footerText)} ` : ''}${company}</p>${footerLinks ? `<div class="footer-links">${footerLinks}</div>` : ''}</footer>
  </div>`;
}

export function formatDate(value?: string): string {
  if (!value) return t('limitedMonitoring');
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? t('limitedMonitoring') : date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function incidentCard(incident: Incident): string {
  return `<a class="card incident-card" href="${base}incident.html?number=${incident.number}">
    <div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(statusLabel(incident.severity))}</span><span class="pill">${escapeHtml(statusLabel(incident.state))}</span></div>
    <h3>${escapeHtml(incident.title)}</h3><p class="muted">${escapeHtml(incident.bodySummary)}</p>
    <small class="muted">${formatDate(incident.startedAt)} · ${incident.serviceIds.map(escapeHtml).join(', ')}</small>
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
