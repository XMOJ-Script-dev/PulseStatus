import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { applyCheck, effectiveMonitorMode } from '../src/data/monitor';
import type { MonitorState, ProbeHistory, Service } from '../src/types/status';

const services = JSON.parse(await readFile('config/services.json', 'utf8')) as Array<Service & { checkUrl?: string }>;
const config = parse(await readFile('config/statuspage.yml', 'utf8')) as { monitoring?: { mode?: 'scheduled' | 'manual' | 'hybrid'; probeIntervalMinutes?: number; timeoutMs?: number; failuresToDown?: number; successesToRecover?: number; historyRetentionDays?: number } };
const mode = (process.env.PULSE_MONITOR_MODE ?? config.monitoring?.mode ?? 'manual') as 'scheduled' | 'manual' | 'hybrid';
const timeoutMs = Number(process.env.PULSE_TIMEOUT_MS ?? config.monitoring?.timeoutMs ?? 5000);
const defaultIntervalMinutes = config.monitoring?.probeIntervalMinutes ?? 15;
const failuresToDown = config.monitoring?.failuresToDown ?? 2;
const successesToRecover = config.monitoring?.successesToRecover ?? 2;
const retentionDays = config.monitoring?.historyRetentionDays ?? 90;
let previousServices: Service[] = [];
try {
  previousServices = (JSON.parse(await readFile('public/data/services.json', 'utf8')) as { services?: Service[] }).services ?? [];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
let monitorState: MonitorState = { generatedAt: new Date(0).toISOString(), services: {} };
try {
  monitorState = JSON.parse(await readFile('public/data/monitor-state.json', 'utf8')) as MonitorState;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
let probeHistory: ProbeHistory = { schemaVersion: 1, services: {} };
try {
  probeHistory = JSON.parse(await readFile('public/data/probe-history.json', 'utf8')) as ProbeHistory;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const now = new Date();
const results = await Promise.all(services.map(async (service): Promise<Service> => {
  const monitorMode = effectiveMonitorMode(mode, service.monitorMode);
  if (monitorMode === 'manual' || !service.checkUrl) {
    return { ...service, status: 'operational', monitorMode, lastCheckedAt: undefined, latencyMs: undefined };
  }
  const previous = previousServices.find((item) => item.id === service.id);
  const previousState = monitorState.services[service.id] ?? { consecutiveFailures: 0, consecutiveSuccesses: 0 };
  const intervalMinutes = service.checkIntervalMinutes ?? defaultIntervalMinutes;
  const lastProbeAt = previousState.lastProbeAt ?? previous?.lastCheckedAt;
  const lastProbeValue = lastProbeAt ? new Date(lastProbeAt).valueOf() : Number.NaN;
  const lastCheckedValue = previous?.lastCheckedAt ? new Date(previous.lastCheckedAt).valueOf() : Number.NaN;
  const snapshotIsStale = Number.isFinite(lastProbeValue) && (!Number.isFinite(lastCheckedValue) || lastCheckedValue < lastProbeValue);
  const due = snapshotIsStale || !lastProbeAt || !Number.isFinite(lastProbeValue) || now.valueOf() - lastProbeValue >= intervalMinutes * 60_000;
  if (!due && previous) {
    monitorState.services[service.id] = { ...previousState, probeDue: false };
    return { ...previous, ...service, status: previous.status, lastCheckedAt: previous.lastCheckedAt, latencyMs: previous.latencyMs, monitorMode };
  }
  const started = performance.now();
  let status: Service['status'] = 'unknown';
  let latencyMs: number | undefined;
  let statusCode: number | undefined;
  try {
    const checkUrl = new URL(service.checkUrl);
    if (!['http:', 'https:'].includes(checkUrl.protocol)) throw new Error(`Unsupported probe URL protocol: ${checkUrl.protocol}`);
    const response = await fetch(checkUrl, { signal: AbortSignal.timeout(timeoutMs) });
    latencyMs = Math.round(performance.now() - started);
    statusCode = response.status;
    status = response.ok ? 'operational' : 'degraded';
  } catch {
    latencyMs = Math.round(performance.now() - started);
    status = 'down';
  }
  const checkedAt = new Date().toISOString();
  const smoothed = applyCheck(
    { consecutiveFailures: previousState.consecutiveFailures, consecutiveSuccesses: previousState.consecutiveSuccesses, status: previous?.status ?? 'unknown' },
    { ok: status !== 'down', statusCode: statusCode ?? null, latencyMs: latencyMs ?? null },
    failuresToDown,
    successesToRecover,
  );
  const displayStatus: Service['status'] = status === 'degraded' ? 'degraded' : smoothed.status;
  probeHistory.services[service.id] ??= [];
  probeHistory.services[service.id].push({ checkedAt, status, latencyMs, statusCode });
  monitorState.services[service.id] = { ...previousState, lastProbeAt: checkedAt, probeDue: true };
  return { ...service, status: displayStatus, latencyMs, lastCheckedAt: checkedAt, monitorMode };
}));
const retentionCutoff = now.valueOf() - retentionDays * 86_400_000;
for (const [serviceId, probes] of Object.entries(probeHistory.services)) {
  probeHistory.services[serviceId] = probes.filter((probe) => new Date(probe.checkedAt).valueOf() >= retentionCutoff);
}
await writeFile('public/data/services.json', JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), services: results }, null, 2));
monitorState.generatedAt = now.toISOString();
await writeFile('public/data/monitor-state.json', JSON.stringify(monitorState, null, 2));
await writeFile('public/data/probe-history.json', JSON.stringify(probeHistory, null, 2));
