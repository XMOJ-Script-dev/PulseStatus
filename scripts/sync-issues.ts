import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';
import type { GithubComment, GithubIssue, GithubIssueEvent, IssueParseConfig } from '../src/data/issues';
import { issueToIncident } from '../src/data/issues';
import { issueToMaintenance, parseMaintenanceTimes } from '../src/data/maintenance';
import type { Incident } from '../src/types/status';
import { sendIncidentNotifications } from './notify';

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
if (!token || !owner || !repository) {
  console.error('Missing GITHUB_TOKEN or repository context; refusing to publish fabricated data.');
  process.exit(1);
}
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
async function github<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json() as Promise<T>;
}
const sourceConfig = parse(await readFile('config/statuspage.yml', 'utf8')) as {
  site?: { name?: string };
  issues?: { autoCloseMaintenance?: boolean; publishLabel?: string; maintenanceLabel?: string; trustedMaintainers?: string[]; trustedAssociations?: string[]; notifyFormat?: 'discord' | 'slack'; notifyNtfyTopic?: string };
};
const autoCloseMaintenance = sourceConfig.issues?.autoCloseMaintenance === true;
const publishLabel = sourceConfig.issues?.publishLabel ?? 'statuspage/incident';
const maintenanceLabel = sourceConfig.issues?.maintenanceLabel ?? 'statuspage/maintenance';
const notifyFormat = sourceConfig.issues?.notifyFormat ?? 'discord';
const envMaintainers = (process.env.PULSE_TRUSTED_MAINTAINERS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
const trustedMaintainers = envMaintainers.length ? envMaintainers : (sourceConfig.issues?.trustedMaintainers ?? []);
const trustedAssociations = sourceConfig.issues?.trustedAssociations ?? ['OWNER', 'MEMBER', 'COLLABORATOR'];
if (sourceConfig.issues?.notifyNtfyTopic) process.env.PULSE_NTFY_TOPIC = sourceConfig.issues.notifyNtfyTopic;
let previousActiveIncidents: Incident[] = [];
try {
  previousActiveIncidents = (JSON.parse(await readFile('public/data/incidents-active.json', 'utf8')) as { incidents?: Incident[] }).incidents ?? [];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
async function githubPages<T>(path: string): Promise<T[]> {
  const values: T[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await github<T[]>(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    values.push(...batch);
    if (batch.length < 100) return values;
  }
}
const serviceIds = (process.env.PULSE_SERVICES ?? '').split(',').map((value) => value.trim()).filter(Boolean);
const config: IssueParseConfig = { publishLabel, serviceIds, trustedMaintainers, trustedAssociations };
const issues = await githubPages<GithubIssue>(`/repos/${owner}/${repository}/issues?state=all`);
const incidents: Incident[] = [];
const maintenance = [];
for (const issue of issues) {
  if ('pull_request' in issue) continue;
  const issueServiceIds = issue.labels.map((label) => label.name.slice(8)).filter((id) => serviceIds.includes(id) && issue.labels.some((candidate) => candidate.name === `service/${id}`));
  if (issue.labels.some((label) => label.name === maintenanceLabel)) {
    const times = parseMaintenanceTimes(issue.body);
    if (issue.state === 'open' && times) {
      const start = new Date(times.startsAt).valueOf();
      for (const windowMinutes of [24 * 60, 60]) {
        const marker = `<!-- pulsestatus-reminded:${windowMinutes}m -->`;
        const inWindow = start - Date.now() > 0 && start - Date.now() <= windowMinutes * 60_000;
        if (inWindow && !(issue.body ?? '').includes(marker)) {
          const when = windowMinutes === 60 ? 'in 1 hour' : 'in 24 hours';
          await github(`/repos/${owner}/${repository}/issues/${issue.number}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body: `⏰ Scheduled maintenance starts ${when} (${times.startsAt}).\n\n${marker}` }),
            headers: { 'Content-Type': 'application/json' },
          });
          console.log(`Reminder comment posted on maintenance Issue #${issue.number} (${when}).`);
        }
      }
    }
    if (autoCloseMaintenance && issue.state === 'open' && !issue.labels.some((label) => label.name === 'state/cancelled') && !issue.labels.some((label) => label.name === 'state/delayed') && times && new Date(times.endsAt).valueOf() <= Date.now()) {
      await github(`/repos/${owner}/${repository}/issues/${issue.number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
        headers: { 'Content-Type': 'application/json' },
      });
      issue.state = 'closed';
      console.log(`Closed maintenance Issue #${issue.number} after its scheduled end.`);
    }
    const event = issueToMaintenance(issue, issueServiceIds);
    if (event) maintenance.push(event);
    else console.warn(JSON.stringify({ issue: issue.number, warning: 'invalid maintenance fields or service labels; skipped' }));
    continue;
  }
  const comments = await githubPages<GithubComment>(`/repos/${owner}/${repository}/issues/${issue.number}/comments`);
  const events = await githubPages<GithubIssueEvent>(`/repos/${owner}/${repository}/issues/${issue.number}/events`);
  const incident = issueToIncident(issue, comments, config, events);
  if (incident) incidents.push(incident);
  else if (issue.labels.some((label) => label.name === config.publishLabel)) console.warn(JSON.stringify({ issue: issue.number, warning: 'invalid incident labels; skipped' }));
}
await mkdir('public/data/history', { recursive: true });
const generatedAt = new Date().toISOString();
const activeIncidents = incidents.filter((incident) => incident.isActive);
const previousActiveIds = new Set(previousActiveIncidents.map((incident) => incident.id));
const currentActiveIds = new Set(activeIncidents.map((incident) => incident.id));
const notifyEvents = [
  ...activeIncidents.filter((incident) => !previousActiveIds.has(incident.id)).map((incident) => ({ incident, event: 'opened' as const })),
  ...previousActiveIncidents.filter((incident) => !currentActiveIds.has(incident.id) && !incident.url.startsWith('https://github.com/demo/')).map((incident) => {
    const resolved = incidents.find((candidate) => candidate.id === incident.id);
    return { incident: resolved ?? incident, event: 'resolved' as const };
  }),
];
if (notifyEvents.length) {
  await sendIncidentNotifications(notifyEvents, {
    siteName: sourceConfig.site?.name ?? 'PulseStatus',
    format: notifyFormat,
    services: serviceIds.map((id) => ({ id, name: id })),
  });
}
await writeFile('public/data/incidents-all.json', JSON.stringify({ schemaVersion: 1, generatedAt, incidents }, null, 2));
await writeFile('public/data/incidents-active.json', JSON.stringify({ schemaVersion: 1, generatedAt, incidents: activeIncidents }, null, 2));
await writeFile('public/data/maintenance.json', JSON.stringify({ schemaVersion: 1, generatedAt, maintenance }, null, 2));
console.log(`Synchronized ${incidents.length} valid incidents.`);
