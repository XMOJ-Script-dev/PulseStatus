import { describe, expect, it } from 'vitest';
import { buildTimeline, extractPostmortem, isActiveIssue, issueToIncident, parseIssueLabels, trustedComment } from '../src/data/issues';
import { issueToMaintenance, maintenanceState, parseMaintenanceTimes } from '../src/data/maintenance';
import { applyCheck, effectiveMonitorMode } from '../src/data/monitor';
import { buildDailyUptime, buildSummary, durationParts, groupHistoryByMonth, groupMaintenanceByMonth, groupStatus, groupStatusRank, mergeTimelineEntries, renderMarkdown } from '../src/utils/status';
import { buildAtomFeed, buildIcsFeed } from '../src/utils/feed';
import { buildDemoIncidents, buildDemoMaintenance } from '../src/utils/demo';
import type { Incident, Maintenance, Service } from '../src/types/status';

const config = { publishLabel: 'statuspage/incident', serviceIds: ['web', 'api'], trustedMaintainers: ['maintainer'], trustedAssociations: ['OWNER'] };
const issue = { number: 1, title: 'API outage', body: 'Users affected', html_url: 'https://github.com/o/r/issues/1', created_at: '2026-01-31T23:00:00Z', updated_at: '2026-02-01T00:00:00Z', closed_at: null, state: 'open' as const, labels: [{ name: 'statuspage/incident' }, { name: 'service/api' }, { name: 'severity/major' }, { name: 'state/investigating' }], user: { login: 'reporter' } };

describe('Issue parsing', () => {
  it('merges a nearby blank state event into its real update', () => {
    const entries = [
      { id: 'state', at: '2026-01-01T00:00:00Z', type: 'state_change' as const, state: 'monitoring' as const, text: '' },
      { id: 'comment', at: '2026-01-01T00:02:00Z', type: 'comment' as const, state: 'monitoring' as const, text: 'Monitoring update.' },
    ];
    expect(mergeTimelineEntries(entries)).toEqual([entries[1]]);
  });

  it('requires exactly one valid severity and known services', () => {
    expect(parseIssueLabels(issue.labels, config).valid).toBe(true);
    expect(parseIssueLabels([...issue.labels, { name: 'severity/minor' }], config).valid).toBe(false);
    expect(parseIssueLabels([{ name: 'statuspage/incident' }, { name: 'severity/major' }], config).valid).toBe(false);
  });
  it('separates resolved and closed issues from active incidents', () => {
    const parsed = parseIssueLabels(issue.labels, config);
    expect(isActiveIssue(issue, parsed)).toBe(true);
    expect(isActiveIssue({ state: 'closed' }, parsed)).toBe(false);
    expect(isActiveIssue(issue, { ...parsed, state: 'resolved' })).toBe(false);
  });
  it('only includes trusted comments in timeline', () => {
    const comments = [{ id: 1, body: '<script>alert(1)</script>', html_url: 'https://x', created_at: '2026-02-01T01:00:00Z', user: { login: 'random', author_association: 'NONE' } }, { id: 2, body: 'Investigating', html_url: 'https://y', created_at: '2026-02-01T02:00:00Z', user: { login: 'maintainer', author_association: 'OWNER' } }, { id: 3, body: 'Monitoring', html_url: 'https://z', created_at: '2026-02-01T03:00:00Z', user: { login: 'maintainer', author_association: 'OWNER' } }];
    expect(trustedComment(comments[0], config)).toBe(false);
    const incident = issueToIncident(issue, comments, config, [{ event: 'labeled', created_at: '2026-02-01T02:30:00Z', label: { name: 'state/monitoring' } }])!;
    expect(incident.timeline).toHaveLength(4);
    expect(incident.timeline[1].text).not.toContain('<script>');
    expect(incident.timeline[1].state).toBe('investigating');
    expect(incident.timeline[0].state).toBe('investigating');
    expect(incident.timeline[2].state).toBe('monitoring');
    expect(incident.timeline[2].type).toBe('state_change');
    expect(incident.timeline[2].text).toBe('');
    expect(incident.timeline[3].state).toBe('monitoring');
  });
  it('publishes only the Issue Form impact summary', () => {
    const incident = issueToIncident({
      ...issue,
      body: '### Affected service\n\napi\n\n### Impact summary\n\n**API errors** are affecting users.\n\n---\n\nextra form content\n\n### Initial phase\n\ninvestigating',
    }, [], config)!;
    expect(incident.bodyMarkdown).toBe('**API errors** are affecting users.');
    expect(incident.bodySummary).toBe('API errors are affecting users.');
  });
});

