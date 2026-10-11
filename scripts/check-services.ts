import { readFile, writeFile } from 'node:fs/promises';
import type { Service } from '../src/types/status';

const services = JSON.parse(await readFile('config/services.json', 'utf8')) as Array<Service & { checkUrl?: string }>;
const mode = (process.env.PULSE_MONITOR_MODE ?? 'manual') as 'scheduled' | 'manual' | 'hybrid';
const timeoutMs = Number(process.env.PULSE_TIMEOUT_MS ?? 5000);
const results: Service[] = [];
for (const service of services) {
  const monitorMode = service.monitorMode ?? mode;
  if (monitorMode === 'manual' || !service.checkUrl) {
    results.push({ ...service, status: 'manually_reported', monitorMode, lastCheckedAt: undefined, latencyMs: undefined });
    continue;
  }
  const started = performance.now();
  let status: Service['status'] = 'unknown';
  let latencyMs: number | undefined;
  try {
    const response = await fetch(service.checkUrl, { signal: AbortSignal.timeout(timeoutMs) });
    latencyMs = Math.round(performance.now() - started);
    status = response.ok ? 'operational' : 'degraded';
  } catch {
    latencyMs = Math.round(performance.now() - started);
    status = 'down';
  }
  results.push({ ...service, status, latencyMs, lastCheckedAt: new Date().toISOString(), monitorMode });
}
await writeFile('public/data/services.json', JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), services: results }, null, 2));
