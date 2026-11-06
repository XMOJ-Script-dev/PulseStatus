# 自动化身份：GitHub Actions 或 PulseStatusBot

**语言：** [English](../github-app.md) · 简体中文

PulseStatus 可以使用默认的 `GITHUB_TOKEN` 或已安装的 GitHub App 来执行 Issue 创建、Issue 更新、监控状态提交以及其他 GitHub API 操作。

## 默认行为

如果未提供仓库变量或 App 凭据，workflow 会使用内置的 `github-actions` 身份。这是最安全的零配置模式，也是默认模式。

只有当以下三个条件全部满足时，workflow 才会使用 App：

1. 仓库或组织变量 `PULSE_BOT_MODE` 为 `app`。
2. Secret `PULSE_APP_ID` 存在。
3. Secret `PULSE_APP_PRIVATE_KEY` 存在。

如果 `PULSE_BOT_MODE` 缺失、设为 `actions`，或 App 凭据不完整，workflow 将回退到 `GITHUB_TOKEN`。

如果凭据存在但 App 未安装在目标仓库上，token 的创建也会以 workflow 警告的形式回退到 `GITHUB_TOKEN`。部署会继续进行，但该次运行中的 API 操作将由 `github-actions` 执行。

## 创建 `PulseStatusBot`

创建 GitHub App 属于账户或组织级别的管理操作，无法通过仓库提交完成。请在拥有该仓库的组织中一次性创建：

1. 打开 **Organization settings → Developer settings → GitHub Apps**。
2. 选择 **New GitHub App**。
3. 将名称设置为 `PulseStatusBot`（或组织批准的其他名称）。
4. 除非需要外部 webhook 接收器，否则禁用 webhook。
5. 授予最低限度的仓库权限：
   - **Contents: Read and write** —— 用于持久化监控状态提交。
   - **Issues: Read and write** —— 用于创建和关闭自动化的 Incident。
   - **Metadata: Read-only** —— GitHub 要求的必需权限。
6. 不要授予管理、Actions 写入、secrets、deployments 或组织管理权限。
7. 创建 App 并记录其 **App ID**。
8. 生成一个私钥并立即下载一次。将其保存在密码管理器中；切勿将其提交到仓库。
9. 在组织上安装该 App，并仅选择 `PulseStatus` 仓库。

该 App 用户将以 `PulseStatusBot[bot]` 的身份出现在 GitHub 上。

## 添加仓库或组织设置

在 **Settings → Secrets and variables → Actions → Secrets** 下添加以下仓库 Secret：

| Secret | 值 |
| --- | --- |
| `PULSE_APP_ID` | 数字形式的 App ID。 |
| `PULSE_APP_PRIVATE_KEY` | 完整的 PEM 私钥，包括 `BEGIN` 和 `END` 行。 |

在 **Variables** 下添加以下仓库或组织 Variable：

| Variable | 值 |
| --- | --- |
| `PULSE_BOT_MODE` | `app` |

不要将 App ID 或私钥放在 `config/statuspage.yml`、`config/services.json`、README 文件、workflow 源码或生成的公开数据中。私钥是凭据材料，必须保存在加密的 GitHub Secret 中。

## 让每个用户选择自己的 bot

workflow 不会硬编码 App 名称。任何仓库所有者都可以通过仓库设置配置自己的 GitHub App：

1. 将所选 App 安装在确切的仓库上。
2. 添加 Actions 变量 `PULSE_BOT_MODE`，值为 `app`。
3. 添加 Actions secret `PULSE_APP_ID`，值为该 App 的数字 ID。
4. 添加 Actions secret `PULSE_APP_PRIVATE_KEY`，值为完整的 PEM 私钥。
5. 手动运行 `PulseStatus` workflow 以进行验证。

当同一个 bot 需要服务于多个仓库时，可以使用组织级变量和 Secret。仓库级值按照 GitHub Actions 常规的变量与 Secret 规则优先。

用户无需修改代码即可切回：

```text
PULSE_BOT_MODE=actions
```

或者，删除该变量和 App 的 Secret。在没有有效 App 配置的情况下，将使用内置的 `GITHUB_TOKEN`。

### 设置检查清单

| 设置 | 位置 | 必需的值 |
| --- | --- | --- |
| `PULSE_BOT_MODE` | Actions variable | `app` 或 `actions` |
| `PULSE_APP_ID` | Actions secret | 属于所选 App 的数字 ID |
| `PULSE_APP_PRIVATE_KEY` | Actions secret | 属于所选 App 的完整 PEM 私钥 |

不要在普通的仓库 **Variables** 部分中输入私钥，因为变量并非用于存放敏感的凭据材料。

## 验证身份

保存设置后手动运行 workflow。确认：

1. 同步步骤可以读取 Issue。
2. 触发自动化 Incident 时，其作者为 `PulseStatusBot[bot]`。
3. `public/data/monitor-state.json` 的提交显示 App 身份。
4. Pages 部署仍然成功。

workflow 会通过 GitHub API 解析已安装 App 的 bot 用户 ID，并在 App token 生效时将 Git 作者设置为该 bot 身份。提交邮箱遵循 GitHub 的 App bot 格式：

```text
<bot-user-id>+<app-slug>[bot]@users.noreply.github.com
```

bot 用户 ID 不是 App ID 或 OAuth client ID。使用其中任何一个值都会产生无法识别的作者。如果 workflow 回退到 `GITHUB_TOKEN`，提交应显示为 `github-actions[bot]`。已有的提交不会被重写；只有在此 workflow 变更之后创建的提交才会使用所选身份。

GitHub Pages 的配置和部署仍是平台 Actions 操作，使用内置的 workflow token；仓库提交和 Issue API 操作使用所选的 App token。

如果 App 未安装在仓库上，token 步骤会对 `/repos/<owner>/<repo>/installation` 返回 404 错误；请将 App 安装在该确切的仓库上并重新运行 workflow。如果 App 的权限过窄，App 身份验证的 API 调用可能在 token 创建之后失败。在修正安装问题期间，将 `PULSE_BOT_MODE` 改回 `actions`，即可恢复使用默认 token。

## 安全与轮换

App token 是短效的，在每次 workflow 开始时生成。workflow 不会将私钥写入磁盘。如需轮换，请在 App 设置中生成新密钥，替换 `PULSE_APP_PRIVATE_KEY`，手动运行一次 workflow，并且只在运行成功后吊销旧密钥。

如果组织要求所有自动化都使用 GitHub Actions，则不要设置 `PULSE_BOT_MODE`，也不要创建 App。两种模式使用相同的应用行为和数据校验。
