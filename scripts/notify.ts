import type { Incident, Service } from '../src/types/status';
import { buildDiscordPayload, buildNtfyPayload, buildSlackPayload } from '../src/utils/notify';

export interface NotifyConfig {
  siteName: string;
  format: 'discord' | 'slack';
  services: Array<Pick<Service, 'id' | 'name'>>;
}

async function post(url: string, payload: unknown, headers: Record<string, string> = {}): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
    if (!response.ok) console.warn(`Notification to ${new URL(url).host} failed: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.warn(`Notification failed: ${(error as Error).message}`);
    return false;
  }
}

export async function sendIncidentNotifications(events: Array<{ incident: Incident; event: 'opened' | 'resolved' }>, config: NotifyConfig): Promise<void> {
  const webhookUrl = process.env.PULSE_WEBHOOK_URL;
  const ntfyTopicRaw = process.env.PULSE_NTFY_TOPIC ?? '';
  const ntfyTopic = ntfyTopicRaw.trim();
  for (const { incident, event } of events) {
    if (webhookUrl) {
      const payload = config.format === 'slack'
        ? buildSlackPayload(incident, event, config.siteName, config.services)
        : buildDiscordPayload(incident, event, config.siteName, config.services);
      await post(webhookUrl, payload);
    }
    if (ntfyTopic) {
      const payload = buildNtfyPayload(incident, event, config.siteName, config.services);
      await post(`https://ntfy.sh/${encodeURIComponent(ntfyTopic)}`, payload, { Title: payload.title, Priority: String(payload.priority), Tags: payload.tags, Click: payload.click });
    }
  }
  if (!webhookUrl && !ntfyTopic && events.length) console.log('Notifications skipped: neither PULSE_WEBHOOK_URL nor issues.notifyNtfyTopic is configured.');
}
