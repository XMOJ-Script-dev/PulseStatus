# PulseStatus 配置参考

**语言：** [English](../configuration.md) · 简体中文

PulseStatus 是一个静态站点。配置在数据构建阶段读取，并以 JSON/JavaScript 形式发布到 `public/data/` 下；浏览器从不直接读取 `config/statuspage.yml`。

## 配置的所有权

源配置放在 `config/` 目录，浏览器使用的生成数据放在 `public/data/` 目录。不要手动编辑生成的 JSON：下一次同步或构建会将其覆盖。一种实用的所有权划分是：

- 运维团队负责 `config/services.json`、监控阈值、受信任维护者、事件（Incident）标签，以及维护（maintenance）数据的质量。
- 品牌或网站负责人负责 `site` 配置段、favicon 资源、`src/styles/custom.css`，以及本地化的服务文案。
- 贡献者负责页面行为、测试和生成数据的流水线。

每一项配置变更都应通过 `npm run validate-config`、`npm run typecheck`、`npm test` 和 `npm run build` 的检查。

## 站点标识

编辑 `config/statuspage.yml`：

| 键 | 必填 | 说明 |
| --- | --- | --- |
| `site.name` | 否 | 显示在浏览器标题和页头中的名称。默认为 `PulseStatus`。 |
| `site.locale` | 否 | 发布时的 locale 元数据。浏览器语言选择目前支持英文和中文。 |
| `site.timezone` | 否 | 运营时区元数据。每日 uptime 仍以 UTC 为准，以保证报告结果确定可复现。 |
| `site.favicon` | 否 | 相对于 `public/` 的文件路径。默认为 `favicon.png`。 |
| `site.theme` | 是 | 管理员选择的内置模板：`modern`、`compact`、`vivid` 或 `mono`。 |
| `site.companyName` | 否 | 页脚中显示的公司或组织名称。 |
| `site.companyUrl` | 否 | 公司名称的可选链接。 |
| `site.headerText` | 否 | 显示在全局页头下方的可选文本。 |
| `site.footerText` | 否 | 页脚中的可选运营或法务文本。 |
| `site.footerLinks` | 否 | 页脚中显示的 `{ label, url }` 链接 YAML 列表。 |
| `site.showGithub` | 否 | 在页头导航中显示 GitHub 仓库链接。默认为 `true`；设为 `false` 可隐藏。 |
| `site.githubUrl` | 否 | 页头仓库链接的目标 URL。默认取 `https://github.com/{repository.owner}/{repository.name}`（由 `repository` 配置段推导）；设置为任意 URL（或空字符串）以完全控制该链接。 |
| `site.githubLabel` | 否 | 页头仓库链接的文本。默认为 `GitHub`。 |
| `site.layout` | 否 | 服务目录布局：`standard`（Cloudflare 风格的全宽行加状态 pill）或 `fused`（融合 statuspage.io 的容器与圆点、GitHub Status 的彩色文字状态、Cloudflare 的 uptime 条与分组聚合的圆角系统面板，并显示每个服务最近 90 天的 uptime 百分比）。默认为 `standard`。 |
| `site.logo` | 否 | 相对于 `public/` 的图片路径（如 `brand/logo.png`），替换页头的字母标。未设置时回退到内置的渐变 "P" 字标。 |
| `site.heroTitle` | 否 | 概览页 hero 区的主标题。默认为 `site.name`。 |
| `site.tagline` | 否 | 概览页 hero 区的副标题。默认为内置的本地化标语。 |
| `site.language` | 否 | 强制显示语言：`auto`（跟随访问者浏览器，默认）、`en` 或 `zh`。 |
| `site.navLinks` | 否 | `{ label, url }` 链接 YAML 列表，追加在页头导航的仓库链接之后。 |
| `site.colors` | 否 | 用十六进制值覆盖主题色。支持的键：`brand`、`brandDeep`、`success`、`warning`、`danger`。示例：`colors: { brand: "#0f766e", brandDeep: "#115e59" }`。在运行时作为 CSS 变量注入，与 `site.theme` 和 `custom.css` 叠加生效。 |
| `site.url` | 否 | 状态站的公开绝对 URL（如 `https://status.example.com`）。启用 `feed.xml`、`maintenance.ics`、`sitemap.xml` 和社交 meta 标签。未设置时回退到 `site.companyUrl`。 |
| `site.headHtml` | 否 | 注入到每页 `<head>` 的原始 HTML（analytics、站点验证）。信任级别等同 `custom.css`——只注入你自己控制的代码。 |
| `site.externalStatus` | 否 | `{ name, apiUrl }` 列表，展示外部状态页的状态芯片（兼容 statuspage.io v2 API，如 `https://www.githubstatus.com/api/v2/status.json`）。 |

