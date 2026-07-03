/**
 * @file utils/crypto-io.js
 * @description AES-256-CBC 加密文件读写 — 供 browser-manager 和 account-browser-manager 共用
 */
import fs from 'fs';
import crypto from 'crypto';

/**
 * 原子写入加密文件（先写 .tmp 再 rename，写入失败自动清理）
 */
export function secureAtomicWriteFileSync(filePath, data, accountId) {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    const key = crypto.createHash('sha256').update(String(accountId)).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    fs.writeFileSync(tempPath, JSON.stringify({
      data: encrypted,
      iv: iv.toString('hex'),
      timestamp: Date.now()
    }), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

/**
 * 读取并解密文件
 */
export function secureReadFileSync(filePath, accountId) {
  const content = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(content);
  const key = crypto.createHash('sha256').update(String(accountId)).digest();
  const iv = Buffer.from(payload.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(payload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}
