# PulseStatus — GitHub Copilot 项目实施规划

> 本文件是项目的需求规格、技术方案和实施验收清单。请 GitHub Copilot Agent 以此为唯一的主要实现依据，直接在当前仓库创建、修改和测试代码，而不是仅输出示例代码或重新设计需求。
>
> 项目目标：构建一个轻量、美观、可部署到 GitHub Pages 的 Statuspage。无需 D1、Cloudflare Worker、常驻后端或外部数据库；使用 GitHub Actions 执行可选的定时健康检查和事件同步，以 GitHub Issues / Discussions 作为运维入口，以静态 JSON、SVG Badge 和 JavaScript Embed 对外发布状态。

---

## 0. Copilot 执行总指令

开始编码前先检查仓库现有文件、分支、GitHub Actions 和包管理器，不要覆盖已有用户内容。若仓库是空的，按本文初始化。

实施要求：

1. 直接实现代码、配置、页面、测试和文档；不要只返回计划。
2. 按本文“实施阶段”逐阶段交付，每个阶段结束后运行相应测试和构建，先修复错误再继续。
3. 优先使用简单、可维护的实现，不引入不必要的后端、数据库或大型 UI 框架。
4. 不要将任何 GitHub Token、Secret 或写入凭证打包进浏览器端代码。
5. 对 Issue 标题、正文、评论、Discussion 内容、URL 和标签均按不可信输入处理。
6. 不得在没有数据时伪造实时状态、可用率或故障记录。演示数据必须明确标为示例，并且生产构建不能悄悄把示例状态显示为真实状态。
7. 不要在每个独立事件发生时只处理 webhook payload 的增量；应以 GitHub 为数据源执行幂等的全量/分页同步，确保多个事件并发或丢失时仍能恢复正确状态。
8. 对无法由 GitHub Pages 原生支持的能力，不得假设可以通过自定义服务器响应头、运行时 API 或后端路由解决。
9. 结束时汇报已实现功能、重要文件、测试命令、尚未解决的问题，以及仓库管理员需要手工配置的 GitHub 设置。

## 1. 产品目标和明确的非目标

### 1.1 产品目标

- 一个响应式、简洁、快速的静态状态页。
- 首页列出**所有活动中的正式 Incident**，不得仅显示前几条或以“查看更多”截断活动事故列表。
- History 页面按月份展示已结束的 Incident，月份按最近到最早排序，提供“加载更多”按钮，按需加载更早月份。
- 以 GitHub Issue 标签识别事件所属服务、严重程度、处理阶段和事件类型。
- 正式 Incident 的 Issue 对话自动锁定，使只有仓库所有者/具有适当协作权限的人员可以继续评论；仅把可信维护者的回复显示为官方状态更新 Timeline。
- 支持计划维护，包含开始时间、结束时间、时区、影响服务和维护阶段。
- 支持 `scheduled`、`manual`、`hybrid` 三种监控模式，并允许全局配置和单个服务覆盖。
- 自动生成静态状态 JSON、月份历史 JSON、SVG Badge 和面向第三方网站的 JavaScript Embed。
- 使用 GitHub Pages 自定义 Actions 工作流部署，不依赖 D1、Worker、数据库、服务器端 API 或账号系统。
- 所有主要页面可在 GitHub Pages 项目路径部署（如 `https://owner.github.io/repo/`），并兼容自定义域名根路径。

### 1.2 非目标（首版不做）

- 不建设数据库、用户登录、管理员 Web 后台或评论系统。
- 不承诺实时 SLA 监控、精确的 15 分钟执行时间或即时告警。
- 不实现邮件、短信、手机推送或 Web Push。
- 不让浏览器端直接使用有写权限的 GitHub Token。
- 不要求 Discussion 成为正式事故的唯一来源；正式事故以 Issues 为准。
- 不在第一版实现复杂图表库、服务端渲染或完整 SPA 路由系统。

## 2. 技术栈

- Node.js：使用当前 GitHub Actions 支持的 LTS 版本，版本通过 `.nvmrc` 或 `package.json` 固定。
- TypeScript + Vite。
- 原生 CSS（CSS variables、Grid、Flexbox），不依赖大型 UI 框架；如果仓库已有经过使用的框架，先评估复用再决定是否保留。
- Vitest 用于纯函数和数据处理单元测试。
- HTML 多页面构建，不依赖 GitHub Pages 上的 SPA fallback。
- GitHub REST API：Issues、Issue comments、labels、lock/unlock 等。
- GitHub GraphQL API：读取 Discussions 和评论；通过 Actions 的短期 `GITHUB_TOKEN` 完成，不得在前端调用需要认证的 GraphQL API。
- GitHub Actions：事件同步、可选健康检查、静态数据生成、测试、构建和 Pages 部署。

建议使用少量依赖：`vite`、`typescript`、`vitest`。仅在处理 Markdown 时，选用维护活跃、支持安全输出的 Markdown 渲染库；必须禁用危险 HTML 或使用可靠的 HTML sanitizer。若无需在前端渲染原始 Markdown，可以显示纯文本摘要并链接到 GitHub 原文。

## 3. 页面结构与核心交互

### 3.1 全局导航

至少提供：

- Overview：首页状态总览。
- History：已结束事件的历史记录。
- GitHub：跳转到当前配置仓库。

