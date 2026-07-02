/**
 * @file safe-delete.js
 * 异步删除分区目录 — Exponential Backoff 重试 + session 层彻底拆除
 *
 * 核心现实：Chromium C++ 层的 SQLite 文件句柄无法从 JS 强制释放。
 * DIPS/Cookies-journal 等文件在进程级持有，clearStorageData() 只清数据不关句柄。
 * 策略：尽力删除 → 失败后降级为逐文件清理 → 残留锁文件留到下次启动清理。
 */
import { remove } from 'fs-extra';
import { readdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const BACKOFF_BASE_MS = 500;
const MAX_RETRIES = 5;
const RETRY_CODES = ['EBUSY', 'EPERM'];

/**
 * 尽力删除目录。5 次指数退避后如仍被锁，改为逐文件清理（跳过锁文件）。
 * 残留的锁文件在 startupCleanStalePartitions() 中统一清理。
 */
export async function safeDeletePartition(partitionPath) {
  // 阶段 1：整体删除 + 指数退避重试
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await remove(partitionPath);
      return;
    } catch (e) {
      if (!RETRY_CODES.includes(e.code)) throw e;
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.log(`[safeDelete] 分区被占用，${delay}ms 后重试(${attempt + 1}/${MAX_RETRIES}): ${partitionPath}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // 阶段 2：整体删除失败 → 逐文件删除，跳过锁文件
  const skipped = [];
  await deleteFileByFile(partitionPath, skipped);
  if (skipped.length > 0) {
    console.log(`[safeDelete] ${skipped.length} 个锁文件已跳过，将在下次启动时自动清理: ${partitionPath}`);
  }
}

/** 递归逐文件删除，遇到 EBUSY/EPERM 跳过并记录 */
async function deleteFileByFile(dirPath, skipped = []) {
  if (!existsSync(dirPath)) return;
  let entries;
  try { entries = readdirSync(dirPath, { withFileTypes: true }); } catch (e) { return; }

  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await deleteFileByFile(full, skipped);
      try { await remove(full); } catch (e) {}
    } else {
      try { await remove(full); } catch (e) {
        if (RETRY_CODES.includes(e.code)) {
          skipped.push(entry.name);
        }
      }
    }
  }

  try { await remove(dirPath); } catch (e) {}
}

/**
 * 启动时清理所有残留的 RPA 临时分区目录。
 * 在 app.whenReady 中调用 — 此时没有活跃 BrowserView，文件不会被锁。
 */
export function startupCleanStalePartitions(partitionsDir) {
  if (!existsSync(partitionsDir)) return;
  let entries;
  try { entries = readdirSync(partitionsDir); } catch (e) { return; }

  let cleaned = 0;
  for (const name of entries) {
    // RPA 分区：chrome_data_{accountId}_rpa，自检分区同理
    if (!name.endsWith('_rpa')) continue;
    const full = join(partitionsDir, name);
    try {
      rmSync(full, { recursive: true, force: true });
      cleaned++;
      console.log(`[StartupClean] ✓ 清理残留分区: ${name}`);
    } catch (e) {
      console.warn(`[StartupClean] 残留分区清理失败: ${name} — ${e.message}`);
    }
  }
  if (cleaned > 0) console.log(`[StartupClean] 共清理 ${cleaned} 个残留 RPA 分区`);
}

/**
 * 完整拆除 (有 BrowserView 场景)。
 * 顺序：解绑 → 清存储 → 销毁 C++ 对象 → 等 OS 释放锁 → 删除分区
 */
export async function teardownSessionAndClean(win, view, partitionPath, partitionName) {
  // 1. 解绑 BrowserView
  if (win && !win.isDestroyed() && view) {
    try { win.removeBrowserView(view); } catch (e) {}
  }

  // 2. 强行停止 webContents 所有活动
  if (view && view.webContents && !view.webContents.isDestroyed()) {
    const wc = view.webContents;
    try { wc.stop(); } catch (e) {}
    try { wc.closeDevTools(); } catch (e) {}
    try { if (wc.debugger && wc.debugger.isAttached()) wc.debugger.detach(); } catch (e) {}
  }

  // 3. 清空 session 存储 + 缓存（在 destroy 之前做，此时 session 还活着）
  const persistKey = `persist:${partitionName}`;
  try {
    const ses = session.fromPartition(persistKey);
    await Promise.all([ses.clearStorageData(), ses.clearCache()]);
    console.log(`[Teardown] session 已清空: ${partitionName}`);
  } catch (e) {
    console.warn('[Teardown] session 清理失败:', e.message);
  }

  // 4. 销毁底层 C++ webContents → 强制释放 SingletonLock/Cookie-journal 句柄
  if (view && view.webContents && !view.webContents.isDestroyed()) {
    try { view.webContents.close(); } catch (e) {}
    try {
      // @ts-ignore — _tearDown is the internal full-destroy, not exposed in types
      if (typeof view.webContents._tearDown === 'function') view.webContents._tearDown();
    } catch (e) {}
  }

  // 5. 给操作系统充分时间释放文件句柄（SingletonLock / DIPS / Cookies-journal）
  await new Promise(r => setTimeout(r, 2000));

  // 6. 安全删除分区（内部有降级策略，不抛异常）
  await safeDeletePartition(partitionPath);
  console.log(`[Teardown] ✓ 分区拆除完成: ${partitionName}`);
}

/**
 * 轻量拆除 (无 BrowserView 场景，如 Playwright profile / 账户数据目录)。
 * 顺序：清空 session 存储 → 2s OS 锁释放 → 删除分区
 */
export async function teardownPartition(partitionPath, partitionName) {
  const persistKey = `persist:${partitionName}`;
  try {
    const ses = session.fromPartition(persistKey);
    await Promise.all([ses.clearStorageData(), ses.clearCache()]).catch(() => {});
    console.log(`[Teardown] session 已清空: ${partitionName}`);
  } catch (e) {
    console.warn('[Teardown] session 清理失败:', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));
  await safeDeletePartition(partitionPath);
  console.log(`[Teardown] ✓ 分区已清理: ${partitionName}`);
}
