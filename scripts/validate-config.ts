import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import type { Service } from '../src/types/status';

interface StatusConfig {
  site?: {
    name?: string; timezone?: string; theme?: string; showGithub?: boolean; githubUrl?: string; githubLabel?: string; layout?: string;
    logo?: string; heroTitle?: string; tagline?: string; language?: string; url?: string; headHtml?: string;
    navLinks?: Array<{ label?: unknown; url?: unknown }>; colors?: Record<string, unknown>;
    externalStatus?: Array<{ name?: unknown; apiUrl?: unknown }>;
  };
  monitoring?: { mode?: string; timeoutMs?: number; probeIntervalMinutes?: number; schedule?: string; autoPublishIncident?: boolean; failuresToIncident?: number; recoverySuccessesToCloseIncident?: number; demoData?: boolean };
  issues?: { autoIncidentMentions?: string[]; autoIncidentSeverity?: string; notifyFormat?: string; notifyNtfyTopic?: string };
  serviceGroups?: Record<string, { parentGroup?: string; name?: string; nameI18n?: Record<string, string>; defaultExpanded?: boolean }>;
  history?: { initialMonths?: number; monthsPerLoad?: number; uptimeDays?: number };
}
const config = parse(await readFile('config/statuspage.yml', 'utf8')) as StatusConfig;
const services = JSON.parse(await readFile('config/services.json', 'utf8')) as Array<Pick<Service, 'id' | 'group' | 'parentGroup' | 'checkIntervalMinutes' | 'dependsOn' | 'runbookUrl' | 'checkType' | 'checkPort' | 'checkUrl' | 'expectContent' | 'certSha256' | 'certMinDays' | 'dnsExpect'>>;
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
if (typeof config.site?.showGithub !== 'undefined' && typeof config.site.showGithub !== 'boolean') errors.push('site.showGithub must be true or false');
if (typeof config.site?.githubUrl !== 'undefined' && typeof config.site.githubUrl !== 'string') errors.push('site.githubUrl must be a string');
if (typeof config.site?.githubLabel !== 'undefined' && typeof config.site.githubLabel !== 'string') errors.push('site.githubLabel must be a string');
if (!['standard', 'fused'].includes(config.site?.layout ?? 'standard')) errors.push('site.layout must be standard or fused');
if (typeof config.site?.logo !== 'undefined' && typeof config.site.logo !== 'string') errors.push('site.logo must be a string');
if (typeof config.site?.heroTitle !== 'undefined' && typeof config.site.heroTitle !== 'string') errors.push('site.heroTitle must be a string');
if (typeof config.site?.tagline !== 'undefined' && typeof config.site.tagline !== 'string') errors.push('site.tagline must be a string');
if (!['auto', 'en', 'zh'].includes(config.site?.language ?? 'auto')) errors.push('site.language must be auto, en, or zh');
if (config.site?.navLinks) {
  if (!Array.isArray(config.site.navLinks) || config.site.navLinks.some((link) => typeof link?.label !== 'string' || !link.label.trim() || typeof link?.url !== 'string' || !link.url.trim())) errors.push('site.navLinks must be a list of { label, url } with non-empty strings');
}
if (typeof config.site?.colors !== 'undefined') {
  const allowedColorKeys = ['brand', 'brandDeep', 'success', 'warning', 'danger'];
  for (const [key, value] of Object.entries(config.site.colors)) {
    if (!allowedColorKeys.includes(key)) errors.push(`site.colors.${key} is not a supported color key (${allowedColorKeys.join(', ')})`);
    else if (typeof value !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) errors.push(`site.colors.${key} must be a hex color like #4f46e5`);
  }
}
if (typeof config.site?.url !== 'undefined' && (typeof config.site.url !== 'string' || !/^https:\/\/.+/.test(config.site.url))) errors.push('site.url must be an absolute https URL, e.g. https://status.example.com');
if (typeof config.site?.headHtml !== 'undefined' && typeof config.site.headHtml !== 'string') errors.push('site.headHtml must be a string');
if (config.site?.externalStatus) {
  if (!Array.isArray(config.site.externalStatus) || config.site.externalStatus.some((entry) => typeof entry?.name !== 'string' || !entry.name.trim() || typeof entry?.apiUrl !== 'string' || !/^https:\/\/.+/.test(entry.apiUrl))) errors.push('site.externalStatus must be a list of { name, apiUrl } with an https apiUrl');
}
const uptimeDays = config.history?.uptimeDays;
if (typeof uptimeDays !== 'undefined' && (!Number.isInteger(uptimeDays) || uptimeDays < 1)) errors.push('history.uptimeDays must be a positive integer');
if (!mode || !['scheduled', 'manual', 'hybrid'].includes(mode)) errors.push('monitoring.mode must be scheduled, manual, or hybrid');
if (typeof initialMonths !== 'number' || !Number.isInteger(initialMonths) || initialMonths < 1) errors.push('history.initialMonths must be a positive integer');
if (typeof monthsPerLoad !== 'number' || !Number.isInteger(monthsPerLoad) || monthsPerLoad < 1) errors.push('history.monthsPerLoad must be a positive integer');
if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 100) errors.push('monitoring.timeoutMs must be at least 100');
if (typeof probeIntervalMinutes !== 'number' || !Number.isInteger(probeIntervalMinutes) || probeIntervalMinutes < 1) errors.push('monitoring.probeIntervalMinutes must be a positive integer');
const schedule = config.monitoring?.schedule;
const scheduleMatch = typeof schedule === 'string' ? /^\*\/(\d+) \* \* \* \*$/.exec(schedule) : null;
if (!scheduleMatch) errors.push('monitoring.schedule must be a cron like "*/5 * * * *"');
else if (typeof probeIntervalMinutes === 'number' && Number(scheduleMatch[1]) > probeIntervalMinutes) errors.push(`monitoring.schedule cadence (${scheduleMatch[1]}m) must not exceed monitoring.probeIntervalMinutes (${probeIntervalMinutes}m), or probes will never run at the configured frequency`);
const workflowText = await readFile('.github/workflows/statuspage.yml', 'utf8').catch(() => '');
const workflowCron = workflowText.match(/cron:\s*["']([^"']+)["']/)?.[1];
if (!workflowText) errors.push('.github/workflows/statuspage.yml is missing');
else if (workflowCron !== schedule) errors.push(`workflow cron "${workflowCron ?? 'not found'}" does not match monitoring.schedule "${schedule}"; keep the Actions trigger cadence in sync with the configured probe frequency`);
const workflowServices = (workflowText.match(/PULSE_SERVICES:\s*([^\n]+)/)?.[1] ?? '').split(',').map((value) => value.trim()).filter(Boolean).sort();
const serviceIds = services.map((service) => service.id).sort();
if (workflowText && JSON.stringify(workflowServices) !== JSON.stringify(serviceIds)) errors.push(`workflow PULSE_SERVICES (${workflowServices.join(', ') || 'none'}) does not match the service ids in config/services.json (${serviceIds.join(', ')})`);
if (typeof config.monitoring?.autoPublishIncident !== 'boolean') errors.push('monitoring.autoPublishIncident must be true or false');
if (typeof config.monitoring?.demoData !== 'undefined' && typeof config.monitoring.demoData !== 'boolean') errors.push('monitoring.demoData must be true or false');
if (typeof failuresToIncident !== 'number' || !Number.isInteger(failuresToIncident) || failuresToIncident < 1) errors.push('monitoring.failuresToIncident must be a positive integer');
if (typeof recoverySuccessesToCloseIncident !== 'number' || !Number.isInteger(recoverySuccessesToCloseIncident) || recoverySuccessesToCloseIncident < 1) errors.push('monitoring.recoverySuccessesToCloseIncident must be a positive integer');
if (!Array.isArray(config.issues?.autoIncidentMentions) || config.issues.autoIncidentMentions.some((value) => typeof value !== 'string' || !/^[A-Za-z0-9-]+$/.test(value))) errors.push('issues.autoIncidentMentions must contain GitHub usernames');
if (!['minor', 'major', 'critical'].includes(config.issues?.autoIncidentSeverity ?? '')) errors.push('issues.autoIncidentSeverity must be minor, major, or critical');
if (!['discord', 'slack'].includes(config.issues?.notifyFormat ?? 'discord')) errors.push('issues.notifyFormat must be discord or slack');
if (typeof config.issues?.notifyNtfyTopic !== 'undefined' && (typeof config.issues.notifyNtfyTopic !== 'string' || !config.issues.notifyNtfyTopic.trim())) errors.push('issues.notifyNtfyTopic must be a non-empty string');
if (services.some((service) => service.checkIntervalMinutes !== undefined && (!Number.isInteger(service.checkIntervalMinutes) || service.checkIntervalMinutes < 1))) errors.push('services.checkIntervalMinutes must be a positive integer when provided');
const serviceIdsInConfig = new Set(services.map((service) => service.id));
for (const service of services) {
  if (typeof service.checkType !== 'undefined' && !['http', 'tcp'].includes(service.checkType)) errors.push(`services.${service.id}.checkType must be http or tcp`);
  if (service.checkType === 'tcp') {
    if (!Number.isInteger(service.checkPort) || (service.checkPort as number) < 1 || (service.checkPort as number) > 65535) errors.push(`services.${service.id}.checkPort must be an integer between 1 and 65535 when checkType is tcp`);
    try {
      const hostname = service.checkUrl ? new URL(service.checkUrl as string).hostname : undefined;
      if (!hostname) errors.push(`services.${service.id}.checkUrl must be set when checkType is tcp (hostname used for the TCP check)`);
    } catch { errors.push(`services.${service.id}.checkUrl is not a valid URL`); }
  }
  if (typeof service.checkPort !== 'undefined' && service.checkType !== 'tcp') errors.push(`services.${service.id}.checkPort requires checkType: "tcp"`);
  if (typeof service.runbookUrl !== 'undefined' && (typeof service.runbookUrl !== 'string' || !/^https:\/\/.+/.test(service.runbookUrl))) errors.push(`services.${service.id}.runbookUrl must be an absolute https URL`);
  if (typeof service.dependsOn !== 'undefined') {
    if (typeof service.dependsOn !== 'string' || !service.dependsOn.trim()) errors.push(`services.${service.id}.dependsOn must be a non-empty service id`);
    else if (!serviceIdsInConfig.has(service.dependsOn)) errors.push(`services.${service.id}.dependsOn references unknown service ${service.dependsOn}`);
    else if (service.dependsOn === service.id) errors.push(`services.${service.id}.dependsOn cannot reference itself`);
    else if (services.some((candidate) => candidate.dependsOn === service.id)) errors.push(`services.${service.id}.dependsOn must be single-level: ${service.id} is itself a dependency of another service`);
  }
  if (typeof service.expectContent !== 'undefined' && (typeof service.expectContent !== 'string' || !service.expectContent)) errors.push(`services.${service.id}.expectContent must be a non-empty string`);
  if (service.expectContent && service.checkType === 'tcp') errors.push(`services.${service.id}.expectContent requires HTTP probing (checkType http)`);
  if (typeof service.certSha256 !== 'undefined' && (typeof service.certSha256 !== 'string' || !/^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){31}$/.test(service.certSha256))) errors.push(`services.${service.id}.certSha256 must be a SHA-256 fingerprint like AB:12:... (32 colon-separated hex bytes)`);
  if (typeof service.certMinDays !== 'undefined' && (!Number.isInteger(service.certMinDays) || (service.certMinDays as number) < 1)) errors.push(`services.${service.id}.certMinDays must be a positive integer`);
  if ((service.certSha256 || typeof service.certMinDays !== 'undefined') && !service.checkUrl) errors.push(`services.${service.id} certificate checks require checkUrl (hostname used for the TLS handshake)`);
  if (typeof service.dnsExpect !== 'undefined') {
    const dnsType = service.dnsExpect?.type;
    const dnsValue = service.dnsExpect?.value;
    if (!service.dnsExpect || !['A', 'AAAA', 'CNAME', 'TXT', 'MX'].includes(dnsType ?? '')) errors.push(`services.${service.id}.dnsExpect.type must be A, AAAA, CNAME, TXT, or MX`);
    else if (typeof dnsValue !== 'string' || !dnsValue.trim()) errors.push(`services.${service.id}.dnsExpect.value must be a non-empty string`);
    else if (!service.checkUrl) errors.push(`services.${service.id}.dnsExpect requires checkUrl (hostname used for the DNS lookup)`);
  }
}
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