示例：

```yaml
site:
  name: Acme Service Status
  locale: en
  timezone: America/Los_Angeles
  theme: modern
  favicon: brand/acme-favicon.svg
  companyName: Acme Inc.
  companyUrl: https://acme.example
  headerText: Live availability and incident communication
  footerText: Maintained by the Acme Operations team.
  footerLinks:
    - label: Support
      url: https://acme.example/support
    - label: Privacy
      url: https://acme.example/privacy
```

将 `brand/acme-favicon.svg` 放置在 `public/brand/acme-favicon.svg`。不要使用 `public/` 之外的文件系统路径。

构建会将该配置输出为 `public/data/site.js`。每个 HTML 入口会在页面模块之前加载它，使相同的标识和页脚出现在概览、历史、事件和服务页面上。如果本地构建缺少 `site.js`，运行 `npm run build-data`。

主题是一个部署设置，而非访客偏好。所有访客收到相同的 `site.theme` 值。组织专属样式请编辑 `src/styles/custom.css`；它在内置样式表之后打包，因此是受支持的覆盖层。

## 仓库与监控

`repository` 配置段标识用于 Issue 同步的 GitHub 仓库：

```yaml
repository:
  owner: Acme
  name: service-status
```

`monitoring` 配置段控制探测调度以及可选的自动事件发布：

| 键 | 说明 |
| --- | --- |
| `monitoring.mode` | 未设置 `monitorMode` 的服务的默认模式：`scheduled`、`manual` 或 `hybrid`。 |
| `monitoring.schedule` | workflow 触发 cron，形如 `*/N * * * *`。必须与 `.github/workflows/statuspage.yml` 中的 `schedule` 触发器一致，且步长不得超过 `probeIntervalMinutes`；`npm run validate-config` 会强制校验这两条。 |
| `monitoring.probeIntervalMinutes` | 真实请求之间的默认最小间隔（分钟）。 |
| `monitoring.timeoutMs` | 探测请求的最大时长。 |
| `monitoring.failuresToDown` | 服务被判定为 down 之前需要的连续失败探测次数。 |
| `monitoring.successesToRecover` | 服务恢复之前需要的连续成功探测次数。 |
| `monitoring.autoPublishIncident` | 启用自动创建事件 Issue 并在恢复后自动关闭。 |
| `monitoring.failuresToIncident` | 创建自动化事件所需的连续失败探测次数。 |
| `monitoring.recoverySuccessesToCloseIncident` | 关闭自动化事件所需的连续成功探测次数。 |
| `monitoring.historyRetentionDays` | 探测历史的保留窗口（天）。 |
| `monitoring.demoData` | 把确定性的示例事故和维护合并进发布数据，并显示"演示数据"横幅。默认 `false`；生产状态页绝不要开启。 |

服务级别的 `monitorMode` 优先于默认值。`manual` 服务永远不会被探测，也无法触发自动事件。

## Issue 策略

```yaml
issues:
  publishLabel: statuspage/incident
  maintenanceLabel: statuspage/maintenance
  autoCloseMaintenance: true
  lockOfficialIncidents: false
  autoIncidentMentions: [oncall-user]
  autoIncidentSeverity: major
  trustedMaintainers: [oncall-user]
  trustedAssociations: [OWNER, MEMBER, COLLABORATOR]
  notifyFormat: discord
  notifyNtfyTopic: ""
```

