/**
 * 将本地物理路径转换为安全的 matrix-media:// 协议 URL
 * 替换危险的 file:// 直读模式，绕过 CSP 沙箱限制
 */
export function toMatrixMediaUrl(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (filePath.startsWith('matrix-media://')) return filePath;
  if (filePath.startsWith('data:')) return filePath;
  if (filePath.startsWith('blob:')) return filePath;
  // 先转换反斜杠，再用 encodeURI 编码中文和空格（保留 :/ 等合法路径分隔符）
  // encodeURI 不会编码 A-Z a-z 0-9 ; , / ? : @ & = + $ - _ . ! ~ * ' ( ) #
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `matrix-media://${encodeURI(normalizedPath)}`;
}
