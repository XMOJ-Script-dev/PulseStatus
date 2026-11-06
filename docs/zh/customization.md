# 品牌与 CSS 定制

**语言：** [English](../customization.md) · 简体中文

本指南介绍在不修改应用逻辑的前提下进行视觉定制。源码层面的修改应放在 `config/statuspage.yml`、`public/` 或 `src/styles/custom.css`；生成的 `dist/` 资源是一次性的，可随时重新生成。

## CSS 入口

编辑 [`src/styles/custom.css`](../src/styles/custom.css)。它在 `main.css` 之后引入，因此是存放仓库特有修改的受支持位置。不要编辑 `dist/` 下生成的文件，也不要编辑 `public/data/` 下生成的数据。

简单的换色通常完全不需要写 CSS：`config/statuspage.yml` 中的 `site.colors` 会在运行时把核心色板（`brand`、`brandDeep`、`success`、`warning`、`danger`）以 CSS 变量形式覆盖，且与所有内置主题叠加生效。只有需要布局、排版或超出这五个变量的选择器级修改时，才动用 `custom.css`。

由管理员选择的 `site.theme` 会将根元素上的 `data-style` 设置为 `modern`、`compact`、`vivid` 或 `mono`。只针对某一种内置样式做定制而不影响其他样式：

```css
html[data-style="modern"] {
  --brand: #0f766e;
  --brand-deep: #115e59;
}
```

为所有样式设置相同的公司配色：

```css
:root {
  --brand: #0b5fff;
  --brand-deep: #0645c0;
  --success: #16803c;
}

.brand-mark {
  border-radius: 6px;
}
```

可用的核心变量包括 `--surface`、`--border`、`--muted`、`--brand`、`--brand-deep`、`--success`、`--warning`、`--danger` 和 `--ink-soft`。现有的选择器已覆盖 `.site-header`、`.site-footer`、`.hero`、`.service-row`、`.service-group-header`、`.system-board`、`.board-row`、`.board-dot`、`.directory-uptime`、`.uptime-card`、`.uptime-day`、`.incident-card` 和 `.pill`。在默认的 `standard` 布局下，服务目录渲染为 Cloudflare 风格：分组标题在其聚合状态旁以 `.pill` 形式展示，成员服务是以细线分隔的 `.service-row` 链接，目录上方的 `.directory-uptime` 条带汇总 90 天可用率。使用 `site.layout: fused` 时，目录渲染为圆角的 `.system-board`：`.board-group-header` 区块和 `.board-row` 链接使用带颜色的 `.board-dot` 指示器和文字形式的 `.board-status` 颜色，而不是 pill。分组按严重程度排序（最严重的在前），而不是按配置顺序，因此请用 CSS 重新设计 pill 的样式，而不是用 CSS 改变分组顺序。

## 主题设计令牌

已发布的站点只有一个由管理员选择的主题；访客没有 CSS 选择器，也没有本地主题偏好。仓库级别的覆盖可以只针对已配置的主题，也可以兼容全部四个取值：

```css
html[data-style="vivid"] .brand-mark {
  background: linear-gradient(135deg, #be123c, #7c2d12);
}

html[data-style="mono"] .card {
  border-radius: 4px;
  box-shadow: none;
}
```

避免仅用颜色来传达故障信息。状态 pill 包含文字，可用率单元格包含无障碍标签和浏览器提示。如果修改单元格颜色，请保留明暗、警告/错误之间的有意义的区分。

## 字体与资源

默认使用系统字体栈。如果组织拥有自有字体，将其放在 `public/` 下，并在 `custom.css` 中引用：

```css
@font-face {
  font-family: "Acme Sans";
  src: url("../fonts/acme-sans.woff2") format("woff2");
  font-display: swap;
}

:root {
  font-family: "Acme Sans", Inter, system-ui, sans-serif;
}
```

如需添加 logo 或 favicon，将资源放在 `public/` 下，并在 `config/statuspage.yml` 中设置 `site.favicon`。页眉的标识刻意采用纯文本实现；可以通过 CSS 替换，或给 `.brand-mark` 设置背景图片来替换它。

### Logo 与 favicon 示例

```css
.brand-mark {
  width: 34px;
  height: 34px;
  background: url("/brand/logo-mark.svg") center / contain no-repeat;
  color: transparent;
}
```

将资源放在 `public/brand/logo-mark.svg`。如需设置浏览器标签页图标，设置 `site.favicon: brand/favicon.svg`；构建时会将其应用到每个页面。

## 布局指南

站点在 640px 和 760px 断点处响应式适配。优先使用流式尺寸、`minmax()` 以及现有的布局原语。保证服务详情内容在移动端可读，并为键盘用户保留可见的焦点轮廓。

不要用 CSS 隐藏事件或维护信息。样式可以改变呈现方式，但状态页应保持可访问且内容真实。

## 测试定制

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

在本地打开 `/`、`/history.html` 和 `/service.html?id=web`。逐个选择每种内置样式，验证自定义规则仍能提供足够的对比度、焦点可见性和移动端布局。

## 无障碍与性能检查清单

- 保持正文文字和弱化文字在 `--surface` 背景上具有可读的对比度。
- 为链接和按钮保留 `:focus-visible` 轮廓。
- 在 320px、640px 和桌面宽度下进行测试。
- 自定义字体使用 `font-display: swap`，并避免使用大尺寸背景图片。
- 不要隐藏进行中的事件、维护或不可用状态的消息。
- 除非运营上确有必要，不要让公共状态页发起外部字体、图片和统计请求。

## 发布自定义样式

1. 编辑 `src/styles/custom.css`。
2. 运行 `npm run typecheck`、`npm test` 和 `npm run build`。
3. 在本地打开全部四个页面，验证管理员选择的主题被一致地应用。
4. 检查生成的 `dist/assets/` 输出；如果使用 GitHub Pages，还要测试部署后的 base path。
5. 提交源 CSS 和 `public/` 下的资源；永远不要提交手动编辑过的 `dist/` 文件。