首页与历史页均支持桌面和手机屏幕。需要有明确的键盘焦点、语义化标题、可访问按钮和足够的颜色对比度。状态不能只依赖颜色表达，必须同时显示文字和图标。

### 3.2 首页 `index.html`

由上到下建议包括：

1. 顶部品牌标识与导航。
2. 整体状态总览：`All systems operational`、`Degraded performance`、`Partial outage`、`Major outage` 或 `Unknown` 等状态文字，并展示最近数据生成/检查时间。
3. **Active incidents 区域：展示全部活动 Incident。**
   - 不使用 `slice(0, N)` 或任何固定条数截断。
   - 按严重程度（critical → major → minor）、状态阶段、最近更新时刻进行稳定排序。
   - 卡片应显示标题、严重程度、进展状态、开始时间、影响服务、最近一条可信状态更新、最近更新时间。
   - 点击卡片进入本站 `incident.html?number=123` 详情页，同时提供明确的“View on GitHub”外链。
   - 若没有活动事故，显示空状态：“No active incidents”。
   - 如果数据文件读取失败，显示“状态暂时无法加载”，不得错误显示“全部正常”。
4. 服务列表：按 `services.json` 中定义的服务/分组展示状态、可选响应延迟、最近检查时间和历史运行条。
5. 计划维护区域：展示即将开始和正在进行的计划维护，包含本地化时间与影响服务；维护结束后从活动列表移除，但仍可在历史维护记录中访问。
6. 最近动态：允许显示最近几项已结束事故/维护的入口，但不得因此截断上面的 Active incidents。
7. 页脚：数据生成时间、GitHub 仓库链接、数据新鲜度/更新时间说明。

“活动 Incident”的定义：带有 `statuspage/incident` 标签、至少一个合法 `service/*` 标签、恰好一个合法 `severity/*` 标签，且尚未解决/关闭。若缺少必须标签，则不要把它悄悄转换成正常状态；应在 Action 日志中报告无效标签，并使该 Issue 不进入公开 Incident 数据，除非项目显式配置宽松策略。

Incident 处于活动状态的判定：默认 Issue 是 open 且没有 `state/resolved`；若 issue 被关闭，或标签为 `state/resolved`，则视为结束。需要通过配置规定重新打开事件后的处理逻辑，并覆盖单元测试。

### 3.3 History 页面 `history.html`

History 页面必须按月份分组显示**已结束的 Incident 历史**，而不是只展示一个无分组的列表。

- 默认只展示最近 3 个有历史 Incident 的月份；不必渲染没有任何事件的空月份。
- 月份使用 `startedAt`（通常对应 Issue `created_at`）所在的 UTC 月份作为归属月份，避免一个跨月事故在两个组里重复出现。
- 月份按 `YYYY-MM` 倒序排序，例如 `2026-10`、`2026-09`、`2026-08`。
- 每个月显示月份标题、该月事件数量，以及此月事件列表。
- 每条记录显示标题、严重程度、影响服务、开始时间、解决时间、持续时长（如果能从可靠时间戳计算）及 GitHub 来源链接。
- **“Load more”/“加载更多”按钮每次加载接下来的 3 个月。**它不是按钮点击后仅把已加载列表的样式展开，而应使用 `history-index.json` 中的月份索引，实际按需 fetch 对应的静态月份文件。
- 正在加载时显示进度和禁用按钮；加载失败时显示错误与重试按钮；无更多月份时隐藏按钮或替换成 “You’re all caught up”。
- 避免重复加载同一个月份。应处理多次快速点击、请求失败、空月份和不存在的 JSON 文件。
- 首页上的活动 Incident 不应被误放入“已结束事件”的 History。活动事故只出现在首页活动区；如果用户希望从历史页查看活动中的事故，可显示“查看活动事故”的链接。
- History 不应把 GitHub API 当作浏览器运行时依赖；数据一律从公开静态文件加载。

建议历史数据结构：`data/history-index.json` 给出按月排序的索引，每个月一份独立文件 `data/history/YYYY-MM.json`。这既允许按月加载，也避免每次打开 History 下载所有历史记录。

### 3.4 Incident 详情 `incident.html?number=<issue-number>`

- 从静态事件索引/数据加载指定事故，不在页面端调用带权限的 API。
- 显示事件标题、状态、严重程度、影响服务、开始/更新时间、正文摘要、官方 Timeline 和 GitHub 原始 Issue 链接。
- Timeline 按时间从早到晚显示状态变化与可信维护者评论。
- 评论内容不得未经消毒就作为 HTML 注入页面。优先渲染安全的 Markdown 子集；如果无法安全实现，使用纯文本并保留换行。
- 如果该事件不在公开数据中，显示“未找到该事故”并提供返回首页/打开 GitHub 仓库的入口。

## 4. 监控模式及模式优先级

在 `config/statuspage.yml` 或等价的强类型配置文件中定义全局模式，并允许单服务覆盖。

三种模式：

- `scheduled`：由 GitHub Actions 定时执行健康检查；用户仍可通过 Issue 发布经过确认的 Incident。
- `manual`：不对服务执行定时 HTTP 健康检查；状态主要来自被维护者确认的 Issues、计划维护及手动数据。事件变化仍触发状态同步与部署。
- `hybrid`：定时健康检查与正式 Incident 并行。人工确认的活动 Incident 不得被一次成功的 HTTP 检查自动覆盖。

单服务的 `monitoring.mode` 若未设置，继承全局模式。

