/**
 * @file EmailRepository.js
 * @description 邮件仓储 - 邮箱账号和邮件数据的访问入口
 *
 * 迁移自:
 *   - src/main/email-engine.js (email accounts, email messages operations)
 */

import { BaseRepository } from '../BaseRepository.js';

export class EmailRepository extends BaseRepository {
  constructor() {
    super();
    this.emailAccountsTable = 'email_accounts';
    this.emailMessagesTable = 'email_messages';
    this.emailDraftsTable = 'email_drafts';
  }

  // ========== Email Accounts ==========

  /**
   * 获取所有邮件账户
   */
  getAllEmailAccounts() {
    const sql = `
      SELECT id, email, display_name, provider, avatar, unread_count, is_active,
             last_sync_at, smtp_host, smtp_port, imap_host, imap_port,
             smtp_secure, imap_secure
      FROM ${this.emailAccountsTable}
      ORDER BY created_at DESC
    `;
    return this.query(sql);
  }

  /**
   * 根据 ID 获取邮件账户
   */
  getEmailAccountById(id) {
    const sql = `
      SELECT *
      FROM ${this.emailAccountsTable}
      WHERE id = ?
    `;
    return this.get(sql, [id]);
  }

  /**
   * 根据邮箱地址获取账户
   */
  getEmailAccountByEmail(email) {
    const sql = `
      SELECT *
      FROM ${this.emailAccountsTable}
      WHERE email = ?
    `;
    return this.get(sql, [email]);
  }