describe('history and maintenance', () => {
  it('groups resolved incidents by UTC start month only', () => {
    const incidents = [issueToIncident({ ...issue, state: 'closed', closed_at: '2026-02-02T00:00:00Z' }, [], config)!] as Incident[];
    const groups = groupHistoryByMonth(incidents);
    expect([...groups.keys()]).toEqual(['2026-01']);
  });
  it('handles maintenance boundaries and invalid forms', () => {
    const parsed = parseMaintenanceTimes('Starts at: 2026-10-15T02:00:00+08:00\nEnds at: 2026-10-15T03:00:00+08:00\nTimezone: Asia/Singapore');
    expect(parsed).not.toBeNull();
    expect(maintenanceState(parsed!.startsAt, parsed!.endsAt, new Date('2026-10-14T00:00:00Z'))).toBe('scheduled');
    expect(maintenanceState(parsed!.startsAt, parsed!.endsAt, new Date('2026-10-14T18:00:00Z'))).toBe('in_progress');
    expect(maintenanceState(parsed!.startsAt, parsed!.endsAt, new Date('2026-10-15T00:00:00Z'))).toBe('completed');
    expect(parseMaintenanceTimes('no timestamps')).toBeNull();
    expect(parseMaintenanceTimes('### Starts at\n2026-10-15T02:00:00+08:00\n### Ends at\n2026-10-15T03:00:00+08:00\n### Timezone\nAsia/Singapore')).not.toBeNull();
  });
  it('groups completed and cancelled maintenance by start month, newest first', () => {
    const item = (id: string, startsAt: string, state: Maintenance['state']): Maintenance => ({ id, title: '', startsAt, endsAt: startsAt, timezone: 'UTC', serviceIds: ['api'], url: '', state });
    const groups = groupMaintenanceByMonth([
      item('a', '2026-02-10T00:00:00Z', 'completed'),
      item('b', '2026-01-15T00:00:00Z', 'cancelled'),
      item('c', '2026-02-01T00:00:00Z', 'completed'),
      item('d', '2026-03-01T00:00:00Z', 'scheduled'),
      item('e', '2026-03-02T00:00:00Z', 'in_progress'),
    ]);
    expect([...groups.keys()]).toEqual(['2026-02', '2026-01']);
    expect(groups.get('2026-02')!.map((entry) => entry.id)).toEqual(['a', 'c']);
  });
  it('excludes planned maintenance windows from downtime', () => {
    const incidents: Incident[] = [
      { id: '1', number: 1, title: '', url: '', bodySummary: '', startedAt: '2026-10-15T01:00:00Z', updatedAt: '2026-10-15T04:00:00Z', closedAt: '2026-10-15T04:00:00Z', state: 'resolved', severity: 'major', serviceIds: ['api'], isActive: false, timeline: [] },
    ];
    const window = { id: 'm1', number: 1, title: '', startsAt: '2026-10-15T02:00:00Z', endsAt: '2026-10-15T03:00:00Z', timezone: 'UTC', serviceIds: ['api'], url: '', state: 'in_progress' } as Maintenance;
    const [day] = buildDailyUptime(incidents, ['api'], '2026-10-16T00:00:00Z', 1, [], [window]);
    expect(day.services.api).toBe(91.667);
    const [cancelledDay] = buildDailyUptime(incidents, ['api'], '2026-10-16T00:00:00Z', 1, [], [{ ...window, state: 'cancelled' }]);
    expect(cancelledDay.services.api).toBe(87.5);
    const [unrelatedDay] = buildDailyUptime(incidents, ['api'], '2026-10-16T00:00:00Z', 1, [], [{ ...window, serviceIds: ['web'] }]);
    expect(unrelatedDay.services.api).toBe(87.5);
  });
  it('keeps a delayed maintenance that overruns its window in progress', () => {
    const base = { number: 7, title: 'Delayed window', body: 'Starts at: 2026-10-15T02:00:00+08:00\nEnds at: 2026-10-15T03:00:00+08:00', html_url: 'https://github.com/x/y/issues/7', state: 'open' as const, labels: [{ name: 'state/delayed' }] };
    expect(issueToMaintenance(base, ['web'], new Date('2026-10-15T00:00:00Z'))?.state).toBe('in_progress');
    expect(issueToMaintenance({ ...base, labels: [] }, ['web'], new Date('2026-10-15T00:00:00Z'))?.state).toBe('completed');
    expect(issueToMaintenance({ ...base, labels: [{ name: 'state/cancelled' }] }, ['web'], new Date('2026-10-15T00:00:00Z'))?.state).toBe('cancelled');
  });

  it('calculates daily uptime from merged downtime intervals', () => {
    const incidents: Incident[] = [
      { id: '1', number: 1, title: '', url: '', bodySummary: '', startedAt: '2026-10-15T01:00:00Z', updatedAt: '2026-10-15T04:00:00Z', closedAt: '2026-10-15T04:00:00Z', state: 'resolved', severity: 'major', serviceIds: ['api'], isActive: false, timeline: [] },
      { id: '2', number: 2, title: '', url: '', bodySummary: '', startedAt: '2026-10-15T03:00:00Z', updatedAt: '2026-10-15T05:00:00Z', closedAt: '2026-10-15T05:00:00Z', state: 'resolved', severity: 'major', serviceIds: ['api'], isActive: false, timeline: [] },
    ];
    const [day] = buildDailyUptime(incidents, ['api', 'web'], '2026-10-16T00:00:00Z', 1);
    expect(day).toEqual({ date: '2026-10-15', services: { api: 83.333, web: 100 } });
  });
  it('includes the current detected outage in today’s uptime', () => {
    const [day] = buildDailyUptime([], ['web'], '2026-10-16T00:00:00Z', 1, [{
      id: 'web', status: 'down', lastCheckedAt: '2026-10-15T12:00:00Z',
    }]);
    expect(day.services.web).toBe(50);
  });
  it('renders safe Markdown without allowing raw HTML or unsafe links', () => {
    const rendered = renderMarkdown('## Impact\n\n**Down** [details](https://example.com)\n\n<script>alert(1)</script> [bad](javascript:alert(1))');
    expect(rendered).toContain('<h2>Impact</h2>');
    expect(rendered).toContain('<strong>Down</strong>');
    expect(rendered).toContain('href="https://example.com"');
    expect(rendered).not.toContain('<script>');
    expect(rendered).not.toContain('javascript:');
  });
});

