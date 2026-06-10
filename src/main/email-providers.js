/**
 * @file email-providers.js
 * @desc 邮件服务商预设配置 — SMTP/IMAP 服务器地址、端口、加密方式
 */

const PROVIDER_PRESETS = {
  'QQ邮箱': {
    imap: { host: 'imap.qq.com', port: 993, secure: true },
    smtp: { host: 'smtp.qq.com', port: 465, secure: true },
    authNote: '在 QQ邮箱设置 → 账户 → POP3/IMAP/SMTP 服务 → 开启IMAP → 生成授权码',
  },
  '腾讯企业邮': {
    imap: { host: 'imap.exmail.qq.com', port: 993, secure: true },
    smtp: { host: 'smtp.exmail.qq.com', port: 465, secure: true },
    authNote: '在邮箱设置 → 客户端专用密码中生成授权码',
  },
  '网易企业邮': {
    imap: { host: 'imap.qiye.163.com', port: 993, secure: true },
    smtp: { host: 'smtp.qiye.163.com', port: 465, secure: true },
    authNote: '在邮箱设置 → 客户端授权密码中开启',
  },
  '阿里企业邮': {
    imap: { host: 'imap.qiye.aliyun.com', port: 993, secure: true },
    smtp: { host: 'smtp.qiye.aliyun.com', port: 465, secure: true },
    authNote: '在邮箱设置 → 客户端密码中生成',
  },
  'Gmail': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    authNote: '需开启两步验证后生成应用专用密码',
  },
  'Outlook': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    authNote: '使用 Microsoft 账户密码或应用密码',
  },
  '自建邮局': {
    imap: { host: '', port: 993, secure: true },
    smtp: { host: '', port: 465, secure: true },
    authNote: '请填写完整的 SMTP/IMAP 服务器地址',
  },
};

/** IMAP 文件夹名映射（中文显示名 → 各服务商可能的 IMAP 文件夹名） */
export const FOLDER_MAP = {
  '收件箱': ['INBOX'],
  '已发送': ['Sent Messages', 'Sent', '已发送', 'Sent Mail', 'INBOX.Sent'],
  '草稿箱': ['Drafts', '草稿箱', 'INBOX.Drafts'],
  '垃圾邮件': ['Junk', 'Spam', '垃圾邮件', 'Bulk Mail', 'INBOX.Junk'],
  '已删除': ['Trash', 'Deleted Messages', '已删除', 'Deleted Items', 'INBOX.Trash'],
};

export function getProviderPreset(name) {
  return PROVIDER_PRESETS[name] || PROVIDER_PRESETS['自建邮局'];
}

/**
 * 解析最终的 IMAP/SMTP 配置
 * 如果用户提供了自定义 host/port，覆盖预设默认值
 */
export function resolveProviderConfig(providerName, overrides = {}) {
  const preset = getProviderPreset(providerName);

  const imapHost = overrides.imapHost || preset.imap.host;
  const imapPort = overrides.imapPort || preset.imap.port;
  const smtpHost = overrides.smtpHost || preset.smtp.host;
  const smtpPort = overrides.smtpPort || preset.smtp.port;

  if (!imapHost || !smtpHost) {
    throw new Error(`邮件服务商 "${providerName}" 需要手动填写服务器地址`);
  }

  return {
    imap: {
      host: imapHost,
      port: Number(imapPort) || preset.imap.port,
      secure: preset.imap.secure,
    },
    smtp: {
      host: smtpHost,
      port: Number(smtpPort) || preset.smtp.port,
      secure: preset.smtp.secure,
    },
    authNote: preset.authNote,
  };
}

export function getAllProviders() {
  return Object.entries(PROVIDER_PRESETS).map(([name, config]) => ({
    name,
    imap: config.imap,
    smtp: config.smtp,
    authNote: config.authNote,
  }));
}

/**
 * 根据邮箱域名自动识别服务商
 * @param {string} email - 邮箱地址
 * @returns {string|null} 服务商名称，或 null（未知域名）
 */
export function detectProviderByEmail(email) {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase();

  const DOMAIN_MAP = {
    'qq.com': 'QQ邮箱',
    'vip.qq.com': 'QQ邮箱',
    'foxmail.com': 'QQ邮箱',
    'exmail.qq.com': '腾讯企业邮',
    '163.com': '网易企业邮',
    '126.com': '网易企业邮',
    'yeah.net': '网易企业邮',
    'qiye.163.com': '网易企业邮',
    'aliyun.com': '阿里企业邮',
    'alibaba-inc.com': '阿里企业邮',
    'qiye.aliyun.com': '阿里企业邮',
    'gmail.com': 'Gmail',
    'googlemail.com': 'Gmail',
    'outlook.com': 'Outlook',
    'hotmail.com': 'Outlook',
    'live.com': 'Outlook',
    'msn.com': 'Outlook',
    'office365.com': 'Outlook',
  };

  return DOMAIN_MAP[domain] || null;
}
