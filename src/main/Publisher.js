/**
 * @file src/main/Publisher.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 无头发射引擎 — 矩阵最后一击
 *
 * 职责:
 *   - 接收 taskConfig (用户填写的真实数据) + masterTemplate (ProtocolAggregator 变形后的蓝图)
 *   - 正则替换模板中 {{USER_INPUT_TITLE}} / {{BILI_VIDEO_CID}} 等占位符
 *   - 构建带签名的 headers (Cookie, User-Agent, Referer, Origin)
 *   - 直接 fetch POST 到目标接口
 *   - 返回服务器响应 (成功 / 错误原因)
 *
 * 使用方式:
 *   import { executePublishTask } from './Publisher.js'
 *   const result = await executePublishTask(taskConfig, masterTemplate, requestUrl, cookies)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════

const DEFAULT_TIMEOUT = 30_000
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'

// ═══════════════════════════════════════════════════════════
// 1. 模板替换引擎
// ═══════════════════════════════════════════════════════════

/**
 * 将 `{{PLACEHOLDER}}` 模板变量替换为 taskConfig 中的真实值
 *
 * 支持的占位符:
 *   {{USER_INPUT_TITLE}}      — 标题
 *   {{USER_INPUT_DESC}}       — 描述 / 简介
 *   {{USER_INPUT_TID}}        — 分区 ID
 *   {{USER_INPUT_TAGS}}       — 标签 (数组或逗号分隔字符串)
 *   {{USER_INPUT_SOURCE}}     — 来源
 *   {{USER_INPUT_COPYRIGHT}}  — 版权 (1=转载, 2/3=自制)
 *   {{USER_INPUT_DYNAMIC}}    — 动态文案
 *   {{USER_INPUT_SUBTITLE}}   — 字幕
 *   {{USER_INPUT_DTIME}}      — 定时发布时间戳 (秒)
 *   {{BILI_VIDEO_CID}}        — 视频 cid (预上传返回)
 *   {{BILI_COVER_URL}}        — 封面 URL
 *   {{BILI_VIDEO_FILENAME}}   — 视频文件名
 *   {{BILI_UPLOAD_AUTH}}      — 上传凭证
 *   {{AUTO_TIMESTAMP}}        — 当前时间戳 (秒)
 */
function resolveValue(placeholder, taskConfig = {}) {
  switch (placeholder) {
    case '{{USER_INPUT_TITLE}}':
      return taskConfig.title || ''
    case '{{USER_INPUT_DESC}}':
      return taskConfig.desc || taskConfig.description || ''
    case '{{USER_INPUT_TID}}':
      return taskConfig.tid ?? taskConfig.tid ?? 160
    case '{{USER_INPUT_TAGS}}':
      return taskConfig.tags || []
    case '{{USER_INPUT_SOURCE}}':
      return taskConfig.source || taskConfig.type || ''
    case '{{USER_INPUT_COPYRIGHT}}':
      return taskConfig.copyright ?? 3
    case '{{USER_INPUT_DYNAMIC}}':
      return taskConfig.dynamic || ''
    case '{{USER_INPUT_SUBTITLE}}':
      return taskConfig.subtitle || ''
    case '{{USER_INPUT_DTIME}}':
      return taskConfig.dtime || ''
    case '{{BILI_VIDEO_CID}}':
      return taskConfig.cid ?? 0
    case '{{BILI_COVER_URL}}':
      return taskConfig.coverUrl || taskConfig.cover || ''
    case '{{BILI_VIDEO_FILENAME}}':
      return taskConfig.filename || taskConfig.videoFilename || ''
    case '{{BILI_UPLOAD_AUTH}}':
      return taskConfig.uploadAuth || taskConfig.auth || ''
    case '{{BILI_UPLOAD_URL}}':
      return taskConfig.uploadUrl || ''
    case '{{BILI_UPLOAD_TOKEN}}':
      return taskConfig.uploadToken || ''
    case '{{AUTO_TIMESTAMP}}':
      return Math.floor(Date.now() / 1000)
    default:
      return placeholder
  }
}

function fillTemplate(obj, taskConfig, depth = 0) {
  if (depth > 30) return obj
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    // 正则匹配所有 {{VAR}} 占位符并替换
    return obj.replace(/\{\{[A-Z_]+\}\}/g, (match) => {
      const resolved = resolveValue(match, taskConfig)
      if (typeof resolved === 'string') return resolved
      if (typeof resolved === 'number') return String(resolved)
      return match
    })
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (typeof item === 'string' && item.includes('{{')) {
        const resolved = resolveValue(item, taskConfig)
        if (Array.isArray(resolved)) return resolved
        return fillTemplate(item, taskConfig, depth + 1)
      }
      return fillTemplate(item, taskConfig, depth + 1)
    })
  }

  if (typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.includes('{{')) {
        // 数字字段特殊处理: cid 等数字字段不应变成字符串
        const resolved = resolveValue(value, taskConfig)
        if (typeof resolved === 'number') {
          result[key] = resolved
        } else if (Array.isArray(resolved) && value.includes('TAGS')) {
          result[key] = resolved.join(',')
        } else {
          result[key] = resolved
        }
      } else if (typeof value === 'number' && key === 'cid' && taskConfig.cid != null) {
        result[key] = taskConfig.cid
      } else {
        result[key] = fillTemplate(value, taskConfig, depth + 1)
      }
    }
    return result
  }

  return obj
}