关键判定规则：

1. 自动健康检查是“观测结果”，Issue 是“被确认的事故记录”，两者必须保存在不同字段中。
2. 活动的正式 Incident 优先于健康检查的单次成功；不能因为 HTTP 200 就取消事故。
3. `scheduled` 或 `hybrid` 需采用连续失败/连续成功阈值降低误报，例如 2 次连续失败才视为 down、2 次连续成功后转入恢复观察。阈值应可配置。
4. 如果 Issue 已解决但自动检查仍持续失败，整体服务不能直接回到 `operational`；应展示检测失败或 `degraded`/`major_outage` 状态，直到恢复规则满足。
5. `manual` 模式不运行网络健康检查；可以通过事件触发或定时“仅发布/刷新派生数据”的任务更新计划维护阶段、Badge 快照和索引。此任务不得探测服务 URL。
6. 计划维护状态尽量在浏览器端依据 `startsAt`/`endsAt` 计算，以免静态 JSON 中的维护阶段在时间边界后过期；SVG Badge 作为静态快照，可能需要下一次发布才更新，文档必须说明这一点。
7. 整体状态由服务真实观测状态、活动 Incident 及计划维护规则派生，不允许硬编码为 operational。

### 4.1 配置示例

```yaml
site:
  name: PulseStatus
  locale: en
  timezone: Asia/Singapore
  defaultTheme: system

repository:
  owner: YOUR_GITHUB_OWNER
  name: YOUR_REPOSITORY

monitoring:
  mode: hybrid
  schedule: "*/15 * * * *"
  timeoutMs: 5000
  failuresToDown: 2
  successesToRecover: 2
  historyRetentionDays: 90

issues:
  publishLabel: statuspage/incident
  maintenanceLabel: statuspage/maintenance
  lockOfficialIncidents: true
  trustedMaintainers:
    - YOUR_GITHUB_LOGIN

history:
  initialMonths: 3
  monthsPerLoad: 3

embed:
  enabled: true
  pollIntervalMs: 300000
```

上例为格式示意。Copilot 应实现 schema 校验，未知的严重程度、模式或时间格式应给出清晰错误，不能静默修正。

## 5. GitHub Issue / Discussion 约定

### 5.1 标签规范

正式事故和维护事件都由 Issue 驱动。建议创建这些标签：

- 事件种类：`statuspage/incident`、`statuspage/maintenance`。
- 服务：`service/web`、`service/api`、`service/auth` 等，由 `config/services.json` 的服务 ID 派生或校验。
- 严重程度：`severity/minor`、`severity/major`、`severity/critical`。
- 处理阶段：`state/investigating`、`state/identified`、`state/monitoring`、`state/resolved`。

规则：

- 必须带一个事件类型标签；正式 Incident 必须带至少一个 `service/*` 标签和恰好一个 `severity/*` 标签。
- 不能仅根据标题中的“outage”“down”等关键词猜测严重程度。
- 多个服务标签表示一次事故影响多个服务。
- 每次同步均从当前 Issue 的完整标签集合计算状态，不依赖之前收到的 label event。
- 普通用户创建的未确认 Issue 不能自动让状态页进入故障。只有具有 `statuspage/incident` 发布资格且标签完整的事件才能进入公开列表。
- 对无效标签数据，记录结构化日志并跳过公开展示；不要因单条无效 Issue 让整个构建直接崩溃。

### 5.2 计划维护 Issue

提供 `.github/ISSUE_TEMPLATE/scheduled-maintenance.yml` 表单，收集：

- 标题和描述。
- 影响服务（发布前通过标签设定 `service/*`）。
- 严重程度/影响级别。
- 开始时间和结束时间，要求使用带时区的 ISO 8601，例如 `2026-10-15T02:00:00+08:00`。
- 时区标识，默认 `Asia/Singapore`，但不能硬编码假设所有站点都使用该时区。
- 维护期间预计影响与完成说明。

维护 Issue 必须被维护者确认，并带 `statuspage/maintenance`。维护时间字段应从模板生成的固定字段中解析；解析失败的维护不能被发布为确定的计划。界面需要展示原始时区或转换后的本地时间，且明确显示时区。

维护阶段：

- `scheduled`：当前时间早于 startsAt。
- `in_progress`：当前时间位于 startsAt 与 endsAt 之间。
- `completed`：当前时间晚于 endsAt，或 Issue 被维护者明确关闭。
- `cancelled`：维护者显式取消（可采用标签 `state/cancelled` 或固定字段）。

### 5.3 Issues 自动锁定与官方 Timeline

目标行为：当一个 Issue 首次变成符合规范的正式 Incident 后，工作流自动锁定 Issue 对话。Issue 被锁定时，具有必要写入权限的协作者/维护者仍可以回复，而普通参与者不能继续评论。使用官方 GitHub API/CLI 能力，不要自行模拟 GitHub 权限。

重要实现细节：

