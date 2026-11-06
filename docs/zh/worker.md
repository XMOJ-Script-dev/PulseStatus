# 外部调度 Worker

**语言：** [English](../worker.md) · 简体中文

GitHub 不保证计划 workflow 的执行时间：免费版上 `*/5` 的 cron 实际可能每天只运行寥寥数次，仅靠内置的 `schedule` 触发器无法实现小时级以内的探测（实测数据见 [探测频率](configuration.md#探测频率)）。

`worker/` 目录包含一个 Cloudflare Worker 来解决这个问题：**Cron Trigger 每次准时运行**，通过 GitHub API 触发 PulseStatus 的 workflow。GitHub 侧的 cron 保留作为兜底，即使删除 Worker 探测也不会中断。

## 架构

```
Cloudflare Cron Trigger (*/5 * * * *)        GitHub
        │                                       │
        ▼                                       ▼
  pulsestatus-scheduler  ──workflow_dispatch──►  statuspage.yml
  ├─ 有进行中的运行则跳过                         (探测服务、
  └─ 距上次运行不足 4 分钟则跳过                   发布数据)
```

Worker 自身不探测你的服务，它只决定*是否启动一次 workflow 运行*，并用两条守卫规则：

- **进行中守卫**——任何 workflow 运行处于 `queued`/`in_progress` 时跳过本次触发，防止运行堆积（workflow 的 `cancel-in-progress` 为 `false`）。
- **最小间隔守卫**——最近一次运行开始时间距今不足 `CRON_MINUTES − 1` 分钟时跳过，即使在运行很快完成时也能保证节奏。

## 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/XMOJ-Script-dev/PulseStatus/tree/main/worker)

1. 在 `github.com/settings/personal-access-tokens/new` 创建一个**细粒度个人访问令牌**，对状态仓库（本仓库为 `XMOJ-Script-dev/PulseStatus`）授予 **Actions: Read and write** 权限。
2. 点击上方按钮。Cloudflare 会把 `worker/` 目录克隆到你账号下的一个新仓库，并打开发布页面。
3. 提示输入 `GITHUB_TOKEN` secret 时粘贴令牌。检查预填的 `vars`（owner、repo、workflow 文件、ref、cron 分钟数），如果你 fork 或改过名，按需调整。
4. 部署。Cron Trigger 立即开始工作。

## 配置

所有配置项在 `worker/wrangler.jsonc` 中，也可以在 Cloudflare 面板 **Workers & Pages → pulsestatus-scheduler → Settings → Variables and Secrets** 里覆盖。

| 变量 | 默认值 | 含义 |
| --- | --- | --- |
| `GITHUB_TOKEN` | *（secret，无默认值）* | 对目标仓库有 `actions: write` 权限的细粒度 PAT。通过部署按钮提示或 `npx wrangler secret put GITHUB_TOKEN` 设置。 |
| `GITHUB_OWNER` | `XMOJ-Script-dev` | 仓库所有者。 |
| `GITHUB_REPO` | `PulseStatus` | 仓库名。 |
| `WORKFLOW_FILE` | `statuspage.yml` | workflow 文件名，即 `workflow_dispatch` API 接受的标识。 |
| `GITHUB_REF` | `main` | 触发的分支或标签。 |
| `CRON_MINUTES` | `5` | 预期触发节奏；最小间隔守卫使用 `CRON_MINUTES − 1`。必须与 `triggers.crons` 和 `monitoring.schedule` 一致。 |

## 运维

- **诊断**——打开 Worker 的 URL（`https://pulsestatus-scheduler.<子域>.workers.dev/`）。它会报告令牌是否已配置、生效的配置，以及一次*干跑*决策（`would-dispatch` / `skipped-in-progress` / `skipped-too-recent` / `error`），不会真正触发。
- **Cron 历史**——面板 **Settings → Trigger Events → View events** 显示最近 100 次调用；日志在 **Workers Logs** 中。
- **本地开发**——在 `worker/` 下执行 `npm install && npm run dev`，然后 `curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"` 手动触发 scheduled 处理器。把令牌放进 `.dev.vars`（复制自 `.dev.vars.example`）即可真实调用 GitHub API。

## 安全说明

- 令牌只需对单个仓库有 `actions: write` 权限，不要授予 `contents` 或 `issues`——那些操作由 workflow 自身的 `GITHUB_TOKEN` / GitHub App 身份完成。
- PAT 以加密 secret 形式存储，绝不进入仓库。
- 任何人都能打开 Worker 的 URL，但它只执行只读的 GitHub API 调用，HTTP 请求永远不会触发 dispatch——派发只发生在 scheduled 处理器中。
