import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, RefreshCw, Edit, FolderTree, Eye, X, Chrome, Shield, MousePointerClick } from 'lucide-react';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return { ipcRenderer: { invoke: async () => ({ success: false, message: '非原生环境' }), send: () => {} } };
};

export default function PublishHistoryView({ videoList, setVideoList, publishHistory, setActiveTab, setActiveVideoId }) {
  const electron = getElectron();
  
  // 💥 监控面板状态
  const [monitorState, setMonitorState] = useState({
    isOpen: false,
    taskId: null,
    title: '',
    platform: ''
  });

  const dockingZoneRef = useRef(null);

  const handleReEdit = (videoId) => {
    setActiveVideoId(videoId);
    setVideoList(prev => prev.map(v => v.id === videoId ? { ...v, status: '未配置' } : v));
    setActiveTab('publish');
  };

  // 打开实时监控面板
  const handleInAppMonitor = (hist) => {
    setMonitorState({
      isOpen: true,
      taskId: hist.historyId, // 传递当前任务的唯一 ID
      title: `${hist.platform} · ${hist.accountAlias} (正在操作：${hist.videoName})`,
      platform: hist.platform
    });
  };

  // 💥 核心逻辑：向主进程发送后台预览面板的坐标，让后台画面镶嵌进来！
  useEffect(() => {
    if (monitorState.isOpen && dockingZoneRef.current) {
      const updateBounds = () => {
        const rect = dockingZoneRef.current.getBoundingClientRect();
        // 将前端 DOM 的坐标发送给主进程的 BrowserView
        electron.ipcRenderer.send('attach-robot-view', {
          taskId: monitorState.taskId,
          bounds: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
        });
      };

      // 稍微延迟一下，确保动画展开完毕再获取坐标
      setTimeout(updateBounds, 300);
      window.addEventListener('resize', updateBounds);
      
      return () => {
        window.removeEventListener('resize', updateBounds);
        // 组件卸载或关闭面板时，通知主进程把画面藏回后台
        electron.ipcRenderer.send('detach-robot-view');
      };
    }
  }, [monitorState.isOpen, monitorState.taskId]);

  const getCoverImage = (videoId) => {
    const video = videoList.find(v => v.id === videoId);
    return video?.config?.universal?.cover || video?.cover || null;
  };

  return (
    <div className="h-full relative flex flex-col max-w-7xl mx-auto animate-in fade-in pb-10">
      
      {/* 头部标题栏 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center border-t-4 border-t-indigo-600 mb-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center">
            <Eye className="mr-2 text-indigo-600" size={24} /> 
            全平台发布队列与控制中心
          </h2>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            点击【手动控制】即可查看后台机器人的实时画面。遇到验证码可直接手动干预，干预后机器人会自动接续工作。
          </p>
        </div>
      </div>

      {/* 数据表格区域 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-bold w-[35%]">分发内容 (视频与标题)</th>
                <th className="p-4 font-bold w-[20%]">目标平台节点</th>
                <th className="p-4 font-bold w-[15%]">发起时间</th>
                <th className="p-4 font-bold w-[15%]">实时状态</th>
                <th className="p-4 font-bold text-right w-[15%]">风控与容错</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {publishHistory.map(hist => {
                const coverSrc = getCoverImage(hist.videoId);
                const isActive = !['任务成功', '任务失败', '已取消'].includes(hist.status);

                return (
                  <tr key={hist.historyId} className={`transition-colors ${isActive ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                    <td className="p-4">
                      <div className="flex items-center space-x-4">
                        <div className="relative w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
                          {coverSrc ? (
                            <img src={coverSrc} alt="cover" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Chrome size={20} />
                            </div>
                          )}
                          {isActive && <div className="absolute inset-0 border-[3px] border-indigo-400 rounded-xl animate-pulse pointer-events-none"></div>}
                        </div>
                        <div className="flex flex-col max-w-[220px]">
                          <span className="font-bold text-slate-800 truncate" title={hist.videoName}>{hist.videoName}</span>
                          <span className="text-xs text-slate-400 mt-1 font-mono">ID: {hist.videoId.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="inline-flex items-center bg-white px-2.5 py-1.5 rounded-lg text-slate-600 border border-slate-200 shadow-sm text-xs font-bold">
                        <span className="text-indigo-600 mr-2">{hist.platform}</span>
                        <span className="text-slate-200 mr-2">|</span>
                        <span className="truncate max-w-[100px]" title={hist.accountAlias}>{hist.accountAlias}</span>
                      </div>
                    </td>

                    <td className="p-4 text-slate-500 font-mono text-xs font-medium">{hist.time}</td>

                    <td className="p-4">
                      <div className="flex flex-col justify-center">
                        {hist.status === '任务成功' && <span className="text-emerald-600 font-bold flex items-center text-xs"><CheckCircle size={14} className="mr-1.5" />发布成功</span>}
                        {hist.status === '任务失败' && <span className="text-red-500 font-bold flex items-center text-xs" title={hist.message}><XCircle size={14} className="mr-1.5" />发布失败</span>}
                        {hist.status === '已取消' && <span className="text-slate-500 font-bold flex items-center text-xs"><XCircle size={14} className="mr-1.5" />已取消</span>}
                        
                        {isActive && (
                          <div className="flex flex-col">
                            <span className="text-indigo-600 font-bold flex items-center text-xs">
                              <RefreshCw size={14} className="mr-1.5 animate-spin" />
                              {hist.status}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1 truncate max-w-[120px]" title={hist.message}>{hist.message}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      {isActive ? (
                        <button 
                          onClick={() => handleInAppMonitor(hist)} 
                          className="group relative text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-all font-bold text-xs inline-flex items-center shadow-lg shadow-indigo-500/30 overflow-hidden active:scale-95"
                        >
                          <MousePointerClick size={14} className="mr-1.5 animate-bounce" /> 手动控制
                        </button>
                      ) : (
                        (hist.status === '任务失败' || hist.status === '已取消') ? (
                          <button 
                            onClick={() => handleReEdit(hist.videoId)} 
                            className="text-slate-600 bg-white hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all font-bold text-xs inline-flex items-center shadow-sm active:scale-95"
                          >
                            <Edit size={12} className="mr-1" /> 重新配置补发
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs font-bold px-3 py-1.5">—</span>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}

              {publishHistory.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-20 text-center">
                    <FolderTree size={48} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400 font-bold text-base">引擎待命中，尚未产生发布记录</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 💥 内嵌后台预览面板 (Robot Docking Zone) 💥 */}
      {monitorState.isOpen && (
        <div className="absolute inset-0 bg-white z-50 rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
          
          {/* 头部控制条 */}
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
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setMonitorState({ ...monitorState, isOpen: false })}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-md flex items-center font-bold text-xs"
              >
                <X size={14} className="mr-1" /> 退出控制并隐藏
              </button>
            </div>
          </div>

          {/* 👇 这就是给后台机器人预留的“物理洞口” 👇 */}
          <div 
            ref={dockingZoneRef} 
            className="flex-1 bg-slate-100 w-full h-full relative"
          >
            {/* 提示层：当 BrowserView 还没贴上来时显示 */}
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