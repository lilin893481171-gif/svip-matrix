/**
 * @file TaskStatusMonitor.jsx
 * 任务状态监控器 — 实时显示正在执行的任务状态
 * 数据源: IPC 'task-progress-update' 事件
 */
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Upload, FileText, Send, X, ChevronDown, ChevronUp } from 'lucide-react';
import getElectron from '../utils/electron';

const STATUS_MAP = {
  pending:              { icon: Clock,          color: 'text-gray-400 bg-gray-100',       label: '等待开始' },
  starting:             { icon: Clock,          color: 'text-blue-400 bg-blue-100',        label: '启动中' },
  navigating:           { icon: Clock,          color: 'text-blue-400 bg-blue-100',        label: '页面导航' },
  scanning_ui:          { icon: Clock,          color: 'text-blue-400 bg-blue-100',        label: '扫描界面' },
  checking_login:       { icon: Clock,          color: 'text-yellow-400 bg-yellow-100',    label: '检查登录' },
  need_qr_code:         { icon: AlertTriangle,  color: 'text-yellow-500 bg-yellow-100',    label: '需扫码登录' },
  waiting_for_qr:       { icon: Clock,          color: 'text-yellow-400 bg-yellow-100',    label: '等待扫码' },
  logged_in:            { icon: CheckCircle,    color: 'text-green-400 bg-green-100',      label: '已登录' },
  uploading:            { icon: Upload,         color: 'text-blue-500 bg-blue-100',        label: '上传视频' },
  preparing_upload:     { icon: Upload,         color: 'text-blue-400 bg-blue-100',        label: '准备上传' },
  verifying_upload:     { icon: Clock,          color: 'text-blue-400 bg-blue-100',        label: '验证上传' },
  upload_success:       { icon: CheckCircle,    color: 'text-green-400 bg-green-100',      label: '上传成功' },
  upload_warning:       { icon: AlertTriangle,  color: 'text-yellow-500 bg-yellow-100',    label: '上传异常' },
  filling_form:         { icon: FileText,       color: 'text-purple-500 bg-purple-100',    label: '填写表单' },
  filling_title:        { icon: FileText,       color: 'text-purple-400 bg-purple-100',    label: '填写标题' },
  filling_desc:         { icon: FileText,       color: 'text-purple-400 bg-purple-100',    label: '填写描述' },
  filling_tags:         { icon: FileText,       color: 'text-purple-400 bg-purple-100',    label: '添加标签' },
  setting_cover:        { icon: FileText,       color: 'text-purple-400 bg-purple-100',    label: '设置封面' },
  adding_poi:           { icon: FileText,       color: 'text-purple-400 bg-purple-100',    label: '添加地点' },
  declaring_original:   { icon: FileText,       color: 'text-purple-400 bg-purple-100',    label: '声明原创' },
  publishing:           { icon: Send,           color: 'text-red-500 bg-red-100',          label: '发布中' },
  completed:            { icon: CheckCircle,    color: 'text-green-600 bg-green-200',      label: '任务完成' },
  error:                { icon: AlertTriangle,  color: 'text-red-600 bg-red-200',          label: '任务出错' },
};

const FALLBACK = { icon: Clock, color: 'text-gray-400 bg-gray-100', label: '未知' };

export function TaskStatusMonitor({ activeTasks = [], compact = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const electron = getElectron();
    const cleanup = electron.ipcRenderer.on('task-progress-update', (payload) => {
      setHistory(prev => {
        const entry = {
          taskId: payload.taskId,
          historyId: payload.historyId,
          videoId: payload.videoId,
          platform: payload.platform,
          status: payload.status,
          message: payload.message || payload.status || '',
          timestamp: payload.timestamp || Date.now(),
          elapsed: payload.elapsed
        };
        const merged = prev.filter(e => e.taskId !== entry.taskId || e.status !== entry.status);
        return [...merged.slice(-49), entry];
      });
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  if (activeTasks.length === 0 && history.length === 0) return null;

  const latest = history.length > 0 ? history[history.length - 1] : null;
  const running = activeTasks.filter(t =>
    t.status && !['任务成功', '任务失败', '已取消', 'completed', 'error'].includes(t.status)
  );

  // Compact mode: single-line status for RPA header
  if (compact && latest) {
    const cfg = STATUS_MAP[latest.status] || FALLBACK;
    const Icon = cfg.icon;
    return (
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-emerald-400 flex-shrink-0" />
        <span className="text-[10px] text-emerald-300 truncate">{latest.message || cfg.label}</span>
        <span className="text-[10px] text-slate-500 ml-auto flex-shrink-0">{latest.platform || ''}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black text-slate-700">
            🤖 实时任务 {running.length > 0 ? `(${running.length})` : ''}
          </span>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {latest && (() => {
            const cfg = STATUS_MAP[latest.status] || FALLBACK;
            const Icon = cfg.icon;
            return (
              <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium ${cfg.color}`}>
                <Icon size={14} />
                <span className="truncate">{latest.message || cfg.label}</span>
                {latest.platform && (
                  <span className="text-[10px] opacity-60 ml-auto flex-shrink-0">{latest.platform}</span>
                )}
              </div>
            );
          })()}

          {running.map(t => (
            <div key={t.historyId || t.taskId} className="flex items-center gap-2 text-xs text-slate-500 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
              <span className="truncate">{t.platform || ''} — {t.status || '执行中...'}</span>
            </div>
          ))}

          {history.length > 1 && (
            <details className="text-[10px] text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600 py-1">执行历史 ({history.length})</summary>
              <div className="max-h-32 overflow-y-auto space-y-0.5 mt-1">
                {[...history].reverse().map((item, i) => {
                  const cfg = STATUS_MAP[item.status] || FALLBACK;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className="flex items-center gap-1.5 px-1 py-0.5 text-slate-500">
                      <Icon size={10} className="flex-shrink-0" />
                      <span className="truncate">{item.message}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