- 锁定调用应幂等：已锁定时不重复报错；权限不足时记录明确警告并在 README 说明所需权限。
- GitHub 锁定接口可接受的 `lock_reason` 是有限枚举（如 `off_topic`、`resolved`、`spam`、`too_heated`）。不要为了锁定一个仍在处理的正式事故而伪造一个不真实的锁定原因。实现时先确认当前 API/CLI 的参数和行为；若当前接口必须选原因，则采用配置项明确让仓库管理员选择策略，不得把“resolved”硬编码到仍在处理的事故上。没有合适策略时，在文档明确说明自动锁定的限制，并提供可关闭锁定的配置选项。
- 官方 Timeline 默认仅显示 `issues.trustedMaintainers` 中的账号的回复；可以支持额外可信 `author_association` 规则，但必须可配置、可测试。锁定状态本身不能替代 Timeline 的可信作者过滤。
- Timeline 事件建议包含：`investigating`、`identified`、`monitoring`、`resolved` 等标签变化，事故关闭/重开，可信维护者评论，自动健康检查状态转变。
- 评论创建/编辑/删除时重新同步；删除的评论不再展示。历史 Timeline 按时间排序，保留 GitHub comment URL。
- 原始 Issue 内容和评论都必须作为不可信 Markdown/文本处理，防止脚本注入。

### 5.4 Discussions

启用/读取以下类别（名称可以在配置中映射）：

- Announcements：站点公告。
- Scheduled Maintenance：补充公告/维护说明。
- Questions & Feedback：反馈入口。

Discussions 可以在首页公告区域展示，并链接原文；正式 Incident 仍以 Issues 为权威数据源。因为 Discussions 的 GitHub Actions webhook 事件目前可能受公开预览状态影响，不可把事故状态正确性完全依赖在 Discussion 触发器上。通过 Action 全量同步或定期的公告刷新补偿事件遗漏。

## 6. 公开数据文件与 TypeScript 类型

所有浏览器运行时读取的状态必须是公开静态数据。建议结构如下：

```text
public/
  data/
    summary.json
    summary.js
    services.json
    incidents-active.json
    incidents-all.json       # 可选；如体积过大，改用单独分块
    maintenance.json
    announcements.json
    history-index.json
    history/
      2026-10.json
      2026-09.json
  badges/
    status.svg
    incidents.svg
    service-web.svg
    service-api.svg
```

实际生成文件不需要都提交到源码分支。若采用单独 `status-data` 分支保存历史数据，工作流必须把产物复制到构建目录后再发布。

### 6.1 `summary.json`

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-11T12:00:00Z",
  "overall": "major_outage",
  "hasActiveIncident": true,
  "activeIncidentCount": 2,
  "affectedServiceCount": 1,
  "activeMaintenanceCount": 0,
  "monitoringMode": "hybrid",
  "isDemo": false
}
```

生产环境中的 `isDemo` 应为 `false`。如没有成功生成状态数据，页面应报告数据错误，而不是用示例数据填充。

### 6.2 `services.json`

包含服务配置与最新观测结果，例如 `id`、`name`、`group`、`description`、`publicUrl`（可选）、`status`、`lastCheckedAt`、`latencyMs`、`uptime30d`、`uptime90d`、`monitorMode`。未执行检测的 manual 服务应表示为 `unknown` 或 `manually_reported`，不能伪造响应时间和 uptime。

### 6.3 `incidents-active.json`

保存所有活动正式 Incident。每条数据至少包含：

- `id`（Issue number 与仓库限定组合即可）。
- `number`、`title`、`url`、`bodySummary`。
- `startedAt`、`updatedAt`、`closedAt`（若有）。
- `state`、`severity`、`serviceIds[]`。
- `isActive`。
- `timeline[]`：可信维护者更新和状态变化。

不得在生成文件时对活动事件数量做上限截断。

### 6.4 `history-index.json` 与每月历史文件

`history-index.json` 示例：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-11T12:00:00Z",
  "months": [
    { "month": "2026-10", "count": 2, "url": "./history/2026-10.json" },
    { "month": "2026-09", "count": 4, "url": "./history/2026-09.json" }
  ]
}
```

每月文件只包含归属该月的已结束 Incident，按开始时间倒序。若某月没有结束 Incident，可以不生成月份索引项。需要覆盖：一场事故持续跨月时只在它开始的月份出现一次；事件重新打开后应从历史组移出并回到活动列表；再次关闭后重新计算归属月份但保持同一事件 ID。

### 6.5 数据 schema 与兼容性

- 为公开 JSON 定义 TypeScript 接口，统一从一处导出。
- 所有生成数据包含 `schemaVersion`。
- 对外数据字段变更要更新 `schemaVersion` 或采用向后兼容策略。
- 对日期使用 ISO 8601 UTC 字符串存储；展示层根据 `site.timezone` 格式化。
- 不把私密正文、Token、环境变量或不应公开的内部 URL写入 JSON。

## 7. 数据保存与 Git 分支策略

不能使用常驻数据库，因此检查历史必须保存到 Git 中。推荐使用独立的 `status-data` 分支保存滚动监控记录与生成的静态 JSON，避免定时数据提交不断污染源代码主分支。

实现方案应具备：

1. 第一次运行时若 `status-data` 分支不存在，能从仓库 seed 数据初始化，或者在 README 明确提供一次性初始化命令。
2. 每次工作流从默认分支 checkout 源代码，再读取/更新 `status-data` 分支中的数据。
3. 对历史记录按 `historyRetentionDays` 进行滚动保留；旧数据归档/聚合规则明确，不允许无限增长。
4. 仅在实际数据变化时提交数据，提交信息清晰，例如 `chore(status-data): refresh public status data`。
5. 多个 workflow 不得同时覆盖状态数据；使用 `concurrency` 和幂等全量同步。不能只依赖事件 payload 作为唯一事实。
6. 数据更新、复制到站点构建目录、构建测试和 Pages 部署应在同一个工作流执行链中；不要期望使用 `GITHUB_TOKEN` push 触发的另一个 `push` 工作流自动继续，因为这类事件通常不会触发新的工作流运行。
7. 历史是由 Issue/评论和监控快照形成的公开输出；如果需要清理错误数据，应通过可重复的数据重建工具完成。

