/**
 * @file DebugPanel.jsx
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 网络拦截器 — 隐藏上帝模式调试面板 (God Mode)
 * 触发：Ctrl+Shift+Alt+D
 * 风格：Matrix Aesthetic — 深黑底 + 荧光绿 + 暗红 Diff
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 对用户绝对隐藏，仅限开发者排查线上接口映射问题
 * 零外部依赖，纯 React + Tailwind 手搓
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'

// ═══════════════════════════════════════════
// 递归 JSON 树组件（手搓，带折叠 + Diff 高亮）
// ═══════════════════════════════════════════

/**
 * 判断一个值是否是"对象或数组"（可展开）
 */
function isExpandable(v) {
  return v !== null && typeof v === 'object'
}

/**
 * 格式化叶子节点值
 */
function formatLeaf(value) {
  if (value === null) return { text: 'null', cls: 'text-slate-500' }
  if (value === undefined) return { text: 'undefined', cls: 'text-slate-600' }
  if (typeof value === 'string') return { text: `"${value}"`, cls: 'text-emerald-400' }
  if (typeof value === 'number') return { text: String(value), cls: 'text-cyan-400' }
  if (typeof value === 'boolean') return { text: String(value), cls: 'text-yellow-400' }
  return { text: String(value), cls: 'text-slate-300' }
}

/**
 * Diff 色彩映射
 * 新增 → 荧光绿底  旧值 → 暗红底  相同 → 无色
 */
function diffColor(key, before, after, side) {
  if (before === undefined && after !== undefined) {
    return side === 'after' ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''
  }
  if (before !== undefined && after === undefined) {
    return side === 'before' ? 'bg-red-500/10 border-l-2 border-red-500' : ''
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    return side === 'after'
      ? 'bg-emerald-500/5 border-l-2 border-emerald-400'
      : 'bg-red-500/5 border-l-2 border-red-400'
  }
  return ''
}

/**
 * JsonTreeNode — 递归渲染带 Diff 高亮的 JSON 树
 */
