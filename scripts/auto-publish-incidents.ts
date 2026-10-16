import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';
import type { MonitorState, Service, Severity } from '../src/types/status';

interface Config {
  monitoring: {
    autoPublishIncident: boolean;
    failuresToIncident: number;
    recoverySuccessesToCloseIncident: number;
  };
  issues: {
    publishLabel: string;
    autoIncidentMentions: string[];
    autoIncidentSeverity: Severity;
  };
}

interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
}

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!token || !repository) {
  console.error('Missing GITHUB_TOKEN or GITHUB_REPOSITORY; refusing to publish automated incidents.');
  process.exit(1);
}

const config = parse(await readFile('config/statuspage.yml', 'utf8')) as Config;
const services = JSON.parse(await readFile('public/data/services.json', 'utf8')) as { services: Array<Service & { checkUrl?: string }> };
let state: MonitorState;
try {
  state = JSON.parse(await readFile('public/data/monitor-state.json', 'utf8')) as MonitorState;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  state = { generatedAt: new Date(0).toISOString(), services: {} };
}

async function github<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

const openIssues = await github<GithubIssue[]>(`/repos/${repository}/issues?state=open&per_page=100`);
const generatedAt = new Date().toISOString();
const mentions = config.issues.autoIncidentMentions.map((username) => `@${username}`).join(' ');

for (const service of services.services) {
  if (service.monitorMode === 'manual' || !service.checkUrl) continue;
  const previous: MonitorState['services'][string] = state.services[service.id] ?? { consecutiveFailures: 0, consecutiveSuccesses: 0 };
  if (previous.probeDue !== true) continue;
  const current: MonitorState['services'][string] = service.status === 'down'
    ? { ...previous, consecutiveFailures: previous.consecutiveFailures + 1, consecutiveSuccesses: 0, probeDue: false }
    : { ...previous, consecutiveFailures: 0, consecutiveSuccesses: previous.consecutiveSuccesses + 1, probeDue: false };
  const marker = `<!-- pulsestatus-auto:${service.id} -->`;
  const existing = openIssues.find((issue) => issue.body?.includes(marker));

  if (config.monitoring.autoPublishIncident && current.consecutiveFailures >= config.monitoring.failuresToIncident && !existing) {
    const title = `[Automated] ${service.name} unavailable`;
    const body = `${marker}\n\nAutomated monitoring failed to connect to **${service.name}** ${current.consecutiveFailures} consecutive times.\n\n${mentions}\n\nA maintainer should confirm customer impact, add context, and close this Issue when service recovery is verified.`;
    const created = await github<GithubIssue>(`/repos/${repository}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        labels: [config.issues.publishLabel, `service/${service.id}`, `severity/${config.issues.autoIncidentSeverity}`, 'state/investigating'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    current.autoIncidentNumber = created.number;
    console.log(`Created automated incident #${created.number} for ${service.id}.`);
  } else if (config.monitoring.autoPublishIncident && existing && current.consecutiveSuccesses >= config.monitoring.recoverySuccessesToCloseIncident) {
    await github(`/repos/${repository}/issues/${existing.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    });
    console.log(`Closed automated incident #${existing.number} after recovery of ${service.id}.`);
  } else if (existing) {
    current.autoIncidentNumber = existing.number;
  }
  state.services[service.id] = current;
}

state.generatedAt = generatedAt;
await writeFile('public/data/monitor-state.json', JSON.stringify(state, null, 2));