若实现专用数据分支过度复杂，可先把数据持久化抽象成 `DataStore` 接口，并提供 `GitBranchDataStore` 实现；不得退回到把每次采样都无条件提交到源代码主分支。

## 8. 健康检查引擎

### 8.1 配置

`config/services.json` 或等效配置定义：

- `id`、`name`、`group`、`description`。
- `monitoring.mode`（可选，继承全局设置）。
- `url`、`method`、`expectedStatus`、`timeoutMs`（只有 scheduled/hybrid 模式可用）。
- 可选响应内容关键字/JSON path 检查，但首版只实现 HTTP 状态、超时和可选简单关键字。
- `failuresToDown`、`successesToRecover` 覆盖值。

只检查仓库维护者配置的、允许公开探测的端点。URL 不可由 Issue 正文或用户可控查询参数直接指定，以降低 SSRF 风险。拒绝非 `http:`/`https:` URL，并在配置校验中警告不安全的 localhost / 私有网段目标；必要时使用 allowlist。

### 8.2 行为

- 以 `AbortController` 或等效机制实现超时。
- 记录 `checkedAt`、`ok`、`statusCode`（可空）、`latencyMs`（可空）、`errorKind`，不要将可能包含敏感信息的完整响应正文写入公开记录。
- 限制每个目标的超时和重试，不对失败无限重试。
- 维护连续失败/成功计数，达到配置阈值后变更服务观测状态。
- 避免对每次检查失败都创建一个新 Issue。若实现自动 Issue 创建，须按 `serviceId + active state` 去重，并保证同一故障最多只有一个活动 Incident；首版可以只自动更新状态数据、不自动创建 Issue。
- 对不同服务限制并发，避免在一次 GitHub Actions 运行中耗尽时间。
- 检测失败不应使整个数据同步任务直接停止；要将失败作为有效检测结果保存。

### 8.3 历史与可用率

- 保存最近 90 天或配置保留时间内的样本。
- 若计算 30/90 天可用率，要明确计算口径；至少区分 `unknown`（没有样本）和 `down`，不能将缺失样本计为正常。
- 对执行频率低于预期或存在大量漏检的区间，考虑将可用率显示为 `N/A` 或带有数据不完整提示。
- 历史条每个时间段都有状态值与准确日期，使用原生 CSS 渲染，不引入重量级图表库。

## 9. 静态 Badge 与第三方 Embed

### 9.1 SVG Badge

构建时为整体系统与每个服务生成 SVG：

- `badges/status.svg`：整体状态。
- `badges/incidents.svg`：活动 Incident 个数。
- `badges/service-<id>.svg`：单服务状态。

Badge 内容应是纯 SVG，所有文本必须经过 XML escape。为不同服务生成独立文件，不要期望 GitHub Pages 根据 `?service=api` 查询参数动态返回不同 SVG。

Badge 用法写入 README，例如：

```md
![System status](https://OWNER.github.io/REPO/badges/status.svg)
![Active incidents](https://OWNER.github.io/REPO/badges/incidents.svg)
```

使用通用 `OWNER`、`REPO` 占位符，不要把示例 URL 当生产 URL。提供可通过构建参数生成的最终站点链接。

### 9.2 浏览器 SDK 与 Embedding

希望外部网站能够读取“是否存在事故、事故数量、受影响服务数、正在进行的维护数量”，并显示嵌入状态条。

API 建议：

```js
const summary = await PulseStatus.getSummary();
// summary.hasActiveIncident
// summary.activeIncidentCount
// summary.affectedServiceCount
// summary.activeMaintenanceCount
// summary.overall
```

提供类似的脚本用法：

```html
<script
  defer
  src="https://OWNER.github.io/REPO/embed.js"
  data-service="all"
  data-theme="auto"
></script>
```

属性：

- `data-service="all"` 或某个服务 ID。
- `data-theme="light|dark|auto"`。
- `data-compact="true|false"`。
- 可选 `data-poll-interval`，设置最短轮询间隔且设置安全下限，防止第三方站点高频请求。

关键跨域设计：

- GitHub Pages 无法配置任意自定义 HTTP 响应头，因此不能假设可以按需设置 CORS 白名单。
- 首选测试公开静态 JSON 在实际 Pages 发布地址上的跨域 `fetch` 行为。
- 为保证跨域嵌入的兼容性，应同时生成一个静态 `summary.js`（将安全序列化后的固定状态放入命名空间）作为经典 `<script src>` 加载的 fallback；不得实现可注入任意 JavaScript 的通用 callback JSONP。
- `embed.js` 通过自身 `document.currentScript.src` 解析站点根 URL，不可使用第三方宿主网站的相对 URL 作为状态数据地址。
- SDK 只读取公开静态数据，不含 token、不写入 GitHub、不调用 GitHub 认证 API。
- Embed DOM 内容使用 `textContent` 或安全模板，不把远端标题直接拼为 HTML。
- 若站点数据加载失败，应显示中性提示/不显示状态条，并提供 Statuspage 主页链接；不能默认生成绿色正常状态。
- 支持重复嵌入多个组件；不得因重复加载产生多个定时器、重复事件监听器或污染不相关全局变量。
- 需要提供 TypeScript 类型声明（例如 `embed.d.ts`）和独立的 `docs/embed.md` 示例。

