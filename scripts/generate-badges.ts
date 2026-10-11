import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Service, Summary } from '../src/types/status';

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character] ?? character));
const summary = JSON.parse(await readFile('public/data/summary.json', 'utf8')) as Summary;
const services = JSON.parse(await readFile('public/data/services.json', 'utf8')) as { services: Service[] };
const badge = (label: string, value: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28" role="img" aria-label="${escapeXml(`${label}: ${value}`)}"><rect width="220" height="28" fill="#17243d" rx="5"/><text x="12" y="19" fill="#fff" font-family="Arial,sans-serif" font-size="13">${escapeXml(label)}</text><text x="208" y="19" fill="#fff" font-family="Arial,sans-serif" font-size="13" text-anchor="end">${escapeXml(value)}</text></svg>`;
await mkdir('public/badges', { recursive: true });
await writeFile('public/badges/status.svg', badge('status', summary.overall.replaceAll('_', ' ')));
await writeFile('public/badges/incidents.svg', badge('incidents', String(summary.activeIncidentCount)));
for (const service of services.services) await writeFile(`public/badges/service-${service.id}.svg`, badge(service.name, service.status.replaceAll('_', ' ')));
