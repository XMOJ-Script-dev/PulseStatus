export type Severity = 'minor' | 'major' | 'critical';
export type IncidentState = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown' | 'manually_reported';
export type OverallStatus = 'operational' | 'monitoring' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'unknown';

export interface TimelineEntry {
  id: string;
  at: string;
  type: 'comment' | 'state_change' | 'issue_event';
  state?: IncidentState;
  text: string;
  url?: string;
  author?: string;
}

export interface Incident {
  id: string;
  number: number;
  title: string;
  url: string;
  bodySummary: string;
  startedAt: string;
  updatedAt: string;
  closedAt?: string;
  state: IncidentState;
  severity: Severity;
  serviceIds: string[];
  isActive: boolean;
  timeline: TimelineEntry[];
}

export interface Service {
  id: string;
  name: string;
  nameI18n?: Record<string, string>;
  group: string;
  description: string;
  descriptionI18n?: Record<string, string>;
  publicUrl?: string;
  status: ServiceStatus;
  lastCheckedAt?: string;
  latencyMs?: number;
  uptime30d?: number;
  uptime90d?: number;
  monitorMode: 'scheduled' | 'manual' | 'hybrid';
  checkIntervalMinutes?: number;
}

export interface Summary {
  schemaVersion: 1;
  generatedAt: string;
  overall: OverallStatus;
  hasActiveIncident: boolean;
  activeIncidentCount: number;
  affectedServiceCount: number;
  activeMaintenanceCount: number;
  monitoringMode: 'scheduled' | 'manual' | 'hybrid';
  isDemo: boolean;
}

export interface HistoryMonth {
  month: string;
  count: number;
  url: string;
}

export interface HistoryIndex {
  schemaVersion: 1;
  generatedAt: string;
  months: HistoryMonth[];
}

export interface DailyUptime {
  date: string;
  services: Record<string, number>;
}

export interface UptimeHistory {
  schemaVersion: 1;
  generatedAt: string;
  days: DailyUptime[];
}

export interface SiteConfig {
  name: string;
  locale: string;
  timezone: string;
  favicon: string;
  companyName: string;
  companyUrl?: string;
  headerText?: string;
  footerText?: string;
  footerLinks?: Array<{ label: string; url: string }>;
  theme: 'modern' | 'compact' | 'vivid' | 'mono';
}

export interface MonitorState {
  generatedAt: string;
  services: Record<string, {
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    autoIncidentNumber?: number;
    lastProbeAt?: string;
    probeDue?: boolean;
  }>;
}

export interface ProbeResult {
  checkedAt: string;
  status: ServiceStatus;
  latencyMs?: number;
  statusCode?: number;
}

export interface ProbeHistory {
  schemaVersion: 1;
  services: Record<string, ProbeResult[]>;
}

export interface Maintenance {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  serviceIds: string[];
  url: string;
  state: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}
