import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { buildSummary, groupHistoryByMonth, groupMaintenanceByMonth } from '../src/utils/status';
import type { Incident, Service, SiteConfig, UptimeHistory } from '../src/types/status';
import type { Maintenance } from '../src/types/status';
import { buildDailyUptime } from '../src/utils/status';
import { buildAtomFeed, buildIcsFeed } from '../src/utils/feed';
import { buildDemoIncidents, buildDemoMaintenance } from '../src/utils/demo';

const incidentsData = JSON.parse(await readFile('public/data/incidents-all.json', 'utf8')) as { incidents: Incident[] };
const servicesData = JSON.parse(await readFile('public/data/services.json', 'utf8')) as { services: Service[] };
const maintenanceData = JSON.parse(await readFile('public/data/maintenance.json', 'utf8')) as { maintenance: Maintenance[] };
const sourceConfig = parse(await readFile('config/statuspage.yml', 'utf8')) as {
  site?: Partial<SiteConfig>;
  serviceGroups?: SiteConfig['serviceGroups'];
  repository?: { owner?: string; name?: string };
  history?: { initialMonths?: number; monthsPerLoad?: number; uptimeDays?: number };
  monitoring?: { demoData?: boolean; probeIntervalMinutes?: number };
};
const site: SiteConfig = {
  name: sourceConfig.site?.name ?? 'PulseStatus',
  locale: sourceConfig.site?.locale ?? 'en',
  timezone: sourceConfig.site?.timezone ?? 'UTC',
  favicon: sourceConfig.site?.favicon ?? 'favicon.png',
  companyName: sourceConfig.site?.companyName ?? sourceConfig.site?.name ?? 'PulseStatus',
  companyUrl: sourceConfig.site?.companyUrl,
  url: sourceConfig.site?.url,
  logo: sourceConfig.site?.logo,
  heroTitle: sourceConfig.site?.heroTitle,
  tagline: sourceConfig.site?.tagline,
  language: sourceConfig.site?.language,
  headerText: sourceConfig.site?.headerText,
  footerText: sourceConfig.site?.footerText,
  footerLinks: sourceConfig.site?.footerLinks,
  navLinks: sourceConfig.site?.navLinks,
  showGithub: sourceConfig.site?.showGithub,
  githubUrl: sourceConfig.site?.githubUrl ?? (sourceConfig.repository?.owner && sourceConfig.repository?.name ? `https://github.com/${sourceConfig.repository.owner}/${sourceConfig.repository.name}` : undefined),
  githubLabel: sourceConfig.site?.githubLabel,
  layout: sourceConfig.site?.layout,
  colors: sourceConfig.site?.colors,
  externalStatus: sourceConfig.site?.externalStatus,
  headHtml: sourceConfig.site?.headHtml,
  history: sourceConfig.history ? { initialMonths: sourceConfig.history.initialMonths ?? 3, monthsPerLoad: sourceConfig.history.monthsPerLoad ?? 3, uptimeDays: sourceConfig.history.uptimeDays } : undefined,
  probeIntervalMinutes: sourceConfig.monitoring?.probeIntervalMinutes,
  theme: sourceConfig.site?.theme ?? 'modern',
  serviceGroups: sourceConfig.serviceGroups,
};
const generatedAt = new Date().toISOString();
const isDemo = sourceConfig.monitoring?.demoData === true;
const incidents = isDemo ? [...buildDemoIncidents(generatedAt), ...incidentsData.incidents] : incidentsData.incidents;
const maintenance = isDemo ? [...buildDemoMaintenance(generatedAt), ...maintenanceData.maintenance] : maintenanceData.maintenance;
if (isDemo) {
  await writeFile('public/data/incidents-all.json', JSON.stringify({ schemaVersion: 1, generatedAt, incidents }, null, 2));
  await writeFile('public/data/incidents-active.json', JSON.stringify({ schemaVersion: 1, generatedAt, incidents: incidents.filter((incident) => incident.isActive) }, null, 2));
  await writeFile('public/data/maintenance.json', JSON.stringify({ schemaVersion: 1, generatedAt, maintenance }, null, 2));
}
const summary = buildSummary(incidents, servicesData.services, generatedAt);
summary.isDemo = isDemo;
summary.activeMaintenanceCount = maintenance.filter((item) => item.state === 'scheduled' || item.state === 'in_progress').length;
summary.monitoringMode = (process.env.PULSE_MONITOR_MODE as typeof summary.monitoringMode | undefined) ?? 'manual';
await writeFile('public/data/summary.json', JSON.stringify(summary, null, 2));
await writeFile('public/data/summary.js', `window.PulseStatusSummary=${JSON.stringify(summary)};`);
await writeFile('public/data/site.js', `window.PulseStatusConfig=${JSON.stringify(site)};`);
const groups = groupHistoryByMonth(incidents);
const maintenanceGroups = groupMaintenanceByMonth(maintenance);
const months = [];
await mkdir('public/data/history', { recursive: true });
for (const month of [...new Set([...groups.keys(), ...maintenanceGroups.keys()])].sort((a, b) => b.localeCompare(a))) {
  const monthIncidents = groups.get(month) ?? [];
  const monthMaintenance = maintenanceGroups.get(month) ?? [];
  await writeFile(`public/data/history/${month}.json`, JSON.stringify({ schemaVersion: 1, generatedAt, incidents: monthIncidents, maintenance: monthMaintenance }, null, 2));
  months.push({ month, count: monthIncidents.length + monthMaintenance.length, url: `./history/${month}.json` });
}
await writeFile('public/data/history-index.json', JSON.stringify({ schemaVersion: 1, generatedAt, months }, null, 2));
const uptimeDays = sourceConfig.history?.uptimeDays ?? 90;
const uptime: UptimeHistory = {
  schemaVersion: 1,
  generatedAt,
  days: buildDailyUptime(incidents, servicesData.services.map((service) => service.id), generatedAt, uptimeDays, servicesData.services, maintenance),
};
await writeFile('public/data/uptime.json', JSON.stringify(uptime, null, 2));

