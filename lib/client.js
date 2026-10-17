window.__ModuleLoader__.load({
	id: "dsh-web-preview",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		"use strict";

		var React = require("react");
		var h = React.createElement;

		var ID = "dsh-web-preview";
		var KIND = "web-preview";
		var ADDRESS_PREFIX = "dsh-resource://web/";
		var NS = "web-preview";
		var STYLE_ID = "dsh-web-preview-style";

		// 侧栏服务由 @deepseek-ai/dsh-client-ui-sidebar-right 提供
		var inject = ["slots", "sidebarRightTabs", "sidebarRight"];

		var LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[/?#]|$)/i;

		// 打开正文时拿到的根 context，供正文里的导航按钮使用
		var pluginCtx = null;

		// ------------------------------------------------------------ 地址

		/** 把资源地址还原成可加载的 URL；页面地址（无 URL）返回空串。 */
		function decodeAddress(address) {
			if (typeof address !== "string") return "";
			if (address.indexOf(ADDRESS_PREFIX) !== 0) return "";
			try {
				return decodeURIComponent(address.slice(ADDRESS_PREFIX.length));
			} catch (e) {
				return "";
			}
		}

		/** 把用户输入转成资源地址。 */
		function encodeAddress(url) {
			return ADDRESS_PREFIX + encodeURIComponent(url);
		}

		/** 补全协议：localhost 补 http，其余补 https。 */
		function normalizeInput(raw) {
			var text = String(raw || "").trim();
			if (!text) return "";
			if (/^https?:\/\//i.test(text)) return text;
			if (LOCAL_HOST.test(text)) return "http://" + text;
			return "https://" + text;
		}

		/** 地址栏里显示的短形式（去掉协议与尾斜杠）。 */
		function prettyUrl(url) {
			return String(url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
		}

		function hostOf(url) {
			try {
				return new URL(url).host || prettyUrl(url);
			} catch (e) {
				return prettyUrl(url);
			}
		}

		// ------------------------------------------------------------ 样式

		var CSS = [
			".wp-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsh-bg-base,#16181d)}",
			".wp-bar{display:flex;align-items:center;gap:6px;padding:7px 8px;border-bottom:1px solid rgba(127,127,127,.22);flex:0 0 auto;background:var(--dsh-bg-elevated,#1f2229)}",
			".wp-input{flex:1 1 auto;min-width:0;height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;font-size:12px;font-family:var(--dsh-font-mono,ui-monospace,Consolas,monospace);outline:none}",
			".wp-input:focus{border-color:rgba(56,160,255,.65)}",
			".wp-btn{height:28px;min-width:28px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;gap:4px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--dsh-text-secondary,#9aa4b2);font-size:12px;line-height:1;cursor:pointer;transition:background .12s,color .12s;white-space:nowrap}",
			".wp-btn:hover{background:rgba(127,127,127,.16);color:var(--dsh-text-primary,#e6e8eb)}",
			".wp-btn[data-primary=\"1\"]{background:#2f7de1;color:#fff;border-color:#2f7de1}",
			".wp-btn[data-primary=\"1\"]:hover{background:#3a8bf0}",
			".wp-frame-wrap{position:relative;flex:1 1 auto;min-height:0;background:#fff}",
			".wp-frame{width:100%;height:100%;border:0;display:block;background:#fff}",
			".wp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;height:100%;padding:24px;text-align:center;color:var(--dsh-text-secondary,#9aa4b2)}",
			".wp-empty-title{font-size:13px;font-weight:600;color:var(--dsh-text-primary,#e6e8eb)}",
			".wp-empty-hint{font-size:11.5px;line-height:1.7;max-width:360px;opacity:.8}",
			".wp-empty-row{display:flex;gap:6px;width:100%;max-width:420px}",
			".wp-note{padding:5px 10px;font-size:11px;line-height:1.6;background:rgba(240,180,60,.12);color:#e8c07a;border-bottom:1px solid rgba(127,127,127,.18);flex:0 0 auto}",
			".wp-note[data-kind=\"error\"]{background:rgba(240,128,128,.14);color:#f0a0a0}"
		].join("\n");

		function ensureStyle() {
			if (document.getElementById(STYLE_ID)) return;
			var el = document.createElement("style");
			el.id = STYLE_ID;
			el.textContent = CSS;
			document.head.appendChild(el);
		}

		// ------------------------------------------------------------ 正文

		/**
		 * 侧栏 tab 正文：地址栏 + iframe。
		 * 通过框架注入的 useTabInfo 读取当前 tab 的资源地址。
		 */
		function WebPreviewBody(props) {
			var useTabInfo = props && props.useTabInfo;
			var info = typeof useTabInfo === "function" ? useTabInfo() : null;
			var tab = (info && info.tab) || {};
			var currentUrl = decodeAddress(tab.contentId);

			var s0 = React.useState("");
			var draft = s0[0];
			var setDraft = s0[1];

			var s1 = React.useState(0);
			var reloadKey = s1[0];
			var setReloadKey = s1[1];

			var s2 = React.useState("");
			var notice = s2[0];
			var setNotice = s2[1];

			var s3 = React.useState(currentUrl);
			var seededFor = s3[0];
			var setSeededFor = s3[1];

			React.useEffect(function () {
				ensureStyle();
			}, []);

			// tab 切换时同步地址栏内容
			React.useEffect(function () {
				if (seededFor === currentUrl) return;
				setDraft(currentUrl);
				setSeededFor(currentUrl);
				setNotice("");
				setReloadKey(function (n) { return n + 1; });
			}, [currentUrl, seededFor]);

			function navigate(raw) {
				var url = normalizeInput(raw);
				if (!url) {
					setNotice("先输入一个地址");
					return;
				}
				var bad = validate(url);
				if (bad) {
					setNotice(bad);
					return;
				}
				if (url === currentUrl) {
					setReloadKey(function (n) { return n + 1; });
					return;
				}
				var sidebarRight = pluginCtx && pluginCtx.sidebarRight;
				if (!sidebarRight || typeof sidebarRight.openResource !== "function") {
					setNotice("侧栏导航服务不可用，请重启 DSH 后再试");
					return;
				}
				try {
					sidebarRight.openResource(encodeAddress(url));
				} catch (err) {
					setNotice("打开失败：" + String((err && err.message) || err));
				}
			}

			/** 拒绝把 DSH 自身地址嵌进自身，避免同源脚本互相干扰。 */
			function validate(url) {
				try {
					var parsed = new URL(url);
					if (parsed.protocol !== "http:" && parsed.protocol !== "https:")	return "只支持 http 与 https";
					if (typeof location !== "undefined" && parsed.origin === location.origin) {
						return "不能预览 DSH 自身的地址";
					}
					return "";
				} catch (e) {
					return "地址格式不正确";
				}
			}

			function copyAddress() {
				var text = currentUrl || normalizeInput(draft);
				if (!text) return;
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text).catch(function () {});
				}
			}

			function openExternal() {
				var url = currentUrl || normalizeInput(draft);
				if (!url) return;
				window.open(url, "_blank", "noopener,noreferrer");
			}

			var bar = h("div", { className: "wp-bar" },
				h("input", {
					className: "wp-input",
					value: draft,
					placeholder: "localhost:3000 或 https://example.com",
					spellCheck: false,
					onChange: function (e) { setDraft(e.target.value); },
					onKeyDown: function (e) {
						if (e.key === "Enter") {
							e.preventDefault();
							navigate(draft);
						}
					}
				}),
				h("button", {
					type: "button",
					className: "wp-btn",
					"data-primary": "1",
					title: "打开地址",
					onClick: function () { navigate(draft); }
				}, "打开"),
				h("button", {
					type: "button",
					className: "wp-btn",
					title: "重新加载",
					disabled: !currentUrl,
					onClick: function () { setReloadKey(function (n) { return n + 1; }); }
				}, "↻"),
				h("button", {
					type: "button",
					className: "wp-btn",
					title: "在外部浏览器打开",
					disabled: !currentUrl && !draft,
					onClick: openExternal
				}, "↗"),
				h("button", {
					type: "button",
					className: "wp-btn",
					title: "复制地址",
					disabled: !currentUrl && !draft,
					onClick: copyAddress
				}, "⧉")
			);

			var noticeBar = notice ? h("div", { className: "wp-note", "data-kind": "error" }, notice) : null;

			if (!currentUrl) {
				return h("div", { className: "wp-root" },
					bar,
					noticeBar,
					h("div", { className: "wp-empty" },
						h("div", { className: "wp-empty-title" }, "网页预览"),
						h("div", { className: "wp-empty-hint" },
							"输入本地开发服务器地址即可在这里查看，不必再开外部浏览器。",
							h("br", null),
							"只写 localhost:5173 会自动补 http://。"
						),
						h("div", { className: "wp-empty-row" },
							h("input", {
								className: "wp-input",
								value: draft,
								placeholder: "localhost:5173",
								spellCheck: false,
								onChange: function (e) { setDraft(e.target.value); },
								onKeyDown: function (e) {
									if (e.key === "Enter") {
										e.preventDefault();
										navigate(draft);
									}
								}
							}),
							h("button", {
								type: "button",
								className: "wp-btn",
								"data-primary": "1",
								onClick: function () { navigate(draft); }
							}, "预览")
						)
					)
				);
			}

			return h("div", { className: "wp-root" },
				bar,
				noticeBar,
				h("div", { className: "wp-frame-wrap" },
					h("iframe", {
						key: currentUrl + "#" + reloadKey,
						className: "wp-frame",
						src: currentUrl,
						title: "网页预览 · " + hostOf(currentUrl),
						referrerPolicy: "no-referrer-when-downgrade",
						sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
					})
				)
			);
		}

		// ------------------------------------------------------------ 入口

		function apply(ctx) {
			pluginCtx = ctx;
			ensureStyle();

			// 正文席位
			ctx.effect(function () {
				return ctx.slots.inject("sidebar.right.pane.tab", function () {
					return ctx.slots.register({ name: "sidebar.right.pane.tab", key: ID }, WebPreviewBody);
				});
			}, "web-preview: body");

			// tab 类型与引导入口
			ctx.effect(function () {
				if (!ctx.sidebarRightTabs || typeof ctx.sidebarRightTabs.register !== "function") {
					return function () {};
				}
				return ctx.sidebarRightTabs.register({
					id: ID,
					kind: KIND,
					patterns: [ADDRESS_PREFIX + "[\\s\\S]+"],
					priority: "extension",
					title: function (address) {
						var url = decodeAddress(address);
						return url ? hostOf(url) : "网页预览";
					},
					guide: [
						{
							id: ID + ":entry",
							kind: KIND,
							title: "网页预览",
							description: "在侧栏打开本地开发服务器或任意网址",
							order: 20
						}
					]
				});
			}, "web-preview: tab type");
		}

		module.exports = { apply: apply, inject: inject };
		return module.exports;
	}
});
