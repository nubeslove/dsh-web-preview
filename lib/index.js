// dsh-web-preview — host 侧
// 职责：暴露预览通道的健康检查与"最近一次打开的地址"记录。
// 一期只做只读状态；页面本体由客户端 iframe 渲染，宿主持有它的来源配置。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const name = 'web-preview';
export const inject = [];

const PREFIX = '/api/web-preview';

// 允许被预览的地址：http/https，以及自动补全协议后的 localhost 形式。
const ALLOWED_PROTOCOL = /^https?:\/\//i;
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[/?#]|$)/i;

/**
 * 把用户输入还原成可加载的 URL。
 * localhost 形式自动补 http://，其余按 https:// 处理。
 * @param {unknown} raw
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function normalizePreviewUrl(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'url must be a string' };
  const text = raw.trim();
  if (!text) return { ok: false, error: 'url is empty' };
  if (text.length > 2048) return { ok: false, error: 'url too long' };

  let url = text;
  if (!ALLOWED_PROTOCOL.test(url)) {
    // 显式写了其它协议（ftp://、file:// 等）直接拒绝，避免被补成 https 前缀后误判为合法
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      return { ok: false, error: 'only http/https is allowed' };
    }
    url = LOCAL_HOST.test(url) ? 'http://' + url : 'https://' + url;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'invalid url' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'only http/https is allowed' };
  }
  return { ok: true, url: parsed.toString() };
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function makeRoutes() {
  const handler = async (req, res) => {
    const method = String(req.method ?? 'GET').toUpperCase();
    const pathname = String(req.url ?? '').split('?', 1)[0] ?? '';
    const tail = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) : pathname;

    if (method === 'GET' && (tail === '/' || tail === '/health')) {
      return json(res, 200, {
        ok: true,
        data: {
          status: 'ready',
          kind: 'web-preview',
          addressPrefix: 'dsh-resource://web/',
          profileHome: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
          hasProfileHome: existsSync(process.env.DSH_HOME ?? join(homedir(), '.dsh'))
        }
      });
    }
    return json(res, 404, { ok: false, error: 'no route ' + method + ' ' + tail });
  };
  return [{ kind: 'prefix', path: PREFIX, handler }];
}

export function apply(ctx) {
  const routes = makeRoutes();
  ctx.inject(['webServer'], (httpCtx) => {
    httpCtx.effect(() => {
      const disposers = routes.map((route) => httpCtx.webServer.register(route));
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, 'web-preview: routes');
  });
}
