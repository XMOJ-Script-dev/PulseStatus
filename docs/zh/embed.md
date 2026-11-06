# Embed 集成

**语言：** [English](../embed.md) · 简体中文

Embed 是一个可选的只读状态指示器，用于嵌入到其他网站。它不会渲染完整的服务目录或事件历史。当访问者需要服务详情、每日可用率、事件或维护信息时，请使用主状态页。

## 基本安装

使用部署在 Pages 源站上的静态脚本：

```html
<script defer src="https://XMOJ-Script-dev.github.io/PulseStatus/embed.js"
  data-service="all" data-position="top-right" data-hide-operational="false"
  data-theme="auto" data-compact="false"
  data-poll-interval="300000"></script>
```

脚本从自身 URL 派生数据来源，而不是从宿主页面。它会尝试请求公开的 `summary.json`，在无法加载时渲染中性的 `Status unavailable` 消息。轮询间隔会被限制为至少 60 秒。GitHub Pages 无法配置任意 CORS 头；如果跨域请求被阻止，请在宿主站点提供一个同源代理，或在自定义集成中使用生成的 `summary.js` 回退方案。本集成不使用 JSONP 回调。

## 属性

| 属性 | 取值 | 说明 |
| --- | --- | --- |
| `data-service` | `all` 或已配置的服务 ID | 将指示器限制为单个服务，或显示整体状态。 |
| `data-position` | `top-right`、`top-left`、`bottom-right`、`bottom-left` | 将状态指示器固定在视口的某个角落；默认为 `top-right`。 |
| `data-hide-operational` | `true`、`false` | 当选定服务正常运行时隐藏固定指示器；默认为 `false`。出现活跃事件或数据不可用时，指示器会重新显示。 |
| `data-theme` | `auto`、`light`、`dark` | 选择 embed 的配色方案。 |
| `data-compact` | `true`、`false` | 为 `true` 时使用紧凑布局。 |
| `data-poll-interval` | 毫秒 | 请求的刷新间隔；低于 60 秒的值会被限制。 |

指示器是一个固定于视口级别的通知。在宽度不超过 480px 的屏幕上，它使用 12px 的侧边边距，并在必要时折行。每个指示器使用一个脚本，并保留脚本的 `defer` 属性，以免阻塞宿主页面。embed 只读取公开数据；它无法访问私有的 GitHub Issue 或服务凭据。

## 故障排查

1. 直接打开已部署的 `summary.json` URL，确认它返回 JSON。
2. 检查浏览器控制台是否有跨域或 Content Security Policy 错误。
3. 确认 `data-service` 与服务 `id` 完全一致，而不是其显示名称。
4. 确认脚本 URL 中的 Pages 源站与发布状态页的分支和仓库一致。
