import { describe, expect, it } from 'vitest';
import { buildTimeline, isActiveIssue, issueToIncident, parseIssueLabels, trustedComment } from '../src/data/issues';
import { maintenanceState, parseMaintenanceTimes } from '../src/data/maintenance';
import { applyCheck } from '../src/data/monitor';
import { buildDailyUptime, buildSummary, groupHistoryByMonth, renderMarkdown } from '../src/utils/status';
import type { Incident } from '../src/types/status';

const config = { publishLabel: 'statuspage/incident', serviceIds: ['web', 'api'], trustedMaintainers: ['maintainer'], trustedAssociations: ['OWNER'] };
const issue = { number: 1, title: 'API outage', body: 'Users affected', html_url: 'https://github.com/o/r/issues/1', created_at: '2026-01-31T23:00:00Z', updated_at: '2026-02-01T00:00:00Z', closed_at: null, state: 'open' as const, labels: [{ name: 'statuspage/incident' }, { name: 'service/api' }, { name: 'severity/major' }, { name: 'state/investigating' }], user: { login: 'reporter' } };

describe('Issue parsing', () => {
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
    const comments = [{ id: 1, body: '<script>alert(1)</script>', html_url: 'https://x', created_at: '2026-02-01T01:00:00Z', user: { login: 'random', author_association: 'NONE' } }, { id: 2, body: 'Investigating', html_url: 'https://y', created_at: '2026-02-01T02:00:00Z', user: { login: 'maintainer', author_association: 'OWNER' } }];
    expect(trustedComment(comments[0], config)).toBe(false);
    const incident = issueToIncident(issue, comments, config)!;
    expect(incident.timeline).toHaveLength(2);
    expect(incident.timeline[1].text).not.toContain('<script>');
    expect(incident.timeline[1].state).toBe('investigating');
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
