/**
 * @file email-engine.js
 * @desc 邮件收发引擎 — IMAP 收信 + SMTP 发信 + IDLE 实时推送
 *       遵循项目 IPC 模式：导出 registerEmailIPC()，在 index.js 中调用
 */
import { ipcMain, BrowserWindow, dialog, safeStorage } from 'electron';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDB } from './database.js';
import { resolveProviderConfig, FOLDER_MAP } from './email-providers.js';

// ══════════════════════════════════════════════════════
// 连接池
// ══════════════════════════════════════════════════════
const connections = new Map(); // accountId → { imap, smtp, idleRunning, status, failCount }

function getConnection(accountId) {
  if (!connections.has(accountId)) {
    connections.set(accountId, {
      imap: null,
      smtp: null,
      idleRunning: false,
      status: 'disconnected', // disconnected | connected | error
      failCount: 0,
    });
  }
  return connections.get(accountId);
}

function broadcastToRenderer(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    } catch (e) { /* ignore */ }
  }
}

// ══════════════════════════════════════════════════════
// 凭据加密
// ══════════════════════════════════════════════════════
function encryptPassword(plaintext) {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plaintext);
  }
  // 降级：AES-256-CBC with app-level secret
  const key = crypto.scryptSync('matrix-email-v1', 'salt-email', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptPassword(encryptedBuffer) {
  if (!encryptedBuffer) return '';
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(encryptedBuffer);
    } catch (e) {
      console.warn('[EmailEngine] safeStorage 解密失败，尝试降级:', e.message);
    }
  }
  // 降级解密
  try {
    const key = crypto.scryptSync('matrix-email-v1', 'salt-email', 32);
    const iv = encryptedBuffer.subarray(0, 16);
    const data = encryptedBuffer.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
  } catch (e) {
    console.error('[EmailEngine] 密码解密失败:', e.message);
    return '';
  }
}

// ══════════════════════════════════════════════════════
// IMAP 客户端管理
// ══════════════════════════════════════════════════════
async function getImapClient(accountId) {
  const conn = getConnection(accountId);
  if (conn.imap && conn.imap.usable) return conn.imap;

  // 断开旧连接
  if (conn.imap) {
    try { await conn.imap.logout(); } catch (e) { /* ignore */ }
    conn.imap = null;
  }

  const db = getDB();
  const account = db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(accountId);
  if (!account) throw new Error(`邮件账户 ${accountId} 不存在`);

  const password = decryptPassword(account.password_encrypted);
  if (!password) throw new Error('无法解密邮箱密码，请重新添加账户');

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.email, pass: password },
    logger: false,
    tls: {
      rejectUnauthorized: false, // 部分企业邮证书链不完整
    },
  });

  await client.connect();
  conn.imap = client;
  conn.status = 'connected';
  conn.failCount = 0;
  broadcastToRenderer('email-connection-status', { accountId, status: 'connected' });
  return client;
}

function getSmtpTransport(accountId) {
  const conn = getConnection(accountId);
  if (conn.smtp) return conn.smtp;

  const db = getDB();
  const account = db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(accountId);
  if (!account) throw new Error(`邮件账户 ${accountId} 不存在`);

  const password = decryptPassword(account.password_encrypted);
  if (!password) throw new Error('无法解密邮箱密码，请重新添加账户');

  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure === 1,
    auth: { user: account.email, pass: password },
    tls: { rejectUnauthorized: false },
  });

  conn.smtp = transport;
  return transport;
}

// ══════════════════════════════════════════════════════
// 文件夹名解析
// ══════════════════════════════════════════════════════
function resolveImapFolder(chineseName) {
  const candidates = FOLDER_MAP[chineseName];
  if (!candidates) return chineseName; // 原样返回
  return candidates[0]; // 默认用第一个候选
}