### 9.3 Embed 的实时性

Embed 的刷新只代表重新拉取最近发布的静态快照，并不保证源服务实时监控。默认 5 分钟轮询，允许配置但不得低于合理的最小间隔（比如 60 秒）；默认不启用过密轮询。页面上可以显示 `generatedAt` 作为状态数据时间。

## 10. GitHub Actions 工作流设计

建议尽量用一条可审计的主工作流完成“同步/检查 → 持久化数据 → 构建 → 测试 → 部署”，避免依赖由 `GITHUB_TOKEN` 生成的 push 再触发另一个工作流。

触发器至少包括：

- `push`：默认分支源码/配置变更。
- `schedule`：按配置定时触发。监控模式为 `scheduled`/`hybrid` 的服务才执行 HTTP 检查；`manual` 模式只允许刷新时间派生数据，不探测服务 URL。
- `workflow_dispatch`：维护者手动触发全量同步/检查。
- `issues`：`opened`、`edited`、`labeled`、`unlabeled`、`closed`、`reopened` 等必要事件。
- `issue_comment`：`created`、`edited`、`deleted`；过滤 Pull Request 评论事件。
- `discussion` 和 `discussion_comment`：公告同步需要的事件类型；考虑到事件可用性可能变化，另提供周期性全量同步补偿。

权限只授予所需权限，例如：

- `contents: write`：提交独立数据分支（如果采用）。
- `issues: read` 或 `issues: write`：同步事件；仅自动锁定确有需要时授权写入。
- `discussions: read`：读取讨论内容（视 GitHub token 支持的权限模型和仓库设置验证）。
- `pages: write`、`id-token: write`：部署 Pages。
- `actions: read` 非必需时不要额外授予。

工作流要求：

1. 给 GitHub Actions 配置最小必要 `permissions`；不要依赖宽泛的默认写权限。
2. 使用受信任且明确 pin 版本的官方部署 Actions；避免 `@master` 等浮动引用。
3. 设置 `concurrency`，防止两个状态更新任务同时写同一份历史。工作流必须幂等，因为事件可能在部署排队时合并或重复。
4. 检查触发事件来自 Issue 而不是 PR；不要把不可信 PR 修改当作可写入部署环境的代码。
5. 不要在 `run:` 脚本中直接插入 `${{ github.event.issue.title }}`、评论正文等不可信内容。通过环境变量/文件传入，再由代码进行数据解析和消毒。
6. 数据同步失败时不得自动发布“全部正常”占位数据。若已有上次有效数据，可保留旧数据并标记数据更新时间；失败应让 Action 失败或发出明显 warning。
7. Pages 采用自定义 workflow：配置 Pages、构建站点、上传 Pages artifact，再由 `deploy-pages` 部署，并设置 `github-pages` environment。遵循 GitHub 文档要求的 `pages: write`、`id-token: write` 和 job dependency。
8. `schedule` 延迟或跳过可能发生，因此 UI 显示真实 `generatedAt`/`lastCheckedAt`。README 不得承诺绝对准点的探测。
9. 要求 Node/包管理器缓存可复现；使用 lockfile，CI 执行 `npm ci`。
10. 为本地预览提供 `npm run dev`、`npm run build`、`npm run preview`、`npm test`、`npm run typecheck`。

推荐文件名：`.github/workflows/statuspage.yml`。如果实现时确需拆分工作流，应解释事件链如何保证不依赖 `GITHUB_TOKEN` 自动触发后续 workflow。

## 11. 推荐项目目录

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── incident-report.yml
│   │   └── scheduled-maintenance.yml
│   ├── workflows/
│   │   └── statuspage.yml
│   └── copilot-instructions.md
├── config/
│   ├── statuspage.yml
│   └── services.json
├── public/
│   ├── favicon.svg
│   ├── data/                  # 构建/部署前填充的静态数据
│   ├── badges/
│   └── embed.js
├── scripts/
│   ├── validate-config.ts
│   ├── sync-issues.ts
│   ├── sync-discussions.ts
│   ├── check-services.ts
│   ├── update-history.ts
│   ├── generate-summary.ts
│   ├── generate-badges.ts
│   └── build-public-data.ts
├── src/
│   ├── components/
│   ├── data/
│   ├── pages/
│   ├── styles/
│   ├── utils/
│   └── types/
├── tests/
│   ├── fixtures/
│   ├── labels.test.ts
│   ├── incident-status.test.ts
│   ├── history-grouping.test.ts
│   ├── maintenance.test.ts
│   ├── monitor-engine.test.ts
│   └── summary.test.ts
├── index.html
├── history.html
├── incident.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── COPILOT_IMPLEMENTATION_PLAN.md
```

Copilot 可以根据最终实现调整目录，但必须保留职责清晰、可测试的模块边界。不要把全部业务逻辑写成一个超长 `main.ts`。

## 12. 视觉与交互标准

风格关键词：轻量、现代、清晰、可信、留白、低装饰。

建议设计 token：

- 背景：浅灰蓝 `#F6F8FC`；暗色背景另设 token。
- 主要文字：`#17243D`。
- 正常：`#16A34A`。
- 性能下降：`#D97706`。
- 故障：`#DC2626`。
- 品牌强调：`#6366F1`。
- 卡片白底、细边框、8–16px 圆角、轻微层次；避免大量渐变、阴影和炫目动画。
- 使用系统字体栈，不强制依赖外部 CDN 字体。
- 历史条用 CSS 小条块/小方块，不需图表依赖。
- 响应式断点至少覆盖窄手机、平板、桌面。
- 交互需支持键盘导航、明显 focus 状态、`aria-live` 适当播报数据加载状态。
- 默认以系统主题为准，可提供明暗主题切换；主题选择不必持久化到服务器。
- 空状态、加载状态、失效数据、部分数据成功、重试状态都要完成设计。
- 将示例数据上的 “Illustrative data / Demo mode” 清楚标识。

