export type Severity = 'minor' | 'major' | 'critical';
export type IncidentState = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown' | 'manually_reported';
export type OverallStatus = 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'unknown';

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
  group: string;
  description: string;
  publicUrl?: string;
  status: ServiceStatus;
  lastCheckedAt?: string;
  latencyMs?: number;
  uptime30d?: number;
  uptime90d?: number;
  monitorMode: 'scheduled' | 'manual' | 'hybrid';
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
