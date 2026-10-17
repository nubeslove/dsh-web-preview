// dsh-web-preview 自检脚本
// 只验证结构、语法、路由与 URL 规范化，不启动浏览器、不加载 iframe。
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS  ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL  ' + name);
    console.log('        ' + (err instanceof Error ? err.message : String(err)));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('dsh-web-preview verify');

  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

  await check('package.json 基本字段', () => {
    assert(pkg.name === 'dsh-web-preview', 'name 不符');
    assert(pkg.type === 'module', 'type 必须是 module');
    assert(pkg.main === './lib/index.js', 'main 指向错误');
    assert(pkg.exports['./client'].default === './lib/client.js', 'client 导出缺失');
    assert(pkg.author && pkg.author.email, '缺少作者邮箱');
  });

  await check('dsh 元数据声明 bundle 与 client', () => {
    assert(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === './cordis.patch.yml', 'bundle.patch 缺失');
    assert(pkg.dsh.client && pkg.dsh.client.platform === 'web', 'client.platform 必须是 web');
    assert(Array.isArray(pkg.dsh.client.inject), 'client.inject 必须是数组');
  });

  await check('cordis.patch.yml 结构', async () => {
    const text = await readFile(join(root, 'cordis.patch.yml'), 'utf8');
    assert(/insert:/.test(text), '缺少 insert 段');
    assert(/id:\s*web-preview/.test(text), '缺少条目 id');
    assert(/dsh-web-preview/.test(text), '缺少插件名');
  });

  const clientSrc = await readFile(join(root, 'lib', 'client.js'), 'utf8');

  await check('客户端脚本语法有效', () => {
    assert(clientSrc.includes('__ModuleLoader__.load'), '缺少模块加载外壳');
    assert(/id:\s*"dsh-web-preview"/.test(clientSrc), '模块 id 不符');
    new Function(clientSrc);
  });

  await check('客户端声明侧栏服务依赖', () => {
    assert(/sidebarRightTabs/.test(clientSrc), '缺少 sidebarRightTabs 依赖');
    assert(/sidebarRight/.test(clientSrc), '缺少 sidebarRight 依赖');
    assert(/sidebar\.right\.pane\.tab/.test(clientSrc), '缺少正文插槽');
    assert(/dsh-resource:\/\/web\//.test(clientSrc), '缺少资源地址前缀');
  });

  await check('客户端不加载 DSH 自身地址', () => {
    assert(/location\.origin/.test(clientSrc), '缺少同源防护');
  });

  const plugin = await import(pathToFileURL(join(root, 'lib', 'index.js')).href);

  await check('宿主导出 name / apply / normalizePreviewUrl', () => {
    assert(plugin.name === 'web-preview', 'name 不符');
    assert(typeof plugin.apply === 'function', 'apply 缺失');
    assert(typeof plugin.normalizePreviewUrl === 'function', 'normalizePreviewUrl 未导出');
    assert(Array.isArray(plugin.inject), 'inject 必须是数组');
  });

  await check('URL 补全：localhost 走 http', () => {
    const out = plugin.normalizePreviewUrl('localhost:5173');
    assert(out.ok === true, '应判定为合法');
    assert(out.url === 'http://localhost:5173/', '实际 ' + out.url);
  });

  await check('URL 补全：裸域名走 https', () => {
    const out = plugin.normalizePreviewUrl('example.com/a?b=1');
    assert(out.ok === true, '应判定为合法');
    assert(out.url === 'https://example.com/a?b=1', '实际 ' + out.url);
  });

  await check('URL 保留显式协议', () => {
    const out = plugin.normalizePreviewUrl('http://127.0.0.1:8080/x');
    assert(out.ok === true && out.url === 'http://127.0.0.1:8080/x', '实际 ' + (out.url || out.error));
  });

  await check('拒绝空值与非 http 协议', () => {
    assert(plugin.normalizePreviewUrl('').ok === false, '空串应被拒绝');
    assert(plugin.normalizePreviewUrl('   ').ok === false, '空白应被拒绝');
    assert(plugin.normalizePreviewUrl('ftp://x.y').ok === false, 'ftp 应被拒绝');
    assert(plugin.normalizePreviewUrl('file:///c:/x').ok === false, 'file 应被拒绝');
    const long = plugin.normalizePreviewUrl('https://a.b/' + 'x'.repeat(3000));
    assert(long.ok === false, '超长地址应被拒绝');
  });

  const routes = [];
  const fakeCtx = {
    inject(deps, cb) {
      assert(deps.includes('webServer'), '应声明 webServer 依赖');
      cb({
        effect(fn) {
          fn();
        },
        webServer: {
          register(route) {
            routes.push(route);
            return () => {};
          }
        }
      });
    }
  };

  plugin.apply(fakeCtx);

  await check('注册了 /api/web-preview 前缀路由', () => {
    assert(routes.length === 1, '路由数量应为 1，实际 ' + routes.length);
    assert(routes[0].path === '/api/web-preview', '路径不符：' + routes[0].path);
    assert(routes[0].kind === 'prefix', '类型应为 prefix');
  });

  const handler = routes[0].handler;

  function call(method, url) {
    return new Promise((resolveCall, rejectCall) => {
      const req = { method, url, on() {} };
      const res = {
        writeHead() {},
        end(text) {
          resolveCall(JSON.parse(text || '{}'));
        }
      };
      Promise.resolve(handler(req, res)).catch(rejectCall);
    });
  }

  await check('GET /health 返回 ready', async () => {
    const body = await call('GET', '/api/web-preview/health');
    assert(body.ok === true, 'ok 应为 true');
    assert(body.data.status === 'ready', 'status 应为 ready');
    assert(body.data.addressPrefix === 'dsh-resource://web/', '地址前缀不符');
  });

  await check('非法路由返回 404', async () => {
    const body = await call('GET', '/api/web-preview/nope');
    assert(body.ok === false, 'ok 应为 false');
    assert(/no route/.test(body.error), '错误信息不符：' + body.error);
  });

  console.log('');
  console.log('结果: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('verify 崩溃:', err);
  process.exitCode = 1;
});