## 13. 配置与失败降级

- 仓库 Owner/Name 和 Pages base path 通过配置或 GitHub 环境变量获取，不硬编码个人仓库名。
- Vite `base` 必须兼容项目站点路径与自定义域名根路径；README 说明配置方式。
- 当 GitHub API rate limit、权限不足或网络暂时故障时，若有上一次有效静态数据则保留并显示较旧的生成时间；不能伪装为最新数据。
- Discussion 无法读取时，Incident 仍需正常同步与显示；公告区域展示“公告暂不可用”或旧数据时间。
- 单个监控目标失败只影响对应服务的观测数据，不应该让其他服务和 Incident 同步全部失败。
- 如果 `history-index.json` 指向不存在的文件，History 页应显示可重试的局部错误，不导致整页崩溃。
- 解析不合法的 Issue 标签、时间戳或维护表单时，记录可定位到 Issue number 的错误，不泄漏任何凭证。

## 14. 测试要求

### 14.1 单元测试

至少覆盖：

- Issue 标签解析：单服务、多服务、严重程度缺失、严重程度重复、未知 service 标签、非正式 Issue。
- 活动/已结束判定：open、closed、resolved label、reopened。
- 状态优先级：重大活动 Incident 不被单次成功健康检查覆盖；自动检测持续失败时不能显示正常。
- History 分月：UTC 月份边界、跨月事故只出现一次、按月倒序、只包含结束事件、重新打开事故迁移到 active。
- Load more：初始 3 个月、每次 3 个月、没有更多月份、文件请求失败、重复点击不会重复插入记录。
- 维护状态：开始之前、开始时间点、维护中、结束时间点、取消、无效时间戳和带时区 ISO 日期。
- 监控阈值：连续失败次数、连续成功恢复、超时、无响应码、manual 模式不发 HTTP 请求。
- 总体状态聚合和 active incident count。
- Badge SVG/XML escape、安全序列化 summary.js。
- Trusted Timeline 作者过滤和评论编辑/删除后的同步。

### 14.2 构建与集成验证

