/**
 * @file r2-presign-worker.js
 * @desc Cloudflare Worker — R2 预签名 URL 网关
 *
 * 功能：接收文件名 → 生成 R2 PUT 预签名 URL + 公开下载 URL
 * 依赖：aws4fetch（npm 包，wrangler deploy 时自动打包）
 *
 * 环境变量（wrangler.toml 或 Dashboard 配置）：
 *   R2_ACCOUNT_ID    — Cloudflare 账户 ID
 *   R2_BUCKET        — R2 Bucket 名称
 *   R2_ACCESS_KEY    — R2 API Token (S3 兼容)
 *   R2_SECRET_KEY    — R2 API Token Secret
 *   R2_PUBLIC_DOMAIN — 公开下载域名 (已绑定到 R2 Bucket 的自定义域名)
 *   ALLOWED_ORIGINS  — 允许的 CORS 来源 (逗号分隔)
 */

import { AwsClient } from 'aws4fetch';

// ==========================================
// CORS 配置
// ==========================================

function getCorsHeaders(env) {
  const origins = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
  return {
    'Access-Control-Allow-Origin': origins.length === 1 ? origins[0] : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) },
  });
}

// ==========================================
// 文件名安全化
// ==========================================

function sanitizeFilename(name) {
  // 保留中文、字母、数字、点、连字符、下划线
  return name
    .replace(/[^\w一-鿿.\-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 128);
}

// ==========================================
// Worker 入口
// ==========================================

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(env) });
    }

    const url = new URL(request.url);

    // ── 路由：POST /v1/r2/presign ──
    if (url.pathname === '/v1/r2/presign' && request.method === 'POST') {
      try {
        return await handlePresign(request, env);
      } catch (e) {
        console.error('[R2 Worker] presign error:', e);
        return jsonResponse({ error: e.message || 'Internal error' }, 500, env);
      }
    }

    // ── 路由：GET /health ──
    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, ts: Date.now() }, 200, env);
    }

    return jsonResponse({ error: 'Not Found' }, 404, env);
  },
};

// ==========================================
// 核心：生成预签名 URL
// ==========================================

async function handlePresign(request, env) {
  // 校验环境变量
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_PUBLIC_DOMAIN } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_PUBLIC_DOMAIN) {
    return jsonResponse({ error: 'R2 环境变量未配置完整' }, 500, env);
  }

  // 解析请求
  const body = await request.json();
  const { filename, contentType } = body;
  if (!filename) {
    return jsonResponse({ error: '缺少 filename 参数' }, 400, env);
  }

  // 生成唯一的 R2 对象 Key
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeName = sanitizeFilename(filename);
  const key = `email-attachments/${ts}-${rand}-${safeName}`;

  // 构建 S3 兼容端点 URL
  const s3Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const putUrl = `${s3Endpoint}/${R2_BUCKET}/${key}`;

  // 用 aws4fetch 签名 PUT 请求
  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  });

  const headers = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  // 允许公开读取（需要在 R2 Bucket 上配置公开访问或自定义域名）
  // 如果 Bucket 已设置为公开，不需要额外 header
  // 如果用 R2.dev 公开 URL，需要在 Dashboard 启用

  const signedRequest = await aws.sign(
    new Request(putUrl, {
      method: 'PUT',
      headers,
    }),
    {
      aws: { signQuery: true }, // 生成预签名 URL（查询参数签名）
      expiresIn: 3600,          // 1 小时有效期
    }
  );

  // 公开下载 URL
  const downloadUrl = `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${key}`;

  return jsonResponse({
    putUrl: signedRequest.url,
    downloadUrl,
    key,
    expiresIn: 3600,
  }, 200, env);
}
