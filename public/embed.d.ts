export interface PulseSummary {
  overall: string;
  hasActiveIncident: boolean;
  activeIncidentCount: number;
  affectedServiceCount: number;
  activeMaintenanceCount: number;
}
export interface PulseStatusApi { getSummary(): Promise<PulseSummary> }
