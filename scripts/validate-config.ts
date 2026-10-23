import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import type { Service } from '../src/types/status';

interface StatusConfig {
  site?: { name?: string; timezone?: string; theme?: string };
  monitoring?: { mode?: string; timeoutMs?: number; probeIntervalMinutes?: number; autoPublishIncident?: boolean; failuresToIncident?: number; recoverySuccessesToCloseIncident?: number };
  issues?: { autoIncidentMentions?: string[]; autoIncidentSeverity?: string };
  serviceGroups?: Record<string, { parentGroup?: string; name?: string; nameI18n?: Record<string, string>; defaultExpanded?: boolean }>;
  history?: { initialMonths?: number; monthsPerLoad?: number };
}
const config = parse(await readFile('config/statuspage.yml', 'utf8')) as StatusConfig;
const services = JSON.parse(await readFile('config/services.json', 'utf8')) as Array<Pick<Service, 'id' | 'group' | 'parentGroup' | 'checkIntervalMinutes'>>;
const errors: string[] = [];
const mode = config.monitoring?.mode;
const initialMonths = config.history?.initialMonths;
const monthsPerLoad = config.history?.monthsPerLoad;
const timeoutMs = config.monitoring?.timeoutMs;
const probeIntervalMinutes = config.monitoring?.probeIntervalMinutes;
const failuresToIncident = config.monitoring?.failuresToIncident;
const recoverySuccessesToCloseIncident = config.monitoring?.recoverySuccessesToCloseIncident;
if (!config.site?.name || !config.site?.timezone) errors.push('site.name and site.timezone are required');
if (!['modern', 'compact', 'vivid', 'mono'].includes(config.site?.theme ?? '')) errors.push('site.theme must be modern, compact, vivid, or mono');
if (!mode || !['scheduled', 'manual', 'hybrid'].includes(mode)) errors.push('monitoring.mode must be scheduled, manual, or hybrid');
if (typeof initialMonths !== 'number' || !Number.isInteger(initialMonths) || initialMonths < 1) errors.push('history.initialMonths must be a positive integer');
if (monthsPerLoad !== 3) errors.push('history.monthsPerLoad must be 3');
if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 100) errors.push('monitoring.timeoutMs must be at least 100');
if (typeof probeIntervalMinutes !== 'number' || !Number.isInteger(probeIntervalMinutes) || probeIntervalMinutes < 1) errors.push('monitoring.probeIntervalMinutes must be a positive integer');
if (typeof config.monitoring?.autoPublishIncident !== 'boolean') errors.push('monitoring.autoPublishIncident must be true or false');
if (typeof failuresToIncident !== 'number' || !Number.isInteger(failuresToIncident) || failuresToIncident < 1) errors.push('monitoring.failuresToIncident must be a positive integer');
if (typeof recoverySuccessesToCloseIncident !== 'number' || !Number.isInteger(recoverySuccessesToCloseIncident) || recoverySuccessesToCloseIncident < 1) errors.push('monitoring.recoverySuccessesToCloseIncident must be a positive integer');
if (!Array.isArray(config.issues?.autoIncidentMentions) || config.issues.autoIncidentMentions.some((value) => typeof value !== 'string' || !/^[A-Za-z0-9-]+$/.test(value))) errors.push('issues.autoIncidentMentions must contain GitHub usernames');
if (!['minor', 'major', 'critical'].includes(config.issues?.autoIncidentSeverity ?? '')) errors.push('issues.autoIncidentSeverity must be minor, major, or critical');
if (services.some((service) => service.checkIntervalMinutes !== undefined && (!Number.isInteger(service.checkIntervalMinutes) || service.checkIntervalMinutes < 1))) errors.push('services.checkIntervalMinutes must be a positive integer when provided');
const groups = new Map(services.filter((service) => service.group).map((service) => [service.group!, service.parentGroup]));
for (const [group, parent] of groups) {
  if (parent && parent === group) errors.push(`services.${group}.parentGroup cannot reference itself`);
  if (parent && !groups.has(parent) && !config.serviceGroups?.[parent]) errors.push(`services.${group}.parentGroup references unknown group ${parent}`);
}
for (const [group, value] of Object.entries(config.serviceGroups ?? {})) {
  if (typeof value.defaultExpanded !== 'undefined' && typeof value.defaultExpanded !== 'boolean') errors.push(`serviceGroups.${group}.defaultExpanded must be true or false`);
  if (value.nameI18n && Object.values(value.nameI18n).some((name) => typeof name !== 'string' || !name.trim())) errors.push(`serviceGroups.${group}.nameI18n must contain non-empty strings`);
  if (value.parentGroup && value.parentGroup === group) errors.push(`serviceGroups.${group}.parentGroup cannot reference itself`);
}
for (const group of groups.keys()) {
  const visited = new Set<string>();
  let current: string | undefined = group;
  while (current) {
    if (visited.has(current)) {
      errors.push(`services.${group} contains a circular parentGroup reference`);
      break;
    }
    visited.add(current);
    current = groups.get(current) ?? config.serviceGroups?.[current]?.parentGroup;
  }
}
if (errors.length) { errors.forEach((error) => console.error(`config: ${error}`)); process.exitCode = 1; }
else console.log('Configuration is valid.');
