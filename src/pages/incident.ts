import type { Incident } from '../types/status';
import { dataUrl, formatDate, layout } from './shared';
import { escapeHtml } from '../utils/status';
import { statusLabel, t } from '../i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout(`${t('incidentHistory')} · PulseStatus`, `<div id="incident-content" class="card">${t('loadingHistory')}</div>`);
const number = new URLSearchParams(location.search).get('number');

async function init(): Promise<void> {
  try {
    const response = await fetch(dataUrl('incidents-all.json'));
    if (!response.ok) throw new Error(`Could not load incidents (${response.status})`);
    const data = await response.json() as { incidents: Incident[] };
    const incident = data.incidents.find((item) => String(item.number) === number);
    if (!incident) {
      document.querySelector('#incident-content')!.innerHTML = `<div class="empty"><h1>${t('incidentNotFound')}</h1><p>${t('incidentNotPublished')}</p></div>`;
      return;
    }
    document.title = `${incident.title} · PulseStatus`;
    document.querySelector('#incident-content')!.innerHTML = `<div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(statusLabel(incident.severity))}</span><span class="pill">${escapeHtml(statusLabel(incident.state))}</span></div><h1>${escapeHtml(incident.title)}</h1><p class="muted">${escapeHtml(incident.bodySummary)}</p><p class="muted">${t('started')} ${formatDate(incident.startedAt)} · ${t('updatedAt')} ${formatDate(incident.updatedAt)}</p><a href="${escapeHtml(incident.url)}" rel="noreferrer">${t('viewOnGithub')}</a><div class="timeline">${incident.timeline.map((entry) => `<article class="timeline-item"><strong>${escapeHtml(entry.state ? statusLabel(entry.state) : entry.type)}</strong><p>${escapeHtml(entry.text)}</p><small class="muted">${formatDate(entry.at)}${entry.author ? ` · ${escapeHtml(entry.author)}` : ''}</small></article>`).join('') || `<p class="muted">${t('noOfficialUpdates')}</p>`}</div>`;
  } catch (error) {
    document.querySelector('#incident-content')!.innerHTML = `<div class="error">${t('incidentDataUnavailable')}</div>`;
    console.error(error);
  }
}
void init();
