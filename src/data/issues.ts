import type { Incident, IncidentState, Severity, TimelineEntry } from '../types/status';

export interface GithubLabel { name: string }
export interface GithubUser { login: string; author_association?: string }
export interface GithubComment { id: number; body: string; html_url: string; created_at: string; updated_at?: string; user: GithubUser | null }
export interface GithubIssueEvent { event: string; created_at: string; label?: { name: string } }
export interface GithubIssue {
  number: number; title: string; body: string | null; html_url: string;
  created_at: string; updated_at: string; closed_at: string | null; state: 'open' | 'closed';
  labels: GithubLabel[]; user: GithubUser | null;
}

export interface IssueParseConfig {
  publishLabel: string;
  serviceIds: string[];
  trustedMaintainers: string[];
  trustedAssociations: string[];
}

export interface ParsedLabels {
  serviceIds: string[];
  severity?: Severity;
  state: IncidentState;
  isIncident: boolean;
  valid: boolean;
  errors: string[];
}

export function parseIssueLabels(labels: GithubLabel[], config: Pick<IssueParseConfig, 'publishLabel' | 'serviceIds'>): ParsedLabels {
  const names = labels.map((label) => label.name);
  const serviceIds = names.filter((name) => name.startsWith('service/')).map((name) => name.slice(8)).filter((id) => config.serviceIds.includes(id));
  const serviceLabels = names.filter((name) => name.startsWith('service/'));
  const severityLabels = names.filter((name) => name.startsWith('severity/'));
  const severity = severityLabels[0]?.slice(9) as Severity | undefined;
  const stateLabel = names.find((name) => name.startsWith('state/'))?.slice(6) as IncidentState | undefined;
  const errors: string[] = [];
  if (!names.includes(config.publishLabel)) return { serviceIds, severity, state: stateLabel ?? 'investigating', isIncident: false, valid: true, errors };
  if (!serviceIds.length) errors.push('missing or unknown service label');
  if (serviceLabels.length !== serviceIds.length) errors.push('contains unknown service label');
  if (severityLabels.length !== 1 || !['minor', 'major', 'critical'].includes(severity ?? '')) errors.push('requires exactly one valid severity label');
  return { serviceIds, severity, state: stateLabel && ['investigating', 'identified', 'monitoring', 'resolved'].includes(stateLabel) ? stateLabel : 'investigating', isIncident: true, valid: errors.length === 0, errors };
}

export function isActiveIssue(issue: Pick<GithubIssue, 'state'>, parsed: Pick<ParsedLabels, 'isIncident' | 'valid' | 'state'>): boolean {
  return parsed.isIncident && parsed.valid && issue.state === 'open' && parsed.state !== 'resolved';
}

function safeSummary(body: string | null): string {
  return (body ?? '').replace(/[`*_>#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 280);
}

function impactSummary(body: string | null): string {
  const lines = (body ?? '').replace(/\r\n?/g, '\n').split('\n');
  const heading = /^###\s+Impact summary\s*$/i;
  const nextHeading = /^###\s+/;
  const start = lines.findIndex((line) => heading.test(line.trim()));
  if (start < 0) return (body ?? '').trim();
  const end = lines.slice(start + 1).findIndex((line) => nextHeading.test(line.trim()) || /^---\s*$/.test(line.trim()));
  const content = lines.slice(start + 1, end < 0 ? undefined : start + 1 + end);
  return content.join('\n').trim();
}

export function trustedComment(comment: GithubComment, config: Pick<IssueParseConfig, 'trustedMaintainers' | 'trustedAssociations'>): boolean {
  const login = comment.user?.login;
  return Boolean(login && (config.trustedMaintainers.includes(login) || config.trustedAssociations.includes(comment.user?.author_association ?? '')));
}

function stateBefore(at: string, issue: GithubIssue, events: GithubIssueEvent[], current: IncidentState): IncidentState {
  const stateEvents = events
    .filter((event) => event.label?.name.startsWith('state/'))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  let state = stateEvents.length ? 'investigating' : current;
  for (const event of stateEvents) {
    if (event.created_at > at) break;
    const value = event.label?.name.slice(6);
    if (value && ['investigating', 'identified', 'monitoring', 'resolved'].includes(value)) state = value as IncidentState;
  }
  return state || (issue.state === 'closed' ? 'resolved' : 'investigating');
}

export function buildTimeline(issue: GithubIssue, comments: GithubComment[], parsed: ParsedLabels, config: Pick<IssueParseConfig, 'trustedMaintainers' | 'trustedAssociations'>, events: GithubIssueEvent[] = []): TimelineEntry[] {
  const entries: TimelineEntry[] = [{
    id: `issue-${issue.number}`, at: issue.created_at, type: 'issue_event', state: stateBefore(issue.created_at, issue, events, parsed.state), text: 'Incident published.',
  }];
  events
    .filter((event) => event.created_at > issue.created_at && event.event === 'labeled' && event.label?.name.startsWith('state/'))
    .forEach((event) => {
      const state = event.label?.name.slice(6);
      if (state && ['investigating', 'identified', 'monitoring', 'resolved'].includes(state)) {
        entries.push({ id: `event-${event.created_at}-${state}`, at: event.created_at, type: 'state_change', state: state as IncidentState, text: 'Incident status changed.' });
      }
    });
  comments.filter((comment) => trustedComment(comment, config)).forEach((comment) => {
    const at = comment.updated_at ?? comment.created_at;
    entries.push({ id: `comment-${comment.id}`, at, type: 'comment', state: stateBefore(comment.created_at, issue, events, parsed.state), text: safeSummary(comment.body), url: comment.html_url, author: comment.user?.login });
  });
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

export function issueToIncident(issue: GithubIssue, comments: GithubComment[], config: IssueParseConfig, events: GithubIssueEvent[] = []): Incident | null {
  const parsed = parseIssueLabels(issue.labels, config);
  if (!parsed.isIncident || !parsed.valid || !parsed.severity) return null;
  const impact = impactSummary(issue.body);
  return {
    id: `issue-${issue.number}`, number: issue.number, title: issue.title, url: issue.html_url,
    bodySummary: safeSummary(impact), bodyMarkdown: impact, startedAt: issue.created_at, updatedAt: issue.updated_at,
    closedAt: issue.closed_at ?? undefined, state: parsed.state, severity: parsed.severity,
    serviceIds: parsed.serviceIds, isActive: isActiveIssue(issue, parsed),
    timeline: buildTimeline(issue, comments, parsed, config, events),
  };
}
