export interface FeedItem {
  id: string;
  title: string;
  url: string;
  updatedAt: string;
  summary: string;
  categories: string[];
}

export interface FeedOptions {
  title: string;
  siteUrl: string;
  feedUrl: string;
}

const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character] ?? character));

const rfc3339 = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString();
};

export function buildAtomFeed(items: FeedItem[], options: FeedOptions): string {
  const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latest = sorted[0]?.updatedAt;
  const entries = sorted.map((item) => `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.url)}" rel="alternate"/>
    <id>${escapeXml(item.id)}</id>
    <updated>${rfc3339(item.updatedAt)}</updated>
    <summary>${escapeXml(item.summary)}</summary>${item.categories.map((category) => `
    <category term="${escapeXml(category)}"/>`).join('')}
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(options.title)}</title>
  <link href="${escapeXml(options.siteUrl)}" rel="alternate"/>
  <link href="${escapeXml(options.feedUrl)}" rel="self"/>
  <id>${escapeXml(options.siteUrl)}</id>${latest ? `
  <updated>${rfc3339(latest)}</updated>` : ''}
${entries}
</feed>
`;
}

export interface CalendarEvent {
  id: string;
  title: string;
  url: string;
  startsAt: string;
  endsAt: string;
  description?: string;
}

const icsDateTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '19700101T000000Z' : date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

const escapeIcs = (value: string): string => value
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function buildIcsFeed(events: CalendarEvent[], options: FeedOptions): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PulseStatus//Maintenance//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(options.title)}`,
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@${new URL(options.siteUrl).hostname}`,
      `DTSTAMP:${icsDateTime(event.startsAt)}`,
      `DTSTART:${icsDateTime(event.startsAt)}`,
      `DTEND:${icsDateTime(event.endsAt)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `URL:${event.url}`,
      `DESCRIPTION:${escapeIcs(event.description ?? event.url)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