async function findRealFolder(client, chineseName) {
  const candidates = FOLDER_MAP[chineseName];
  if (!candidates) return chineseName;

  try {
    const list = await client.list();
    const realNames = list.map(f => f.path);
    for (const candidate of candidates) {
      if (realNames.includes(candidate)) return candidate;
    }
  } catch (e) {
    console.warn('[EmailEngine] 列出文件夹失败:', e.message);
  }
  return candidates[0]; // fallback
}

// ══════════════════════════════════════════════════════
// 广播辅助
// ══════════════════════════════════════════════════════
function emitToast(type, title, message) {
  broadcastToRenderer('toast-notification', { type, title, message });
}

// ══════════════════════════════════════════════════════
// IPC 注册
// ══════════════════════════════════════════════════════
export function registerEmailIPC() {
  const db = getDB();

  // ─── 账户管理 ──────────────────────────────────

  ipcMain.handle('email-accounts-get', async () => {
    try {
      const rows = db.prepare(`
        SELECT id, email, display_name, provider, avatar, unread_count, is_active, last_sync_at,
               smtp_host, smtp_port, imap_host, imap_port, smtp_secure, imap_secure
        FROM email_accounts ORDER BY created_at DESC
      `).all();
      return rows;
    } catch (e) {
      console.error('[EmailEngine] 获取账户列表失败:', e);
      return [];
    }
  });

  ipcMain.handle('email-accounts-add', async (_, payload) => {
    try {
      const { email, password, provider, displayName, smtpHost, smtpPort, imapHost, imapPort } = payload;
      if (!email || !password) {
        return { success: false, message: '邮箱和密码不能为空' };
      }

      const config = resolveProviderConfig(provider, { smtpHost, smtpPort, imapHost, imapPort });
      const encrypted = encryptPassword(password);
      const avatar = (displayName || email).substring(0, 2).toUpperCase();

      const stmt = db.prepare(`
        INSERT INTO email_accounts (email, display_name, provider, smtp_host, smtp_port, imap_host, imap_port,
                                    password_encrypted, imap_secure, smtp_secure, avatar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        email,
        displayName || email.split('@')[0],
        provider || '自建邮局',
        config.smtp.host, config.smtp.port,
        config.imap.host, config.imap.port,
        encrypted,
        config.imap.secure ? 1 : 0,
        config.smtp.secure ? 1 : 0,
        avatar
      );
      console.log(`[EmailEngine] 账户添加成功: ${email} (id=${info.lastInsertRowid})`);
      return { success: true, id: info.lastInsertRowid };
    } catch (e) {
      console.error('[EmailEngine] 添加账户失败:', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('email-accounts-remove', async (_, accountId) => {
    try {
      // 关闭连接
      const conn = connections.get(accountId);
      if (conn) {
        if (conn.imap) { try { await conn.imap.logout(); } catch (e) { /* */ } }
        if (conn.smtp) { try { conn.smtp.close(); } catch (e) { /* */ } }
        connections.delete(accountId);
      }
      db.prepare('DELETE FROM email_accounts WHERE id = ?').run(accountId);
      console.log(`[EmailEngine] 账户 ${accountId} 已删除`);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('email-accounts-test', async (_, { accountId }) => {
    try {
      const client = await getImapClient(accountId);
      await client.noop();
      // 测试 SMTP
      const transport = getSmtpTransport(accountId);
      await transport.verify();
      return { success: true, message: 'IMAP + SMTP 连接测试通过' };
    } catch (e) {
      return { success: false, message: `连接测试失败: ${e.message}` };
    }
  });

  ipcMain.handle('email-accounts-update', async (_, { accountId, displayName, isActive }) => {
    try {
      if (displayName !== undefined) {
        db.prepare('UPDATE email_accounts SET display_name = ? WHERE id = ?').run(displayName, accountId);
      }
      if (isActive !== undefined) {
        db.prepare('UPDATE email_accounts SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, accountId);
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  // ─── 邮件获取 ──────────────────────────────────

  ipcMain.handle('email-messages-cached', async (_, { accountId, folder }) => {
    try {
      const rows = db.prepare(`
        SELECT id, uid, folder, message_id, from_address, from_name, to_address, cc,
               subject, preview, received_at, is_read, is_starred, has_attachments
        FROM email_messages
        WHERE account_id = ? AND folder = ?
        ORDER BY received_at DESC
        LIMIT 100
      `).all(accountId, folder);
      return rows;
    } catch (e) {
      console.error('[EmailEngine] 读取缓存邮件失败:', e);
      return [];
    }
  });

  ipcMain.handle('email-inbox-fetch', async (_, { accountId, folder = '收件箱', limit = 50 }) => {
    try {
      const client = await getImapClient(accountId);
      const realFolder = await findRealFolder(client, folder);

      const lock = await client.getMailboxLock(realFolder);
      try {
        const total = client.mailbox.exists || 0;
        if (total === 0) return [];

        // 拉最近 limit 封的信封
        const start = Math.max(1, total - limit + 1);
        const messages = [];

        for await (const msg of client.fetch(`${start}:*`, {
          envelope: true,
          uid: true,
          bodyStructure: true,
          source: false,
        })) {
          const env = msg.envelope || {};
          const from = env.from?.[0] || {};
          const to = env.to?.[0] || {};

          // 检查 \Seen 标志
          const isRead = msg.flags?.has('\\Seen') ? 1 : 0;
          const isStarred = msg.flags?.has('\\Flagged') ? 1 : 0;

          const receivedAt = env.date ? new Date(env.date).toISOString() : null;
          const preview = (env.subject || '').substring(0, 200);

          messages.push({
            uid: msg.uid,
            folder,
            message_id: env.messageId || null,
            from_address: from.address || '',
            from_name: from.name || from.address || '',
            to_address: to.address || '',
            subject: env.subject || '(无主题)',
            preview,
            received_at: receivedAt,
            is_read: isRead,
            is_starred: isStarred,
            has_attachments: hasAttachments(msg.bodyStructure),
          });
        }

        // 写入 SQLite — 冲突时保留本地 is_read/is_starred（用户已操作的优先）
        const insert = db.prepare(`
          INSERT INTO email_messages
            (account_id, uid, folder, message_id, from_address, from_name, to_address,
             subject, preview, received_at, is_read, is_starred, has_attachments)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id, uid, folder) DO UPDATE SET
            message_id = excluded.message_id,
            from_address = excluded.from_address,
            from_name = excluded.from_name,
            to_address = excluded.to_address,
            subject = excluded.subject,
            preview = excluded.preview,
            received_at = excluded.received_at,
            has_attachments = excluded.has_attachments
        `);
        const tx = db.transaction(() => {
          for (const m of messages) {
            insert.run(
              accountId, m.uid, m.folder, m.message_id,
              m.from_address, m.from_name, m.to_address,
              m.subject, m.preview, m.received_at,
              m.is_read, m.is_starred, m.has_attachments ? 1 : 0
            );
          }
          db.prepare('UPDATE email_accounts SET last_sync_at = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);
        });
        tx();

        // 更新未读计数
        const unreadCount = db.prepare(
          'SELECT COUNT(*) as cnt FROM email_messages WHERE account_id = ? AND folder = ? AND is_read = 0'
        ).get(accountId, folder);
        db.prepare('UPDATE email_accounts SET unread_count = ? WHERE id = ?').run(unreadCount.cnt, accountId);

        // 返回缓存结果
        const cached = db.prepare(`
          SELECT id, uid, folder, message_id, from_address, from_name, to_address, cc,
                 subject, preview, received_at, is_read, is_starred, has_attachments
          FROM email_messages WHERE account_id = ? AND folder = ?
          ORDER BY received_at DESC LIMIT 100
        `).all(accountId, folder);
        return cached;
      } finally {
        lock.release();
      }
    } catch (e) {
      console.error('[EmailEngine] IMAP 拉取邮件失败:', e);
      // 断线标记
      const conn = getConnection(accountId);
      conn.status = 'error';
      conn.failCount++;
      broadcastToRenderer('email-connection-status', { accountId, status: 'error', message: e.message });

      // 降级返回缓存
      const cached = db.prepare(`
        SELECT id, uid, folder, message_id, from_address, from_name, to_address, cc,
               subject, preview, received_at, is_read, is_starred, has_attachments
        FROM email_messages WHERE account_id = ? AND folder = ?
        ORDER BY received_at DESC LIMIT 100
      `).all(accountId, folder);
      return cached;
    }
  });

  ipcMain.handle('email-message-get', async (_, { accountId, uid, folder }) => {
    try {
      // 先检查缓存
      const cached = db.prepare(
        'SELECT body_html, body_text FROM email_messages WHERE account_id = ? AND uid = ? AND folder = ?'
      ).get(accountId, uid, folder);

      if (cached && cached.body_html) {
        return { success: true, bodyHtml: cached.body_html, bodyText: cached.body_text };
      }

      // 从 IMAP 拉取完整正文
      const client = await getImapClient(accountId);
      const realFolder = await findRealFolder(client, folder);

      const lock = await client.getMailboxLock(realFolder);
      try {
        // ⚠️ fetchOne 第三参数才是 options，uid:true 表示按 UID 拉取
        const msg = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!msg || !msg.source) {
          console.warn(`[EmailEngine] fetchOne 无返回 uid=${uid} folder=${realFolder}`);
          return { success: false, message: '无法获取邮件内容' };
        }

        const parsed = await simpleParser(msg.source);

        // 多级降容：html → textAsHtml（纯文本自动转HTML） → text
        let bodyHtml = parsed.html || '';
        const bodyText = parsed.text || '';

        if (!bodyHtml && bodyText) {
          // 纯文本邮件自动转 HTML（保留换行）
          bodyHtml = `<div style="font-family:sans-serif;white-space:pre-wrap;">${bodyText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>')}</div>`;
        }

        console.log(`[EmailEngine] 邮件正文解析 uid=${uid}: html=${bodyHtml.length}B text=${bodyText.length}B`);

        // 更新缓存
        db.prepare(`
          UPDATE email_messages SET body_html = ?, body_text = ?, cc = ?, attachments_meta = ?
          WHERE account_id = ? AND uid = ? AND folder = ?
        `).run(
          bodyHtml, bodyText,
          parsed.cc?.text || '',
          JSON.stringify((parsed.attachments || []).map(a => ({
            filename: a.filename, size: a.size, contentType: a.contentType
          }))),
          accountId, uid, folder
        );

        return { success: true, bodyHtml, bodyText };
      } finally {
        lock.release();
      }
    } catch (e) {
      console.error(`[EmailEngine] 获取邮件正文失败 uid=${uid}:`, e);
      return { success: false, message: e.message };
    }
  });

  // ─── 文件夹 ──────────────────────────────────

  ipcMain.handle('email-folders-list', async (_, { accountId }) => {
    try {
      const client = await getImapClient(accountId);
      const list = await client.list();
      return list.map(f => ({
        name: f.path,
        delimiter: f.delimiter,
        specialUse: f.specialUse || null,
      }));
    } catch (e) {
      console.error('[EmailEngine] 列出文件夹失败:', e);
      return [];
    }
  });

  // ─── 邮件操作 ──────────────────────────────────

  ipcMain.handle('email-mark-read', async (_, { accountId, uid, folder }) => {
    // 无论 IMAP 是否成功，先更新本地 DB（保证红点消失）
    try {
      db.prepare('UPDATE email_messages SET is_read = 1 WHERE account_id = ? AND uid = ? AND folder = ?')
        .run(accountId, uid, folder);
      const cnt = db.prepare(
        'SELECT COUNT(*) as c FROM email_messages WHERE account_id = ? AND folder = ? AND is_read = 0'
      ).get(accountId, folder);
      db.prepare('UPDATE email_accounts SET unread_count = ? WHERE id = ?').run(cnt.c, accountId);
    } catch (dbErr) {
      console.error('[email-mark-read] DB更新失败:', dbErr.message);
    }

    // IMAP 标记可失败（连接断开等不影响本地状态）
    try {
      const client = await getImapClient(accountId);
      const realFolder = await findRealFolder(client, folder);
      const lock = await client.getMailboxLock(realFolder);
      try {
        await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
      } finally { lock.release(); }
    } catch (imapErr) {
      console.warn('[email-mark-read] IMAP标记失败(非致命):', imapErr.message);
    }

    return { success: true };
  });

  ipcMain.handle('email-mark-unread', async (_, { accountId, uid, folder }) => {
    try {
      const client = await getImapClient(accountId);
      const realFolder = await findRealFolder(client, folder);
      const lock = await client.getMailboxLock(realFolder);
      try {
        await client.messageFlagsRemove({ uid }, ['\\Seen'], { uid: true });
      } finally { lock.release(); }

      db.prepare('UPDATE email_messages SET is_read = 0 WHERE account_id = ? AND uid = ? AND folder = ?')
        .run(accountId, uid, folder);

      const cnt = db.prepare(
        'SELECT COUNT(*) as c FROM email_messages WHERE account_id = ? AND folder = ? AND is_read = 0'
      ).get(accountId, folder);
      db.prepare('UPDATE email_accounts SET unread_count = ? WHERE id = ?').run(cnt.c, accountId);

      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('email-toggle-star', async (_, { accountId, uid, folder, starred }) => {
    try {
      const client = await getImapClient(accountId);
      const realFolder = await findRealFolder(client, folder);
      const lock = await client.getMailboxLock(realFolder);
      try {
        if (starred) {
          await client.messageFlagsAdd({ uid }, ['\\Flagged'], { uid: true });
        } else {
          await client.messageFlagsRemove({ uid }, ['\\Flagged'], { uid: true });
        }
      } finally { lock.release(); }

      db.prepare('UPDATE email_messages SET is_starred = ? WHERE account_id = ? AND uid = ? AND folder = ?')
        .run(starred ? 1 : 0, accountId, uid, folder);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('email-delete', async (_, { accountId, uid, folder }) => {
    try {
      const client = await getImapClient(accountId);
      const realFolder = await findRealFolder(client, folder);

      // 尝试移动到垃圾箱
      const trashCandidates = FOLDER_MAP['已删除'] || ['Trash'];
      let moved = false;
      for (const trashFolder of trashCandidates) {
        try {
          await client.messageCopy({ uid }, trashFolder, { uid: true });
          const lock = await client.getMailboxLock(realFolder);
          try {
            await client.messageFlagsAdd({ uid }, ['\\Deleted'], { uid: true });
            await client.expunge();
          } finally { lock.release(); }
          moved = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!moved) {
        // 直接标记删除
        const lock = await client.getMailboxLock(realFolder);
        try {
          await client.messageFlagsAdd({ uid }, ['\\Deleted'], { uid: true });
          await client.expunge();
        } finally { lock.release(); }
      }

      // 从缓存删除
      db.prepare('DELETE FROM email_messages WHERE account_id = ? AND uid = ? AND folder = ?')
        .run(accountId, uid, folder);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  // ─── SMTP 发送 ──────────────────────────────────

  ipcMain.handle('email-send', async (_, payload) => {
    try {
      const { accountId, to, cc, subject, bodyHtml, attachments = [] } = payload;
      const db2 = getDB();
      const account = db2.prepare('SELECT * FROM email_accounts WHERE id = ?').get(accountId);
      if (!account) return { success: false, message: '账户不存在' };

      const transport = getSmtpTransport(accountId);

      const mailOptions = {
        from: { name: account.display_name, address: account.email },
        to,
        subject,
        html: bodyHtml,
        text: stripHtml(bodyHtml),
      };
      if (cc) mailOptions.cc = cc;

      if (attachments.length > 0) {
        mailOptions.attachments = attachments.map(a => ({
          filename: a.filename,
          path: a.filePath,
          contentType: a.mimeType || undefined,
        }));
      }

      const result = await transport.sendMail(mailOptions);

      // 写入已发送缓存
      try {
        db2.prepare(`
          INSERT OR IGNORE INTO email_messages
            (account_id, uid, folder, from_address, from_name, to_address, cc, subject, body_html, body_text, preview, received_at, is_read)
          VALUES (?, ?, '已发送', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
        `).run(
          accountId,
          Date.now() % 1000000, // 临时 UID（已发送文件夹同步后会被覆盖）
          account.email, account.display_name, to, cc || '',
          subject, bodyHtml, stripHtml(bodyHtml), subject,
        );
      } catch (e) {
        console.warn('[EmailEngine] 已发送缓存写入失败:', e.message);
      }

      console.log(`[EmailEngine] 邮件已发送: ${subject} → ${to}`);
      return { success: true, messageId: result.messageId };
    } catch (e) {
      console.error('[EmailEngine] 发送失败:', e);
      // SMTP 552 附件过大 — 中文友好提示
      const msg = String(e.message || e);
      if (e.responseCode === 552 || /552|message size exceeded/i.test(msg)) {
        return { success: false, message: '附件体积过大，请确保单个文件在 15MB 以内，或使用云盘通道上传大文件' };
      }
      return { success: false, message: `发送失败: ${msg}` };
    }
  });

  ipcMain.handle('email-select-attachments', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '所有文件', extensions: ['*'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return [];
      return result.filePaths.map(fp => {
        const stat = fs.statSync(fp);
        const name = fp.split(/[\\/]/).pop();
        return { name, path: fp, size: stat.size };
      });
    } catch (e) {
      return [];
    }
  });

  // ─── R2 云盘上传（大附件直传） ────────────────────

  ipcMain.handle('r2-upload-file', async (_, { filePath, putUrl, filename }) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, message: `文件不存在: ${filename}` };
      }

      const fileBuffer = fs.readFileSync(filePath);
      const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(1);
      console.log(`[R2Upload] 开始上传: ${filename} (${fileSizeMB}MB)`);

      const resp = await fetch(putUrl, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.error(`[R2Upload] 上传失败: HTTP ${resp.status}`, errText);
        return { success: false, message: `R2 上传失败: HTTP ${resp.status}` };
      }

      console.log(`[R2Upload] ✅ 上传成功: ${filename}`);
      return { success: true };
    } catch (e) {
      console.error('[R2Upload] 上传异常:', e);
      return { success: false, message: `R2 上传异常: ${e.message}` };
    }
  });

  // ─── IMAP IDLE ──────────────────────────────────

  ipcMain.handle('email-idle-start', async (_, { accountId }) => {
    try {
      const conn = getConnection(accountId);
      if (conn.idleRunning) return { success: true, message: 'IDLE 已在运行' };

      const client = await getImapClient(accountId);
      conn.idleRunning = true;

      // 获取当前邮件数量基线
      const db2 = getDB();
      const account = db2.prepare('SELECT * FROM email_accounts WHERE id = ?').get(accountId);
      const lastCount = db2.prepare(
        'SELECT COUNT(*) as cnt FROM email_messages WHERE account_id = ? AND folder = ?'
      ).get(accountId, '收件箱').cnt;

      // 后台 IDLE 循环
      runIdleLoop(accountId, client, lastCount).catch(e => {
        console.warn(`[EmailEngine] IDLE 循环异常 (account ${accountId}):`, e.message);
        conn.idleRunning = false;
      });

      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('email-idle-stop', async (_, { accountId }) => {
    const conn = connections.get(accountId);
    if (conn) conn.idleRunning = false;
    return { success: true };
  });

  console.log('[EmailEngine] 邮件 IPC 已注册');
}

// ══════════════════════════════════════════════════════
// IDLE 循环
// ══════════════════════════════════════════════════════
async function runIdleLoop(accountId, client, baselineCount) {
  const conn = getConnection(accountId);
  let currentCount = baselineCount;

  while (conn.idleRunning && client.usable) {
    try {
      await client.idle();
      // IDLE 返回后检查是否有新邮件
      const lock = await client.getMailboxLock('INBOX');
      try {
        const newCount = client.mailbox.exists || 0;
        if (newCount > currentCount) {
          const delta = newCount - currentCount;
          console.log(`[EmailEngine] IDLE 检测到 ${delta} 封新邮件 (account ${accountId})`);

          // 拉取新邮件信封
          const startUid = currentCount + 1;
          const newMessages = [];
          for await (const msg of client.fetch(`${startUid}:*`, {
            envelope: true, uid: true, bodyStructure: true,
          })) {
            const env = msg.envelope || {};
            const from = env.from?.[0] || {};
            const receivedAt = env.date ? new Date(env.date).toISOString() : null;

            newMessages.push({
              uid: msg.uid,
              folder: '收件箱',
              message_id: env.messageId || null,
              from_address: from.address || '',
              from_name: from.name || from.address || '',
              to_address: (env.to?.[0] || {}).address || '',
              subject: env.subject || '(无主题)',
              preview: (env.subject || '').substring(0, 200),
              received_at: receivedAt,
              is_read: 0,
              is_starred: 0,
              has_attachments: hasAttachments(msg.bodyStructure),
            });
          }

          // 写入缓存
          const db2 = getDB();
          const insert = db2.prepare(`
            INSERT OR IGNORE INTO email_messages
              (account_id, uid, folder, message_id, from_address, from_name, to_address,
               subject, preview, received_at, is_read, is_starred, has_attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const m of newMessages) {
            insert.run(
              accountId, m.uid, m.folder, m.message_id,
              m.from_address, m.from_name, m.to_address,
              m.subject, m.preview, m.received_at,
              m.is_read, m.is_starred, m.has_attachments ? 1 : 0
            );
          }

          // 更新未读计数
          const cnt = db2.prepare(
            'SELECT COUNT(*) as c FROM email_messages WHERE account_id = ? AND folder = ? AND is_read = 0'
          ).get(accountId, '收件箱');
          db2.prepare('UPDATE email_accounts SET unread_count = ? WHERE id = ?').run(cnt.c, accountId);

          // 推送新邮件到前端
          for (const m of newMessages) {
            broadcastToRenderer('email-new-message', {
              accountId,
              message: m,
            });
            emitToast('info', '新邮件', `${m.from_name}: ${m.subject}`);
          }

          currentCount = newCount;
        }
      } finally {
        lock.release();
      }
    } catch (e) {
      if (!conn.idleRunning) break;
      console.warn(`[EmailEngine] IDLE 周期异常:`, e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ══════════════════════════════════════════════════════
// 辅助函数
// ══════════════════════════════════════════════════════
function hasAttachments(bodyStructure) {
  if (!bodyStructure) return false;
  if (bodyStructure.disposition === 'attachment') return true;
  if (bodyStructure.childNodes) {
    return bodyStructure.childNodes.some(child => hasAttachments(child));
  }
  return false;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 关闭所有连接（app quit 时调用） */
export async function closeAllEmailConnections() {
  for (const [accountId, conn] of connections) {
    conn.idleRunning = false;
    if (conn.imap) {
      try { await conn.imap.logout(); } catch (e) { /* */ }
    }
    if (conn.smtp) {
      try { conn.smtp.close(); } catch (e) { /* */ }
    }
  }
  connections.clear();
  console.log('[EmailEngine] 所有邮件连接已关闭');
}
