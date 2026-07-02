import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, XCircle, RefreshCw, Edit, FolderTree, Eye, X, Chrome, Shield,
  MousePointerClick, Pause, Play, Activity, Clock, AlertTriangle, RotateCw
} from 'lucide-react';
import { toMatrixMediaUrl } from '../utils/safePath';
import EngineStatusIndicator from './EngineStatusIndicator';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return { ipcRenderer: { invoke: async () => ({ success: false, message: '非原生环境' }), send: () => {} } };
};

/** 格式化耗时 mm:ss 或 hh:mm:ss */
const formatDuration = (startMs, endMs) => {
  if (!startMs) return '—';
  const end = endMs || Date.now();
  const diff = Math.max(0, end - startMs);
  const secs = Math.floor(diff / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** 平台色映射 */
const PLATFORM_COLORS = {
  '抖音': 'bg-[#fe2c55]', '小红书': 'bg-[#ff2442]', 'B站': 'bg-[#fb7299]',
  '微信视频号': 'bg-[#07C160]', '快手': 'bg-[#FF7700]', '知乎': 'bg-[#0066ff]',
  '微博': 'bg-[#ff8200]', '百家号': 'bg-[#2b88ff]', '企鹅号(腾讯)': 'bg-[#00A4FF]',
  '腾讯视频': 'bg-[#00A4FF]', '大鱼号(优酷)': 'bg-[#FF6600]', '爱奇艺号': 'bg-emerald-600'
};

export default function PublishHistoryView({ videoList, setVideoList, publishHistory, setPublishHistory, setActiveTab, setActiveVideoId, setPublishStep, accounts = [] }) {
  const electron = getElectron();

  // ─── 队列统计 ───
  const [stats, setStats] = useState({ queued: 0, running: 0, paused: false, runningPlatforms: [], concurrencyLimit: 3 });
  const [sysInfo, setSysInfo] = useState(null);  // 🆕 系统诊断
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await electron.ipcRenderer.invoke('get-task-stats');
        setStats(s);
      } catch {}
    };
    // 🆕 系统信息只取一次，不变
    electron.ipcRenderer.invoke('get-system-info').then(setSysInfo).catch(() => {});
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  // ─── 监控面板状态 ───
  const [monitorState, setMonitorState] = useState({
    isOpen: false,
    taskId: null,
    title: '',
    platform: ''
  });

  const dockingZoneRef = useRef(null);

  // 💥 核心逻辑：向主进程发送后台预览面板的坐标
  useEffect(() => {
    if (monitorState.isOpen && dockingZoneRef.current) {
      const updateBounds = () => {
        const rect = dockingZoneRef.current.getBoundingClientRect();
        electron.ipcRenderer.send('attach-robot-view', {
          taskId: monitorState.taskId,
          bounds: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
        });
      };
      setTimeout(updateBounds, 300);
      window.addEventListener('resize', updateBounds);
      return () => {
        window.removeEventListener('resize', updateBounds);
        electron.ipcRenderer.send('detach-robot-view');
      };
    }
  }, [monitorState.isOpen, monitorState.taskId]);

  // ─── 操作 ───

  // 🆕 过滤掉已删除平台的账号（只保留当前有效账号）
  const filterValidAccounts = (targetAccounts) => {
    if (!targetAccounts || !Array.isArray(targetAccounts)) return targetAccounts;
    // 获取所有有效平台的账号字符串
    const validAccountStrs = accounts.map(a => `${a.id}|${a.platform}|${a.alias}`);
    // 只保留 targetAccounts 中存在于有效账号的项
    return targetAccounts.filter(acc => validAccountStrs.includes(acc));
  };

  const handleReEdit = (hist) => {
    setVideoList(prev => {
      const exists = prev.find(v => v.id === hist.videoId);
      if (exists) {
        return prev.map(v => v.id === hist.videoId
          ? {
              ...v,
              status: '已就绪',
              url: v.url || toMatrixMediaUrl(v.path),
              // 🆕 过滤掉已删除平台的账号
              config: {
                ...v.config,
                targetAccounts: filterValidAccounts(v.config.targetAccounts)
              }
            }
          : v);
      }
      if (hist._videoSnapshot) {
        return [...prev, {
          ...hist._videoSnapshot,
          status: '已就绪',
          url: toMatrixMediaUrl(hist._videoSnapshot.path),
          // 🆕 过滤掉已删除平台的账号
          config: {
            ...hist._videoSnapshot.config,
            targetAccounts: filterValidAccounts(hist._videoSnapshot.config.targetAccounts)
          }
        }];
      }
      return prev;
    });
    setActiveVideoId(hist.videoId);
    setPublishStep(2);
    setActiveTab('publish');
  };

  // 重发：先取消旧任务，跳转到配置界面让用户重新确认
  const handleRetry = async (hist) => {
    try {
      // 🆕 先取消旧任务（如果有活跃浏览器）
      if (hist.historyId) {
        await electron.ipcRenderer.invoke('cancel-publish-task', hist.historyId).catch(() => {});
        // 等待浏览器关闭
        await new Promise(r => setTimeout(r, 1000));
      }

      // 剔除旧状态字段，只保留任务数据
      const { status, time, startTime, endTime, error, statusType, message, historyId, videoId, ...taskData } = hist;

      // 🆕 跳转到配置页，让用户重新确认任务
      setVideoList(prev => {
        const exists = prev.find(v => v.id === videoId);
        if (exists) {
          return prev.map(v => v.id === videoId
            ? {
                ...v,
                status: '已就绪',
                url: v.url || toMatrixMediaUrl(v.path),
                // 🆕 过滤掉已删除平台的账号
                config: {
                  ...v.config,
                  targetAccounts: filterValidAccounts(v.config.targetAccounts)
                }
              }
            : v);
        }
        if (hist._videoSnapshot) {
          return [...prev, {
            ...hist._videoSnapshot,
            status: '已就绪',
            url: toMatrixMediaUrl(hist._videoSnapshot.path),
            // 🆕 过滤掉已删除平台的账号
            config: {
              ...hist._videoSnapshot.config,
              targetAccounts: filterValidAccounts(hist._videoSnapshot.config.targetAccounts)
            }
          }];
        }
        return prev;
      });

      setActiveVideoId(videoId);
      setPublishStep(2);  // 跳转到配置页
      setActiveTab('publish');

    } catch (e) {
      console.error('[重发失败]', e);
    }
  };

  // 删除记录时，如有活跃浏览器则强制关闭
  const handleDelete = async (hist) => {
    const hasBrowser = ['运行中', '已转手动接管', '已终止', '手动发布完成中...', '任务失败'].includes(hist.status);
    if (hasBrowser) {
      try {
        await electron.ipcRenderer.invoke('force-close-manual-publish', hist.historyId);
      } catch (e) { /* 浏览器可能已关闭，忽略 */ }
    }
    setPublishHistory(prev => prev.filter(h => h.historyId !== hist.historyId));
  };

  const handleCancel = async (historyId) => {
    // v3: 乐观 UI — 立即标记为"已终止"
    setPublishHistory(prev => prev.map(item =>
      item.historyId === historyId
        ? { ...item, status: '已取消', statusType: 'cancelled', endTime: Date.now() }
        : item
    ));
    try {
      const res = await electron.ipcRenderer.invoke('cancel-publish-task', historyId);
      if (!res.success) {
        console.warn('[终止]', res.message);
      }
    } catch (e) {
      console.error('[终止] IPC 失败:', e);
    }
  };

  /** v3: 紧急停止全部 — 毙掉所有运行中任务 */
  const handleEmergencyStopAll = async () => {
    try {
      const res = await electron.ipcRenderer.invoke('emergency-stop-all');
      console.log('[紧急停止] 已终止 ' + res.stopped + ' 个任务');
    } catch (e) {
      console.error('[紧急停止] IPC 失败:', e);
    }
  };

  /** 🆕 步骤失败 → 用户手动完成后点"继续"，RPA 从断点恢复 */
  const handleContinueManualStep = async (historyId) => {
    try {
      const res = await electron.ipcRenderer.invoke('continue-after-manual-step', historyId);
      if (!res.success) {
        console.warn('[继续]', res.message);
      }
    } catch (e) {
      console.error('[继续] IPC 失败:', e);
    }
  };

  /** 🆕 完成手动发布 — 用户手动操作完毕后关闭浏览器 */
  const handleCompleteManual = async (historyId, forceClose = false) => {
    const targetStatus = forceClose ? '已取消' : '手动发布完成中...';
    setPublishHistory(prev => prev.map(item =>
      item.historyId === historyId
        ? { ...item, status: targetStatus, endTime: Date.now() }
        : item
    ));
    try {
      if (forceClose) {
        await electron.ipcRenderer.invoke('force-close-manual-publish', historyId);
      } else {
        await electron.ipcRenderer.invoke('complete-manual-publish', historyId);
      }
    } catch (e) {
      console.error('[手动发布] IPC 失败:', e);
    }
  };

  const handlePauseResume = async () => {
    try {
      if (stats.paused) {
        await electron.ipcRenderer.invoke('resume-task-queue');
      } else {
        await electron.ipcRenderer.invoke('pause-task-queue');
      }
    } catch {}
  };

  const handleInAppMonitor = (hist) => {
    setMonitorState({
      isOpen: true,
      taskId: hist.historyId,
      title: `${hist.platform} · ${hist.accountAlias} (${hist.videoName})`,
      platform: hist.platform
    });
  };

  const getCoverSrc = (videoId) => {
    const video = videoList.find(v => v.id === videoId);
    return video?.config?.universal?.coverUrl || video?.config?.universal?.coverPath || null;
  };

  // ─── 选择清理 ───
  const toggleSelect = (historyId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(historyId) ? next.delete(historyId) : next.add(historyId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const clearable = publishHistory.filter(h => !['任务圆满成功', '任务成功', '任务失败', '已取消', '任务已取消', '已转手动接管', '手动发布已完成', '需要重新扫码登录'].includes(h.status));
    if (clearable.length === 0) return;
    const allSelected = clearable.every(h => selectedIds.has(h.historyId));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clearable.map(h => h.historyId)));
    }
  };

  const handleClearSelected = async () => {
    if (selectedIds.size === 0) return;
    // 先关闭有活跃浏览器的任务
    const activeStatuses = ['运行中', '已转手动接管', '已终止', '手动发布完成中...'];
    for (const hist of publishHistory) {
      if (selectedIds.has(hist.historyId) && activeStatuses.includes(hist.status)) {
        try { await electron.ipcRenderer.invoke('force-close-manual-publish', hist.historyId); } catch (e) {}
      }
    }
    setPublishHistory(prev => prev.filter(h => !selectedIds.has(h.historyId)));
    setSelectedIds(new Set());
  };

  // ─── 分类 ───
  const runningTasks = publishHistory.filter(h => !['任务圆满成功', '任务成功', '任务失败', '已取消', '任务已取消', '已转手动接管', '手动发布已完成', '需要重新扫码登录'].includes(h.status));
  const manualTasks = publishHistory.filter(h => ['已转手动接管', '需要重新扫码登录'].includes(h.status));
  const completedTasks = publishHistory.filter(h => ['任务圆满成功', '任务成功', '手动发布已完成'].includes(h.status));
  const failedTasks = publishHistory.filter(h => ['任务失败'].includes(h.status));
  const cancelledTasks = publishHistory.filter(h => ['已取消', '任务已取消'].includes(h.status));

  return (
    <div className="h-full relative flex flex-col max-w-7xl mx-auto animate-in fade-in pb-10">

      {/* ─── 顶部控制条 ─── */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center">
              <Activity className="mr-2 text-indigo-600" size={22} />
              发布队列与控制中心
            </h2>
            <div className="flex gap-3 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                队列 {stats.queued}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                运行中 {stats.running}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                已完成 {completedTasks.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 🆕 并发槽位指示器 + 诊断提示 */}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {Array.from({ length: stats.concurrencyLimit || 3 }, (_, slot) => {
                  const active = slot < stats.running;
                  const platformEntry = stats.runningPlatforms?.[slot] || '';
                  const platform = platformEntry.split('|')[1] || '';
                  return (
                    <div
                      key={slot}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black border transition-all ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-md animate-pulse'
                          : 'bg-slate-100 text-slate-300 border-slate-200'
                      }`}
                      title={active ? `运行中: ${platform}` : '空闲槽位'}
                    >
                      {active ? (platform?.[0] || '●') : slot + 1}
                    </div>
                  );
                })}
              </div>
              {/* 🆕 诊断 tooltip */}
              {sysInfo && (
                <div className="relative group">
                  <div className="w-5 h-5 rounded-full bg-slate-200 hover:bg-indigo-100 flex items-center justify-center cursor-help text-[10px] font-black text-slate-500 hover:text-indigo-600 transition">
                    ?
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] pointer-events-none">
                    <div className="font-black text-sm mb-1.5">⚡ 智能并发分配</div>
                    <div className="space-y-0.5 text-slate-300">
                      <div className="flex justify-between"><span>CPU</span> <span className="text-white font-bold">{sysInfo.cpuCores} 核</span></div>
                      <div className="flex justify-between"><span>内存</span> <span className="text-white font-bold">{sysInfo.totalMemGB} GB</span></div>
                      <div className="flex justify-between"><span>可用</span> <span className="text-white font-bold">{sysInfo.freeMemGB} GB</span></div>
                      <hr className="border-slate-700 my-1" />
                      <div className="flex justify-between"><span>内存槽位</span> <span>{sysInfo.breakdown.memSlots}</span></div>
                      <div className="flex justify-between"><span>CPU 槽位</span> <span>{sysInfo.breakdown.cpuSlots}</span></div>
                      <hr className="border-slate-700 my-1" />
                      <div className="flex justify-between text-indigo-300">
                        <span>最终并发</span>
                        <span className="font-black text-sm">{sysInfo.concurrencyLimit} 个</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5 leading-tight">
                      公式: min(5, 内存槽, CPU槽) ≤ 5<br />
                      每窗口 ~{sysInfo.breakdown.perBrowserMB}MB · 预留 {sysInfo.breakdown.reserveGB}GB
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-0 w-3 h-3 bg-slate-900 rotate-45"></div>
                  </div>
                </div>
              )}
            </div>

            {/* 🆕 暂停/恢复 */}
            <button
              onClick={handlePauseResume}
              className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm active:scale-95 ${
                stats.paused
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {stats.paused ? <><Play size={14} /> 恢复调度</> : <><Pause size={14} /> 暂停调度</>}
            </button>

            {/* v3: 全部终止 */}
            {stats.running > 0 && (
              <button
                onClick={handleEmergencyStopAll}
                className="px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm active:scale-95 bg-red-600 text-white hover:bg-red-700"
              >
                <XCircle size={14} /> 全部终止
              </button>
            )}
          </div>
        </div>

        {stats.paused && (
          <div className="mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-700 flex items-center gap-2">
            <Pause size={12} />
            队列调度已暂停 — 当前运行中的任务将继续完成，新任务暂不入队
          </div>
        )}
      </div>

      {/* 🆕 选中批量清理栏 */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-bold text-indigo-700">
            已选 <span className="text-indigo-900 text-base">{selectedIds.size}</span> 条记录
          </span>
          <button
            onClick={handleClearSelected}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-bold text-xs flex items-center shadow-sm active:scale-95"
          >
            <XCircle size={13} className="mr-1" /> 清除选中记录
          </button>
        </div>
      )}

      {/* ─── 数据表格 ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-bold w-[4%]">
                  <input
                    type="checkbox"
                    checked={publishHistory.filter(h => !['任务圆满成功', '任务成功', '任务失败', '已取消', '任务已取消', '已转手动接管', '手动发布已完成', '需要重新扫码登录'].includes(h.status)).length > 0 && publishHistory.filter(h => !['任务圆满成功', '任务成功', '任务失败', '已取消', '任务已取消', '已转手动接管', '手动发布已完成', '需要重新扫码登录'].includes(h.status)).every(h => selectedIds.has(h.historyId))}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-4 font-bold w-[26%]">分发内容</th>
                <th className="p-4 font-bold w-[16%]">目标平台</th>
                <th className="p-4 font-bold w-[8%]">发布时间</th>
                <th className="p-4 font-bold w-[8%]">耗时</th>
                <th className="p-4 font-bold w-[18%]">实时状态</th>
                <th className="p-4 font-bold text-right w-[22%]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {publishHistory.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-20 text-center">
                    <FolderTree size={48} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400 font-bold text-base">引擎待命中，尚未产生发布记录</p>
                  </td>
                </tr>
              )}

              {publishHistory.map(hist => {
                const coverSrc = hist.coverPath || getCoverSrc(hist.videoId);
                const isRunning = !['任务圆满成功', '任务成功', '任务失败', '已取消', '任务已取消', '已终止', '已转手动接管', '手动发布已完成', '需要重新扫码登录'].includes(hist.status);
                const isManual = hist.status === '已转手动接管';
                const isStepNeedsManual = hist.statusType === 'step_needs_manual';  // 🆕 步骤失败暂停等手动
                const needsRelogin = hist.status === '需要重新扫码登录';
                const isSuccess = ['任务圆满成功', '任务成功', '手动发布已完成'].includes(hist.status);
                const isFailed = hist.status === '任务失败';
                const isCancelled = ['已取消', '任务已取消', '已终止'].includes(hist.status);
                const duration = formatDuration(hist.startTime, hist.endTime);
                const platformBg = PLATFORM_COLORS[hist.platform] || 'bg-slate-600';

                return (
                  <tr key={hist.historyId} className={`transition-colors ${isRunning ? 'bg-indigo-50/20' : isFailed ? 'bg-red-50/20' : 'hover:bg-slate-50'}`}>
                    {/* 🆕 勾选 */}
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(hist.historyId)}
                        onChange={() => toggleSelect(hist.historyId)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    {/* 封面 + 文件名 + 标题 */}
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="relative w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
                          {coverSrc ? (
                            coverSrc.startsWith('data:') ? (
                              <img src={coverSrc} alt="cover" className="w-full h-full object-cover" />
                            ) : (
                              <img src={toMatrixMediaUrl(coverSrc)} alt="cover" className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            )
                          ) : null}
                          <div className={`w-full h-full items-center justify-center text-slate-300 ${coverSrc ? 'hidden' : 'flex'}`}>
                            <Chrome size={18} />
                          </div>
                          {isRunning && <div className="absolute inset-0 border-[3px] border-indigo-400 rounded-lg animate-pulse pointer-events-none"></div>}
                        </div>
                        <div className="flex flex-col min-w-[140px]">
                          {hist.title && (
                            <span className="font-black text-slate-900 text-sm truncate leading-tight" title={hist.title}>
                              {hist.title}
                            </span>
                          )}
                          <span className={`font-mono truncate ${hist.title ? 'text-[10px] text-slate-400' : 'font-bold text-slate-800 text-xs'}`} title={hist.videoName}>
                            {hist.videoName}
                          </span>
                          <span className="text-[10px] text-slate-300 mt-0.5 font-mono">{hist.videoId?.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>

                    {/* 平台 + 账号 */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 ${platformBg} rounded-md flex items-center justify-center text-white text-[10px] font-black flex-shrink-0`}>
                          {hist.platform?.[0]}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-slate-700">{hist.platform}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[80px]" title={hist.accountAlias}>{hist.accountAlias}</span>
                        </div>
                      </div>
                    </td>

                    {/* 时间 */}
                    <td className="p-4 text-slate-500 font-mono text-xs whitespace-nowrap">{hist.time}</td>

                    {/* 🆕 耗时 */}
                    <td className="p-4">
                      {isRunning ? (
                        <span className="text-indigo-500 font-mono text-xs flex items-center gap-1">
                          <Clock size={12} className="animate-pulse" /> {duration}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs">{duration}</span>
                      )}
                    </td>

                    {/* 🆕 状态 + 错误原因 */}
                    <td className="p-4">
                      <EngineStatusIndicator
                        engineType={hist.engineType || 'embedded'}
                        status={hist.statusType || hist.status}
                        message={hist.message}
                      />
                      {(hist.message && hist.message !== hist.status) || hist.errorMessage ? (
                        <div className="mt-1">
                          <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={hist.message || hist.errorMessage}>
                            {hist.message || hist.errorMessage}
                          </span>
                        </div>
                      ) : null}
                    </td>

                    {/* 🆕 操作 */}
                    <td className="p-4 text-right">
                      {isRunning ? (
                        <div className="flex items-center justify-end gap-2">
                          {isStepNeedsManual && (
                            <button
                              onClick={() => handleContinueManualStep(hist.historyId)}
                              className="text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-md active:scale-95 animate-pulse"
                            >
                              <CheckCircle size={13} className="mr-1" /> 继续
                            </button>
                          )}
                          <button
                            onClick={() => handleInAppMonitor(hist)}
                            className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-md active:scale-95"
                          >
                            <MousePointerClick size={13} className="mr-1" /> 控制
                          </button>
                          <button
                            onClick={() => handleCancel(hist.historyId)}
                            className="text-red-600 bg-white hover:bg-red-50 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-sm active:scale-95"
                          >
                            <XCircle size={13} className="mr-1" /> 终止
                          </button>
                        </div>
                      ) : (isManual || needsRelogin) ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleInAppMonitor(hist)}
                            className={`text-white px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-md active:scale-95 ${
                              needsRelogin ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            <MousePointerClick size={13} className="mr-1" /> 控制
                          </button>
                          {needsRelogin && (
                            <button
                              onClick={() => handleCompleteManual(hist.historyId, true)}
                              className="text-red-600 bg-white hover:bg-red-50 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-sm active:scale-95"
                            >
                              <XCircle size={13} className="mr-1" /> 放弃
                            </button>
                          )}
                          {isManual && (
                            <button
                              onClick={() => handleCompleteManual(hist.historyId)}
                              className="text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-md active:scale-95"
                            >
                              <CheckCircle size={13} className="mr-1" /> 完成手动发布
                            </button>
                          )}
                        </div>
                      ) : (isFailed || isCancelled) ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRetry(hist)}
                            className="text-emerald-600 bg-white hover:text-emerald-800 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-sm active:scale-95"
                          >
                            <RotateCw size={12} className="mr-1" /> 重发
                          </button>
                          <button
                            onClick={() => handleReEdit(hist)}
                            className="text-indigo-600 bg-white hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-sm active:scale-95"
                          >
                            <Edit size={12} className="mr-1" /> 重新配置补发
                          </button>
                          <button
                            onClick={() => handleDelete(hist)}
                            className="text-red-500 bg-white hover:bg-red-50 border border-red-200 hover:border-red-400 px-2.5 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-sm active:scale-95"
                            title="从列表中删除"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDelete(hist)}
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition font-bold text-xs flex items-center shadow-sm active:scale-95"
                          title="从列表中删除"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 内嵌后台预览面板 ─── */}
      {monitorState.isOpen && (
        <div className="absolute inset-0 bg-white z-50 rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
          <div className="h-14 bg-slate-900 text-white flex items-center justify-between px-4 flex-shrink-0 shadow-md">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-lg mr-3 shadow-inner shadow-white/20">
                {monitorState.platform[0]}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm truncate max-w-sm text-emerald-400">正在显示实时运行环境</span>
                <span className="text-[10px] text-slate-300 flex items-center mt-0.5">
                  <Shield size={10} className="mr-1" /> 你可以直接在此窗口进行点击或滑动验证码，机器人将自动顺延执行。
                </span>
              </div>
            </div>
            <button
              onClick={() => setMonitorState({ ...monitorState, isOpen: false })}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-md flex items-center font-bold text-xs"
            >
              <X size={14} className="mr-1" /> 退出控制并隐藏
            </button>
          </div>
          <div ref={dockingZoneRef} className="flex-1 bg-slate-100 w-full h-full relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw size={40} className="animate-spin mb-4 opacity-50" />
              <p className="font-bold tracking-widest text-sm">正在将底层 RPA 后台画面吸附至此窗口...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
