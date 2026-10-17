import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { buildSummary, groupHistoryByMonth } from '../src/utils/status';
import type { Incident, Service, SiteConfig, UptimeHistory } from '../src/types/status';
import type { Maintenance } from '../src/types/status';
import { buildDailyUptime } from '../src/utils/status';

const incidentsData = JSON.parse(await readFile('public/data/incidents-all.json', 'utf8')) as { incidents: Incident[] };
const servicesData = JSON.parse(await readFile('public/data/services.json', 'utf8')) as { services: Service[] };
const maintenanceData = JSON.parse(await readFile('public/data/maintenance.json', 'utf8')) as { maintenance: Maintenance[] };
const sourceConfig = parse(await readFile('config/statuspage.yml', 'utf8')) as { site?: Partial<SiteConfig> };
const site: SiteConfig = {
  name: sourceConfig.site?.name ?? 'PulseStatus',
  locale: sourceConfig.site?.locale ?? 'en',
  timezone: sourceConfig.site?.timezone ?? 'UTC',
  favicon: sourceConfig.site?.favicon ?? 'favicon.png',
  companyName: sourceConfig.site?.companyName ?? sourceConfig.site?.name ?? 'PulseStatus',
  companyUrl: sourceConfig.site?.companyUrl,
  headerText: sourceConfig.site?.headerText,
  footerText: sourceConfig.site?.footerText,
  footerLinks: sourceConfig.site?.footerLinks,
  theme: sourceConfig.site?.theme ?? 'modern',
};
const generatedAt = new Date().toISOString();
const incidents = incidentsData.incidents;
const summary = buildSummary(incidents, servicesData.services, generatedAt);
summary.activeMaintenanceCount = maintenanceData.maintenance.filter((item) => item.state === 'scheduled' || item.state === 'in_progress').length;
summary.monitoringMode = (process.env.PULSE_MONITOR_MODE as typeof summary.monitoringMode | undefined) ?? 'manual';
await writeFile('public/data/summary.json', JSON.stringify(summary, null, 2));
await writeFile('public/data/summary.js', `window.PulseStatusSummary=${JSON.stringify(summary)};`);
await writeFile('public/data/site.js', `window.PulseStatusConfig=${JSON.stringify(site)};`);
const groups = groupHistoryByMonth(incidents);
const months = [];
await mkdir('public/data/history', { recursive: true });
for (const [month, monthIncidents] of groups) {
  await writeFile(`public/data/history/${month}.json`, JSON.stringify({ schemaVersion: 1, generatedAt, incidents: monthIncidents }, null, 2));
  months.push({ month, count: monthIncidents.length, url: `./history/${month}.json` });
}
await writeFile('public/data/history-index.json', JSON.stringify({ schemaVersion: 1, generatedAt, months }, null, 2));
const uptime: UptimeHistory = {
  schemaVersion: 1,
  generatedAt,
  days: buildDailyUptime(incidents, servicesData.services.map((service) => service.id), generatedAt),
};
await writeFile('public/data/uptime.json', JSON.stringify(uptime, null, 2));
console.log(`Built summary, ${months.length} history month files, and ${uptime.days.length} uptime days.`);
