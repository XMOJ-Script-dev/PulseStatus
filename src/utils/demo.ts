import type { Incident, Maintenance } from '../types/status';

function minutesAgo(generatedAt: string, minutes: number): string {
  return new Date(new Date(generatedAt).valueOf() - minutes * 60_000).toISOString();
}

function daysAgo(generatedAt: string, days: number): string {
  return minutesAgo(generatedAt, days * 1440);
}

function daysFromNow(generatedAt: string, days: number): string {
  return new Date(new Date(generatedAt).valueOf() + days * 1440 * 60_000).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).valueOf() + minutes * 60_000).toISOString();
}

function demoIncident(partial: Pick<Incident, 'id' | 'number' | 'title' | 'startedAt' | 'updatedAt' | 'closedAt' | 'state' | 'severity' | 'serviceIds' | 'isActive'> & { summary: string }): Incident {
  return {
    url: 'https://github.com/demo/pulsestatus-demo',
    bodySummary: partial.summary,
    bodyMarkdown: partial.summary,
    timeline: [
      { id: `${partial.id}-opened`, at: partial.startedAt, type: 'issue_event', text: 'Incident published.' },
      { id: `${partial.id}-resolved`, at: partial.updatedAt, type: 'state_change', state: partial.state, text: '' },
    ],
    ...partial,
  };
}

export function buildDemoIncidents(generatedAt: string): Incident[] {
  return [
    demoIncident({
      id: 'issue-demo-101', number: 101, title: '[Demo] Elevated error rates on the API',
      startedAt: minutesAgo(generatedAt, 25), updatedAt: minutesAgo(generatedAt, 5),
      state: 'monitoring', severity: 'major', serviceIds: ['api'], isActive: true,
      summary: 'Demo data: the API is returning elevated 5xx responses while the fix is monitored.',
    }),
    demoIncident({
      id: 'issue-demo-100', number: 100, title: '[Demo] Brief docs site outage',
      startedAt: daysAgo(generatedAt, 3), updatedAt: addMinutes(daysAgo(generatedAt, 3), 40),
      closedAt: addMinutes(daysAgo(generatedAt, 3), 40),
      state: 'resolved', severity: 'minor', serviceIds: ['docs'], isActive: false,
      summary: 'Demo data: the documentation site was unreachable for 40 minutes during a deployment.',
    }),
    demoIncident({
      id: 'issue-demo-99', number: 99, title: '[Demo] Assets service degradation',
      startedAt: daysAgo(generatedAt, 12), updatedAt: addMinutes(daysAgo(generatedAt, 12), 120),
      closedAt: addMinutes(daysAgo(generatedAt, 12), 120),
      state: 'resolved', severity: 'critical', serviceIds: ['assets'], isActive: false,
      summary: 'Demo data: image serving was degraded for two hours after a storage backend failure.',
    }),
  ];
}

export function buildDemoMaintenance(generatedAt: string): Maintenance[] {
  return [
    {
      id: 'maintenance-demo-7',
      title: '[Demo] API database upgrade',
      startsAt: minutesAgo(generatedAt, 10),
      endsAt: addMinutes(generatedAt, 50),
      timezone: 'UTC',
      serviceIds: ['api', 'assets'],
      url: 'https://github.com/demo/pulsestatus-demo',
      state: 'in_progress',
    },
    {
      id: 'maintenance-demo-8',
      title: '[Demo] Planned network maintenance',
      startsAt: daysFromNow(generatedAt, 2),
      endsAt: addMinutes(daysFromNow(generatedAt, 2), 90),
      timezone: 'UTC',
      serviceIds: ['web'],
      url: 'https://github.com/demo/pulsestatus-demo',
      state: 'scheduled',
    },
  ];
}
