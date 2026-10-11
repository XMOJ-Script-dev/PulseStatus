import '../styles/main.css';
import type { Incident, Service, Summary } from '../types/status';
import { escapeHtml } from '../utils/status';

export const base = import.meta.env.BASE_URL;
export const dataUrl = (path: string) => `${base}data/${path}`;

export function layout(title: string, content: string): string {
  document.title = title;
  return `<div class="site-shell">
    <header class="site-header"><a class="brand" href="${base}">PulseStatus</a>
      <nav aria-label="Primary navigation"><a href="${base}">Overview</a><a href="${base}history.html">History</a><a href="https://github.com/XMOJ-Script-dev/PulseStatus">GitHub</a></nav>
    </header><main>${content}</main>
    <footer>Data is published from GitHub Issues. A failed refresh never becomes a false “all clear”.</footer>
  </div>`;
}

export function formatDate(value?: string): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function incidentCard(incident: Incident): string {
  return `<a class="card incident-card" href="${base}incident.html?number=${incident.number}">
    <div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(incident.severity)}</span><span class="pill">${escapeHtml(incident.state)}</span></div>
    <h3>${escapeHtml(incident.title)}</h3><p class="muted">${escapeHtml(incident.bodySummary)}</p>
    <small class="muted">Started ${formatDate(incident.startedAt)} · ${incident.serviceIds.map(escapeHtml).join(', ')}</small>
  </a>`;
}

export function serviceCard(service: Service): string {
  return `<article class="card"><div class="section-heading"><h3>${escapeHtml(service.name)}</h3><span class="pill">${escapeHtml(service.status.replace('_', ' '))}</span></div><p class="muted">${escapeHtml(service.description)}</p><small class="muted">${service.lastCheckedAt ? `Checked ${formatDate(service.lastCheckedAt)}` : 'No automated check configured'}</small></article>`;
}

export function statusClass(summary: Summary): string {
  if (summary.overall === 'unknown') return 'unknown';
  if (summary.overall === 'operational') return '';
  if (summary.overall === 'major_outage' || summary.overall === 'partial_outage') return 'danger';
  return 'warning';
}
