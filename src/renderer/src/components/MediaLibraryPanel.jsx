import React, { useState, useEffect } from 'react';
import {
  FolderOpen, RefreshCw, CheckSquare, Square, Video, HardDrive, ArrowRight,
  Loader2, AlertCircle, FolderPlus, Monitor,
} from 'lucide-react';
import { SYSTEM_MEDIA_FOLDER } from '../config/matrixConfig';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return { ipcRenderer: { invoke: async () => ({ success: false }), on: () => {}, removeAllListeners: () => {} } };
};

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoStr) {
  if (!isoStr) return '--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return '--'; }
}

export default function MediaLibraryPanel({ mediaFolders, setMediaFolders, onAddToWorkbench, onSkipToPublish }) {
  const electron = getElectron();
  const [scannedVideos, setScannedVideos] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('publish_user_media_folder');
    if (saved && !mediaFolders.user) {
      setMediaFolders(prev => ({ ...prev, user: saved }));
    }
  }, []);

  const handleSelectFolder = async (type) => {
    const res = await electron.ipcRenderer.invoke('select-folder');
    if (!res.success || !res.path) return;
    if (type === 'system') {
      setMediaFolders(prev => ({ ...prev, system: res.path }));
    } else {
      setMediaFolders(prev => ({ ...prev, user: res.path }));
      localStorage.setItem('publish_user_media_folder', res.path);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanError('');
    setSelectedIds(new Set());

    const allFiles = [];
    const folders = [
      { path: mediaFolders.system, label: 'system' },
      { path: mediaFolders.user, label: 'user' },
    ];

    for (const folder of folders) {
      if (!folder.path) continue;
      const res = await electron.ipcRenderer.invoke('scan-media-folder', { folderPath: folder.path });
      if (res.success && res.files.length > 0) {
        for (const f of res.files) {
          f._source = folder.label;
          f._sourcePath = folder.path;
        }
        allFiles.push(...res.files);
      }
    }

    const seen = new Set();
    const deduped = allFiles.filter(f => {
      const key = `${f.name}|${f.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (deduped.length === 0) {
      setScanError('两个文件夹中均未扫描到视频文件');
    }
    setScannedVideos(deduped);
    setIsScanning(false);
  };

  const toggleSelect = (key) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === scannedVideos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scannedVideos.map((_, i) => i)));
    }
  };

  const handleAddToWorkbench = () => {
    const selected = scannedVideos.filter((_, i) => selectedIds.has(i));
    if (selected.length === 0) return;
    onAddToWorkbench(selected);
  };

  const hasVideos = scannedVideos.length > 0;
  const selectedCount = selectedIds.size;

  return (
    <div className="flex-1 bg-zinc-100 p-6 animate-in slide-in-from-bottom-4 duration-400 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* 标题 */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-300">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center gap-2.5">
              <Video size={22} className="text-zinc-700" />
              媒体库
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">
              双文件夹扫描 · 勾选视频加入发布队列
            </p>
          </div>
        </div>

        {/* 文件夹配置区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 系统预设文件夹 */}
          <div className="bg-white border border-zinc-200 rounded-sm p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={16} className="text-amber-500" />
              <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">系统预设文件夹</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <code className="flex-1 text-[11px] bg-zinc-100 px-3 py-2 rounded-sm text-zinc-600 truncate font-mono">
                {mediaFolders.system || '(未设置)'}
              </code>
              <button
                onClick={() => handleSelectFolder('system')}
                className="px-3 py-2 text-[10px] font-black bg-zinc-100 hover:bg-zinc-200 rounded-sm transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <FolderPlus size={12} /> 更改
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium">
              AI 生成的视频会自动保存到此目录
            </p>
          </div>

          {/* 用户本地文件夹 */}
          <div className="bg-white border border-zinc-200 rounded-sm p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={16} className="text-emerald-500" />
              <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">用户本地文件夹</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <code className={`flex-1 text-[11px] px-3 py-2 rounded-sm truncate font-mono ${mediaFolders.user ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                {mediaFolders.user || '(点击右侧按钮选择)'}
              </code>
              <button
                onClick={() => handleSelectFolder('user')}
                className="px-3 py-2 text-[10px] font-black bg-zinc-100 hover:bg-zinc-200 rounded-sm transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <FolderPlus size={12} /> 更改
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium">
              你剪辑完成的视频所在目录 · 设置后自动记住
            </p>
          </div>
        </div>

        {/* 扫描按钮 */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="px-5 py-2.5 bg-black text-white text-xs font-black rounded-sm flex items-center gap-2 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-sm uppercase tracking-wider"
          >
            {isScanning ? (
              <><Loader2 size={14} className="animate-spin" /> 扫描中...</>
            ) : (
              <><RefreshCw size={14} /> 刷新扫描</>
            )}
          </button>
          {hasVideos && (
            <span className="text-[11px] font-bold text-zinc-500">
              已扫描 <span className="text-black">{scannedVideos.length}</span> 个视频
            </span>
          )}
        </div>

        {/* 扫描错误 */}
        {scanError && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-4 py-3 rounded-sm">
            <AlertCircle size={14} />
            {scanError}
          </div>
        )}

        {/* 视频列表 */}
        {hasVideos && (
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
            {/* 表头 */}
            <div className="flex items-center px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              <button onClick={toggleAll} className="mr-3 flex items-center gap-1.5 hover:text-zinc-600 transition-colors">
                {selectedCount === scannedVideos.length && scannedVideos.length > 0
                  ? <CheckSquare size={15} className="text-emerald-500" />
                  : <Square size={15} />}
                全选
              </button>
              <span className="flex-1">文件名</span>
              <span className="w-36 text-right">日期</span>
              <span className="w-24 text-right">大小</span>
            </div>

            {/* 列表项 */}
            <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
              {scannedVideos.map((file, i) => {
                const isSelected = selectedIds.has(i);
                return (
                  <button
                    key={`${file.path}_${i}`}
                    onClick={() => toggleSelect(i)}
                    className={`w-full flex items-center px-4 py-3 text-left hover:bg-zinc-50 transition-colors ${isSelected ? 'bg-amber-50/60' : ''}`}
                  >
                    <span className="mr-3 flex-shrink-0">
                      {isSelected
                        ? <CheckSquare size={15} className="text-amber-500" />
                        : <Square size={15} className="text-zinc-300" />}
                    </span>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Video size={13} className={`flex-shrink-0 ${file._source === 'system' ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <span className="text-xs font-bold text-zinc-800 truncate">{file.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
                        style={{ background: file._source === 'system' ? '#fef3c7' : '#d1fae5', color: file._source === 'system' ? '#92400e' : '#065f46' }}>
                        {file._source === 'system' ? 'AI生成' : '本地'}
                      </span>
                    </div>
                    <span className="w-36 text-right text-[10px] text-zinc-500 font-mono flex-shrink-0">{formatDate(file.date)}</span>
                    <span className="w-24 text-right text-[10px] text-zinc-500 font-mono flex-shrink-0">{formatSize(file.size)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 空态 */}
        {!hasVideos && !isScanning && !scanError && (
          <div className="bg-white border border-dashed border-zinc-300 rounded-sm p-16 flex flex-col items-center justify-center text-center">
            <FolderOpen size={48} className="text-zinc-300 mb-4" />
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-wider mb-2">暂无扫描数据</h3>
            <p className="text-xs text-zinc-400 font-medium max-w-sm">
              配置好文件夹路径后，点击「刷新扫描」从系统预设文件夹和本地文件夹中加载视频
            </p>
          </div>
        )}

        {/* 底部操作栏 */}
        {hasVideos && (
          <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-sm p-4 shadow-sm">
            <span className="text-xs font-bold text-zinc-500">
              已选 <span className="text-amber-600 font-black">{selectedCount}</span> 个视频
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const selected = scannedVideos.filter((_, i) => selectedIds.has(i));
                  if (selected.length === 0) return;
                  onSkipToPublish?.(selected);
                }}
                disabled={selectedCount === 0}
                className="px-5 py-2.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 text-xs font-black rounded-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm uppercase tracking-wider"
              >
                直接进入发布台 <ArrowRight size={14} />
              </button>
              <button
                onClick={handleAddToWorkbench}
                disabled={selectedCount === 0}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm uppercase tracking-wider"
              >
                加入 AI 填表工作台 <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