// ═══════════════════════════════════════════════════════════
// 2. Cookie 格式化
// ═══════════════════════════════════════════════════════════

/**
 * 将 cookies 数组/字符串/对象格式化为标准 Cookie 请求头
 *
 * 输入支持:
 *   - Array: [{ name, value }, ...]   (Electron session.cookies.get)
 *   - String: "key1=val1; key2=val2"   (直接透传)
 *   - Object: { key1: "val1", ... }    (序列化)
 */
function formatCookieHeader(cookies) {
  if (!cookies) return ''

  if (typeof cookies === 'string') {
    return cookies
  }

  if (Array.isArray(cookies)) {
    return cookies
      .map((c) => {
        if (typeof c === 'string') return c
        return `${encodeURIComponent(c.name || c.key || '')}=${encodeURIComponent(c.value || '')}`
      })
      .join('; ')
  }

  if (typeof cookies === 'object') {
    return Object.entries(cookies)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v || '')}`)
      .join('; ')
  }

  return String(cookies)
}

// ═══════════════════════════════════════════════════════════
// 3. Headers 构建
// ═══════════════════════════════════════════════════════════

function buildHeaders(requestUrl, cookies, extraHeaders = {}) {
  const parsedUrl = new URL(requestUrl)
  const origin = `${parsedUrl.protocol}//${parsedUrl.host}`

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Origin: origin,
    Referer: `${origin}/`,
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': DEFAULT_UA,
    ...extraHeaders,
  }

  const cookieStr = formatCookieHeader(cookies)
  if (cookieStr) {
    headers.Cookie = cookieStr
  }

  return headers
}

// ═══════════════════════════════════════════════════════════
// 4. 核心发送函数
// ═══════════════════════════════════════════════════════════

/**
 * 无头发布 — 向目标接口签发完整的 POST 请求
 *
 * @param {object} taskConfig — 用户填入的真实数据
 *   { title, desc, tid, tags, copyright, cid, coverUrl, dtime, dynamic, ... }
 * @param {object} masterTemplate — ProtocolAggregator 变形后的蓝图 (含 {{}} 变量)
 * @param {string} requestUrl — 目标接口完整 URL (含 w_rid / wts / csrf)
 * @param {*} cookies — 账号 Cookie (Array / String / Object)
 * @param {object} [options] — 可选配置
 *   { timeout, extraHeaders, dryRun }
 * @returns {Promise<{success: boolean, status?: number, data?: object, error?: string}>}
 */
export async function executePublishTask(
  taskConfig,
  masterTemplate,
  requestUrl,
  cookies,
  options = {}
) {
  const { timeout = DEFAULT_TIMEOUT, extraHeaders = {}, dryRun = false } = options

  // --- Step 1: 参数校验 ---
  if (!requestUrl || typeof requestUrl !== 'string') {
    return { success: false, error: '缺少 requestUrl: 目标接口地址' }
  }
  if (!masterTemplate || typeof masterTemplate !== 'object') {
    return { success: false, error: '缺少 masterTemplate: 协议蓝图' }
  }
  if (!taskConfig || typeof taskConfig !== 'object') {
    return { success: false, error: '缺少 taskConfig: 用户真实数据' }
  }

  try {
    // --- Step 2: 模板填充 — 正则替换所有 {{}} 占位符 ---
    const finalPayload = fillTemplate(masterTemplate, taskConfig)

    // --- Step 3: dryRun 模式 — 只生成不发送 ---
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        payload: finalPayload,
        url: requestUrl,
        message: 'Dry run: 有效载荷已生成，未实际发送',
      }
    }

    // --- Step 4: 构建 Headers ---
    const headers = buildHeaders(requestUrl, cookies, extraHeaders)

    // --- Step 5: 发送 POST 请求 ---
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const body = JSON.stringify(finalPayload)

    console.log('[Publisher] 发射:', requestUrl.slice(0, 80) + '...')
    console.log('[Publisher] Body keys:', Object.keys(finalPayload).join(', '))

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)

    // --- Step 6: 解析响应 ---
    const responseText = await response.text()
    let responseData = null
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { _raw: responseText }
    }

    if (response.ok) {
      console.log('[Publisher] 发射成功 — HTTP', response.status)
      return {
        success: true,
        status: response.status,
        data: responseData,
        payload: finalPayload,
      }
    }

    // 非 2xx — 提取业务错误信息
    const errorMsg =
      responseData?.message ||
      responseData?.msg ||
      responseData?.error ||
      `HTTP ${response.status}`

    console.warn('[Publisher] 服务端拒绝:', errorMsg)
    return {
      success: false,
      status: response.status,
      data: responseData,
      error: errorMsg,
      payload: finalPayload,
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: `请求超时 (${timeout / 1000}s)` }
    }
    console.error('[Publisher] 网络异常:', err.message)
    return { success: false, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════
// 5. 批量掩护导出 (可选)
// ═══════════════════════════════════════════════════════════

/**
 * 生成 w_rid 防伪签名 (B站 风格 — wbi 算法)
 * 若平台不需要此字段, 从 finalPayload 中删除 _w_rid 模板行即可
 */
export function generateWbiSignature(params, mixinKey) {
  if (!mixinKey) return params
  const sorted = Object.keys(params)
    .filter((k) => k !== 'w_rid')
    .sort()
  const query = sorted.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&')
  const hash = crypto.createHash('md5').update(query + mixinKey).digest('hex')
  return hash
}
