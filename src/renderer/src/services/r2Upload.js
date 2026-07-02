/**
 * @file r2Upload.js
 * @desc Cloudflare R2 大附件上传服务
 *
 * 流程：前端请求主进程 → 主进程读文件 + 获取预签名 URL + 直传 R2 → 返回下载链接
 *
 * 配置：在 .env 或 electron-builder 中设置 VITE_R2_WORKER_URL
 */

// Worker 网关地址（从环境变量读取）
const WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || '';

/** 单个附件大小阈值：15MB */
export const SIZE_THRESHOLD = 15 * 1024 * 1024;

/**
 * 判断附件是否需要走 R2 云盘通道
 * @param {{ name: string, size: number }} file
 * @returns {boolean}
 */
export function isLargeAttachment(file) {
  return file.size > SIZE_THRESHOLD;
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 生成 R2 云盘下载卡片 HTML
 * @param {string} filename - 文件名
 * @param {number} fileSize - 文件大小 (bytes)
 * @param {string} downloadUrl - R2 公开下载链接
 * @returns {string} HTML 片段
 */
export function generateDownloadCard(filename, fileSize, downloadUrl) {
  const sizeStr = formatSize(fileSize);
  return `
<div style="margin:16px 0; padding:16px 20px; background:linear-gradient(135deg,#f0f9ff,#e0f2fe); border:1px solid #bae6fd; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
    <span style="font-size:24px;">📁</span>
    <div>
      <div style="font-weight:600; color:#0c4a6e; font-size:14px;">YuMatrix 极速传输</div>
      <div style="color:#64748b; font-size:12px; margin-top:2px;">大文件云盘通道 · 安全加密 · 高速下载</div>
    </div>
  </div>
  <div style="background:white; border-radius:8px; padding:12px 16px; border:1px solid #e2e8f0;">
    <div style="display:flex; align-items:center; justify-content:space-between;">
      <div>
        <div style="font-weight:500; color:#1e293b; font-size:14px;">${filename}</div>
        <div style="color:#94a3b8; font-size:12px; margin-top:2px;">${sizeStr}</div>
      </div>
      <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer"
         style="display:inline-flex; align-items:center; gap:6px; padding:8px 20px; background:linear-gradient(135deg,#0ea5e9,#0284c7); color:white; border-radius:8px; text-decoration:none; font-size:13px; font-weight:500; box-shadow:0 2px 8px rgba(14,165,233,0.3); transition:all 0.2s;">
        ⬇️ 立即下载
      </a>
    </div>
  </div>
  <div style="margin-top:8px; color:#94a3b8; font-size:11px; text-align:right;">
    链接有效期 7 天 · Powered by YuMatrix Cloud
  </div>
</div>`;
}

/**
 * 上传单个文件到 R2（通过主进程 IPC）
 * @param {{ name: string, path: string, size: number }} file - 附件对象
 * @param {(percent: number) => void} onProgress - 进度回调 (0-100)
 * @returns {Promise<{ downloadUrl: string, key: string }>}
 */
export async function uploadToR2(file, onProgress) {
  if (!WORKER_URL) {
    throw new Error('R2 Worker 地址未配置 (VITE_R2_WORKER_URL)');
  }

  onProgress?.(5);

  // 1. 获取预签名 URL
  const presignResp = await fetch(`${WORKER_URL}/v1/r2/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name }),
  });

  if (!presignResp.ok) {
    const err = await presignResp.json().catch(() => ({}));
    throw new Error(`预签名请求失败: ${err.error || presignResp.status}`);
  }

  const { putUrl, downloadUrl, key } = await presignResp.json();
  onProgress?.(15);

  // 2. 通过主进程读取文件并上传到 R2
  const result = await window.electron.ipcRenderer.invoke('r2-upload-file', {
    filePath: file.path,
    putUrl,
    filename: file.name,
  });

  if (!result.success) {
    throw new Error(result.message || 'R2 上传失败');
  }

  onProgress?.(100);

  return { downloadUrl, key };
}
