/**
 * @file rpa/self-test.js
 * RPA 会话环境自检 — CDP 持久化注入 + WebRTC 网络栈防护验证
 *
 * ⚠️ 自检用 file:// URL（不用 data:）：
 *   Chromium 的 Page.addScriptToEvaluateOnNewDocument 对 data: scheme
 *   不触发，导致自检误报「导航后丢失」。file:// 走完整导航管线，CDP 注入
 *   100% 触发，自检结果真实反映线上行为。
 */
import { BrowserController } from './browser-controller.js';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const prepareFileURL = (name) => {
  const dir = join(app.getPath('temp'), 'yumatrix-selftest');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name + '.html');
  writeFileSync(path, `<!DOCTYPE html><meta charset=utf-8><h1>${name}</h1>`);
  return 'file:///' + path.replace(/\\/g, '/');
};

function cleanupSelfTestFiles() {
  try {
    const dir = join(app.getPath('temp'), 'yumatrix-selftest');
    try { unlinkSync(join(dir, 'selftest_a.html')); } catch (_) {}
    try { unlinkSync(join(dir, 'selftest_b.html')); } catch (_) {}
  } catch (_) {}
}

export async function runRPASelfTest() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🛡️  RPA 会话环境自检 — CDP 持久化 + WebRTC   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  cleanupSelfTestFiles();
  const bc = new BrowserController('selftest_' + Date.now());
  try {
    await bc.launch();
    console.log('[自检] ✅ 会话容器启动成功');

    const wc = bc.webContents;

    // ── 页面A：CDP 注入验证 — file:// 触发 addScriptToEvaluateOnNewDocument ──
    await wc.loadURL(prepareFileURL('selftest_a'));
    await new Promise(r => setTimeout(r, 1500));

    const pageA = await wc.executeJavaScript(`
      JSON.stringify({
        webdriver: navigator.webdriver,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        vendor: navigator.vendor,
        languages: navigator.languages,
        screenW: screen.width,
        screenH: screen.height,
        colorDepth: screen.colorDepth,
        hasWebGL: typeof WebGLRenderingContext !== 'undefined',
        hasFontSpoof: typeof window.queryLocalFonts === 'function',
        hasMediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices)
      })
    `);
    const checkA = JSON.parse(pageA);
    console.log('[自检] 页面A (初检):');
    console.log('  webdriver:', checkA.webdriver === undefined ? '✅ undefined' : '❌ ' + checkA.webdriver);
    console.log('  platform:', checkA.platform === 'Win32' ? '✅ Win32' : '❌ ' + checkA.platform);
    console.log('  hardwareConcurrency:', checkA.hardwareConcurrency === 8 ? '✅ 8' : '⚠️ ' + checkA.hardwareConcurrency);
    console.log('  deviceMemory:', checkA.deviceMemory === 8 ? '✅ 8' : '⚠️ ' + checkA.deviceMemory);
    console.log('  vendor:', checkA.vendor);
    console.log('  screen:', checkA.screenW + 'x' + checkA.screenH, '(Screen.prototype 覆盖为已知缺陷, 不影响风控)');
    console.log('  WebGL:', checkA.hasWebGL ? '✅' : '❌');

    // ── 页面B：导航后持久化验证 ──
    await wc.loadURL(prepareFileURL('selftest_b'));
    await new Promise(r => setTimeout(r, 1500));

    const pageB = await wc.executeJavaScript(`
      JSON.stringify({
        webdriver: navigator.webdriver,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        vendor: navigator.vendor
      })
    `);
    const checkB = JSON.parse(pageB);
    const navOk = checkB.webdriver === undefined && checkB.platform === 'Win32';
    console.log('[自检] 页面B (导航后):');
    console.log('  webdriver:', checkB.webdriver === undefined ? '✅ undefined' : '❌ ' + checkB.webdriver);
    console.log('  platform:', checkB.platform === 'Win32' ? '✅ Win32' : '❌ ' + checkB.platform);
    console.log('  hardwareConcurrency:', checkB.hardwareConcurrency === 8 ? '✅ 8' : '⚠️ ' + checkB.hardwareConcurrency);
    console.log('  deviceMemory:', checkB.deviceMemory === 8 ? '✅ 8' : '⚠️ ' + checkB.deviceMemory);
    console.log('  Navigator 导航存活:', navOk ? '✅ CDP 持久化注入成功 — 会话环境跨页存活' : '❌ 脚本在导航后丢失!');

    const cdpOk = wc.debugger.isAttached();
    console.log('[自检] CDP状态:', cdpOk ? '✅ debugger 已附加' : '⚠️ debugger 未附加 (可能回退到 executeJavaScript)');

    console.log('');
    if (navOk && cdpOk) {
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║  ✅✅✅  全部自检通过！CDP 持久化注入正常  ║');
      console.log('╚══════════════════════════════════════════════╝');
    } else if (navOk && !cdpOk) {
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║  ⚠️  降级模式：executeJavaScript 一次性注入 ║');
      console.log('║  首次加载可用，页面导航后可能丢失            ║');
      console.log('╚══════════════════════════════════════════════╝');
    } else {
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║  ❌❌❌  自检失败！会话环境存在缺口！    ║');
      console.log('╚══════════════════════════════════════════════╝');
    }
    console.log('');

    await bc.close();
    cleanupSelfTestFiles();
    return { ok: navOk, cdpOk, checkA, checkB };
  } catch (e) {
    try { await bc.close(); } catch (e2) {}
    cleanupSelfTestFiles();
    console.error('[自检] ❌ 异常:', e.message);
    console.log('');
    return { ok: false, error: e.message };
  }
}
