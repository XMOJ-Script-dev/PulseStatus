import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildSummary, groupHistoryByMonth } from '../src/utils/status';
import type { Incident, Service } from '../src/types/status';

const incidentsData = JSON.parse(await readFile('public/data/incidents-all.json', 'utf8')) as { incidents: Incident[] };
const servicesData = JSON.parse(await readFile('public/data/services.json', 'utf8')) as { services: Service[] };
const generatedAt = new Date().toISOString();
const incidents = incidentsData.incidents;
const summary = buildSummary(incidents, servicesData.services, generatedAt);
summary.monitoringMode = (process.env.PULSE_MONITOR_MODE as typeof summary.monitoringMode | undefined) ?? 'manual';
await writeFile('public/data/summary.json', JSON.stringify(summary, null, 2));
await writeFile('public/data/summary.js', `window.PulseStatusSummary=${JSON.stringify(summary)};`);
const groups = groupHistoryByMonth(incidents);
const months = [];
await mkdir('public/data/history', { recursive: true });
for (const [month, monthIncidents] of groups) {
  await writeFile(`public/data/history/${month}.json`, JSON.stringify({ schemaVersion: 1, generatedAt, incidents: monthIncidents }, null, 2));
  months.push({ month, count: monthIncidents.length, url: `./history/${month}.json` });
}
await writeFile('public/data/history-index.json', JSON.stringify({ schemaVersion: 1, generatedAt, months }, null, 2));
console.log(`Built summary and ${months.length} history month files.`);
