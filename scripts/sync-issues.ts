import { mkdir, writeFile } from 'node:fs/promises';
import type { GithubComment, GithubIssue, IssueParseConfig } from '../src/data/issues';
import { issueToIncident } from '../src/data/issues';
import { issueToMaintenance } from '../src/data/maintenance';
import type { Incident } from '../src/types/status';

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
if (!token || !owner || !repository) {
  console.error('Missing GITHUB_TOKEN or repository context; refusing to publish fabricated data.');
  process.exit(1);
}
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
async function github<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json() as Promise<T>;
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
const config: IssueParseConfig = { publishLabel: 'statuspage/incident', serviceIds, trustedMaintainers: (process.env.PULSE_TRUSTED_MAINTAINERS ?? '').split(',').filter(Boolean), trustedAssociations: ['OWNER', 'MEMBER', 'COLLABORATOR'] };
const issues = await githubPages<GithubIssue>(`/repos/${owner}/${repository}/issues?state=all`);
const incidents: Incident[] = [];
const maintenance = [];
for (const issue of issues) {
  if ('pull_request' in issue) continue;
  const issueServiceIds = issue.labels.map((label) => label.name.slice(8)).filter((id) => serviceIds.includes(id) && issue.labels.some((candidate) => candidate.name === `service/${id}`));
  if (issue.labels.some((label) => label.name === 'statuspage/maintenance')) {
    const event = issueToMaintenance(issue, issueServiceIds);
    if (event) maintenance.push(event);
    else console.warn(JSON.stringify({ issue: issue.number, warning: 'invalid maintenance fields or service labels; skipped' }));
    continue;
  }
  const comments = await githubPages<GithubComment>(`/repos/${owner}/${repository}/issues/${issue.number}/comments`);
  const incident = issueToIncident(issue, comments, config);
  if (incident) incidents.push(incident);
  else if (issue.labels.some((label) => label.name === config.publishLabel)) console.warn(JSON.stringify({ issue: issue.number, warning: 'invalid incident labels; skipped' }));
}
await mkdir('public/data/history', { recursive: true });
const generatedAt = new Date().toISOString();
await writeFile('public/data/incidents-all.json', JSON.stringify({ schemaVersion: 1, generatedAt, incidents }, null, 2));
await writeFile('public/data/incidents-active.json', JSON.stringify({ schemaVersion: 1, generatedAt, incidents: incidents.filter((incident) => incident.isActive) }, null, 2));
await writeFile('public/data/maintenance.json', JSON.stringify({ schemaVersion: 1, generatedAt, maintenance }, null, 2));
console.log(`Synchronized ${incidents.length} valid incidents.`);
