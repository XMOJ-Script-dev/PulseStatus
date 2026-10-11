const translations = {
  en: {
    overview: 'Overview', history: 'History', github: 'GitHub', serviceStatus: 'Service status',
    tagline: 'A clear view of current incidents and service health.', activeIncidents: 'Active incidents',
    incidentHistory: 'Incident history', resolvedEvents: 'Resolved events',
    historyIntro: 'Events are grouped by the UTC month in which they started.',
    loadingHistory: 'Loading history…', loadingOlder: 'Loading older months…', historyLoaded: 'History loaded.',
    loadMore: 'Load more', incidentsInMonth: 'incidents', noIncidentsInMonth: 'No incidents in this month.',
    historyUnavailable: 'History is temporarily unavailable.', historyLoadFailed: 'This part of history could not be loaded. Try again.',
    incidentNotFound: 'Incident not found', incidentNotPublished: 'The incident is not present in the published data.',
    viewOnGithub: 'View on GitHub', noOfficialUpdates: 'No official updates have been published.',
    incidentDataUnavailable: 'Incident data could not be loaded.', started: 'Started', updatedAt: 'Updated',
    active: 'active', noActiveIncidents: 'No active incidents', services: 'Services',
    noServiceData: 'No service data available', updated: 'Updated', checked: 'Checked',
    manualMonitoring: 'Manual monitoring', operational: 'Operational', degraded: 'Degraded performance',
    partialOutage: 'Partial outage', majorOutage: 'Major outage', limitedMonitoring: 'Limited monitoring',
    statusUnavailable: 'Status temporarily unavailable', dataUnavailable: 'Status data could not be loaded. Please try again later.',
    publishedFromGithub: 'Data is published from GitHub Issues. A failed refresh never becomes a false “all clear”.',
    severity: { minor: 'Minor', major: 'Major', critical: 'Critical' },
    state: { investigating: 'Investigating', identified: 'Identified', monitoring: 'Monitoring', resolved: 'Resolved' },
  },
  zh: {
    overview: '概览', history: '历史记录', github: 'GitHub', serviceStatus: '服务状态',
    tagline: '清晰了解当前事故与服务运行状态。', activeIncidents: '正在进行的事故',
    incidentHistory: '事故历史', resolvedEvents: '已解决事件',
    historyIntro: '事件按其开始时间所在的 UTC 月份归档。',
    loadingHistory: '正在加载历史记录…', loadingOlder: '正在加载更早月份…', historyLoaded: '历史记录已加载。',
    loadMore: '加载更多', incidentsInMonth: '项事故', noIncidentsInMonth: '本月没有事故记录。',
    historyUnavailable: '历史记录暂时无法加载。', historyLoadFailed: '这一部分历史记录加载失败，请重试。',
    incidentNotFound: '未找到事故', incidentNotPublished: '该事故不在当前发布的数据中。',
    viewOnGithub: '在 GitHub 查看', noOfficialUpdates: '尚未发布官方更新。',
    incidentDataUnavailable: '事故数据无法加载。', started: '开始于', updatedAt: '更新于',
    active: '项进行中', noActiveIncidents: '当前没有正在进行的事故', services: '服务',
    noServiceData: '暂无服务数据', updated: '更新于', checked: '检查于',
    manualMonitoring: '人工维护', operational: '运行正常', degraded: '性能下降',
    partialOutage: '部分中断', majorOutage: '重大中断', limitedMonitoring: '监控数据有限',
    statusUnavailable: '状态暂时无法加载', dataUnavailable: '状态数据无法加载，请稍后重试。',
    publishedFromGithub: '数据来自 GitHub Issues。刷新失败时不会伪装成“全部正常”。',
    severity: { minor: '轻微', major: '重大', critical: '严重' },
    state: { investigating: '调查中', identified: '已定位', monitoring: '监控中', resolved: '已解决' },
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
export const language = typeof navigator !== 'undefined' && navigator.languages.some((value) => value.toLowerCase().startsWith('zh')) ? 'zh' : 'en';
export const messages = translations[language];

export function t(key: TranslationKey): string {
  const value = messages[key];
  return typeof value === 'string' ? value : key;
}

export function statusLabel(status: string): string {
  if (status === 'unknown') return t('limitedMonitoring');
  if (status === 'monitoring') return t('limitedMonitoring');
  if (status === 'manually_reported') return t('manualMonitoring');
  if (status === 'operational') return t('operational');
  if (status === 'degraded_performance') return t('degraded');
  if (status === 'partial_outage') return t('partialOutage');
  if (status === 'major_outage') return t('majorOutage');
  if (status in messages.severity) return messages.severity[status as keyof typeof messages.severity];
  if (status in messages.state) return messages.state[status as keyof typeof messages.state];
  return status.replaceAll('_', ' ');
}
