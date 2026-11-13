import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Service, Summary, UptimeHistory } from '../src/types/status';

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character] ?? character));
const summary = JSON.parse(await readFile('public/data/summary.json', 'utf8')) as Summary;
const services = JSON.parse(await readFile('public/data/services.json', 'utf8')) as { services: Service[] };
const uptime = JSON.parse(await readFile('public/data/uptime.json', 'utf8')) as UptimeHistory;
const badge = (label: string, value: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28" role="img" aria-label="${escapeXml(`${label}: ${value}`)}"><rect width="220" height="28" fill="#17243d" rx="5"/><text x="12" y="19" fill="#fff" font-family="Arial,sans-serif" font-size="13">${escapeXml(label)}</text><text x="208" y="19" fill="#fff" font-family="Arial,sans-serif" font-size="13" text-anchor="end">${escapeXml(value)}</text></svg>`;
const uptimeColor = (average: number) => (average >= 99.9 ? '#16a34a' : average >= 99 ? '#ca8a04' : average >= 95 ? '#d97706' : '#dc2626');
const uptimeBadge = (label: string, average: number) => {
  const value = `${average.toFixed(2)}%`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28" role="img" aria-label="${escapeXml(`${label}: ${value}`)}"><rect width="220" height="28" fill="#17243d" rx="5"/><rect width="6" height="28" fill="${uptimeColor(average)}"/><text x="16" y="19" fill="#fff" font-family="Arial,sans-serif" font-size="13">${escapeXml(label)}</text><text x="208" y="19" fill="#fff" font-family="Arial,sans-serif" font-size="13" text-anchor="end">${escapeXml(value)}</text></svg>`;
};
const averageFor = (serviceId: string): number | null => {
  const values = uptime.days.map((day) => day.services[serviceId]).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
};
await mkdir('public/badges', { recursive: true });
await writeFile('public/badges/status.svg', badge('status', summary.overall.replaceAll('_', ' ')));
await writeFile('public/badges/incidents.svg', badge('incidents', String(summary.activeIncidentCount)));
for (const service of services.services) {
  await writeFile(`public/badges/service-${service.id}.svg`, badge(service.name, service.status.replaceAll('_', ' ')));
  const average = averageFor(service.id);
  if (average !== null) await writeFile(`public/badges/uptime-${service.id}.svg`, uptimeBadge(service.name, average));
}
const allValues = uptime.days.flatMap((day) => Object.values(day.services)).filter((value): value is number => typeof value === 'number');
if (allValues.length) {
  await writeFile('public/badges/uptime.svg', uptimeBadge('uptime', allValues.reduce((total, value) => total + value, 0) / allValues.length));
}
