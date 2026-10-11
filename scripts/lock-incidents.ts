import { readFile } from 'node:fs/promises';
import type { Incident } from '../src/types/status';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const reason = process.env.PULSE_LOCK_REASON;
if (process.env.PULSE_LOCK_INCIDENTS !== 'true') {
  console.log('Issue locking disabled by configuration.');
  process.exit(0);
}
if (!token || !repository || !reason || !['off_topic', 'resolved', 'spam', 'too_heated'].includes(reason)) {
  console.warn('Issue locking skipped: token, repository, and a valid explicit lock reason are required.');
  process.exit(0);
}
const incidents = JSON.parse(await readFile('public/data/incidents-active.json', 'utf8')) as { incidents: Incident[] };
const alreadyLockedStatus = 422;
for (const incident of incidents.incidents) {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues/${incident.number}/lock`, {
    method: 'PUT',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ lock_reason: reason }),
  });
  if (!response.ok && response.status !==  alreadyLockedStatus) console.warn(`Could not lock issue #${incident.number}: ${response.status}`);
}