`publishLabel` 和 `maintenanceLabel` 是同步器识别的标签。`trustedMaintainers` 和 `trustedAssociations` 控制哪些评论可以成为公开的运营更新。`autoIncidentSeverity` 必须是 `minor`、`major` 或 `critical`。

当 `autoCloseMaintenance` 为 `true` 时，workflow 会在维护 Issue 的 `Ends at` 时间之后关闭处于打开状态且未被取消的维护 Issue。它使用 GitHub 的 `completed` state reason。这仅适用于维护 Issue，不会关闭手动管理的事件。给维护 Issue 添加 `state/delayed` 标签可使其在计划结束时间之后保持打开；处于打开状态的延迟 Issue 会被导出为进行中（in progress），直到它被关闭或该标签被移除。

workflow 需要 `contents: write` 和 `issues: write` 权限来持久化监控状态并更新 Issue。

### 通知

事故进入进行中（或解决）时，可以通过 `scripts/notify.ts` 推送到两个可选渠道（由 `sync-issues.ts` 内的 before/after diff 驱动）：

- **Webhook**——把 GitHub Actions Secret `PULSE_WEBHOOK_URL` 设为 Discord 或 Slack 的 incoming webhook 地址，并用 `issues.notifyFormat: discord | slack`（默认 `discord`）选择消息格式。webhook 不会出现在配置文件或日志中。
- **ntfy.sh**——把 `issues.notifyNtfyTopic` 设为任意 ntfy topic（公共 ntfy.sh 或自建）。无需 Secret，知道 topic 的人即可订阅。

两个渠道互相独立，未配置时静默跳过；投递失败只产生 workflow 警告。opened 和 resolved 事件都会推送，自动与人工发布的事故一视同仁。

## 历史设置

```yaml
history:
  initialMonths: 3
  monthsPerLoad: 3
  uptimeDays: 90
```

`initialMonths` 和 `monthsPerLoad` 控制历史页面加载的按月事件归档数量：首次渲染显示 `initialMonths` 个月（按 `monthsPerLoad` 为一批），"加载更多"按钮每点一次取下一批。`uptimeDays` 设置每日 uptime 窗口（默认 90），用于 `uptime.json`、uptime 徽章和行内 uptime 百分比。

embed 是只读的，轮询已发布的 `summary.json`。它通过在 `<script>` 标签上设置 `data-*` 属性配置（见 [`embed.md`](../embed.md)），而不是在 `statuspage.yml` 中；其浏览器端最小间隔为 60 秒。

### 订阅源与演示模式

设置了 `site.url`（或 `site.companyUrl`）后，每次构建还会发布：

- `feed.xml`——事故与维护的 Atom 订阅源，在每页页脚和 `<head>` 中链接。
- `maintenance.ics`——计划维护的 iCalendar 订阅源，在维护区块中链接。
- `sitemap.xml` 以及静态页的 Open Graph meta 标签。

设置 `monitoring.demoData: true` 会把确定性的示例事故和维护（标题带 `[Demo]` 标识）合并进发布数据，并显示醒目的"演示数据"横幅。仅供试用模板；生产状态页切勿开启。

## 服务

编辑 `config/services.json`。每个服务必须有一个稳定且唯一的 `id`；该 ID 用于 GitHub 标签（`service/<id>`）、生成的数据、服务 URL 和 uptime 记录。`nameI18n` 和 `descriptionI18n` 可以提供本地化文本。`monitorMode` 可以是 `scheduled`、`manual` 或 `hybrid`。

服务卡片链接到：

```text
service.html?id=<id>
```

详情页按同一 ID 过滤事件和维护。因此重命名 ID 属于数据迁移：需要同时更新标签、现有 Issue 上的标签和所有相关链接。

可选的 per-service 字段：

