# dsh-web-preview

在 DeepSeek Harness 右侧栏里直接预览网页，不用跳出 DSH 去开外部浏览器。

Preview web pages inside the DeepSeek Harness right sidebar — no external browser window needed.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.0--rc.1%2B-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-0284c7.svg)](https://github.com/topics/dsh-plugin)

---

## 它解决什么问题

写完前端要验证效果，标准流程是切到浏览器、开新标签、输地址、再切回来。真机上窗口一多就找不着北。DSH 的右侧栏本来就是文件预览的地盘，把网页也放进去，视线不用离开对话。

`dsh-web-preview` 给右侧栏加一个「网页预览」标签页：输入地址、回车，页面就在侧栏里跑起来。

## 用法

1. 点右侧栏 tab 条上的添加按钮，在引导页里选 **网页预览**。
2. 在地址栏输入 `localhost:5173` 或 `https://example.com`，回车。
3. 地址栏右侧三个按钮：重新加载、在外部浏览器打开、复制地址。

地址会自动补协议：`localhost:5173` 走 `http://`，裸域名走 `https://`。显式写了协议就按你写的来。

## 实现方式

走 DSH 官方的侧栏扩展点，不自绘面板、不覆盖既有 UI：

- 类型注册：`ctx.sidebarRightTabs.register({ id, kind, patterns, priority, title, guide })`
- 正文注册：`ctx.slots.register({ name: 'sidebar.right.pane.tab', key })`
- 导航：`ctx.sidebarRight.openResource('dsh-resource://web/<encodeURIComponent(url)>')`

每个预览地址是一个独立的资源 tab，同一地址重复打开会聚焦已有 tab，不会堆一堆重复页。tab 标题取目标站点的 host。

宿主侧只提供一个只读健康检查 `/api/web-preview/health`，不读文件、不落盘、没有对外网络请求。

## 安全边界

- iframe 只接受 `http` / `https`，其它协议直接拒绝。
- 拒绝把 DSH 自身的 origin 当作预览目标，避免把 DSH 页面嵌进自己造成同源脚本互扰。
- 不注入任何脚本到被预览的页面，不读取页面内容，不上报任何数据。
- 预览页运行在 iframe 的独立文档上下文里；父页面不获得它的 DOM。

## 已知限制

- 跨域页面无法被父页面读取 DOM，所以这一版只能「看」，不能「批注」。
- 拒绝承载体 X-Frame-Options / CSP `frame-ancestors` 的站点会白屏，这类站点请用地址栏右侧的 ↗ 打开到外部浏览器。
- 需要登录态的页面在侧栏里可能没有 cookie，取决于目标站点的 SameSite 策略。
- 尚未注册模型工具，目前由用户手动输入地址。

## 路线图

批注功能（指向页面元素、显示标签/尺寸/颜色/字体、点击就地下评论、批注回填输入框）二期实现。跨域 iframe 拿不到内部 DOM，二期改为宿主侧接管浏览器：Playwright 打开页面、CDP 推画面、坐标回传、`document.elementFromPoint` 取元素、注入批注覆盖层。

## 开发

```
lib/index.js         宿主侧：健康检查路由 + URL 规范化
lib/client.js        客户端侧：tab 类型注册、正文（地址栏 + iframe）
scripts/verify.mjs   自检
```

```bash
node scripts/verify.mjs
```

覆盖包元数据、patch 结构、客户端语法与依赖声明、同源防护、四类 URL 规范化用例、路由注册与健康检查、非法路由。共 14 项。

## 安装

```bash
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-web-preview"
```

路径含空格时改为手工方式：在 `profiles/desktop/package.json` 的 `dependencies` 加 `"dsh-web-preview": "link:E:/path/to/dsh-web-preview"`，在 `dsh.profile.bundles` 追加 `"dsh-web-preview"`，并在 `profiles/desktop/node_modules/` 下建指向本目录的 Junction，然后重启 DSH。

## 许可证

[MIT](LICENSE)

## 联系

邮箱：**1992335297@qq.com**
