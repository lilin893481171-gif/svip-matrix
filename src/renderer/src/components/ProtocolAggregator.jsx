/**
 * @file ProtocolAggregator.jsx
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 协议汇总引擎 v6 — 轻量刺客版
 * 触发：Ctrl+Shift+Alt+P
 *
 * 使命变更 (v5 → v6):
 *   废弃: WBI 签名抓取 · PayloadTransformer · 模板变量引擎
 *   新增: 会话身份提取 (Cookie/UA/bili_jct) + 上传资产监控
 *
 * 数据流 v6:
 *   R2 CDN ─→ rules.json (仅上传端点) ─→ 主进程匹配
 *   Preload sniff ─→ NETWORK_INTERCEPTED ─→ 本面板分拣
 *   ─→ 上传事件卡片 (preupload / cover)
 *   ─→ 身份卡片 (Cookie / UA / bili_jct)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react'

// ═══════════════════════════════════════════
// R2 云端规则 (v6: 仅上传端点，无 /add/v3)
// ═══════════════════════════════════════════

const R2_RULES_URL = 'https://assetsyumatrix.nikolaboy.com/interceptor/rules.json'

const LOCAL_FALLBACK_RULES = {
  version: '2.0.0-local',
  enabled: true,
  platforms: [
    {
      name: 'bilibili',
      matchHost: 'member.bilibili.com',
      rules: [
        { matchUrl: '/preupload', tag: 'video-upload' },
        { matchUrl: '/cover/up', tag: 'cover-upload' },
        { matchUrl: '/archive/cover', tag: 'cover-upload' },
      ],
    },
  ],
}

// ═══════════════════════════════════════════
// 会话状态 (v6 精简: 只跟踪上传资产 + 身份信息)
// ═══════════════════════════════════════════

const initialSession = {
  // 上传资产
  videoUploadAuth: null,
  videoFilename: null,
  videoCid: null,
  coverUrl: null,

  // 身份管道
  cookies: null,
  userAgent: null,
  biliJct: null,

  phase: 'idle',
}

function sessionReducer(state, action) {
  switch (action.type) {
    case 'VIDEO_UPLOAD':
      return {
        ...state,
        videoUploadAuth: action.payload.auth || state.videoUploadAuth,
        videoFilename: action.payload.filename || state.videoFilename,
        videoCid: action.payload.cid || state.videoCid,
        phase: 'video-upload',
      }
    case 'COVER_UPLOAD':
      return {
        ...state,
        coverUrl: action.payload.coverUrl || state.coverUrl,
        phase: 'cover-upload',
      }
    case 'IDENTITY':
      return {
        ...state,
        cookies: action.payload.cookies || state.cookies,
        userAgent: action.payload.ua || state.userAgent,
        biliJct: action.payload.biliJct || state.biliJct,
      }
    case 'RESET':
      return initialSession
    default:
      return state
  }
}

// ═══════════════════════════════════════════
// URL 端点识别 (仅上传类)
// ═══════════════════════════════════════════

function matchEndpoint(url) {
  if (!url) return null
  const u = String(url).toLowerCase()
  if (u.includes('preupload')) return 'video-upload'
  if (u.includes('cover/up') || u.includes('archive/cover')) return 'cover-upload'
  return null
}

let _idCounter = 1
function uid() { return 'entry_' + (_idCounter++) + '_' + Date.now() }

// ═══════════════════════════════════════════
// 子组件: 状态探针圆点
// ═══════════════════════════════════════════

function StatusDot({ active, color = 'gray' }) {
  const colors = {
    green: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]',
    cyan: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]',
    purple: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]',
    yellow: 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]',
    red: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
    gray: 'bg-gray-600',
  }
  return <div className={`w-2 h-2 rounded-full shrink-0 ${active ? colors[color] : colors.gray}`} />
}

// ═══════════════════════════════════════════
// 子组件: JSON 高亮
// ═══════════════════════════════════════════

function JsonRawHighlight({ obj }) {
  const lines = JSON.stringify(obj, null, 2).split('\n')
  return (
    <pre className="text-[11px] font-mono overflow-x-auto p-3 bg-[#0d0d0d] rounded-lg border border-gray-700/50 whitespace-pre leading-relaxed">
      {lines.map((line, i) => (
        <div key={i}>
          <span className="text-gray-600 select-none mr-3 text-right inline-block w-6">{i + 1}</span>
          <span className="text-gray-300">{line}</span>
        </div>
      ))}
    </pre>
  )
}

// ═══════════════════════════════════════════
// 子组件: 事件时间线
// ═══════════════════════════════════════════

const PHASE_META = {
  'video-upload': { label: '视频上传', dot: 'cyan' },
  'cover-upload': { label: '封面上传', dot: 'purple' },
}

function EventTimeline({ events }) {
  if (events.length === 0) {
    return <div className="text-gray-500 text-xs text-center py-6 font-mono">等待上传事件...</div>
  }
  return (
    <div className="space-y-1.5">
      {events.map((ev, i) => {
        const meta = PHASE_META[ev.type] || { label: ev.type, dot: 'gray' }
        return (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-800/50 rounded text-xs font-mono">
            <StatusDot active color={meta.dot} />
            <span className="text-gray-500 w-12 shrink-0">{ev.time}</span>
            <span className="text-gray-300 font-semibold w-16 shrink-0">{meta.label}</span>
            <span className="text-gray-400 break-all min-w-0">{ev.summary}</span>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// 子组件: Cookie 卡片
// ═══════════════════════════════════════════

function CookieCard({ cookies, biliJct, userAgent }) {
  const [copied, setCopied] = useState(false)

  const handleCopyCookies = useCallback(async () => {
    if (!cookies) return
    try { await navigator.clipboard.writeText(cookies) } catch {
      const ta = document.createElement('textarea'); ta.value = cookies; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [cookies])

  if (!cookies && !biliJct) {
    return (
      <div className="text-gray-500 text-xs text-center py-6 font-mono">
        等待身份提取... (在沙盒中登录 B站后自动捕获)
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* bili_jct 高亮 */}
      {biliJct && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-2">
          <StatusDot active color="yellow" />
          <span className="text-yellow-400 font-bold text-xs">bili_jct (CSRF)</span>
          <code className="text-yellow-300 text-xs font-mono ml-auto">{biliJct.slice(0, 10)}...</code>
        </div>
      )}

      {/* UA */}
      {userAgent && (
        <div className="flex items-center gap-2 bg-gray-700/30 rounded px-3 py-2">
          <StatusDot active color="gray" />
          <span className="text-gray-400 text-xs">User-Agent</span>
          <code className="text-gray-300 text-[10px] font-mono ml-auto truncate max-w-[300px]">{userAgent}</code>
        </div>
      )}

      {/* Cookie 字符串 */}
      {cookies && (
        <div className="bg-[#0d0d0d] border border-gray-700/30 rounded p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-500">完整 Cookie 字符串</span>
            <button
              onClick={handleCopyCookies}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border transition-all ${
                copied ? 'text-emerald-400 border-emerald-500 bg-emerald-500/10' : 'text-gray-400 border-gray-600 hover:border-cyan-500 hover:text-cyan-400'
              }`}
            >
              {copied ? '已复制' : '复制 Cookie'}
            </button>
          </div>
          <pre className="text-[10px] text-gray-300 font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto leading-relaxed">
            {cookies}
          </pre>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// 子组件: 上传事件卡片
// ═══════════════════════════════════════════

function UploadCard({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const endpoint = matchEndpoint(entry.url)
  const tag = endpoint === 'video-upload' ? '视频上传' : endpoint === 'cover-upload' ? '封面上传' : '未知'

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden bg-[#0d0d0d]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
          endpoint === 'video-upload' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
          endpoint === 'cover-upload' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
          'bg-gray-500/10 text-gray-400 border border-gray-600/30'
        }`}>
          {tag}
        </span>
        <span className="text-gray-500 w-12 shrink-0">{entry.time}</span>
        <span className="text-gray-400 font-semibold w-10 shrink-0">{entry.method}</span>
        <span className="text-gray-500 truncate flex-1 min-w-0">{entry.url}</span>
        <span className="text-gray-600 text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="border-t border-gray-700/50 p-2.5 space-y-2">
          {entry.responseBody && (
            <>
              <div className="text-[10px] text-gray-500">响应体</div>
              <JsonRawHighlight obj={JSON.parse(entry.responseBody)} />
            </>
          )}
          {entry.diff && Object.keys(entry.diff.before || {}).length > 0 && (
            <>
              <div className="text-[10px] text-gray-500">请求体</div>
              <JsonRawHighlight obj={entry.diff.before} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════

export default function ProtocolAggregator({ browserViewRect }) {
  const [visible, setVisible] = useState(false)
  const [session, dispatch] = useReducer(sessionReducer, initialSession)
  const [events, setEvents] = useState([])

  // 上传事件列表
  const [uploadEntries, setUploadEntries] = useState([])

  // Tab 切换
  const [topTab, setTopTab] = useState('identity')

  // 面板宽度拖拽
  const [panelWidth, setPanelWidth] = useState(420)
  const panelWidthRef = useRef(panelWidth)
  panelWidthRef.current = panelWidth
  const [isDragging, setIsDragging] = useState(false)

  // R2 规则
  const [cloudRules, setCloudRules] = useState(null)
  const [rulesStatus, setRulesStatus] = useState('loading')

  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])

  const cachePulled = useRef(false)

  // ─── 通知主进程: BrowserView 自动缩进 ───
  useEffect(() => {
    const electron = typeof window !== 'undefined' && window.electron ? window.electron : { ipcRenderer: { invoke: () => Promise.resolve() } }
    if (visible) {
      electron.ipcRenderer.invoke('debug-panel-visibility', { visible: true, panelWidth }).catch(() => {})
    } else {
      electron.ipcRenderer.invoke('debug-panel-visibility', { visible: false }).catch(() => {})
    }
  }, [visible, panelWidth])

  const panelRef = useRef(null)
  const dragRef = useRef({ startX: 0, startWidth: 0 })

  const handleDragStart = useCallback((e) => {
    setIsDragging(true)
    dragRef.current.startX = e.clientX || e.touches?.[0]?.clientX || 0
    dragRef.current.startWidth = panelWidth
    e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e) => {
      const clientX = e.clientX || e.touches?.[0]?.clientX || 0
      const deltaX = dragRef.current.startX - clientX
      const newWidth = Math.min(900, Math.max(300, dragRef.current.startWidth + deltaX))
      setPanelWidth(newWidth)
    }
    const handleUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchend', handleUp)
    }
  }, [isDragging])

  // ─── R2 云端规则拉取 ───
  useEffect(() => {
    let cancelled = false
    async function fetchRules() {
      setRulesStatus('loading')
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(R2_RULES_URL, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const rules = await res.json()
        if (cancelled) return
        if (rules && rules.platforms) {
          setCloudRules(rules)
          setRulesStatus('synced')
          try {
            const electron = window.electron
            if (electron?.ipcRenderer?.invoke) {
              await electron.ipcRenderer.invoke('net-interceptor:update-rules', rules)
            }
          } catch (e) { console.warn('[Aggregator v6] 规则下发失败:', e.message) }
        }
      } catch (err) {
        if (cancelled) return
        console.warn('[Aggregator v6] R2 拉取失败，使用本地回退:', err.message)
        setCloudRules(LOCAL_FALLBACK_RULES)
        setRulesStatus('fallback')
        try {
          const electron = window.electron
          if (electron?.ipcRenderer?.invoke) {
            await electron.ipcRenderer.invoke('net-interceptor:update-rules', LOCAL_FALLBACK_RULES)
          }
        } catch (e) {}
      }
    }
    fetchRules()
    return () => { cancelled = true }
  }, [])

  // ─── 热键监听 ───
  useEffect(() => {
    const getElectron = () => {
      if (typeof window !== 'undefined' && window.electron) return window.electron
      return { ipcRenderer: { on: () => {}, removeAllListeners: () => {} } }
    }
    const electron = getElectron()
    const cleanup = electron.ipcRenderer.on('hotkey-toggle-protocol-aggregator', () => {
      setVisible((v) => !v)
    })
    return () => { if (cleanup) cleanup() }
  }, [])

  // ─── Esc 关闭 ───
  useEffect(() => {
    if (!visible) return
    const handler = (e) => { if (e.key === 'Escape') setVisible(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible])

  // ═══════════════════════════════════════════
  // NETWORK_INTERCEPTED 实时监听 (v6: 仅上传端点)
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (!visible) return

    const interceptor = window.interceptorAPI
    if (!interceptor) return

    const now = new Date().toLocaleTimeString()

    const handleIntercepted = (entry) => {
      const url = entry.url || ''
      const time = entry.time || now
      const method = entry.method || 'POST'
      const responseBody = entry.responseBody
      const currentSession = sessionRef.current

      // 端点识别
      const endpoint = matchEndpoint(url)

      // ── 视频上传端点 ──
      if (endpoint === 'video-upload') {
        if (responseBody) {
          try {
            const resp = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody
            const auth = resp.data || resp.result || resp
            const filename = resp.data?.filename || resp.filename || resp.data?.name || null
            const cid = resp.data?.cid || resp.cid || resp.data?.biz_id || null
            dispatch({ type: 'VIDEO_UPLOAD', payload: { auth, filename, cid } })
            setEvents((prev) =>
              [...prev, { type: 'video-upload', time, summary: cid ? `cid: ${cid} | ${filename || 'unknown'}` : (filename ? `文件: ${filename}` : '凭证已获取') }].slice(-30)
            )
          } catch (_) {}
        }

        setUploadEntries((prev) => {
          if (entry.id && prev.findIndex(e => e.id === entry.id) !== -1) return prev
          return [{ id: entry.id || uid(), time, url, method, responseBody, diff: entry.diff, type: 'video-upload' }, ...prev].slice(-30)
        })
        return
      }

      // ── 封面上传端点 ──
      if (endpoint === 'cover-upload') {
        if (responseBody) {
          try {
            const resp = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody
            const coverUrl = resp.data?.url || resp.data?.cover || resp.url || resp.cover || null
            if (coverUrl) {
              dispatch({ type: 'COVER_UPLOAD', payload: { coverUrl } })
              setEvents((prev) =>
                [...prev, { type: 'cover-upload', time, summary: coverUrl.length > 60 ? coverUrl.slice(0, 60) + '...' : coverUrl }].slice(-30)
              )
            }
          } catch (_) {}
        }

        setUploadEntries((prev) => {
          if (entry.id && prev.findIndex(e => e.id === entry.id) !== -1) return prev
          return [{ id: entry.id || uid(), time, url, method, responseBody, diff: entry.diff, type: 'cover-upload' }, ...prev].slice(-30)
        })
        return
      }

      // 非上传端点: 忽略 (不再记录雷达)
    }

    interceptor.onRealtimeLog(handleIntercepted)

    // ── v6: 首次挂载补收缓存池 ──
    if (!cachePulled.current) {
      cachePulled.current = true
      interceptor.getInterceptedLogs().then((cachedEntries) => {
        if (!Array.isArray(cachedEntries) || cachedEntries.length === 0) return
        console.log('[Aggregator v6] 缓存池补收:', cachedEntries.length, '条')

        const seenIds = new Set()
        const uploadBatch = []

        for (const entry of cachedEntries) {
          if (seenIds.has(entry.id)) continue
          seenIds.add(entry.id)

          const endpoint = matchEndpoint(entry.url)
          if (endpoint) {
            uploadBatch.push({
              id: entry.id || uid(),
              time: entry.time,
              url: entry.url,
              method: entry.method,
              responseBody: entry.responseBody,
              diff: entry.diff,
              type: endpoint,
            })
          }
        }

        if (uploadBatch.length > 0) {
          setUploadEntries((prev) => {
            const existing = new Set(prev.map(e => e.id))
            const fresh = uploadBatch.filter(e => !existing.has(e.id))
            return [...fresh, ...prev].slice(0, 30)
          })
        }
      }).catch((err) => {
        console.warn('[Aggregator v6] 缓存池拉取失败:', err?.message || err)
      })
    }

    return () => {
      if (interceptor.clearRealtimeLogListener) {
        interceptor.clearRealtimeLogListener()
      }
    }
  }, [visible])

  // ─── 重置 ───
  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' })
    setEvents([])
    setUploadEntries([])
    const interceptor = window.interceptorAPI
    if (interceptor?.clearInterceptedLogs) {
      interceptor.clearInterceptedLogs().catch(() => {})
    }
  }, [])

  // ─── 身份提取：从活跃 BrowserView 导出 Cookie/UA ───
  const handleExtractIdentity = useCallback(async () => {
    // 此功能依赖 account-browser-manager 中的活跃 session
    // 通过 IPC 向主进程请求身份提取
    try {
      const electron = window.electron
      if (electron?.ipcRenderer?.invoke) {
        const result = await electron.ipcRenderer.invoke('identity:request-extract')
        if (result?.success && result?.identity) {
          dispatch({ type: 'IDENTITY', payload: result.identity })
        }
      }
    } catch (e) {
      console.warn('[Aggregator v6] 身份提取失败:', e.message)
    }
  }, [])

  const panelStyle = browserViewRect
    ? {
        top: `${browserViewRect.top}px`,
        height: `${browserViewRect.height}px`,
        width: panelWidth,
        right: 0,
        cursor: isDragging ? 'col-resize' : undefined,
      }
    : {
        right: 0, top: 0, width: panelWidth, height: '100vh',
        cursor: isDragging ? 'col-resize' : undefined,
      }

  if (!visible) return null

  const phaseLabel = {
    idle: '待命中',
    'video-upload': '▶ 视频上传',
    'cover-upload': '▶ 封面上传',
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-[99998] font-mono text-sm select-text overflow-y-auto box-border flex"
      style={{
        ...panelStyle,
        backgroundColor: '#1e1e1e',
        borderLeft: '1px solid rgba(75,85,99,0.3)',
        userSelect: isDragging ? 'none' : undefined,
      }}
    >
      {/* 左侧拖拽手柄 */}
      <div
        className="absolute left-0 top-0 w-[6px] h-full z-10 cursor-col-resize hover:bg-cyan-500/20 transition-colors shrink-0"
        style={{ marginLeft: -3, background: isDragging ? 'rgba(6,182,212,0.25)' : undefined }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      />

      <div className="flex flex-col gap-3 p-3 text-gray-100 w-full">
        {/* ═══ 标题栏 ═══ */}
        <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot active color="cyan" />
            <span className="text-cyan-400 font-bold tracking-wider text-xs uppercase">协议汇总 v6</span>
            <span className="text-gray-400 text-xs">|</span>
            <span className="text-gray-300 text-xs font-semibold">{phaseLabel[session.phase]}</span>

            {/* R2 规则状态 */}
            <span className="text-gray-600 text-xs">|</span>
            {rulesStatus === 'loading' && (
              <span className="text-gray-500 text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" />规则加载中...
              </span>
            )}
            {rulesStatus === 'synced' && (
              <span className="text-green-400 text-[10px]" title="R2 云端规则已同步">
                R2 v{cloudRules?.version || '?'}
              </span>
            )}
            {rulesStatus === 'fallback' && (
              <span className="text-orange-400 text-[10px]">本地回退</span>
            )}

            {/* 统计 */}
            <span className="text-gray-600 text-xs">|</span>
            <span className="text-cyan-400 text-[10px]">↑{uploadEntries.filter(e => e.type === 'video-upload').length}</span>
            <span className="text-purple-400 text-[10px]">▣{uploadEntries.filter(e => e.type === 'cover-upload').length}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handleReset} className="px-2 py-1 text-[10px] text-gray-400 border border-gray-600 rounded hover:border-yellow-500 hover:text-yellow-400 active:scale-95 transition-all">重置</button>
            <button onClick={() => setVisible(false)} className="px-2 py-1 text-[10px] text-gray-400 border border-gray-600 rounded hover:border-red-500 hover:text-red-400 active:scale-95 transition-all">关闭</button>
          </div>
        </div>

        {/* ═══ 会话状态卡 ═══ */}
        <div className="bg-gray-800 rounded-lg p-2.5 shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">会话资产状态</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <StatusDot active={!!session.videoUploadAuth} color="cyan" />
              <span className="text-gray-500">上传凭证</span>
              <span className={session.videoUploadAuth ? 'text-cyan-400 font-semibold' : 'text-gray-600'}>
                {session.videoUploadAuth ? '已捕获' : '等待中'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <StatusDot active={!!session.videoCid} color="cyan" />
              <span className="text-gray-500 shrink-0">cid</span>
              <span className={session.videoCid ? 'text-cyan-300 truncate font-mono' : 'text-gray-600'}>
                {session.videoCid || '—'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <StatusDot active={!!session.coverUrl} color="purple" />
              <span className="text-gray-500 shrink-0">封面</span>
              <span className={session.coverUrl ? 'text-purple-300 truncate' : 'text-gray-600'}>
                {session.coverUrl ? (session.coverUrl.length > 35 ? session.coverUrl.slice(0, 35) + '...' : session.coverUrl) : '等待中'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <StatusDot active={!!session.videoFilename} color="cyan" />
              <span className="text-gray-500 shrink-0">文件</span>
              <span className={session.videoFilename ? 'text-cyan-300 truncate' : 'text-gray-600 truncate'}>
                {session.videoFilename || '—'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              <StatusDot active={!!session.biliJct} color="yellow" />
              <span className="text-gray-500 shrink-0">bili_jct</span>
              <code className={session.biliJct ? 'text-yellow-400 font-mono text-[11px]' : 'text-gray-600'}>
                {session.biliJct ? session.biliJct.slice(0, 12) + '...' : '等待提取'}
              </code>
            </div>
          </div>
        </div>

        {/* ═══ 事件时间线 ═══ */}
        <div className="bg-gray-800 rounded-lg p-2.5 shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5">上传事件时间线</div>
          <div className="max-h-32 overflow-y-auto">
            <EventTimeline events={events} />
          </div>
        </div>

        {/* ═══ 顶层 Tab ═══ */}
        <div className="flex items-center gap-0 bg-gray-800 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setTopTab('identity')}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 ${
              topTab === 'identity' ? 'bg-yellow-500/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            🔑 身份管道
            {session.biliJct && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">已捕获</span>
            )}
          </button>
          <button
            onClick={() => setTopTab('uploads')}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 ${
              topTab === 'uploads' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            ↑ 上传监控
            {uploadEntries.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">{uploadEntries.length}</span>
            )}
          </button>
        </div>

        {/* ═══ 🔑 身份管道视图 ═══ */}
        {topTab === 'identity' && (
          <div className="bg-gray-800 rounded-lg p-2.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StatusDot active={!!session.biliJct} color="yellow" />
                <span className="text-[10px] uppercase tracking-widest text-yellow-400 font-bold">会话身份管道</span>
              </div>
              <button
                onClick={handleExtractIdentity}
                className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:shadow-[0_0_8px_rgba(234,179,8,0.2)] transition-all active:scale-95"
              >
                提取身份
              </button>
            </div>
            <CookieCard cookies={session.cookies} biliJct={session.biliJct} userAgent={session.userAgent} />
          </div>
        )}

        {/* ═══ ↑ 上传监控视图 ═══ */}
        {topTab === 'uploads' && (
          <div className="bg-gray-800 rounded-lg p-2.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StatusDot active={uploadEntries.length > 0} color="cyan" />
                <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">上传资产监控</span>
                <span className="text-[9px] text-gray-500">{uploadEntries.length} 条记录</span>
              </div>
              <span className="text-[9px] text-gray-600">preupload / cover</span>
            </div>

            {uploadEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-xs gap-2.5">
                <div className="text-gray-400 font-bold text-sm">等待上传事件</div>
                <div className="text-gray-500">在 B站创作者中心选择视频并上传后自动捕获</div>
                <div className="text-[10px] text-gray-600 space-y-0.5 bg-gray-900 rounded-lg p-2.5 mt-1">
                  <div>1. 选择视频文件 → preupload 端点捕获 cid/upload_auth</div>
                  <div>2. 上传封面 → cover/up 端点捕获 coverUrl</div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {uploadEntries.map((entry) => (
                  <UploadCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-[10px] text-gray-600 shrink-0 pb-1">
          <span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">Ctrl+Shift+Alt+P</kbd> 切换面板</span>
          <span className="ml-auto text-gray-700">YuMatrix 协议汇总引擎 v6 轻量刺客版</span>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #0d0d0d; border-radius: 3px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
        `}</style>
      </div>
    </div>
  )
}
