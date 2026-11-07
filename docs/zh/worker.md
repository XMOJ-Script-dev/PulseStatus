# 外部调度 Worker

**语言：** [English](../worker.md) · 简体中文

GitHub 不保证计划 workflow 的启动时间。Worker 每分钟轮询一次，按配置的五分钟间隔派发；如果上一次 workflow 仍运行，会排队一个后续任务而不是漏掉探测。GitHub Runner 资源繁忙时，实际执行仍可能延迟。

`worker/` 目录包含一个每分钟运行的 Cloudflare Cron Trigger，通过 GitHub API 触发 PulseStatus 的 workflow。GitHub 侧的 cron 保留作为兜底，即使删除 Worker 探测也不会中断。

## 架构

```
Cloudflare Cron Trigger (* * * * *)           GitHub
        │                                       │
        ▼                                       ▼
  pulsestatus-scheduler  ──workflow_dispatch──►  statuspage.yml
  ├─ 已有排队运行则跳过                             (探测服务、
  └─ 距上次运行不足 4 分钟则跳过                   发布数据)
```

Worker 自身不探测你的服务，它只决定*是否启动一次 workflow 运行*，并用两条守卫规则：

- **排队守卫**——已有运行处于 `queued`/`waiting` 时跳过本次触发。如果运行仍在执行且间隔已到，Worker 会派发一个后续运行；workflow 的并发组会让它等待当前运行结束。
- **最小间隔守卫**——最近一次运行开始时间距今不足 `CRON_MINUTES` 分钟时跳过。每分钟轮询会在间隔到期后的下一次检查时启动运行。
- 只检查配置的 workflow 和分支，不会被其他 workflow 或分支上的运行延迟。

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
| `CRON_MINUTES` | `5` | workflow 运行之间的最小间隔；必须与 `monitoring.probeIntervalMinutes` 一致。 |

## 运维

- **诊断**——打开 Worker 的 URL（`https://pulsestatus-scheduler.<子域>.workers.dev/`）。它会报告令牌是否已配置、生效的配置，以及一次*干跑*决策（`would-dispatch` / `skipped-in-progress` / `skipped-too-recent` / `error`），不会真正触发。
- **Cron 历史**——面板 **Settings → Trigger Events → View events** 显示最近 100 次调用；日志在 **Workers Logs** 中。
- **本地开发**——在 `worker/` 下执行 `npm install && npm run dev`，然后 `curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"` 手动触发 scheduled 处理器。把令牌放进 `.dev.vars`（复制自 `.dev.vars.example`）即可真实调用 GitHub API。

## 安全说明

- 令牌只需对单个仓库有 `actions: write` 权限，不要授予 `contents` 或 `issues`——那些操作由 workflow 自身的 `GITHUB_TOKEN` / GitHub App 身份完成。
- PAT 以加密 secret 形式存储，绝不进入仓库。
- 任何人都能打开 Worker 的 URL，但它只执行只读的 GitHub API 调用，HTTP 请求永远不会触发 dispatch——派发只发生在 scheduled 处理器中。