function JsonTreeNode({ nodeKey, value, depth, before, after, side }) {
  const [open, setOpen] = useState(depth < 2)
  const expandable = isExpandable(value)

  const dc = side ? diffColor(nodeKey, before, after, side) : ''
  const leaf = !expandable ? formatLeaf(value) : null

  if (!expandable) {
    return (
      <div className={`flex items-start py-0.5 px-1 rounded-sm ${dc}`}
           style={{ paddingLeft: `${depth * 16 + 4}px` }}>
        {nodeKey !== undefined && (
          <span className="text-slate-500 mr-1.5 select-none">{nodeKey}:</span>
        )}
        <span className={leaf.cls}>{leaf.text}</span>
      </div>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [i, v])
    : Object.entries(value)

  return (
    <div>
      <div
        className={`flex items-center py-0.5 px-1 cursor-pointer hover:bg-white/5 rounded-sm ${dc}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-slate-600 mr-1 text-xs select-none w-3 text-center">
          {open ? '▼' : '▶'}
        </span>
        {nodeKey !== undefined && (
          <span className="text-slate-500 mr-1.5">{nodeKey}:</span>
        )}
        <span className="text-slate-500 text-xs">
          {Array.isArray(value) ? `[${value.length}]` : `{${entries.length}}`}
        </span>
      </div>
      {open && entries.map(([k, v]) => {
        const bVal = before && typeof before === 'object' ? before[k] : undefined
        const aVal = after && typeof after === 'object' ? after[k] : undefined
        return (
          <JsonTreeNode
            key={k}
            nodeKey={k}
            value={v}
            depth={depth + 1}
            before={bVal}
            after={aVal}
            side={side}
          />
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// 数据显微镜（右侧面板）
// ═══════════════════════════════════════════

function DataMicroscope({ log }) {
  if (!log) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-sm">
        <span className="animate-pulse">&lt; 点击左侧日志条目查看详情 &gt;</span>
      </div>
    )
  }

  let beforeObj = null
  let afterObj = null
  try { beforeObj = JSON.parse(log.before) } catch {}
  try { afterObj = JSON.parse(log.after) } catch {}

  // 计算 Diff 统计
  const allKeys = new Set([
    ...Object.keys(beforeObj || {}),
    ...Object.keys(afterObj || {}),
  ])
  let added = 0, removed = 0, modified = 0
  for (const k of allKeys) {
    const b = beforeObj?.[k]
    const a = afterObj?.[k]
    if (b === undefined && a !== undefined) added++
    else if (b !== undefined && a === undefined) removed++
    else if (JSON.stringify(b) !== JSON.stringify(a)) modified++
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶栏统计 — 窄屏适配 */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800/80 text-[10px] font-mono shrink-0">
        <span className="text-slate-500 truncate max-w-[40%]">{log.url}</span>
        <span className="ml-auto text-emerald-500">+{added}</span>
        <span className="text-red-400">-{removed}</span>
        <span className="text-yellow-400">~{modified}</span>
      </div>

      {/* 双栏对比 — 窄屏改为上下排布 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Before */}
        <div className="h-[45%] overflow-y-auto p-1.5 border-b border-slate-800/50">
          <div className="text-[9px] uppercase tracking-widest text-red-400/60 font-bold mb-1 px-0.5">
            原始 (Before)
          </div>
          {beforeObj ? (
            <JsonTreeNode value={beforeObj} depth={0} before={beforeObj} after={afterObj} side="before" />
          ) : (
            <span className="text-slate-600 text-[10px] font-mono">解析失败</span>
          )}
        </div>

        {/* After */}
        <div className="flex-1 overflow-y-auto p-1.5">
          <div className="text-[9px] uppercase tracking-widest text-emerald-400/60 font-bold mb-1 px-0.5">
            篡改后 (After)
          </div>
          {afterObj ? (
            <JsonTreeNode value={afterObj} depth={0} before={beforeObj} after={afterObj} side="after" />
          ) : (
            <span className="text-slate-600 text-[10px] font-mono">解析失败</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// 主面板
// ═══════════════════════════════════════════

export default function DebugPanel({ browserViewRect }) {
  const [visible, setVisible] = useState(false)
  const [logs, setLogs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [ruleCount, setRuleCount] = useState(0)
  const [ruleVersion, setRuleVersion] = useState('-')
  const terminalRef = useRef(null)

  // ─── 通知主进程: 面板打开 → BrowserView 向左缩进，面板关闭 → BrowserView 恢复全宽 ───
  useEffect(() => {
    const electron = typeof window !== 'undefined' && window.electron ? window.electron : { ipcRenderer: { invoke: () => Promise.resolve() } }
    if (visible) {
      electron.ipcRenderer.invoke('debug-panel-visibility', { visible: true, panelWidth: Math.round(window.innerWidth * 0.4) }).catch(() => {})
    } else {
      electron.ipcRenderer.invoke('debug-panel-visibility', { visible: false }).catch(() => {})
    }
  }, [visible])

  // ─── 主进程 IPC 热键监听 (替代 window keydown — BrowserView 抢占焦点时不失效) ───
  useEffect(() => {
    const getElectron = () => {
      if (typeof window !== 'undefined' && window.electron) return window.electron;
      return { ipcRenderer: { on: () => {}, removeAllListeners: () => {} } };
    };
    const electron = getElectron();
    const cleanup = electron.ipcRenderer.on('hotkey-toggle-debug-panel', () => {
      setVisible(v => !v);
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  // ─── Esc 关闭 ───
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible]);

  // ─── 首次显示时拉取规则版本 (v4 兼容) ───
  useEffect(() => {
    if (!visible) return
    if (window.interceptorAPI) {
      const debug = window.interceptorAPI.getDebug();
      if (debug?.rules) {
        setRuleVersion(debug.rules.version || '-');
        setRuleCount(debug.rules.platforms?.length || 0);
      }
    }
  }, [visible])

  // ─── 实时日志监听（替换轮询，使用黑匣子补收+实时推送）───
  useEffect(() => {
    if (!visible) return

    // Step 7: 先从主进程黑匣子补收历史日志 (v4: 使用 getAllLogs 通过 IPC 获取)
    const fetchHistoricalLogs = async () => {
      if (window.interceptorAPI && window.interceptorAPI.getAllLogs) {
        try {
          const historicalLogs = await window.interceptorAPI.getAllLogs()
          if (Array.isArray(historicalLogs) && historicalLogs.length > 0) {
            const adaptedLogs = historicalLogs.map(log => ({
              id: log.id,
              ts: log.time,
              url: log.url,
              platform: '',
              before: JSON.stringify(log.diff?.before || {}),
              after: JSON.stringify(log.diff?.after || {})
            }))
            setLogs(adaptedLogs)
          }
        } catch (e) {
          console.error('[DebugPanel] 获取历史日志失败:', e)
        }
      }
    }

    fetchHistoricalLogs()

    // 使用 getLogs() 本地缓存 (v4 精简 API) 作为历史日志
    if (window.interceptorAPI) {
      const localLogs = window.interceptorAPI.getLogs() || [];
      if (localLogs.length > 0) {
        const adaptedLogs = localLogs.map(log => ({
          id: log.id, ts: log.time, url: log.url, platform: '',
          before: JSON.stringify(log.diff?.before || {}),
          after: JSON.stringify(log.diff?.after || {})
        }));
        setLogs(adaptedLogs);
      }
    }

    // 实时监听
    const cleanupCallback = (logItem) => {
      const exists = logs.some(l => l.id === logItem.id)
      if (!exists) {
        setLogs(prevLogs => {
          const newLogs = [{ id: logItem.id, ts: logItem.time, url: logItem.url, platform: '', before: JSON.stringify(logItem.diff?.before || {}), after: JSON.stringify(logItem.diff?.after || {}) }, ...prevLogs].slice(0, 50)
          return newLogs
        })
      }
    }

    if (window.interceptorAPI) {
      window.interceptorAPI.onRealtimeLog(cleanupCallback)
    }

    return () => {
      if (window.interceptorAPI) {
        window.interceptorAPI.clearRealtimeLogListener()
      }
    }
  }, [visible])

  // ─── 终端自动滚底 ───
  useEffect(() => {
    if (terminalRef.current) {
      // 由于最新日志在上方（unshift），此处保持默认即可，如需控制滚动条可以在此扩展
    }
  }, [logs])

  // ─── 内置沙盒点火器 (v4: 已移除 fetchWithInterceptor, 改为直接嗅探演示) ───
  const fireTestRequest = async () => {
    const testBody = JSON.stringify({ title: "测试嗅探", author: "YuMatrix", time: Date.now() });
    // 在渲染进程发个 fetch，由主世界拦截器捕获并记录日志
    try {
      await fetch('https://member.bilibili.com/x/vu/web/add/v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: testBody
      });
    } catch (e) {
      // CORS 被阻止是正常的，拦截器已经在主世界捕获了请求
      console.log('[DebugPanel] 嗅探请求已发出 (预期 CORS 错误):', e.message);
    }
  };

  const selectedLog = useMemo(
    () => logs.find(l => l.id === selectedId) || null,
    [logs, selectedId],
  )

  // 面板定位：与 BrowserView 容器顶部对齐、高度一致，贴右边界
  const panelStyle = browserViewRect
    ? {
        top: `${browserViewRect.top}px`,
        height: `${browserViewRect.height}px`,
        width: `${Math.round(browserViewRect.width * 0.4)}px`,
        right: 0
      }
    : { right: 0, top: 0, width: '40%', height: '100vh' }

  if (!visible) return null

  return (
    <div className="fixed z-[99999] flex flex-col font-mono text-sm select-text"
         style={{ ...panelStyle, backgroundColor: "#0a0a0a", borderLeft: "1px solid rgba(30,41,59,0.8)", boxSizing: "border-box" }}>
      {/* ═══ 标题栏 ═══ */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-emerald-500 font-bold tracking-widest text-[10px] uppercase shrink-0">
            ▓▓ 上帝模式 ▓▓
          </span>
          <span className="text-slate-600 text-[10px] hidden sm:inline shrink-0">
            v{ruleVersion}
          </span>
          <span className="text-cyan-600 text-[10px] hidden sm:inline shrink-0">{ruleCount}条</span>
          <span className="text-slate-500 text-[10px] shrink-0">{logs.length}条记录</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={fireTestRequest}
            className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white bg-red-600 border border-red-500 rounded hover:bg-red-500 active:scale-95 transition-all"
          >
            🔥 点火
          </button>
          <button
            onClick={async () => {
              // v4 兼容：通过本地缓存获取规则信息
              if (window.interceptorAPI) {
                const debug = window.interceptorAPI.getDebug();
                if (debug?.rules) {
                  setRuleCount(debug.rules.platforms?.length || 0);
                  setRuleVersion(debug.rules.version || '-');
                }
              }
            }}
            className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-400 border border-slate-700 rounded hover:border-emerald-500 hover:text-emerald-400 active:scale-95 transition-all"
          >
            刷新
          </button>
          <button
            onClick={() => setVisible(false)}
            className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-400 border border-slate-700 rounded hover:border-red-500 hover:text-red-400 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      {/* ═══ 主体：40%窄屏改为纵向排布 ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── 日志流（上 35%）── */}
        <div className="h-[35%] border-b border-slate-800/50 flex flex-col">
          <div className="px-2 py-1 border-b border-slate-800/40 text-[10px] uppercase tracking-widest text-slate-600 font-bold shrink-0">
            &gt;_ 拦截日志流
          </div>
          <div ref={terminalRef} className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {logs.length === 0 && (
              <div className="text-slate-700 text-[10px] text-center mt-6">
                等待拦截请求中...
              </div>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedId(log.id)}
                className={`
                  px-1.5 py-0.5 rounded-sm cursor-pointer text-[10px] leading-tight transition-colors
                  ${selectedId === log.id
                    ? 'bg-emerald-500/15 border-l-2 border-emerald-400 text-emerald-300'
                    : 'hover:bg-white/5 text-slate-400 border-l-2 border-transparent'}
                `}
              >
                <span className="text-slate-600">[{log.ts}]</span>
                <span className="text-emerald-500 ml-1">[MATCH]</span>
                <span className="text-slate-300 ml-1 truncate inline-block align-bottom max-w-[100px]">
                  {log.platform || log.url?.slice(0, 30)}
                </span>
                <span className="text-cyan-600 ml-1">&rarr;</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 数据显微镜（下 65%）── */}
        <div className="flex-1 flex flex-col">
          <div className="px-2 py-1 border-b border-slate-800/40 text-[10px] uppercase tracking-widest text-slate-600 font-bold shrink-0">
            🔬 数据显微镜 — 篡改前后对比
          </div>
          <DataMicroscope log={selectedLog} />
        </div>
      </div>

      {/* ═══ 底栏快捷键提示 ═══ */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-950 border-t border-slate-800/40 text-[10px] text-slate-700 shrink-0">
        <span><kbd className="bg-slate-800 px-1 rounded">Ctrl+Shift+Alt+D</kbd> 切换面板</span>
        <span><kbd className="bg-slate-800 px-1 rounded">Esc</kbd> 关闭</span>
        <span className="ml-auto text-slate-800">YuMatrix 网络拦截器 — 上帝模式调试面板</span>
      </div>
    </div>
  )
}