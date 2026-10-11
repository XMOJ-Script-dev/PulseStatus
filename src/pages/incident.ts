import type { Incident } from '../types/status';
import { dataUrl, formatDate, layout } from './shared';
import { escapeHtml } from '../utils/status';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = layout('Incident · PulseStatus', '<div id="incident-content" class="card">Loading incident…</div>');
const number = new URLSearchParams(location.search).get('number');

async function init(): Promise<void> {
  try {
    const response = await fetch(dataUrl('incidents-all.json'));
    if (!response.ok) throw new Error(`Could not load incidents (${response.status})`);
    const data = await response.json() as { incidents: Incident[] };
    const incident = data.incidents.find((item) => String(item.number) === number);
    if (!incident) {
      document.querySelector('#incident-content')!.innerHTML = '<div class="empty"><h1>Incident not found</h1><p>The incident is not present in the published data.</p></div>';
      return;
    }
    document.title = `${incident.title} · PulseStatus`;
    document.querySelector('#incident-content')!.innerHTML = `<div class="incident-meta"><span class="pill ${incident.severity}">${escapeHtml(incident.severity)}</span><span class="pill">${escapeHtml(incident.state)}</span></div><h1>${escapeHtml(incident.title)}</h1><p class="muted">${escapeHtml(incident.bodySummary)}</p><p class="muted">Started ${formatDate(incident.startedAt)} · Updated ${formatDate(incident.updatedAt)}</p><a href="${escapeHtml(incident.url)}" rel="noreferrer">View on GitHub</a><div class="timeline">${incident.timeline.map((entry) => `<article class="timeline-item"><strong>${escapeHtml(entry.state ?? entry.type)}</strong><p>${escapeHtml(entry.text)}</p><small class="muted">${formatDate(entry.at)}${entry.author ? ` · ${escapeHtml(entry.author)}` : ''}</small></article>`).join('') || '<p class="muted">No official updates have been published.</p>'}</div>`;
  } catch (error) {
    document.querySelector('#incident-content')!.innerHTML = '<div class="error">Incident data could not be loaded.</div>';
    console.error(error);
  }
}
void init();