- `checkType: "tcp"` 搭配 `checkPort`——探测 TCP 端口（主机名取自 `checkUrl`）而非 HTTP，适用于数据库、缓存等非 HTTP 端点。默认仍为 HTTP 探测。
- `runbookUrl`——HTTPS 格式的 Runbook 链接，显示在服务详情页，事故处理时有用。
- `dependsOn`——单层次依赖另一个服务 id。概览显示"依赖 …"注记；上游 down 时下游展示状态最低为 Degraded（仅展示层，不改变探测数据）。
- `checkIntervalMinutes`——per-service 的探测间隔覆盖。
- `expectContent`——HTTP 响应体必须包含的字符串；即使状态码正常，内容不匹配也会把服务标记为 down（可发现页面被劫持或部署错误）。
- `certSha256`——期望的 TLS 证书 SHA-256 指纹（冒号分隔的十六进制，可用 `openssl x509 -fingerprint -sha256` 查看）。指纹不匹配会把服务标记为 down。
- `certMinDays`——证书可接受的最短剩余天数；低于阈值时服务降级为 degraded，在证书真正失效前发出警告。
- `dnsExpect: { type, value }`——check 主机名的 DNS 记录必须包含给定值（`A`、`AAAA`、`CNAME`、`TXT` 或 `MX`；TXT 分片会先合并再比较）。不匹配会把服务标记为 down，可发现 DNS 劫持或记录过期。

推荐的服务配置：

```json
{
  "id": "api",
  "name": "Public API",
  "nameI18n": { "en": "Public API", "zh": "公共 API" },
  "group": "backend",
  "description": "The API used by public clients.",
  "descriptionI18n": {
    "en": "The API used by public clients.",
    "zh": "供公共客户端使用的 API。"
  },
  "publicUrl": "https://api.example.com",
  "checkUrl": "https://api.example.com/health",
  "monitorMode": "scheduled"
}
```

`publicUrl` 用于面向用户的链接，`checkUrl` 仅用于有边界限的健康检查。`monitorMode: manual` 的服务永远不会被自动探测，即使设置了 `checkUrl` 或 `checkIntervalMinutes` 也是如此。它们不会增加失败/恢复计数，也无法触发或自动关闭事件。手动服务可以省略 `checkUrl`；不应将它们呈现为经探测验证。

### 探测频率

`monitoring.probeIntervalMinutes` 设置真实请求之间的默认分钟数：

```yaml
monitoring:
  probeIntervalMinutes: 5
  schedule: "*/5 * * * *"
```

单个服务可以覆盖它：

```json
{
  "id": "docs",
  "monitorMode": "scheduled",
  "checkUrl": "https://docs.example.com/health",
  "checkIntervalMinutes": 10
}
```

检查脚本将 `lastProbeAt` 持久化在 `public/data/monitor-state.json` 中。当间隔尚未结束时，它会复用上一次结果，不增加连续失败或恢复计数。因此计数代表真实请求，而不是 workflow 调用次数。低于五分钟的取值在 GitHub 托管的调度下无法产生更多检查；如有低于五分钟的需求，请使用专门的外部监控。

`monitoring.schedule` 必须是 `*/N * * * *` 形式的 cron，`npm run validate-config` 会强制两条规则：cron 的分钟步长 `N` 不得超过 `probeIntervalMinutes`，且 cron 必须与 `.github/workflows/statuspage.yml` 中的 `schedule` 触发器完全一致。配置值是预期频率的唯一事实来源；workflow 文件才是 GitHub 真正执行的东西，因此两者一旦漂移校验就会报错。

`failuresToDown` 和 `successesToRecover` 对发布的服务状态做平滑处理：单次探测失败不会立即把服务标记为 down，需要连续 `failuresToDown` 次失败（恢复同理，需要连续 `successesToRecover` 次成功才回到 operational）。HTTP 错误响应（degraded）不经平滑立即显示。注意发布的状态因此会刻意滞后于原始探测结果；`probe-history.json` 始终记录原始结果。