describe('monitoring thresholds', () => {
  it('uses the configured global mode unless a service overrides it', () => {
    expect(effectiveMonitorMode('hybrid')).toBe('hybrid');
    expect(effectiveMonitorMode('hybrid', 'manual')).toBe('manual');
    expect(effectiveMonitorMode('manual', 'scheduled')).toBe('scheduled');
  });

  it('requires configured consecutive failures and successes', () => {
    const down = applyCheck({ consecutiveFailures: 1, consecutiveSuccesses: 0, status: 'unknown' }, { ok: false, statusCode: null, latencyMs: null }, 2, 2);
    expect(down.status).toBe('down');
    const recovering = applyCheck({ consecutiveFailures: 0, consecutiveSuccesses: 1, status: 'down' }, { ok: true, statusCode: 200, latencyMs: 10 }, 2, 2);
    expect(recovering.status).toBe('operational');
  });

  describe('manual service defaults', () => {
    it('keeps a manual service operational without making an HTTP request', () => {
      const summary = buildSummary([], [{ id: 'api', name: 'API', group: 'Core', description: '', status: 'operational', monitorMode: 'manual' }]);
      expect(summary.overall).toBe('operational');
    });

    it('reports an outage from a down service even without a published incident', () => {
      const summary = buildSummary([], [{ id: 'web', name: 'Web', group: 'Core', description: '', status: 'down', monitorMode: 'scheduled' }]);
      expect(summary.overall).toBe('major_outage');
      expect(summary.activeIncidentCount).toBe(0);
      expect(summary.hasActiveIncident).toBe(false);
    });
  });
});

describe('group status', () => {
  const service = (id: string, status: Service['status']) => ({ id, name: id, description: '', status, monitorMode: 'manual' }) as Service;
  const incident = (severity: Incident['severity'], serviceIds: string[], isActive = true) =>
    ({ id: severity, number: 1, title: '', url: '', bodySummary: '', startedAt: '', updatedAt: '', state: 'investigating', severity, serviceIds, isActive, timeline: [] }) as Incident;

  it('ranks more severe statuses first', () => {
    expect(groupStatusRank.major_outage).toBeLessThan(groupStatusRank.all_down);
    expect(groupStatusRank.all_down).toBeLessThan(groupStatusRank.partial_outage);
    expect(groupStatusRank.partial_outage).toBeLessThan(groupStatusRank.degraded_performance);
    expect(groupStatusRank.degraded_performance).toBeLessThan(groupStatusRank.unknown);
    expect(groupStatusRank.unknown).toBeLessThan(groupStatusRank.operational);
  });

  it('returns operational when all members are operational', () => {
    expect(groupStatus([service('web', 'operational'), service('api', 'operational')], [])).toBe('operational');
  });

  it('returns partial_outage when one member is down', () => {
    expect(groupStatus([service('web', 'operational'), service('api', 'down')], [])).toBe('partial_outage');
  });

  it('returns all_down when every member is down', () => {
    expect(groupStatus([service('web', 'down'), service('api', 'down')], [])).toBe('all_down');
  });

  it('returns degraded_performance when members are degraded but none are down', () => {
    expect(groupStatus([service('web', 'operational'), service('api', 'degraded')], [])).toBe('degraded_performance');
  });

  it('returns partial_outage for an active major incident', () => {
    expect(groupStatus([service('web', 'operational'), service('api', 'operational')], [incident('major', ['api'])])).toBe('partial_outage');
  });

  it('returns major_outage for an active critical incident', () => {
    expect(groupStatus([service('api', 'operational')], [incident('critical', ['api'])])).toBe('major_outage');
  });

  it('returns degraded_performance for an active minor incident', () => {
    expect(groupStatus([service('api', 'operational')], [incident('minor', ['api'])])).toBe('degraded_performance');
  });

  it('lets an incident override an operational service status', () => {
    expect(groupStatus([service('api', 'operational')], [incident('major', ['api'])])).toBe('partial_outage');
  });

  it('returns unknown for an empty group', () => {
    expect(groupStatus([], [incident('major', ['api'])])).toBe('unknown');
  });

  it('returns unknown when a member is unknown and nothing is more severe', () => {
    expect(groupStatus([service('web', 'operational'), service('api', 'unknown')], [])).toBe('unknown');
  });
});

