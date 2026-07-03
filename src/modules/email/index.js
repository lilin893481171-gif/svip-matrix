/**
 * @file src/modules/email/index.js
 * @description 邮件模块 - 邮箱账号和邮件管理业务逻辑
 *
 * 职责:
 *   - 邮箱账户管理
 *   - 邮件收发
 *   - 邮件同步
 */

import { getEmailRepository } from '../../core/database/index.js';
import crypto from 'crypto';
import { safeStorage } from 'electron';

/**
 * 邮件服务类
 * 封装邮件相关的业务逻辑
 */
export class EmailService {
  constructor() {
    this.repository = getEmailRepository();
  }

  /**
   * 加密密码
   */
  encryptPassword(plaintext) {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(plaintext);
    }
    const key = crypto.scryptSync('matrix-email-v1', 'salt-email', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * 解密密码
   */
  decryptPassword(encryptedBuffer) {
    if (!encryptedBuffer) return '';
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(encryptedBuffer);
      } catch (e) {
        console.warn('[EmailService] safeStorage 解密失败');
      }
    }
    try {
      const key = crypto.scryptSync('matrix-email-v1', 'salt-email', 32);
      const iv = encryptedBuffer.subarray(0, 16);
      const data = encryptedBuffer.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
    } catch (e) {
      console.error('[EmailService] 密码解密失败:', e.message);
      return '';
    }
  }

  /**
   * 获取所有邮件账户
   */
  getAllEmailAccounts() {
    return this.repository.getAllEmailAccounts();
  }

  /**
   * 获取邮件账户详情
   */
  getEmailAccountById(id) {
    return this.repository.getEmailAccountById(id);
  }

  /**
   * 创建邮件账户
   */
  createEmailAccount(email, password, provider, displayName, smtpHost, smtpPort, imapHost, imapPort) {
    const encrypted = this.encryptPassword(password);
    const avatar = (displayName || email).substring(0, 2).toUpperCase();

    return this.repository.createEmailAccount({
      email,
      displayName: displayName || email.split('@')[0],
      provider: provider || '自建邮局',
      smtpHost,
      smtpPort,
      imapHost,
      imapPort,
      encryptedPassword: encrypted,
      smtpSecure: 1,
      imapSecure: 1,
      avatar
    });
  }

  /**
   * 更新邮件账户
   */
  updateEmailAccount(id, updates) {
    this.repository.updateEmailAccount(id, updates);
  }

  /**
   * 删除邮件账户
   */
  deleteEmailAccount(id) {
    this.repository.deleteEmailAccount(id);
  }

  /**
   * 获取邮件消息
   */
  getEmailMessages(accountId, folder, limit = 100) {
    return this.repository.getEmailMessages(accountId, folder, limit);
  }

  /**
   * 获取邮件详情
   */
  getEmailMessageById(accountId, uid, folder) {
    return this.repository.getEmailMessageById(accountId, uid, folder);
  }

  /**
   * 获取邮件正文
   */
  getEmailBody(accountId, uid, folder) {
    return this.repository.getEmailBody(accountId, uid, folder);
  }

  /**
   * 标记邮件已读
   */
  markEmailRead(accountId, uid, folder, isRead = true) {
    this.repository.markEmailRead(accountId, uid, folder, isRead);
  }

  /**
   * 标记邮件收藏
   */
  markEmailStarred(accountId, uid, folder, isStarred = true) {
    this.repository.markEmailStarred(accountId, uid, folder, isStarred);
  }

  /**
   * 删除邮件
   */
  deleteEmailMessage(accountId, uid, folder) {
    this.repository.deleteEmailMessage(accountId, uid, folder);
  }

  /**
   * 获取草稿列表
   */
  getEmailDrafts(accountId) {
    return this.repository.getEmailDrafts(accountId);
  }

  /**
   * 创建草稿
   */
  createEmailDraft(accountId, toAddress, subject, bodyHtml, cc = '', inReplyToUid = null) {
    return this.repository.createEmailDraft(accountId, {
      toAddress,
      cc,
      subject,
      bodyHtml,
      inReplyToUid
    });
  }

  /**
   * 获取未读邮件数量
   */
  getUnreadCount(accountId, folder = '收件箱') {
    return this.repository.getUnreadCount(accountId, folder);
  }
}

// 导出单例
let instance = null;
export function getEmailService() {
  if (!instance) {
    instance = new EmailService();
  }
  return instance;
}