必须通过：

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run preview` 的基本手动验证。

至少验证这些场景：

1. 没有 Incident：首页显示正常/未知（依数据规则）和空事件态，不能显示硬编码样例故障。
2. 有 1 个活动 Incident：首页显示它。
3. 有 20 个活动 Incident：首页全部出现。
4. Incident 标签由 major 改为 critical 后，严重程度、总体状态和 Badge 同步变化。
5. Incident 标记 resolved 或关闭后，从首页活动区移除，进入对应月份历史文件。
6. 历史页面初始仅加载最近 3 个有事件的月份；点击一次加载 3 个更早月份；连续多次不会重复。
7. 计划维护开始/结束边界正确，时区显示无歧义。
8. 非可信 Issue 评论不能进入官方 Timeline；可信维护者评论能正确显示。
9. Embed 在与状态页不同的域名中运行；JSON 跨域请求失败时可回退到静态 `summary.js`；数据不可用时不显示绿色“正常”。
10. 在 `/REPO/` 子路径部署后，所有 CSS、JS、图片、JSON、Badge 与页面链接仍然正确。

不要只写测试文件而不执行；在最终报告中列出真正运行过的命令和结果。

## 15. 分阶段实施计划

### Phase 1 — 仓库初始化与基础页面

- 检查当前仓库；创建 TypeScript、Vite、多页面结构和 lockfile。
- 建立 CSS variables、导航、首页、History、Incident detail 页面。
- 添加明确的 loading/empty/error states 和示例 fixtures。
- 先让 `npm run build` 与 `npm run typecheck` 通过。

验收：本地可以运行，视觉风格一致，三个页面能互相导航，项目路径 base 可配置。

### Phase 2 — Schema 与 Issue/Discussion 数据同步

- 实现配置 schema 校验和强类型公开数据模型。
- 用 GitHub API/GraphQL 实现分页同步 Issues、标签、评论及 Discussion 公告。
- 写标签解析、可信作者过滤、官方 Timeline、维护 Issue 时间解析。
- 加入重试、rate limit 错误处理、无效数据日志和测试 fixtures。

验收：运行脚本时可以把模拟/测试 fixture 转为符合 schema 的公开 JSON；没有认证信息进入前端 bundle。

### Phase 3 — 首页活动事故与历史分页

- 首页从 `incidents-active.json` 完整渲染所有活动事件，不能限制条数。
- 实现 History 的 `history-index.json` 和每月文件加载。
- 默认显示 3 个月，“加载更多”每次添加 3 个月，支持重试、无更多数据、键盘访问。
- 实现 Incident detail Timeline。

验收：通过“20 个活动事件”和“多月份历史”集成测试。

### Phase 4 — 监控模式、健康检查与数据持久化

- 实现 scheduled/manual/hybrid、服务级覆盖、timeout、失败/成功阈值、观测结果历史。
- 实现 Git 分支数据存储或明确的可替换存储层，使用滚动 retention。
- 确保正式活动 Incident 与自动检测独立，按定义聚合服务和全局状态。
- 加上计划维护时间边界处理。

验收：manual 模式绝不探测服务 URL；scheduled/hybrid 可按规则检测；历史重建可重复且幂等。

### Phase 5 — Badge、Embed 与 SDK

- 生成整体状态、事故数量和服务级 SVG Badge。
- 生成 summary JSON + `summary.js` 安全 fallback。
- 实现 `embed.js`、`PulseStatus.getSummary()`、外观主题、服务筛选和合理轮询。
- 写集成文档与真实跨域测试步骤。

验收：至少在一个不同 origin 的测试页面中测试脚本加载；CORS 不满足时使用静态 JS fallback；不能把远端文本作为 HTML 注入。

### Phase 6 — GitHub Actions 与 Pages 自动部署

- 实现统一状态工作流，接入 push/schedule/manual dispatch/Issue/评论/Discussion 事件。
- 仅赋予最小必要权限，设置并发控制，将数据同步、数据保存、构建和 Pages 部署串成同一次可追踪流程。
- 在正式 Incident 符合标签要求时自动锁定 Issue 对话；处理 API 参数约束、重复执行和权限失败。
- 配置 Pages build/deploy environment，添加 CI 任务。

验收：Actions 中可手动执行成功；事件触发后静态数据与页面被更新；不会依赖由 `GITHUB_TOKEN` push 触发的第二个 workflow。

### Phase 7 — 完善文档与最终审查

- README 写明功能、部署步骤、初始标签、Issue Form、配置文件、Badge、Embed、限制与维护策略。
- 检查安全注入、过期数据显示、空状态、响应式、可访问性和页面路径。
- 执行所有测试、typecheck 和生产构建。
- 最后输出实施总结、所需仓库设置、剩余问题，不要声称未执行的测试已通过。

## 16. 完成定义（Definition of Done）

只有全部满足以下条件，才算首版完成：

- [ ] GitHub Pages 可通过自定义 Actions 工作流部署。
- [ ] 不需要 D1、Worker、外部数据库或常驻后端。
- [ ] 首页列出所有活动 Incident，而不是固定数量。
- [ ] History 按月分组，默认 3 个月，每次“加载更多”增加 3 个月。
- [ ] 结束的 Incident 归档至开始月份，跨月事件不重复。
- [ ] 服务、严重程度和事件状态由明确标签规则计算。
- [ ] 可信开发者评论和状态迁移显示为 Timeline。
- [ ] 支持计划维护及时间边界。
- [ ] scheduled/manual/hybrid 三种模式行为清楚、可测试。
- [ ] SVG Badge 与第三方 Embed/SDK 能读取同一份状态数据。
- [ ] 跨域 Embed 有失败降级，不显示错误的绿色正常状态。
- [ ] 无 Token 进入浏览器端代码，输入内容经过安全处理。
- [ ] 有单元测试、CI 构建和完整的部署 README。

## 17. Copilot 可以直接执行的启动提示词

将以下文字复制给 GitHub Copilot Agent：

> 请先完整阅读仓库根目录 `COPILOT_IMPLEMENTATION_PLAN.md`，再检查当前仓库已有内容。严格按文档实现 PulseStatus，不要只给建议或代码片段。先完成 Phase 1，运行 typecheck/build 并修复错误，再按 Phase 2 到 Phase 7 继续。首页必须显示所有活动 Incident；History 必须按月份分组，初始加载 3 个月，每次点击加载更多加载另外 3 个月。Incident 数据以 GitHub Issues 为准；Discussions 仅用于公告/维护补充。实现时遵循最小权限、安全输入处理、无后端和 GitHub Pages 路径兼容要求。遇到 API/权限限制时先验证官方接口行为，再实现清晰的降级，不能伪造成功。每个阶段完成后运行测试并简要报告结果，最后交付实际代码、测试结果、部署说明和管理员手动配置清单。

## 18. 官方参考文档

- GitHub Pages custom workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Actions workflow events: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- GitHub REST API — Issues: https://docs.github.com/en/rest/issues/issues
- GitHub GraphQL API — Discussions: https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions
- GitHub Actions security / script injections: https://docs.github.com/en/actions/concepts/security/script-injections
- GitHub Actions `GITHUB_TOKEN` behavior: https://docs.github.com/en/actions/concepts/security/github_token
- GitHub CLI `gh issue lock`: https://cli.github.com/manual/gh_issue_lock

---

**最后的实施原则：** 所有状态页面、JSON、Badge 和 Embed 都读取同一份已验证的公开数据；Issue/Discussion 事件只触发重新同步，不直接绕过业务规则更改状态。对用户最重要的两条交互不可妥协：**首页永远列出全部活动 Incident；History 永远按月份呈现，并通过“加载更多”渐进加载更早月份。**