describe('subscriptions and content', () => {
  it('extracts a postmortem section and stops at the next heading', () => {
    const body = 'Impact summary\n\n## Postmortem\n\nRoot cause was a bad deploy.\n\n- item one\n\n## Follow-ups\n\ntracked elsewhere';
    expect(extractPostmortem(body)).toBe('Root cause was a bad deploy.\n\n- item one');
    expect(extractPostmortem('### Postmortem\n\ntext')).toBe('text');
    expect(extractPostmortem('no section')).toBeUndefined();
    expect(extractPostmortem(null)).toBeUndefined();
    expect(extractPostmortem('## Postmortem\n')).toBeUndefined();
  });
  it('computes human duration parts', () => {
    expect(durationParts('2026-10-15T00:00:00Z', '2026-10-15T02:05:00Z')).toEqual({ days: 0, hours: 2, minutes: 5 });
    expect(durationParts('2026-10-15T00:00:00Z', '2026-10-17T01:00:00Z')).toEqual({ days: 2, hours: 1, minutes: 0 });
    expect(durationParts('2026-10-15T02:00:00Z', '2026-10-15T01:00:00Z')).toBeNull();
  });
  it('builds an atom feed with escaped xml and newest first', () => {
    const feed = buildAtomFeed([
      { id: 'a', title: 'Old <incident> & done', url: 'https://x.test/a', updatedAt: '2026-10-01T00:00:00Z', summary: 'older', categories: ['api'] },
      { id: 'b', title: 'New', url: 'https://x.test/b', updatedAt: '2026-10-03T00:00:00Z', summary: 'newer', categories: [] },
    ], { title: 'Status & more', siteUrl: 'https://x.test/', feedUrl: 'https://x.test/feed.xml' });
    expect(feed.indexOf('<entry>')).toBeGreaterThan(-1);
    expect(feed.indexOf('<id>b</id>')).toBeLessThan(feed.indexOf('<id>a</id>'));
    expect(feed).toContain('Old &lt;incident&gt; &amp; done');
    expect(feed).toContain('<category term="api"/>');
    expect(feed).toContain('Status &amp; more');
  });
  it('builds an ics calendar for maintenance windows', () => {
    const ics = buildIcsFeed([
      { id: 'm-1', title: 'DB, upgrade; window', url: 'https://x.test/m/1', startsAt: '2026-11-01T02:00:00Z', endsAt: '2026-11-01T03:00:00Z' },
    ], { title: 'Maint', siteUrl: 'https://x.test/', feedUrl: 'https://x.test/cal.ics' });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:m-1@x.test');
    expect(ics).toContain('DTSTART:20261101T020000Z');
    expect(ics).toContain('SUMMARY:DB\\, upgrade\\; window');
  });
  it('generates deterministic demo data with an active incident and in-progress maintenance', () => {
    const at = '2026-11-06T12:00:00.000Z';
    const incidentsA = buildDemoIncidents(at);
    expect(JSON.stringify(buildDemoIncidents(at))).toBe(JSON.stringify(incidentsA));
    expect(incidentsA.some((incident) => incident.isActive)).toBe(true);
    expect(incidentsA.every((incident) => incident.id.startsWith('issue-demo-'))).toBe(true);
    const maintenance = buildDemoMaintenance(at);
    expect(maintenance.some((item) => item.state === 'in_progress')).toBe(true);
    expect(maintenance.some((item) => item.state === 'scheduled')).toBe(true);
  });
});