`historyRetentionDays`（默认 90）控制 `probe-history.json` 的保留窗口：每次检查时早于该窗口的记录会被修剪。

一个重要的注意点：GitHub 不保证计划 workflow 的执行时间。高峰时段 `schedule` 事件会排队延迟，免费版上 `*/5` 的 cron 实际可能每天只运行寥寥数次（观测到数小时的间隔）。上面的 due 逻辑保证探测频率不会*高于*配置值，但无法让频率高于 workflow 本身的触发频率。要真正实现小时级以内的探测，部署仓库自带的 Cloudflare Worker——由 Cron Trigger 准时通过 GitHub API 派发 workflow——并把 GitHub cron 仅作为兜底。一键部署和配置说明见 [`worker.md`](../worker.md)。

每次真实请求还会向 `public/data/probe-history.json` 追加一条记录。新检查运行时不会编辑已有记录。每条记录包含 `checkedAt`、产生的服务状态、可选的 `statusCode` 和可选的 `latencyMs`；手动服务有意不出现在该历史中。服务详情页单独显示最近的探测记录，与事件推导出的 uptime 区分开。

## 事件与维护发布

事件来自满足以下条件的有效 GitHub Issue：

1. `statuspage/incident`
2. 至少一个已知的 `service/<id>`
3. 恰好一个 `severity/minor`、`severity/major` 或 `severity/critical`

维护来自带有 `statuspage/maintenance`、至少一个已知服务标签，且包含可解析的 `Starts at`、`Ends at` 和可选 `Timezone` 字段的 Issue。同步器写入 `incidents-all.json`、`incidents-active.json` 和 `maintenance.json`。设置 `issues.autoCloseMaintenance: true` 可在结束时间之后自动关闭处于打开状态的维护 Issue。当前仓库配置启用了该行为。

维护解析器接受诸如 `Starts at:` 和 `Ends at:` 后接 ISO 时间戳的标签。请始终包含显式偏移量：

```text
Starts at: 2026-11-01T02:00:00+08:00
Ends at: 2026-11-01T03:30:00+08:00
Timezone: Asia/Singapore
```

无效的时间窗口会被跳过并给出警告。已关闭的维护 Issue 被导出为 completed；`state/cancelled` 标签被导出为 cancelled；超过结束时间仍处于打开状态且带 `state/delayed` 标签的 Issue 被导出为进行中（in progress）而非 completed。

概览页的维护板块只列出计划中的维护（`scheduled` 和 `in_progress`）。已完成的和已取消的维护会被归档到事件历史中：`build-public-data.ts` 按 UTC 起始月份将它们分组到 `history/YYYY-MM.json`，历史页面会将其与已解决的事件一起渲染，并显示每月数量。

## 服务分组

服务目录支持嵌套分组。`group` 是可选的：希望服务出现在分组之外时将其省略。当某个服务的分组属于另一个分组之下时，在该服务上设置 `parentGroup`。分组默认值和本地化标签在 `config/statuspage.yml` 中配置；事件和维护板块从不分组。

```yaml
serviceGroups:
  backend:
    nameI18n:
      en: Backend services
      zh: 后端服务
    defaultExpanded: false
```

例如，一个服务可以将其分组放在另一个分组之下：

```json
{
  "id": "api",
  "group": "backend"
}
```

`nameI18n` 优先使用浏览器的确切 locale，其次是其基础语言，最后是 `name` 或分组键。服务目录按 Cloudflare 风格渲染：分组始终是展开的全宽行（左侧分组名，右侧聚合状态 pill），成员服务在其下方以细线分隔的行列出——没有可展开或折叠的内容，因此渲染不再使用 `defaultExpanded`（为了向后兼容，配置校验仍会接受它）。

每个分组标题也显示一个聚合状态 pill，分组按严重程度排序（最严重的在前；并列时按名称排序）。该 pill 在浏览器中计算：分组中处于活动状态的 `severity/critical` 事件显示 Major outage，`severity/major` 显示 Partial outage，`severity/minor` 显示 Degraded performance。当没有活动事件时，由成员的探测状态决定：全部成员 down 显示 All systems down，部分成员 down 显示 Partial outage，有成员降级显示 Degraded performance，有状态未知或手动监控的成员显示 Unknown/Limited monitoring，否则显示 Operational。