  /**
   * 创建邮件账户
   */
  createEmailAccount(accountData) {
    const { email, displayName, provider, smtpHost, smtpPort, imapHost, imapPort,
            encryptedPassword, imapSecure, smtpSecure, avatar } = accountData;

    const sql = `
      INSERT INTO ${this.emailAccountsTable}
      (email, display_name, provider, smtp_host, smtp_port, imap_host, imap_port,
       password_encrypted, imap_secure, smtp_secure, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = this.execute(sql, [
      email,
      displayName || email.split('@')[0],
      provider || '自建邮局',
      smtpHost, smtpPort,
      imapHost, imapPort,
      encryptedPassword,
      imapSecure ? 1 : 0,
      smtpSecure ? 1 : 0,
      avatar
    ]);
    return result.lastInsertRowid;
  }

  /**
   * 更新邮件账户
   */
  updateEmailAccount(id, updates) {
    const sets = [];
    const params = [];

    if (updates.displayName !== undefined) {
      sets.push('display_name = ?');
      params.push(updates.displayName);
    }
    if (updates.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }
    if (updates.unreadCount !== undefined) {
      sets.push('unread_count = ?');
      params.push(updates.unreadCount);
    }
    if (updates.lastSyncAt !== undefined) {
      sets.push('last_sync_at = ?');
      params.push(updates.lastSyncAt);
    }

    if (sets.length === 0) return;

    params.push(id);
    const sql = `UPDATE ${this.emailAccountsTable} SET ${sets.join(', ')} WHERE id = ?`;
    this.execute(sql, params);
  }

  /**
   * 删除邮件账户
   */
  deleteEmailAccount(id) {
    this.execute(`DELETE FROM ${this.emailAccountsTable} WHERE id = ?`, [id]);
  }

  /**
   * 获取未读邮件数量
   */
  getUnreadCount(accountId, folder = '收件箱') {
    const sql = `
      SELECT COUNT(*) as cnt
      FROM ${this.emailMessagesTable}
      WHERE account_id = ? AND folder = ? AND is_read = 0
    `;
    const result = this.get(sql, [accountId, folder]);
    return result?.cnt || 0;
  }

  // ========== Email Messages ==========

  /**
   * 获取邮件消息列表
   */
  getEmailMessages(accountId, folder, limit = 100) {
    const sql = `
      SELECT id, uid, folder, message_id, from_address, from_name, to_address, cc,
             subject, preview, received_at, is_read, is_starred, has_attachments
      FROM ${this.emailMessagesTable}
      WHERE account_id = ? AND folder = ?
      ORDER BY received_at DESC
      LIMIT ?
    `;
    return this.query(sql, [accountId, folder, limit]);
  }

  /**
   * 获取单封邮件详情
   */
  getEmailMessageById(accountId, uid, folder) {
    const sql = `
      SELECT id, uid, folder, message_id, from_address, from_name, to_address, cc,
             subject, preview, received_at, is_read, is_starred, has_attachments,
             body_html, body_text, attachments_meta
      FROM ${this.emailMessagesTable}
      WHERE account_id = ? AND uid = ? AND folder = ?
    `;
    return this.get(sql, [accountId, uid, folder]);
  }

  /**
   * 获取邮件正文（优先从缓存）
   */
  getEmailBody(accountId, uid, folder) {
    const sql = `
      SELECT body_html, body_text
      FROM ${this.emailMessagesTable}
      WHERE account_id = ? AND uid = ? AND folder = ?
    `;
    return this.get(sql, [accountId, uid, folder]);
  }

  /**
   * 插入或更新邮件消息
   */
  upsertEmailMessage(messageData) {
    const { accountId, uid, folder, messageId, fromAddress, fromName, toAddress,
            cc, subject, preview, receivedAt, isRead, isStarred, hasAttachments,
            bodyHtml, bodyText, attachmentsMeta } = messageData;

    const sql = `
      INSERT INTO ${this.emailMessagesTable}
      (account_id, uid, folder, message_id, from_address, from_name, to_address, cc,
       subject, preview, received_at, is_read, is_starred, has_attachments,
       body_html, body_text, attachments_meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, uid, folder) DO UPDATE SET
        message_id = excluded.message_id,
        from_address = excluded.from_address,
        from_name = excluded.from_name,
        to_address = excluded.to_address,
        cc = excluded.cc,
        subject = excluded.subject,
        preview = excluded.preview,
        received_at = excluded.received_at,
        has_attachments = excluded.has_attachments,
        body_html = excluded.body_html,
        body_text = excluded.body_text,
        attachments_meta = excluded.attachments_meta
    `;
    this.execute(sql, [
      accountId, uid, folder, messageId || null,
      fromAddress || '', fromName || '', toAddress || '', cc || '',
      subject || '', preview || '', receivedAt || null,
      isRead ? 1 : 0, isStarred ? 1 : 0, hasAttachments ? 1 : 0,
      bodyHtml || '', bodyText || '', attachmentsMeta || '[]'
    ]);
  }

  /**
   * 批量插入邮件消息
   */
  bulkInsertEmailMessages(messages) {
    const sql = `
      INSERT INTO ${this.emailMessagesTable}
      (account_id, uid, folder, message_id, from_address, from_name, to_address,
       subject, preview, received_at, is_read, is_starred, has_attachments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(sql);
      for (const msg of messages) {
        stmt.run(
          msg.accountId, msg.uid, msg.folder, msg.messageId || null,
          msg.fromAddress || '', msg.fromName || '', msg.toAddress || '',
          msg.subject || '', msg.preview || '', msg.receivedAt || null,
          msg.isRead ? 1 : 0, msg.isStarred ? 1 : 0, msg.hasAttachments ? 1 : 0
        );
      }
    });
    tx();
  }

  /**
   * 更新邮件阅读状态
   */
  markEmailRead(accountId, uid, folder, isRead = true) {
    const sql = `UPDATE ${this.emailMessagesTable} SET is_read = ? WHERE account_id = ? AND uid = ? AND folder = ?`;
    this.execute(sql, [isRead ? 1 : 0, accountId, uid, folder]);
  }

  /**
   * 更新邮件收藏状态
   */
  markEmailStarred(accountId, uid, folder, isStarred = true) {
    const sql = `UPDATE ${this.emailMessagesTable} SET is_starred = ? WHERE account_id = ? AND uid = ? AND folder = ?`;
    this.execute(sql, [isStarred ? 1 : 0, accountId, uid, folder]);
  }

  /**
   * 删除邮件
   */
  deleteEmailMessage(accountId, uid, folder) {
    this.execute(`DELETE FROM ${this.emailMessagesTable} WHERE account_id = ? AND uid = ? AND folder = ?`, [accountId, uid, folder]);
  }

  // ========== Email Drafts ==========

  /**
   * 获取草稿列表
   */
  getEmailDrafts(accountId) {
    const sql = `
      SELECT id, to_address, cc, subject, body_html, in_reply_to_uid, updated_at
      FROM ${this.emailDraftsTable}
      WHERE account_id = ?
      ORDER BY updated_at DESC
    `;
    return this.query(sql, [accountId]);
  }

  /**
   * 创建草稿
   */
  createEmailDraft(accountId, draftData) {
    const { toAddress, cc, subject, bodyHtml, inReplyToUid } = draftData;

    const sql = `
      INSERT INTO ${this.emailDraftsTable}
      (account_id, to_address, cc, subject, body_html, in_reply_to_uid)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = this.execute(sql, [accountId, toAddress, cc || '', subject, bodyHtml || '', inReplyToUid || null]);
    return result.lastInsertRowid;
  }

  /**
   * 更新草稿
   */
  updateEmailDraft(id, draftData) {
    const { toAddress, cc, subject, bodyHtml, inReplyToUid } = draftData;

    const sets = [];
    const params = [];

    if (toAddress !== undefined) {
      sets.push('to_address = ?');
      params.push(toAddress);
    }
    if (cc !== undefined) {
      sets.push('cc = ?');
      params.push(cc);
    }
    if (subject !== undefined) {
      sets.push('subject = ?');
      params.push(subject);
    }
    if (bodyHtml !== undefined) {
      sets.push('body_html = ?');
      params.push(bodyHtml);
    }
    if (inReplyToUid !== undefined) {
      sets.push('in_reply_to_uid = ?');
      params.push(inReplyToUid);
    }

    if (sets.length === 0) return;

    params.push(id);
    const sql = `UPDATE ${this.emailDraftsTable} SET ${sets.join(', ')} WHERE id = ?`;
    this.execute(sql, params);
  }

  /**
   * 删除草稿
   */
  deleteEmailDraft(id) {
    this.execute(`DELETE FROM ${this.emailDraftsTable} WHERE id = ?`, [id]);
  }
}

// 单例
let instance = null;
export function getEmailRepository() {
  if (!instance) {
    instance = new EmailRepository();
  }
  return instance;
}
