import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

interface StatusConfig {
  site?: { name?: string; timezone?: string };
  monitoring?: { mode?: string; timeoutMs?: number };
  history?: { initialMonths?: number; monthsPerLoad?: number };
}
const config = parse(await readFile('config/statuspage.yml', 'utf8')) as StatusConfig;
const errors: string[] = [];
const mode = config.monitoring?.mode;
const initialMonths = config.history?.initialMonths;
const monthsPerLoad = config.history?.monthsPerLoad;
const timeoutMs = config.monitoring?.timeoutMs;
if (!config.site?.name || !config.site?.timezone) errors.push('site.name and site.timezone are required');
if (!mode || !['scheduled', 'manual', 'hybrid'].includes(mode)) errors.push('monitoring.mode must be scheduled, manual, or hybrid');
if (typeof initialMonths !== 'number' || !Number.isInteger(initialMonths) || initialMonths < 1) errors.push('history.initialMonths must be a positive integer');
if (monthsPerLoad !== 3) errors.push('history.monthsPerLoad must be 3');
if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 100) errors.push('monitoring.timeoutMs must be at least 100');
if (errors.length) { errors.forEach((error) => console.error(`config: ${error}`)); process.exitCode = 1; }
else console.log('Configuration is valid.');