## 自动事件发布

自动发布通过 `config/statuspage.yml` 选择启用：

```yaml
monitoring:
  autoPublishIncident: true
  failuresToIncident: 3
  recoverySuccessesToCloseIncident: 2

issues:
  autoIncidentMentions: [PythonSmall-Q]
  autoIncidentSeverity: major
```

`check-services` 步骤写入当前服务结果。随后 `auto-publish-incidents` 步骤：

1. 从 `public/data/monitor-state.json` 加载上一个按服务维度的计数。
2. 对处于 `down` 状态的受监控服务增加连续失败计数，并重置其成功计数。
3. 在 `failuresToIncident` 次失败后创建一个 Issue，带上 `statuspage/incident`、`service/<id>`、配置的严重程度和 `state/investigating`。
4. 将每个配置的用户名作为 `@mention` 添加到 Issue 正文中。
5. 记录一个包含服务 ID 的 HTML 标记，使后续运行不会创建重复 Issue。
6. 恢复后增加连续成功计数，并在 `recoverySuccessesToCloseIncident` 次成功检查之后关闭生成的 Issue。

自动创建的 Issue 刻意保持为普通的 GitHub Issue，而非伪造的浏览器数据。维护者应核实客户影响、补充上下文，并酌情关闭或调整该 Issue。设置 `autoPublishIncident: false` 会阻止创建新的自动 Issue，也会阻止自动化关闭已有 Issue。

workflow 只提交监控计数文件，并带 `[skip ci]`，从而避免持久化状态的提交递归触发另一个 workflow。它需要：

```yaml
permissions:
  contents: write
  issues: write
```

如果仓库策略不允许 workflow 推送，请使用外部持久化状态存储或禁用自动发布；没有持久化的计数，就无法在多次调度运行之间保证连续失败行为。

## Uptime 计算

`buildDailyUptime()` 独立计算每个 UTC 日。它找出提及某个服务的事件，将每个区间裁剪到该日，排序并合并重叠区间，再从当天时长中减去停机的并集。已解决的事件使用 `closedAt`（回退到 `updatedAt`）；活动事件延伸到生成快照的时间戳。计划中的维护窗口（与服务重叠且未取消的维护）被裁剪到当日并从停机中排除，因此处于维护中的服务不会损失 uptime。已取消的维护和针对其他服务的维护没有影响。

当维护处于 `in_progress` 时，受影响的服务会在概览页和服务详情页上显示 "Under maintenance" pill；活动事件仍具有显示优先级。维护状态本身不会在 `services.json` 中改变，因此分组聚合和总体摘要不受影响。

输出结果四舍五入到小数点后三位，并在 0 到 100 之间封顶。它有意由事件推导得出，不应被描述为合成监控覆盖率。

## 构建顺序

```bash
npm run validate-config
npm run sync-issues       # requires GitHub Actions environment variables
npm run check-services
npm run build-data
npm run build
```

`build-data` 读取同步后的文件，生成摘要、事件历史、站点配置和 90 天日度 uptime 记录。同步失败必须中止 workflow，而不是发布虚假的健康状态。

## GitHub Actions 要求

发布任务需要读取 Issue 和写入 Pages 构件（artifact）的权限。同步步骤需要 `GITHUB_TOKEN`、`GITHUB_REPOSITORY_OWNER` 和 `GITHUB_REPOSITORY`；服务配置通过仓库已有的环境变量提供。应将 `PULSE_TRUSTED_MAINTAINERS` 限制为获准发布运营更新的维护者。

如果仓库使用项目 Pages URL，请将仓库路径作为 `VITE_BASE_PATH` 传入。应从部署后的子目录验证链接，而不是只从 `http://localhost:5173/` 验证。
