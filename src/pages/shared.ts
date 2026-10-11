import '../styles/main.css';
import type { Incident, Service, Summary } from '../types/status';
import { escapeHtml } from '../utils/status';
import { language, statusLabel, t } from '../i18n';

export const base = import.meta.env.BASE_URL;
export const dataUrl = (path: string) => `${base}data/${path}`;

export function layout(title: string, content: string): string {
  document.title = title;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  return `<div class="site-shell">
    <header class="site-header"><a class="brand" href="${base}">PulseStatus</a>
      <nav aria-label="Primary navigation"><a href="${base}">${t('overview')}</a><a href="${base}history.html">${t('history')}</a><a href="https://github.com/XMOJ-Script-dev/PulseStatus">${t('github')}</a></nav>
    </header><main>${content}</main>
    <footer>${t('publishedFromGithub')}</footer>
  </div>`;
}

export function formatDate(value?: string): string {
  if (!value) return t('limitedMonitoring');
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? t('limitedMonitoring') : date.toLocaleString(language === 'zh' ? 'zh-CN' : undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function incidentCard(incident: Incident): string {
  return `<a class="card incident-card" href="${base}incident.html?number=${incident.number}">
    <div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(statusLabel(incident.severity))}</span><span class="pill">${escapeHtml(statusLabel(incident.state))}</span></div>
    <h3>${escapeHtml(incident.title)}</h3><p class="muted">${escapeHtml(incident.bodySummary)}</p>
    <small class="muted">${formatDate(incident.startedAt)} · ${incident.serviceIds.map(escapeHtml).join(', ')}</small>
  </a>`;
}

export function serviceCard(service: Service): string {
  return `<article class="card"><div class="section-heading"><h3>${escapeHtml(service.name)}</h3><span class="pill">${escapeHtml(statusLabel(service.status))}</span></div><p class="muted">${escapeHtml(service.description)}</p><small class="muted">${service.lastCheckedAt ? `${t('checked')} ${formatDate(service.lastCheckedAt)}` : t('manualMonitoring')}</small></article>`;
}

export function statusClass(summary: Summary): string {
  if (summary.overall === 'unknown' || summary.overall === 'monitoring') return 'unknown';
  if (summary.overall === 'operational') return '';
  if (summary.overall === 'major_outage' || summary.overall === 'partial_outage') return 'danger';
  return 'warning';
}