const siteUrl = (site.url ?? site.companyUrl ?? '').replace(/\/$/, '');
if (siteUrl) {
  const feedItems = [
    ...incidents.map((incident) => ({
      id: incident.url, title: incident.title, url: incident.url, updatedAt: incident.updatedAt,
      summary: incident.bodySummary, categories: ['incident', incident.severity, ...incident.serviceIds],
    })),
    ...maintenance.filter((item) => item.state !== 'cancelled').map((item) => ({
      id: item.url, title: item.title, url: item.url, updatedAt: item.endsAt,
      summary: `Scheduled maintenance from ${item.startsAt} to ${item.endsAt}`, categories: ['maintenance', ...item.serviceIds],
    })),
  ];
  await writeFile('public/feed.xml', buildAtomFeed(feedItems, { title: `${site.name} Status`, siteUrl, feedUrl: `${siteUrl}/feed.xml` }));
  await writeFile('public/maintenance.ics', buildIcsFeed(
    maintenance.filter((item) => item.state === 'scheduled' || item.state === 'in_progress').map((item) => ({
      id: item.id, title: item.title, url: item.url, startsAt: item.startsAt, endsAt: item.endsAt,
      description: `Services: ${item.serviceIds.join(', ')}`,
    })),
    { title: `${site.name} Maintenance`, siteUrl, feedUrl: `${siteUrl}/maintenance.ics` },
  ));
  await writeFile('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc></url>
  <url><loc>${siteUrl}/history.html</loc></url>
  <url><loc>${siteUrl}/feed.xml</loc></url>
</urlset>
`);
}

const uptimeAverage = (serviceId: string): number | null => {
  const values = uptime.days.map((day) => day.services[serviceId]).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
};
const statusMd = [
  `# ${site.name} status`,
  '',
  `_Last updated: ${generatedAt}${isDemo ? ' (demo data)' : ''}_`,
  '',
  '| Service | Status | Latency | Uptime (' + uptimeDays + 'd) |',
  '| --- | --- | --- | --- |',
  ...servicesData.services.map((service) => {
    const average = uptimeAverage(service.id);
    const latency = service.lastCheckedAt ? (service.latencyMs === undefined ? '—' : `${service.latencyMs} ms`) : 'manual';
    return `| [${service.name}](${siteUrl || '.'}/service.html?id=${service.id}) | ${service.status} | ${latency} | ${average === null ? '—' : `${average.toFixed(3)}%`} |`;
  }),
  '',
  `[![status](${siteUrl || '.'}/badges/status.svg)](${siteUrl || '.'}/)`,
  '',
].join('\n');
await writeFile('STATUS.md', statusMd);
console.log(`Built summary, ${months.length} history month files, ${uptime.days.length} uptime days${siteUrl ? ', feed.xml, maintenance.ics, sitemap.xml' : ''}, and STATUS.md.`);
