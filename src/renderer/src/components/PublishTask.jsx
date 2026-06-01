import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Video, Trash2, Edit, Globe, Scissors, Wand2, Hash, AtSign, MapPin,
  ShoppingBag, Eye, Settings, ToggleRight, Bot, Shield, Rss, Smile, Link as LinkIcon,
  FolderOpen, Activity, Loader2, Radio, MessageCircle, CheckCircle2,
  ChevronRight, Sparkles, RefreshCw, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import MediaLibraryPanel from './MediaLibraryPanel';
import AIFillPanel from './AIFillPanel';
import XHSPublishMock from './XHSPublishMock';
import CommonConfigPanel from './CommonConfigPanel';
import { SYSTEM_MEDIA_FOLDER } from '../config/matrixConfig';
import { useToast } from './ToastContext';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return {
    ipcRenderer: {
      invoke: async () => ({ success: false, message: '非原生环境' }),
      on: () => {}, 
      send: () => {}, 
      removeAllListeners: () => {}
    }
  };
};

const PLATFORM_COLORS = {
  '抖音': { text: 'text-[#fe2c55]', bg: 'bg-[#fe2c55]', border: 'border-[#fe2c55]', ring: 'focus:border-[#fe2c55]', tabBg: 'bg-[#161823]', tabText: 'text-white' },
  '小红书': { text: 'text-[#ff2442]', bg: 'bg-[#ff2442]', border: 'border-[#ff2442]', ring: 'focus:border-[#ff2442]', tabBg: 'bg-[#ff2442]', tabText: 'text-white' },
  'B站': { text: 'text-[#fb7299]', bg: 'bg-[#fb7299]', border: 'border-[#fb7299]', ring: 'focus:border-[#fb7299]', tabBg: 'bg-[#fb7299]', tabText: 'text-white' },
  '微信视频号': { text: 'text-[#07C160]', bg: 'bg-[#07C160]', border: 'border-[#07C160]', ring: 'focus:border-[#07C160]', tabBg: 'bg-[#07C160]', tabText: 'text-white' },
  '快手': { text: 'text-[#FF7700]', bg: 'bg-[#FF7700]', border: 'border-[#FF7700]', ring: 'focus:border-[#FF7700]', tabBg: 'bg-[#FF7700]', tabText: 'text-white' },
  '知乎': { text: 'text-[#0066ff]', bg: 'bg-[#0066ff]', border: 'border-[#0066ff]', ring: 'focus:border-[#0066ff]', tabBg: 'bg-[#0066ff]', tabText: 'text-white' },
  '微博': { text: 'text-[#ff8200]', bg: 'bg-[#ff8200]', border: 'border-[#ff8200]', ring: 'focus:border-[#ff8200]', tabBg: 'bg-[#ff8200]', tabText: 'text-white' },
  '百家号': { text: 'text-[#2b88ff]', bg: 'bg-[#2b88ff]', border: 'border-[#2b88ff]', ring: 'focus:border-[#2b88ff]', tabBg: 'bg-[#2b88ff]', tabText: 'text-white' },
  '企鹅号(腾讯)': { text: 'text-[#00A4FF]', bg: 'bg-[#00A4FF]', border: 'border-[#00A4FF]', ring: 'focus:border-[#00A4FF]', tabBg: 'bg-[#00A4FF]', tabText: 'text-white' },
  '腾讯视频': { text: 'text-[#00A4FF]', bg: 'bg-[#00A4FF]', border: 'border-[#00A4FF]', ring: 'focus:border-[#00A4FF]', tabBg: 'bg-[#00A4FF]', tabText: 'text-white' },
  '大鱼号(优酷)': { text: 'text-[#FF6600]', bg: 'bg-[#FF6600]', border: 'border-[#FF6600]', ring: 'focus:border-[#FF6600]', tabBg: 'bg-[#FF6600]', tabText: 'text-white' },
  '爱奇艺号': { text: 'text-emerald-600', bg: 'bg-emerald-600', border: 'border-emerald-600', ring: 'focus:border-emerald-600', tabBg: 'bg-emerald-600', tabText: 'text-white' }
};

const getBrand = (platform) => PLATFORM_COLORS[platform] || { text: 'text-slate-600', bg: 'bg-slate-600', border: 'border-slate-600', ring: 'focus:border-slate-600', tabBg: 'bg-slate-800', tabText: 'text-white' };

const getSafeVideoSrc = (path) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('file://') || path.startsWith('blob:') || path.startsWith('/@fs/')) return path;
  const normalizedPath = path.replace(/\\/g, '/');
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return `/@fs/${normalizedPath}`;
  return `file:///${encodeURI(normalizedPath)}`;
};

const PlatformHeader = ({ platform }) => {
  const colors = {
    '抖音': 'bg-[#fe2c55]', '小红书': 'bg-[#ff2442]', 'B站': 'bg-[#fb7299]',
    '微信视频号': 'bg-[#07C160]', '快手': 'bg-[#FF7700]', '知乎': 'bg-[#0066ff]',
    '微博': 'bg-[#ff8200]', '百家号': 'bg-[#2b88ff]', '企鹅号(腾讯)': 'bg-[#00A4FF]',
    '腾讯视频': 'bg-[#00A4FF]', '大鱼号(优酷)': 'bg-[#FF6600]', '爱奇艺号': 'bg-emerald-600'
  };
  const bgColor = colors[platform] || 'bg-slate-800';

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#e3e4e5] flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div className="flex items-center min-w-0">
        <div className={`w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center text-white mr-3 shadow-sm flex-shrink-0`}>
          <Settings size={18} />
        </div>
        <span className="font-black text-[18px] text-[#333] truncate">{platform}</span>
      </div>
      <div className="text-[12px] text-[#999] bg-[#f0f2f5] px-3 py-1.5 rounded-full font-bold flex items-center whitespace-nowrap flex-shrink-0">
        <Shield size={14} className="mr-1.5 text-slate-400 flex-shrink-0"/>
        当前配置将仅对「<span className="text-[#333] mx-1">{platform}</span>」生效
      </div>
    </div>
  );
};

// 🚨 接收了 setActiveTab，方便发完视频瞬间跳转发布队列
export default function PublishTask({ accounts, videoList, setVideoList, activeVideoId, setActiveVideoId, publishHistory, setPublishHistory, setActiveTab, publishStep, setPublishStep, publishEditorTab, setPublishEditorTab, publishWorkbenchVideos, setPublishWorkbenchVideos, publishIsDryRun, setPublishIsDryRun, isPublishFullscreen, setIsPublishFullscreen }) {
  const electron = getElectron();
  const videoRef = useRef(null);
  const { addToast } = useToast();

  const activeVideo = videoList.find(v => v.id === activeVideoId);
  const [syncTasks, setSyncTasks] = useState([]);

  // ─── 队列面板折叠 ───
  const [isQueueCollapsed, setIsQueueCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('publish_queue_collapsed') || 'false'); } catch { return false; }
  });
  const toggleQueueCollapsed = () => {
    const next = !isQueueCollapsed;
    setIsQueueCollapsed(next);
    localStorage.setItem('publish_queue_collapsed', JSON.stringify(next));
  };

  // ─── RPA 实时内嵌视图 ───
  const rpaDockRef = useRef(null);
  const [rpaViewActive, setRpaViewActive] = useState(false);
  const [rpaActiveTaskId, setRpaActiveTaskId] = useState(null);
  const activeRunningTask = syncTasks.find(t => t.status === '开始执行' || (t.status && t.status.includes('中') && t.status !== '排队中'));

  // 自动吸附 BrowserView 到内嵌面板
  useEffect(() => {
    if (rpaViewActive && rpaDockRef.current && activeRunningTask) {
      const updateBounds = () => {
        const rect = rpaDockRef.current.getBoundingClientRect();
        electron.ipcRenderer.send('attach-robot-view', {
          taskId: activeRunningTask.historyId,
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
  }, [rpaViewActive, activeRunningTask?.historyId]);

  // 当有任务开始执行时自动开启 RPA 视图
  useEffect(() => {
    if (activeRunningTask && !rpaViewActive) {
      setRpaViewActive(true);
      setRpaActiveTaskId(activeRunningTask.historyId);
    }
  }, [activeRunningTask?.historyId]);

  // ─── 步骤系统（状态提升至 App.jsx，跨视图存活）───
  const currentStep = publishStep;
  const setCurrentStep = setPublishStep;
  const activeEditorTab = publishEditorTab;
  const setActiveEditorTab = setPublishEditorTab;
  const workbenchVideos = publishWorkbenchVideos;
  const setWorkbenchVideos = setPublishWorkbenchVideos;
  const isDryRun = publishIsDryRun;
  const setIsDryRun = setPublishIsDryRun;
  const [mediaFolders, setMediaFolders] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('publish_user_media_folder') : null;
    return { system: SYSTEM_MEDIA_FOLDER, user: saved || '' };
  });

  const handleAddToWorkbench = (selectedFiles) => {
    setWorkbenchVideos(prev => {
      const existingKeys = new Set(prev.map(v => `${v.name}|${v.size}`));
      const newVids = selectedFiles.filter(f => !existingKeys.has(`${f.name}|${f.size}`));
      return [...prev, ...newVids];
    });
    setCurrentStep(1);
  };

  const handleMapToPublish = (results) => {
    const newVideos = results.map((r, i) => {
      const id = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;
      const video = r.video;
      const universal = {
        title: r.title,
        desc: '',
        tags: '',
        category: '科技数码',
        coverUrl: '',
        coverPath: '',
        firstComment: '',
        original: true,
        aigc: false,
      };
      const platforms = {};
      if (r.aiResult?.platforms) {
        for (const [pName, pData] of Object.entries(r.aiResult.platforms)) {
          platforms[pName] = {
            title: pData.title || r.title,
            desc: pData.desc || '',
            tags: Array.isArray(pData.tags) ? pData.tags.join(',') : (pData.tags || ''),
            category: '科技数码',
          };
        }
      }
      return {
        id,
        path: video.path,
        url: getSafeVideoSrc(video.path),
        name: video.name,
        status: '未配置',
        config: { universal, platforms, targetAccounts: [], coverStatus: 'none' },
      };
    });

    setVideoList(prev => [...prev, ...newVideos]);
    if (newVideos.length > 0 && !activeVideoId) {
      setActiveVideoId(newVideos[0].id);
    }
    setCurrentStep(2);
  };

  // 🚀 跳过 AI 填表：直接将视频数组映射到发布台（字段为空，用户手动填写）
  const handleSkipToPublish = (videos) => {
    if (!videos || videos.length === 0) return;
    const newVideos = videos.map((video, i) => {
      const id = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;
      return {
        id,
        path: video.path,
        url: getSafeVideoSrc(video.path),
        name: video.name,
        status: '未配置',
        config: {
          universal: {
            title: video.name.replace(/\.[^/.]+$/, ''),
            desc: '',
            tags: '',
            category: '科技数码',
            coverUrl: '',
            coverPath: '',
            firstComment: '',
            original: true,
            aigc: false,
          },
          platforms: {},
          targetAccounts: [],
          coverStatus: 'none',
        },
      };
    });
    setVideoList(prev => [...prev, ...newVideos]);
    if (newVideos.length > 0 && !activeVideoId) {
      setActiveVideoId(newVideos[0].id);
    }
    setCurrentStep(2);
  };

  const handlePublish = async (platformName) => {
    const activeVideo = videoList.find(v => v.id === activeVideoId);
    if (!activeVideo) { addToast('error', '未选择挂载载荷', '请先在左侧列表中选取一个视频'); return; }

    const targetAccounts = activeVideo.config.targetAccounts || [];
    const matchedAccountStr = targetAccounts.find(accStr => accStr.includes(`|${platformName}|`));
    
    if (!matchedAccountStr) { addToast('error', '未分配账号', `请为【${platformName}】指定目标账号`); return; }

    const [currentAccountId, _, accountAlias] = matchedAccountStr.split('|');
    const uConfig = activeVideo.config?.universal || {};
    const pConfig = activeVideo.config?.platforms?.[platformName] || {};

    const taskData = {
      historyId: `hist_${Date.now()}`,         
      videoId: activeVideo.id,                 
      videoName: uConfig.title || 'UNKNOWN_PAYLOAD', 
      videoPath: activeVideo.videoPath || activeVideo.path, 
      coverPath: uConfig.coverPath || '', 
      platform: platformName,                  
      accountId: currentAccountId,             
      accountAlias: accountAlias,              
      title: pConfig.title ?? uConfig.title ?? '',
      desc: pConfig.desc ?? uConfig.desc ?? '',
      tags: pConfig.tags ?? uConfig.tags ?? '',
      category: pConfig.category || '科技',
      isOriginal: pConfig.isOriginal ?? uConfig.original ?? false, 
      aigc: pConfig.aigc ?? uConfig.aigc ?? false,
      scheduled: pConfig.scheduled ?? false,
      scheduleTime: pConfig.scheduleTime ?? '',
      syncToutiao: pConfig.syncToutiao ?? true,
      poi: pConfig.poi ?? '',
      productLink: pConfig.productLink ?? '',
      visibility: pConfig.visibility || 'public',
      dryRun: isDryRun 
    };

    // 乐观 UI 更新
    setPublishHistory(prev => [{ ...taskData, status: '排队中', time: new Date().toLocaleTimeString() }, ...prev]);

    try {
      const res = await electron.ipcRenderer.invoke('execute-auto-publish', taskData);
      if (res.success) {
         // 🚀 核心优化：一开始，立刻带你去发布队列看板！
         setActiveTab('history'); 
      } else {
         addToast('error', '注入失败', res.message);
      }
    } catch (error) {
      addToast('error', 'RPA 引擎失联', '请检查底层浏览器运行状态');
    }
  };

  const selectedPlatforms = activeVideo 
    ? Array.from(new Set(activeVideo.config.targetAccounts.map(accStr => accStr.split('|')[1])))
    : [];

  useEffect(() => {
    if (activeEditorTab !== 'universal' && !selectedPlatforms.includes(activeEditorTab)) {
      setActiveEditorTab('universal');
    }
  }, [selectedPlatforms, activeEditorTab]);

  useEffect(() => {
    const handleUpdate = (event, payload) => {
      const safeMsg = (typeof payload.error === 'object' && payload.error) 
        ? String(payload.error.message || JSON.stringify(payload.error)) 
        : String(payload.error || payload.status || '未知状态');

      setSyncTasks(prev => {
        const exists = prev.find(item => item.historyId === payload.historyId);
        if (exists) {
          return prev.map(item => item.historyId === payload.historyId 
            ? { ...item, status: payload.status, error: safeMsg, platform: payload.platform || item.platform, accountAlias: payload.accountAlias || item.accountAlias } 
            : item
          );
        }
        if (['排队中', '开始执行'].includes(payload.status) || payload.status.includes('中')) {
          return [{ 
            historyId: payload.historyId, videoId: payload.videoId, videoName: payload.title || '未知视频', 
            platform: payload.platform, accountAlias: payload.accountAlias, status: payload.status, 
            time: payload.timestamp ? new Date(payload.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(), 
            taskId: payload.taskId, error: safeMsg 
          }, ...prev];
        }
        return prev;
      });

      if (payload.status === '任务成功') {
        addToast('success', '发布成功', payload.title || '未知视频');
      } else if (payload.status === '任务失败') {
        addToast('error', '发布失败', safeMsg);
      }
    };
    if (electron.ipcRenderer.on) electron.ipcRenderer.on('task-progress-update', handleUpdate);
    return () => { if (electron.ipcRenderer.removeAllListeners) electron.ipcRenderer.removeAllListeners('task-progress-update'); };
  }, []);

  const handleRemoveVideo = (e, videoId, videoName) => {
    e.stopPropagation();
    if (!confirm(`确定要从待发队列中移除《${videoName}》吗？`)) return;
    setVideoList(prev => {
      const newList = prev.filter(v => v.id !== videoId);
      if (activeVideoId === videoId) setTimeout(() => setActiveVideoId(newList.length > 0 ? newList[0].id : null), 0);
      return newList;
    });
  };

  const updateConfig = (level, key, value) => {
    if (!activeVideoId) return;
    setVideoList(prev => prev.map(v => {
      if (v.id !== activeVideoId) return v;
      if (level === 'universal') {
        return { ...v, config: { ...v.config, universal: { ...v.config.universal, [key]: value } } };
      } else {
        return { ...v, config: { ...v.config, platforms: { ...v.config.platforms, [level]: { ...(v.config.platforms[level] || {}), [key]: value } } } };
      }
    }));
  };

  const updateRootConfig = (key, value) => {
    if (!activeVideoId) return;
    setVideoList(prev => prev.map(v => v.id === activeVideoId ? { ...v, config: { ...v.config, [key]: value } } : v));
  };

  const captureCurrentFrame = async () => {
    if (!videoRef.current || !activeVideo) return;
    const video = videoRef.current;

    if (video.readyState === 0) {
      addToast('warning', '视频未就绪', '请等待视频加载完成后再截帧');
      return;
    }

    try {
      updateRootConfig('coverStatus', 'extracting');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Cover = canvas.toDataURL('image/jpeg', 0.85);

      updateConfig('universal', 'coverUrl', base64Cover);

      const saveRes = await electron.ipcRenderer.invoke('save-temp-cover', base64Cover);
      if (saveRes.success) {
        updateConfig('universal', 'coverPath', saveRes.path);
        updateRootConfig('coverStatus', 'done');
      } else {
        throw new Error(saveRes.message);
      }
    } catch (err) {
      console.error(err);
      addToast('error', '截帧失败', '请确保视频格式正确');
      updateRootConfig('coverStatus', 'none');
    }
  };

  const handleAccountToggle = (accVal) => {
    if (!activeVideo) return;
    const currentList = activeVideo.config.targetAccounts || [];
    if (currentList.includes(accVal)) updateRootConfig('targetAccounts', currentList.filter(x => x !== accVal));
    else updateRootConfig('targetAccounts', [...currentList, accVal]);
  };

  const handleSaveToLocalDraft = () => {
    if (!activeVideo) return;
    if (activeVideo.config.targetAccounts.length === 0) { addToast('warning', '未选择目标平台', '请先勾选至少一个发布平台'); return; }
    setVideoList(prev => prev.map(v => v.id === activeVideoId ? { ...v, status: '已就绪' } : v));
  };

  const launchAllQueue = async () => {
    const readyQueue = videoList.filter(v => v.status === '已就绪');
    if (readyQueue.length === 0) { addToast('warning', '序列为空', '请先将视频存为 [已就绪] 状态'); return; }
    
    const confirmMsg = isDryRun 
      ? `🛡️ [SIMULATION_MODE]\n侦测到 ${readyQueue.length} 个待发载荷。\n引擎将仅执行渗透与填表，最后一步会被防火墙拦截。`
      : `🚀 [LIVE_FIRE_MODE]\n侦测到 ${readyQueue.length} 个实弹载荷。\n即将唤醒底层节点，请确认是否点火？`;
    
    if (!confirm(confirmMsg)) return;

    setVideoList(prev => prev.map(v => v.status === '已就绪' ? { ...v, status: '发布中' } : v));
    
    // 🚀 核心优化：大批量发射后，自动切入总控面板！
    setActiveTab('history'); 

    for (const vid of readyQueue) {
      for (const accStr of vid.config.targetAccounts) {
        const [accountId, platform, accountAlias] = accStr.split('|');
        const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        setPublishHistory(prev => [{ historyId, videoId: vid.id, videoName: vid.name, platform, accountAlias, status: '排队中', time: new Date().toLocaleTimeString() }, ...prev]);
        setSyncTasks(prev => [{ historyId, videoId: vid.id, videoName: vid.name, platform, accountAlias, status: '排队中', time: new Date().toLocaleTimeString(), taskId: '' }, ...prev]);

        const pConfig = vid.config.platforms[platform] || {};
        const uConfig = vid.config.universal;

        const result = await electron.ipcRenderer.invoke('execute-auto-publish', {
          historyId, videoId: vid.id, platform, accountId, accountAlias,
          title: pConfig.title ?? uConfig.title, 
          desc: pConfig.desc ?? uConfig.desc,
          tags: pConfig.tags ?? uConfig.tags, 
          category: pConfig.category ?? uConfig.category,
          firstComment: pConfig.firstComment ?? uConfig.firstComment,
          isOriginal: pConfig.isOriginal ?? uConfig.original ?? false,
          aigc: pConfig.aigc ?? uConfig.aigc ?? false,
          poi: pConfig.poi ?? '',
          productLink: pConfig.productLink ?? '',
          scheduled: pConfig.scheduled ?? false,
          scheduleTime: pConfig.scheduleTime ?? '',
          syncToutiao: pConfig.syncToutiao ?? true,
          videoPath: vid.path, 
          coverPath: uConfig.coverPath || '',
          dryRun: isDryRun
        });

        if (result.success) {
          setSyncTasks(prev => prev.map(task => task.historyId === historyId ? { ...task, taskId: result.taskId } : task));
        }
      }
    }
  };
  
  const groupedAccounts = useMemo(() => {
    return accounts.reduce((acc, item) => {
      const g = item.group || '默认标签';
      if (!acc[g]) acc[g] = [];
      acc[g].push(item);
      return acc;
    }, {});
  }, [accounts]);

  const handleGroupToggle = (groupName) => {
    if (!activeVideo) return;
    const groupList = groupedAccounts[groupName] || [];
    const groupVals = groupList.map(a => `${a.id}|${a.platform}|${a.alias}`);
    const currentTarget = activeVideo.config.targetAccounts || [];
    const selectedInGroup = groupVals.filter(val => currentTarget.includes(val));
    const isFullySelected = selectedInGroup.length === groupVals.length;

    let newTargets;
    if (isFullySelected) {
      newTargets = currentTarget.filter(val => !groupVals.includes(val));
    } else {
      newTargets = [...new Set([...currentTarget, ...groupVals])];
    }
    updateRootConfig('targetAccounts', newTargets);
  };

  const renderPlatformEditor = () => {
    if (!activeVideo) return null;
    const uConfig = activeVideo.config.universal;
    const pConfig = activeVideo.config.platforms[activeEditorTab] || {};

    if (activeEditorTab === 'universal') {
      return (
        <div className="flex justify-center py-6 animate-in fade-in duration-300">
          <CommonConfigPanel
            config={uConfig}
            onChange={(field, value) => updateConfig('universal', field, value)}
            activeVideo={activeVideo}
          />
        </div>
      );
    }

// ==================== 🔥 1. 抖音（已补齐「挂商品」功能） ====================
    if (activeEditorTab === '抖音') {
      return (
        <div className="bg-[#f6f6f6] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
          <div className="max-w-[840px] w-full mx-auto space-y-5">
            <PlatformHeader platform={activeEditorTab} />
            
            {/* 卡片 1: 基础信息 */}
            <div className="bg-white rounded-lg p-6 sm:p-8 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[16px] font-bold text-[#161823]">基础信息</h2>
              </div>

              <div className="space-y-6">
                {/* 作品描述（不变） */}
                <div className="flex flex-col sm:flex-row items-start">
                  <div className="w-full sm:w-[100px] text-[14px] text-[#161823] mt-2 mb-2 sm:mb-0 flex items-center">
                    作品描述 <span className="text-[#999] ml-1 border border-[#ccc] rounded-full w-[14px] h-[14px] flex items-center justify-center text-[10px] cursor-help">?</span>
                  </div>
                  <div className="flex-1 w-full">
                    <div className="border border-[#e3e4e5] rounded-lg bg-[#fcfcfc] focus-within:border-[#fe2c55] focus-within:bg-white transition-all overflow-hidden">
                      <div className="relative border-b border-[#f0f0f0]">
                        <input 
                          className="w-full bg-transparent p-3 text-[14px] text-[#161823] font-bold outline-none placeholder-[#999] pr-12" 
                          placeholder="填写作品标题，为作品获得更多流量" 
                          value={pConfig.title ?? uConfig.title} 
                          onChange={e => updateConfig('抖音', 'title', e.target.value)} 
                        />
                        <span className="absolute right-3 top-3 text-[12px] text-[#999]">{(pConfig.title ?? uConfig.title)?.length || 0}/30</span>
                      </div>
                      <textarea 
                        className="w-full bg-transparent p-3 h-24 text-[14px] text-[#161823] outline-none resize-none placeholder-[#999]" 
                        placeholder="添加作品简介" 
                        value={pConfig.desc ?? uConfig.desc} 
                        onChange={e => updateConfig('抖音', 'desc', e.target.value)} 
                      />
                      <div className="px-3 pb-3 flex items-center justify-between">
                        <div className="text-[#161823] font-bold text-[14px] flex gap-4">
                          <span className="cursor-pointer hover:text-[#fe2c55]">#添加话题</span>
                          <span className="cursor-pointer hover:text-[#fe2c55]">@好友</span>
                        </div>
                        <span className="text-[12px] text-[#999]">0 / 1000</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🔥 新增：关联商品（挂商品） */}
                <div className="flex flex-col sm:flex-row items-start">
                  <div className="w-full sm:w-[100px] text-[14px] text-[#161823] mt-2 mb-2 sm:mb-0 flex items-center">
                    关联商品 <span className="text-[#999] ml-1 border border-[#ccc] rounded-full w-[14px] h-[14px] flex items-center justify-center text-[10px] cursor-help">?</span>
                  </div>
                  <div className="flex-1 w-full">
                    <div className="border border-[#e3e4e5] rounded-lg bg-[#fcfcfc] focus-within:border-[#fe2c55] focus-within:bg-white transition-all p-4">
                      <input 
                        className="w-full bg-transparent outline-none text-[14px] text-[#161823] placeholder-[#999]" 
                        placeholder="输入商品ID / 商品链接 / 商品名称（支持搜索）" 
                        value={pConfig.productLink || ''} 
                        onChange={e => updateConfig('抖音', 'productLink', e.target.value)} 
                      />
                      <div className="text-[12px] text-[#999] mt-2 flex items-center">
                        <ShoppingBag size={14} className="mr-1"/> 
                        挂载后用户可直接点击购买，提升带货转化
                      </div>
                    </div>
                  </div>
                </div>

                {/* 话题标签（保持柔性探雷） */}
                <div className="flex items-start">
                  <div className="w-full sm:w-[100px] text-[14px] text-[#161823] mt-2">话题标签</div>
                  <div className="flex-1">
                    <input 
                      className="w-full border border-[#e3e4e5] rounded p-3 text-sm outline-none focus:border-[#fe2c55]" 
                      placeholder="输入#话题后按空格生成胶囊" 
                      value={pConfig.tags || ''} 
                      onChange={e => updateConfig('抖音', 'tags', e.target.value)} 
                    />
                  </div>
                </div>

                {/* 添加地点 */}
                <div className="flex items-start">
                  <div className="w-full sm:w-[100px] text-[14px] text-[#161823] mt-2">添加地点</div>
                  <input 
                    className="flex-1 border border-[#e3e4e5] rounded p-3 text-sm outline-none focus:border-[#fe2c55]" 
                    placeholder="搜索地点（POI）" 
                    value={pConfig.poi || ''} 
                    onChange={e => updateConfig('抖音', 'poi', e.target.value)} 
                  />
                </div>

                {/* 定时发布 + 同步头条（不变） */}
                <div className="flex items-center justify-between">
                  <div className="text-[14px] text-[#161823]">定时发布</div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="dy_time" checked={!pConfig.scheduled} onChange={()=>updateConfig('抖音', 'scheduled', false)} className="accent-[#fe2c55]" />
                      <span className="ml-2 text-[14px]">立即发布</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="dy_time" checked={pConfig.scheduled} onChange={()=>updateConfig('抖音', 'scheduled', true)} className="accent-[#fe2c55]" />
                      <span className="ml-2 text-[14px]">定时发布</span>
                    </label>
                  </div>
                </div>
                {pConfig.scheduled && (
                  <input type="datetime-local" className="w-full border border-[#e3e4e5] rounded p-3 text-sm" value={pConfig.scheduleTime || ''} onChange={e=>updateConfig('抖音', 'scheduleTime', e.target.value)} />
                )}

                <div className="flex items-center justify-between">
                  <div className="text-[14px] text-[#161823]">同步至今日头条</div>
                  <ToggleRight size={32} className={pConfig.syncToutiao ? "text-[#fe2c55]" : "text-[#e3e4e5]"} onClick={()=>updateConfig('抖音', 'syncToutiao', !pConfig.syncToutiao)} />
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
              <button className="bg-white border border-[#e3e4e5] text-[#161823] px-10 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#f9f9f9] transition shadow-sm">暂存草稿</button>
              <button onClick={() => handlePublish('抖音')} className="bg-[#fe2c55] text-white px-12 py-2.5 rounded-xl shadow-md text-[14px] font-bold hover:bg-[#e0264b] transition active:scale-95">
                立即发布至抖音
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ==================== 🔥 2. 小红书（沉浸式原生编辑器） ====================
    if (activeEditorTab === '小红书') {
      const xhsConfig = { ...uConfig, ...pConfig };
      return (
        <XHSPublishMock
          config={xhsConfig}
          onChange={(field, value) => updateConfig('小红书', field, value)}
          onPublish={() => handlePublish('小红书')}
          onSaveDraft={() => console.log('[小红书] 暂存草稿', xhsConfig)}
        />
      );
    }

// ==================== 🔥 2. 快手（cp.kuaishou.com 1:1 原生复刻） ====================
if (activeEditorTab === '快手') {
  const ksTitle = pConfig.title ?? uConfig.title ?? '';
  const ksDesc = pConfig.desc ?? uConfig.desc ?? '';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return (
    <div className="min-h-full bg-[#f5f6f7] flex font-sans text-[14px] text-[#333] animate-in fade-in duration-300">
      {/* ========== 左：核心编辑区 ========== */}
      <div className="flex-1 min-w-0 overflow-y-auto pb-24">
        <div className="px-6 pt-5 max-w-[720px] space-y-5">

          {/* ─── 1. 作品描述 + AI 栏 ─── */}
          <section>
            <label className="text-[14px] text-[#666] mb-2 block">作品描述</label>
            <div className="border border-[#e5e5e5] rounded-md overflow-hidden focus-within:border-[#FF7700] transition-colors bg-white">
              <textarea
                className="w-full h-[140px] p-4 text-[14px] text-[#333] outline-none resize-none bg-transparent placeholder-[#ccc] leading-relaxed"
                placeholder="作品描述不会写？试试智能文案"
                value={ksDesc}
                onChange={e => updateConfig('快手', 'desc', e.target.value)}
              />
              {/* AI 辅助栏 */}
              <div className="border-t border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-[12px] text-[#666] hover:border-[#FF7700] hover:text-[#FF7700] transition">
                    <Sparkles size={13} /> 智能文案
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-[12px] text-[#666] hover:border-[#FF7700] hover:text-[#FF7700] transition">
                    <Hash size={13} /> 智能话题
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-[12px] text-[#666] hover:border-[#FF7700] hover:text-[#FF7700] transition">
                    <AtSign size={13} /> 好友
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-[#999]">推荐:</span>
                  {['#这才是男人该玩的打火机','#是时候该露一手了','#给你看个好东西','#zippo打火机'].map(t => (
                    <span key={t} className="text-[11px] text-[#FF7700] bg-orange-50 px-2 py-0.5 rounded cursor-pointer hover:bg-orange-100 transition">{t}</span>
                  ))}
                  <span className="text-[11px] text-[#999] cursor-pointer hover:text-[#FF7700]">全部</span>
                </div>
              </div>
            </div>
          </section>

          {/* ─── 2. 活动推荐 ─── */}
          <section>
            <label className="text-[14px] text-[#666] mb-2 flex items-center gap-1 block">活动推荐</label>
            <div className="space-y-2">
              {[
                { img: 'https://p23-plat.wsukwai.com/udata/pkg/ai-cover-SQEvnndV-1779937849581.png?x-kcdn-pid=112531', title: '你应该出去看看' },
                { img: 'https://p23-plat.wsukwai.com/udata/pkg/ai-cover-WaPfITdX-1780044292859.png?x-kcdn-pid=112531', title: '一个普通的下午' },
              ].map((act, i) => (
                <div key={i} className="flex items-center gap-3 bg-white border border-[#eee] rounded-lg p-2.5 hover:border-[#FF7700]/30 transition cursor-pointer">
                  <img src={act.img} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#333]">{act.title}</div>
                  </div>
                  <span className="text-[12px] text-[#666] flex items-center gap-1 flex-shrink-0">去领取 <ChevronRight size={14} /></span>
                </div>
              ))}
              <div className="text-[12px] text-[#999] cursor-pointer hover:text-[#FF7700]">全部</div>
            </div>
          </section>

          {/* ─── 3. 封面设置 ─── */}
          <section>
            <label className="text-[14px] text-[#666] mb-2 flex items-center gap-1 block">封面设置</label>
            <div className="bg-white border border-[#eee] rounded-lg p-4">
              <div className="flex gap-4">
                {/* 当前封面 */}
                <div className="w-[120px] h-[160px] bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative cursor-pointer border-2 border-dashed border-gray-200 hover:border-[#FF7700] flex items-center justify-center">
                  {activeVideo?.config?.universal?.coverUrl ? (
                    <img src={activeVideo.config.universal.coverUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-[11px] text-gray-400">点击上传封面</span>
                  )}
                </div>
                {/* 智能推荐封面 */}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#666] mb-2 font-medium">智能推荐封面</div>
                  <div className="flex gap-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-[80px] h-[106px] bg-gray-100 rounded-lg border border-gray-100 cursor-pointer hover:border-[#FF7700] flex items-center justify-center text-[11px] text-gray-400">
                        推荐{i}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* PK 封面 */}
              <div className="flex items-center justify-end mt-3 pt-3 border-t border-[#f5f5f5]">
                <span className="text-[12px] text-[#666] mr-3">PK封面</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" onChange={e => updateConfig('快手', 'pkCover', e.target.checked)} />
                  <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF7700]" />
                </label>
              </div>
            </div>
          </section>

          {/* ─── 4. 作者服务 ─── */}
          <section className="flex items-center gap-3">
            <label className="text-[14px] text-[#666] flex-shrink-0">作者服务</label>
            <select className="w-[168px] border border-[#e5e5e5] rounded px-3 py-2 text-[13px] text-[#333] outline-none focus:border-[#FF7700] bg-white mr-2" value={pConfig.authorService || ''} onChange={e => updateConfig('快手', 'authorService', e.target.value)}>
              <option value="">选择服务类型</option>
              <option value="ecom">电商带货</option>
              <option value="live">直播预约</option>
              <option value="course">付费课程</option>
            </select>
            <input className="flex-1 border border-[#e5e5e5] rounded px-3 py-2 text-[13px] text-[#999] outline-none focus:border-[#FF7700] bg-[#f5f5f5] placeholder-[#999]" placeholder="关联成功可获得更多收益" disabled />
          </section>

          {/* ─── 5. 作者声明 ─── */}
          <section className="flex items-center gap-3">
            <label className="text-[14px] text-[#666] flex-shrink-0">作者声明</label>
            <select className="flex-1 border border-[#e5e5e5] rounded px-3 py-2 text-[13px] text-[#333] outline-none focus:border-[#FF7700] bg-white" value={pConfig.authorDeclare || ''} onChange={e => updateConfig('快手', 'authorDeclare', e.target.value)}>
              <option value="">为作品添加补充说明</option>
              <option value="original">原创内容</option>
              <option value="ai">包含AI生成内容</option>
              <option value="ad">包含商业推广</option>
            </select>
          </section>

          {/* ─── 6. 添加地点 ─── */}
          <section className="flex items-center gap-3">
            <label className="text-[14px] text-[#666] flex-shrink-0">添加地点</label>
            <select className="w-[168px] border border-[#e5e5e5] rounded px-3 py-2 text-[13px] text-[#333] outline-none focus:border-[#FF7700] bg-white mr-2" value={pConfig.poi || ''} onChange={e => updateConfig('快手', 'poi', e.target.value)}>
              <option value="">请选择所在地区</option>
              <option value="北京">北京</option>
              <option value="上海">上海</option>
              <option value="广州">广州</option>
              <option value="深圳">深圳</option>
            </select>
            <input className="flex-1 border border-[#e5e5e5] rounded px-3 py-2 text-[13px] text-[#999] outline-none focus:border-[#FF7700] bg-[#f5f5f5] placeholder-[#999]" placeholder="请输入视频详细地址，让同城老铁看见你" disabled />
          </section>

          {/* ─── 7. 发布设置 ─── */}
          <section className="mt-2">
            <h3 className="text-[16px] font-bold text-[#333] mb-4">发布设置</h3>
            <div className="bg-white border border-[#eee] rounded-lg p-5 space-y-5">

              {/* 互动设置 */}
              <div>
                <label className="text-[14px] text-[#333] font-bold mb-3 block">互动设置</label>
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  {[
                    { key: 'allowDuet', label: '允许别人跟我拍同框', def: true },
                    { key: 'allowDownload', label: '允许下载此作品', def: true },
                    { key: 'showCity', label: '作品展示在同城页', def: true },
                  ].map(item => (
                    <label key={item.key} className="flex items-center cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-[#FF7700] mr-2" checked={pConfig[item.key] ?? item.def} onChange={e => updateConfig('快手', item.key, e.target.checked)} />
                      <span className="text-[14px] text-[#333]">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 查看权限 */}
              <div>
                <label className="text-[14px] text-[#333] font-bold mb-3 block">查看权限</label>
                <div className="flex gap-8">
                  {[
                    { val: 'public', label: '所有人可见' },
                    { val: 'friend', label: '好友可见' },
                    { val: 'private', label: '仅自己可见' },
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center cursor-pointer">
                      <input type="radio" name="ks_vis" className="accent-[#FF7700] mr-2" checked={pConfig.visibility === opt.val || (!pConfig.visibility && opt.val === 'public')} onChange={() => updateConfig('快手', 'visibility', opt.val)} />
                      <span className="text-[14px] text-[#333]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 发布时间 */}
              <div>
                <label className="text-[14px] text-[#333] font-bold mb-3 block">发布时间</label>
                <div className="flex gap-8">
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" name="ks_time" className="accent-[#FF7700] mr-2" checked={!pConfig.scheduled} onChange={() => updateConfig('快手', 'scheduled', false)} />
                    <span className="text-[14px] text-[#333]">立即发布</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" name="ks_time" className="accent-[#FF7700] mr-2" checked={!!pConfig.scheduled} onChange={() => updateConfig('快手', 'scheduled', true)} />
                    <span className="text-[14px] text-[#333]">定时发布</span>
                  </label>
                </div>
                {pConfig.scheduled && (
                  <input type="datetime-local" className="mt-3 border border-[#e5e5e5] rounded p-2.5 text-[13px] text-[#333] outline-none focus:border-[#FF7700] w-[240px]" value={pConfig.scheduleTime || ''} onChange={e => updateConfig('快手', 'scheduleTime', e.target.value)} />
                )}
                {/* 粉丝活跃高峰提示 */}
                <div className="mt-3 flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  <span className="text-[18px]">⏰</span>
                  <span className="text-[12px] text-[#cc6600] flex-1">你的粉丝在20:00到21:00点活跃，在该时间发布可提升流量～</span>
                  <button className="text-[11px] text-[#FF7700] font-medium hover:underline flex-shrink-0">一键设置</button>
                </div>
              </div>

            </div>
          </section>

          {/* ─── 底部按钮 ─── */}
          <div className="flex justify-center gap-4 pt-4 pb-8">
            <button className="w-[96px] h-[36px] bg-white border border-[#e5e5e5] text-[#333] rounded-full text-[13px] font-medium hover:bg-[#f5f5f5] transition">取消</button>
            <button onClick={() => handlePublish('快手')} className="w-[96px] h-[36px] bg-[#FF7700] text-white rounded-full text-[13px] font-medium hover:bg-[#e66a00] transition active:scale-95 shadow-[0_2px_8px_rgba(255,119,0,0.3)]">发布</button>
          </div>
        </div>
      </div>

      {/* ========== 中：手机预览 ========== */}
      <div className="w-[375px] flex-shrink-0 bg-[#f5f6f7] overflow-y-auto border-l border-[#e8e8e8] py-5 px-4 hidden xl:block">
        <div className="sticky top-5">
          <div className="bg-white rounded-[40px] p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] border-[5px] border-[#1a1a1a] mx-auto" style={{ width: 280 }}>
            {/* Tab 切换 */}
            <div className="flex bg-[#f0f0f0] p-1 rounded-full text-[12px] font-medium mb-2.5">
              {['预览封面','预览作品'].map((tab, i) => (
                <button key={tab} className={`flex-1 py-1.5 rounded-full transition ${i === 1 ? 'bg-white shadow-sm text-[#333]' : 'text-[#999]'}`}>{tab}</button>
              ))}
            </div>
            {/* 视频预览 */}
            <div className="bg-black rounded-2xl overflow-hidden relative aspect-[9/16] max-h-[420px]">
              {activeVideo?.url ? (
                <video src={activeVideo.url} className="w-full h-full object-cover" controlsList="nodownload" loop muted />
              ) : (
                <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-[11px] text-gray-500">视频预览</div>
              )}
              {/* Play 按钮 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
              {/* 右侧互动按钮 */}
              <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 text-white">
                <div className="w-8 h-8 bg-white/20 rounded-full border border-white/40" />
                {[{icon:'♡',label:'赞'},{icon:'☆',label:'收藏'},{icon:'💬',label:'评论'}].map(item => (
                  <div key={item.label} className="flex flex-col items-center gap-0.5">
                    <span className="text-lg leading-none">{item.icon}</span>
                    <span className="text-[9px]">{item.label}</span>
                  </div>
                ))}
              </div>
              {/* 底部信息 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-gray-500 border border-white/50 flex-shrink-0" />
                  <span className="text-white text-[11px] font-medium">@潮玩一族</span>
                  <span className="text-white/60 text-[10px] ml-auto flex-shrink-0 px-2 py-0.5 bg-white/15 rounded-full text-[9px] border border-white/20">关注</span>
                </div>
                {ksTitle && <p className="text-white text-[11px] leading-tight line-clamp-2">{ksTitle}</p>}
                <p className="text-white/60 text-[10px] mt-0.5">{ksDesc?.slice(0, 40)}{(ksDesc?.length||0) > 40 ? '...' : ''}</p>
              </div>
            </div>
          </div>
          {/* 重新上传 */}
          <div className="flex justify-center mt-3">
            <button className="flex items-center gap-1.5 px-4 py-2 border border-[#ddd] rounded-full text-[12px] text-[#666] hover:border-[#FF7700] hover:text-[#FF7700] transition bg-white">
              <RefreshCw size={13} /> 重新上传
            </button>
          </div>
        </div>
      </div>

      {/* ========== 右：创作助手 ========== */}
      <div className="w-[260px] flex-shrink-0 border-l border-[#e8e8e8] bg-white overflow-y-auto py-5 px-4 hidden 2xl:block">
        <div className="sticky top-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f0f0f0]">
            <span className="text-[16px]">🤖</span>
            <span className="text-[13px] font-bold text-[#333]">创作助手</span>
          </div>
          <div className="text-[12px] text-[#999] leading-relaxed mb-4">发文助手为你护航，检查笔记是否符合社区规范</div>
          <button className="w-full py-2.5 bg-[#f5f5f5] text-[#333] rounded-full text-[12px] font-medium hover:bg-[#eee] transition mb-3">开始检测</button>
          <div className="text-center text-[11px] text-[#ccc] mb-5">今日剩余 10 次</div>

          {/* 流量提升建议 */}
          <div>
            <h4 className="text-[13px] font-bold text-[#333] mb-3">流量提升建议</h4>
            {[
              { icon: '📝', title: '去优化标题', desc: '为了让更多人搜索到你的作品，建议使用智能推荐标题' },
              { icon: '⏰', title: '在粉丝浏览高峰期发布', desc: '你的粉丝一般会在20:00-21:00浏览作品' },
            ].map((tip, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[#333] hover:text-[#FF7700] cursor-pointer transition">
                  <span>{tip.icon}</span>
                  <span>{tip.title}</span>
                  <ChevronRight size={14} className="ml-auto text-[#ccc]" />
                </div>
                <p className="text-[11px] text-[#999] mt-1 ml-6">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 🔥 4. B站（已完全对齐最新截图） ====================
if (activeEditorTab === 'B站') {
  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto space-y-5">
        <PlatformHeader platform={activeEditorTab} />

        <div className="bg-white p-8 shadow-sm border border-[#e3e4e5] rounded-xl space-y-8">
          
          {/* 标题 */}
          <div className="flex items-center">
            <div className="w-[100px] text-[14px] text-[#222] font-bold flex items-center">
              <span className="text-[#f25d8e] mr-1">*</span>标题
            </div>
            <div className="flex-1 relative flex gap-2">
              <input
                className="flex-1 border border-[#ccd0d7] rounded p-2.5 text-[14px] text-[#222] outline-none focus:border-[#00aeec] transition hover:border-[#b8c0cc]"
                value={pConfig.title ?? uConfig.title}
                onChange={e => updateConfig('B站', 'title', e.target.value)}
                placeholder="请输入标题"
              />
            </div>
          </div>

          {/* 类型：自制 / 转载 */}
          <div className="flex items-center">
            <div className="w-[100px] text-[14px] text-[#222] font-bold">类型</div>
            <div className="flex gap-8">
              <label className="flex items-center cursor-pointer group">
                <input 
                  type="radio" 
                  name="bili_type" 
                  className="mr-2 accent-[#00aeec] w-[15px] h-[15px]" 
                  checked={pConfig.type !== '转载'} 
                  onChange={() => updateConfig('B站', 'type', '自制')} 
                />
                <span className="text-[14px] text-[#222] group-hover:text-[#00aeec] transition">自制</span>
              </label>
              <label className="flex items-center cursor-pointer group">
                <input 
                  type="radio" 
                  name="bili_type" 
                  className="mr-2 accent-[#00aeec] w-[15px] h-[15px]" 
                  checked={pConfig.type === '转载'} 
                  onChange={() => updateConfig('B站', 'type', '转载')} 
                />
                <span className="text-[14px] text-[#222] group-hover:text-[#00aeec] transition">转载</span>
              </label>
            </div>
          </div>

          {/* 分区（科技数码等） */}
          <div className="flex items-center">
            <div className="w-[100px] text-[14px] text-[#222] font-bold flex items-center">
              <span className="text-[#f25d8e] mr-1">*</span>分区
            </div>
            <select 
              className="w-[220px] border border-[#ccd0d7] rounded p-2.5 text-[14px] text-[#222] outline-none focus:border-[#00aeec] hover:border-[#b8c0cc] transition bg-white" 
              value={pConfig.category || '科技数码'} 
              onChange={e => updateConfig('B站', 'category', e.target.value)}
            >
              <option value="科技数码">科技数码</option>
              <option value="游戏">游戏</option>
              <option value="生活">生活</option>
              <option value="知识">知识</option>
              <option value="动画">动画</option>
              <option value="音乐">音乐</option>
              <option value="舞蹈">舞蹈</option>
              <option value="影视">影视</option>
              <option value="娱乐">娱乐</option>
              <option value="鬼畜">鬼畜</option>
              <option value="时尚">时尚</option>
              <option value="其他">其他</option>
            </select>
          </div>

          {/* 简介 */}
          <div className="flex items-start">
            <div className="w-[100px] text-[14px] text-[#222] mt-2 font-bold">简介</div>
            <textarea
              className="flex-1 border border-[#ccd0d7] rounded p-3 text-[14px] text-[#222] outline-none focus:border-[#00aeec] hover:border-[#b8c0cc] transition resize-none h-32"
              placeholder="填写更全面的相关信息，让更多的人能找到你的视频吧"
              value={pConfig.desc ?? uConfig.desc}
              onChange={e => updateConfig('B站', 'desc', e.target.value)}
            />
          </div>

          {/* 定时发布 */}
          <div className="flex items-center border-t border-[#f0f0f0] pt-6">
            <div className="w-[100px] text-[14px] text-[#222] font-bold">定时发布</div>
            <div className="flex items-center gap-3">
              <ToggleRight 
                size={32} 
                className={pConfig.scheduled ? "text-[#00aeec] cursor-pointer" : "text-[#ccd0d7] cursor-pointer"} 
                onClick={() => updateConfig('B站', 'scheduled', !pConfig.scheduled)} 
              />
              <span className="text-[12px] text-[#99a2aa]">
                （可选择距离当前最早≥5分钟/最晚≤15天的时间）
              </span>
            </div>
          </div>
          {pConfig.scheduled && (
            <div className="ml-[100px]">
              <input 
                type="datetime-local" 
                className="border border-[#ccd0d7] rounded p-2 text-[13px] text-[#222] outline-none focus:border-[#00aeec]" 
                value={pConfig.scheduleTime || ''} 
                onChange={e => updateConfig('B站', 'scheduleTime', e.target.value)} 
              />
            </div>
          )}

          {/* 二创设置 + 商业推广 */}
          <div className="flex items-center border-t border-[#f0f0f0] pt-6 gap-8">
            <label className="flex items-center cursor-pointer group">
              <input 
                type="checkbox" 
                className="mr-2 w-[14px] h-[14px] accent-[#00aeec]" 
                checked={pConfig.allowRecreate ?? false} 
                onChange={e => updateConfig('B站', 'allowRecreate', e.target.checked)}
              />
              <span className="text-[14px] text-[#505050] group-hover:text-[#00aeec] transition">允许二创</span>
            </label>

            <label className="flex items-center cursor-pointer group">
              <input 
                type="checkbox" 
                className="mr-2 w-[14px] h-[14px] accent-[#00aeec]" 
                checked={pConfig.commercial ?? false} 
                onChange={e => updateConfig('B站', 'commercial', e.target.checked)}
              />
              <span className="text-[14px] text-[#505050] group-hover:text-[#00aeec] transition">增加商业推广信息</span>
            </label>
          </div>

          {/* 底部按钮 */}
          <div className="pt-8 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
            <button className="px-10 py-2.5 bg-white border border-[#e3e4e5] text-[#505050] rounded-xl text-[14px] font-bold hover:border-[#00aeec] hover:text-[#00aeec] transition shadow-sm">存草稿</button>
            <button 
              onClick={() => handlePublish('B站')} 
              className="px-12 py-2.5 bg-[#00aeec] text-white rounded-xl shadow-md text-[14px] font-bold hover:bg-[#0098ce] transition active:scale-95"
            >
              立即投稿
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 🔥 5. 微信视频号（紧凑适配版） ====================

if (activeEditorTab === '微信视频号') {

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-4 pb-24 font-sans px-3 sm:px-6">
      {/* 容器宽度从 840px 缩至 720px，更适配主流屏幕 */}
      <div className="max-w-[720px] w-full mx-auto space-y-4">
        <PlatformHeader platform={activeEditorTab} />

        {/* 卡片内边距从 p-8 缩至 p-6，垂直间距从 space-y-8 缩至 space-y-6 */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e3e4e5] p-6 space-y-6">

          {/* 基础信息 */}
          <div>
            {/* 标题边距优化 */}
            <h3 className="text-[15px] font-black text-[#333] mb-4 flex items-center border-l-4 border-[#07C160] pl-2">
              基础信息
            </h3>

            {/* 短标题 + 视频描述 */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-[90px] text-[#666] text-[13px] font-bold flex-shrink-0">短标题</div>
                <input 
                  className="flex-1 border border-[#e3e4e5] rounded-xl h-10 px-3 text-[13px] text-[#333] outline-none focus:border-[#07C160] placeholder-[#999]" 
                  placeholder="6–16 字，概括内容" 
                  value={pConfig.title ?? uConfig.title} 
                  onChange={e => updateConfig('微信视频号', 'title', e.target.value)} 
                />
              </div>

              <div className="flex items-start gap-4">
                <div className="w-[90px] text-[#666] text-[13px] font-bold flex-shrink-0 mt-2">视频描述</div>
                <textarea 
                  className="flex-1 border border-[#e3e4e5] rounded-xl p-3 text-[13px] text-[#333] outline-none focus:border-[#07C160] resize-none h-24 placeholder-[#999]" 
                  placeholder="写文案、表情、#话题标签" 
                  value={pConfig.desc ?? uConfig.desc} 
                  onChange={e => updateConfig('微信视频号', 'desc', e.target.value)} 
                />
              </div>
            </div>
          </div>

          {/* 分割线 */}
          <div className="h-px bg-[#f0f0f0]" />

          {/* 权益与商业变现 */}
          <div>
            <h3 className="text-[15px] font-black text-[#333] mb-4 flex items-center border-l-4 border-[#f99b3b] pl-2">
              权益与商业变现
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-[90px] text-[#666] text-[13px] font-bold flex-shrink-0">声明原创</div>
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="mr-2 w-4 h-4 accent-[#07C160]" 
                    checked={pConfig.isOriginal ?? uConfig.original} 
                    onChange={e => updateConfig('微信视频号', 'isOriginal', e.target.checked)} 
                  />
                  <span className="text-[13px] text-[#333]">开启原创声明</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-[90px] text-[#666] text-[13px] font-bold flex-shrink-0">商品挂车</div>
                <input 
                  className="flex-1 border border-[#e3e4e5] rounded-xl h-10 px-3 text-[13px] text-[#333] outline-none focus:border-[#07C160]" 
                  placeholder="粘贴商品ID / 链接" 
                  value={pConfig.productLink || ''} 
                  onChange={e => updateConfig('微信视频号', 'productLink', e.target.value)} 
                />
              </div>
            </div>
          </div>

          {/* 分割线 */}
          <div className="h-px bg-[#f0f0f0]" />

          {/* 流量扩展 */}
          <div>
            <h3 className="text-[15px] font-black text-[#333] mb-4 flex items-center border-l-4 border-[#2b88ff] pl-2">
              流量扩展
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-[90px] text-[#666] text-[13px] font-bold flex-shrink-0">地理位置</div>
                <input 
                  className="flex-1 border border-[#e3e4e5] rounded-xl h-10 px-3 text-[13px] text-[#333] outline-none focus:border-[#07C160]" 
                  placeholder="添加精准定位（提升本地流量）" 
                  value={pConfig.poi || ''} 
                  onChange={e => updateConfig('微信视频号', 'poi', e.target.value)} 
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-[90px] text-[#666] text-[13px] font-bold flex-shrink-0">定时发表</div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="radio" 
                      checked={!pConfig.scheduled} 
                      onChange={() => updateConfig('微信视频号', 'scheduled', false)} 
                      className="accent-[#07C160]" 
                    />
                    <span className="ml-2 text-[13px]">直接发表</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="radio" 
                      checked={pConfig.scheduled} 
                      onChange={() => updateConfig('微信视频号', 'scheduled', true)} 
                      className="accent-[#07C160]" 
                    />
                    <span className="ml-2 text-[13px]">定时发表</span>
                  </label>
                </div>
              </div>

              {/* 定时选择器左边距同步标签宽度 */}
              {pConfig.scheduled && (
                <div className="ml-[90px]">
                  <input 
                    type="datetime-local" 
                    className="border border-[#e3e4e5] rounded-xl h-10 px-3 text-[13px] text-[#333] outline-none focus:border-[#07C160]" 
                    value={pConfig.scheduleTime || ''} 
                    onChange={e => updateConfig('微信视频号', 'scheduleTime', e.target.value)} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* 底部按钮：间距和尺寸优化 */}
          <div className="pt-6 flex justify-center gap-3 border-t border-[#e3e4e5]">
            <button className="px-8 py-2.5 bg-white border border-[#e3e4e5] text-[#666] rounded-xl text-[13px] font-bold hover:bg-[#f9f9f9] transition shadow-sm">存入草稿</button>
            <button 
              onClick={() => handlePublish('微信视频号')} 
              className="px-12 py-2.5 bg-[#07C160] text-white rounded-xl shadow-md text-[14px] font-black hover:bg-[#06ad56] transition active:scale-95 shadow-[#07C160]/30"
            >
              发表至视频号
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

    // ==================== 🔥 6. 百家号（全新SOP版） ====================
    if (activeEditorTab === '百家号') {
      return (
        <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
          <div className="max-w-[840px] w-full mx-auto space-y-5">
            <PlatformHeader platform={activeEditorTab} />

            <div className="bg-white p-6 rounded-xl border border-[#e3e4e5] shadow-sm space-y-5">
              <div>
                <div className="flex justify-between mb-2"><span className="text-[14px] font-bold text-[#333]">文章标题</span><span className="text-[11px] font-mono text-[#999] bg-slate-100 px-2 py-0.5 rounded">{(pConfig.title ?? uConfig.title)?.length || 0}/50</span></div>
                <input className="w-full border border-[#e3e4e5] p-3.5 rounded-xl text-[15px] font-bold outline-none focus:border-[#2b88ff] bg-[#fcfcfc]" placeholder="好的标题能获得更多推荐..." value={pConfig.title ?? uConfig.title} onChange={e => updateConfig('百家号', 'title', e.target.value)} />
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 bg-slate-50 text-[#666] text-[13px] font-bold rounded-lg border border-slate-200 hover:border-[#2b88ff] hover:text-[#2b88ff] transition-all flex items-center"><Hash size={14} className="mr-1.5"/> 插入话题</button>
              </div>
            </div>

            <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
              <button className="px-8 py-2.5 bg-white text-[#666] font-bold rounded-xl text-[13px] hover:bg-slate-50 transition border border-[#e3e4e5] shadow-sm">存入草稿</button>
              <button onClick={() => handlePublish('百家号')} className="px-10 py-2.5 bg-[#2b88ff] text-white font-black rounded-xl text-[13px] hover:bg-[#1a73e8] transition shadow-md shadow-blue-200 active:scale-95">立刻发布至百家号</button>
            </div>
          </div>
        </div>
      );
    }

    // ==================== 7. 知乎 ====================
    if (activeEditorTab === '知乎') {
      return (
        <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
          <div className="max-w-[840px] w-full mx-auto space-y-5">
            <PlatformHeader platform={activeEditorTab} />

            <div className="bg-white rounded-xl shadow-sm border border-[#e3e4e5] p-6 sm:p-8 space-y-8">
              <div>
                <label className="block text-[15px] font-bold text-[#121212] mb-3">专属视频标题</label>
                <input className="w-full border border-[#ebebeb] rounded-lg p-3.5 text-[15px] outline-none focus:border-[#0066ff] transition bg-[#fbfbfb]" value={pConfig.title ?? uConfig.title} onChange={e=>updateConfig('知乎', 'title', e.target.value)} />
              </div>
              <div>
                <label className="block text-[15px] font-bold text-[#121212] mb-3">绑定问题 (知乎特色)</label>
                <input className="w-full border border-[#ebebeb] rounded-lg p-3.5 text-[15px] outline-none focus:border-[#0066ff] transition bg-[#fbfbfb]" placeholder="输入知乎问题链接，视频将作为回答发布" value={pConfig.bindQuestion || ''} onChange={e=>updateConfig('知乎', 'bindQuestion', e.target.value)} />
              </div>
              <div>
                <label className="block text-[15px] font-bold text-[#121212] mb-3">知识标签</label>
                <input className="w-full border border-[#ebebeb] rounded-lg p-3.5 text-[15px] outline-none focus:border-[#0066ff] transition bg-[#fbfbfb]" placeholder="搜索话题标签" value={pConfig.tags || ''} onChange={e=>updateConfig('知乎', 'tags', e.target.value)} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-[15px] font-bold text-[#121212]">专属视频简介</label>
                </div>
                <textarea className="w-full border border-[#ebebeb] rounded-lg p-3.5 text-[15px] outline-none focus:border-[#0066ff] h-32 resize-none bg-[#fbfbfb]" value={pConfig.desc ?? uConfig.desc} onChange={e=>updateConfig('知乎', 'desc', e.target.value)} />
              </div>
              <div className="flex items-center pt-6 border-t border-[#ebebeb]">
                <ToggleRight size={32} className={pConfig.aigc ?? uConfig.aigc ? "text-[#0066ff] cursor-pointer" : "text-[#e3e4e5] cursor-pointer"} onClick={() => updateConfig('知乎', 'aigc', !(pConfig.aigc ?? uConfig.aigc))} />
                <span className="text-[14px] text-[#121212] font-bold ml-2">本内容由 AI 生成</span>
              </div>
            </div>

            <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
              <button className="px-10 py-2.5 bg-white border border-[#e3e4e5] text-[#333] rounded-xl text-[14px] font-bold hover:bg-[#f9f9f9] transition shadow-sm">存草稿</button>
              <button onClick={() => handlePublish('知乎')} className="px-12 py-2.5 bg-[#0066ff] text-white rounded-xl shadow-md text-[14px] font-bold hover:bg-[#005ce6] transition active:scale-95">发布回答</button>
            </div>
          </div>
        </div>
      );
    }

    // ==================== 8. 微博 ====================
    if (activeEditorTab === '微博') {
      return (
        <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
          <div className="max-w-[840px] w-full mx-auto space-y-5">
            <PlatformHeader platform={activeEditorTab} />

            <div className="bg-white rounded-xl shadow-sm border border-[#e3e4e5] p-6 sm:p-8 space-y-6">
              <div>
                <label className="block text-[14px] font-bold text-[#333] mb-3">专属视频标题</label>
                <input className="w-full border border-[#cccccc] rounded-lg p-3.5 text-[14px] outline-none focus:border-[#ff8200] bg-[#fcfcfc]" placeholder="填写微博标题" value={pConfig.title ?? uConfig.title} onChange={e=>updateConfig('微博', 'title', e.target.value)} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-[14px] font-bold text-[#333]">微博文案 (视频将作为附件)</label>
                </div>
                <textarea className="w-full border border-[#cccccc] rounded-lg p-3.5 text-[14px] outline-none focus:border-[#ff8200] h-36 resize-none bg-[#fcfcfc]" placeholder="有什么新鲜事想分享给大家？" value={pConfig.desc ?? uConfig.desc} onChange={e=>updateConfig('微博', 'desc', e.target.value)} />
                <div className="flex gap-4 mt-3">
                  <button className="text-[#eb7350] text-[13px] font-bold flex items-center bg-[#fff8f2] px-4 py-1.5 rounded-full border border-[#ffd8b2] shadow-sm"><Hash size={14} className="mr-1"/>话题</button>
                  <button className="text-[#eb7350] text-[13px] font-bold flex items-center bg-[#fff8f2] px-4 py-1.5 rounded-full border border-[#ffd8b2] shadow-sm"><AtSign size={14} className="mr-1"/>@某人</button>
                  <button className="text-[#eb7350] text-[13px] font-bold flex items-center bg-[#fff8f2] px-4 py-1.5 rounded-full border border-[#ffd8b2] shadow-sm"><MessageCircle size={14} className="mr-1"/>超话挂载</button>
                </div>
              </div>
              <div className="bg-[#f9f9f9] p-4 rounded-xl flex justify-between items-center border border-[#eee]">
                <div className="flex items-center text-[14px] text-[#333] font-bold"><Eye size={18} className="mr-2 text-[#999]"/>可见范围</div>
                <select className="border border-[#ccc] rounded-lg px-3 py-1.5 bg-white outline-none text-[#ff8200] font-bold" value={pConfig.visibility || '公开'} onChange={e=>updateConfig('微博', 'visibility', e.target.value)}>
                  <option>公开</option><option>粉丝可见</option><option>仅自己可见</option>
                </select>
              </div>
            </div>

            <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
              <button className="px-10 py-2.5 bg-white border border-[#e3e4e5] text-[#333] rounded-xl text-[14px] font-bold hover:bg-[#f9f9f9] transition shadow-sm">存草稿</button>
              <button onClick={() => handlePublish('微博')} className="px-12 py-2.5 bg-[#ff8200] text-white rounded-xl shadow-md text-[14px] font-bold hover:bg-[#e67500] transition active:scale-95">发布微博</button>
            </div>
          </div>
        </div>
      );
    }
    // ==================== 9 & 10. 企鹅号 / 腾讯视频 ====================
    if (['企鹅号(腾讯)', '腾讯视频'].includes(activeEditorTab)) {
      return (
        <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
          <div className="max-w-[840px] w-full mx-auto space-y-5">
            <PlatformHeader platform={activeEditorTab} />

            <div className="bg-white shadow-sm border border-[#e3e4e5] rounded-xl p-6 sm:p-8 space-y-8">
              <div>
                <label className="block text-[14px] text-[#000] mb-3 font-bold">专属标题</label>
                <input className="w-full border border-[#e3e4e5] p-3.5 rounded-lg text-[14px] outline-none focus:border-[#00A4FF] bg-[#fcfcfc]" value={pConfig.title ?? uConfig.title} onChange={e=>updateConfig(activeEditorTab, 'title', e.target.value)} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-[14px] text-[#000] font-bold">专属简介</label>
                </div>
                <textarea className="w-full border border-[#e3e4e5] p-3.5 rounded-lg text-[14px] outline-none focus:border-[#00A4FF] h-28 resize-none bg-[#fcfcfc]" value={pConfig.desc ?? uConfig.desc} onChange={e=>updateConfig(activeEditorTab, 'desc', e.target.value)} />
              </div>
              <div>
                <label className="block text-[14px] text-[#000] mb-3 font-bold">分类</label>
                <select className="w-64 border border-[#e3e4e5] p-3.5 rounded-lg text-[14px] outline-none focus:border-[#00A4FF] bg-white" value={pConfig.category || '科技'} onChange={e=>updateConfig(activeEditorTab, 'category', e.target.value)}>
                  <option>科技</option><option>生活</option><option>娱乐</option>
                </select>
              </div>
              <div className="border-t border-[#e5e7eb] pt-6 space-y-4">
                <label className="flex items-center cursor-pointer bg-[#f9fbff] p-4 rounded-xl border border-[#e0f0ff] hover:shadow-sm transition">
                  <input type="checkbox" className="mr-3 w-5 h-5 accent-[#00A4FF]" checked={pConfig.syncTencent ?? true} onChange={(e)=>updateConfig(activeEditorTab, 'syncTencent', e.target.checked)} />
                  <span className="text-[14px] text-[#000] font-bold">腾讯系全网分发 (同步至QQ浏览器、腾讯新闻、微视等)</span>
                </label>
                <label className="flex items-center cursor-pointer bg-[#fafafa] p-4 rounded-xl border border-[#eee] hover:shadow-sm transition">
                  <input type="checkbox" className="mr-3 w-5 h-5 accent-[#00A4FF]" checked={pConfig.aigc ?? uConfig.aigc} onChange={(e)=>updateConfig(activeEditorTab, 'aigc', e.target.checked)} />
                  <span className="text-[14px] text-[#000] font-bold">本内容由 AI 生成</span>
                </label>
              </div>
            </div>

            <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
              <button className="px-10 py-2.5 bg-white border border-[#e3e4e5] text-[#333] rounded-xl text-[14px] font-bold hover:bg-[#f9f9f9] transition shadow-sm">存草稿</button>
              <button onClick={() => handlePublish(activeEditorTab)} className="px-12 py-2.5 bg-[#00A4FF] text-white rounded-xl shadow-md text-[14px] font-bold hover:bg-[#008ce6] transition active:scale-95">发布视频</button>
            </div>
          </div>
        </div>
      );
    }

    // ==================== 11. 大鱼号 ====================
    if (activeEditorTab === '大鱼号(优酷)') {
      return (
        <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
          <div className="max-w-[840px] w-full mx-auto space-y-5">
            <PlatformHeader platform={activeEditorTab} />

            <div className="bg-white rounded-xl shadow-sm border border-[#e3e4e5] p-6 sm:p-8 space-y-8">
              <div>
                <label className="block text-[14px] font-bold text-[#333] mb-3">专属标题</label>
                <input className="w-full border border-[#e3e4e5] p-3.5 rounded-lg text-[14px] outline-none focus:border-[#FF6600] bg-[#fcfcfc]" value={pConfig.title ?? uConfig.title} onChange={e=>updateConfig('大鱼号(优酷)', 'title', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[14px] font-bold text-[#333] mb-3">分类</label>
                  <select className="w-full border border-[#e3e4e5] p-3.5 rounded-lg text-[14px] outline-none focus:border-[#FF6600] bg-white" value={pConfig.category || '科技'} onChange={e=>updateConfig('大鱼号(优酷)', 'category', e.target.value)}>
                    <option>科技</option><option>数码</option><option>生活</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[14px] font-bold text-[#333] mb-3">标签</label>
                  <input className="w-full border border-[#e3e4e5] p-3.5 rounded-lg text-[14px] outline-none focus:border-[#FF6600] bg-[#fcfcfc]" placeholder="添加标签，按回车确认" value={pConfig.tags || ''} onChange={e=>updateConfig('大鱼号(优酷)', 'tags', e.target.value)} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-[14px] font-bold text-[#333]">专属简介</label>
                </div>
                <textarea className="w-full border border-[#e3e4e5] p-3.5 rounded-lg text-[14px] outline-none focus:border-[#FF6600] h-28 resize-none bg-[#fcfcfc]" value={pConfig.desc ?? uConfig.desc} onChange={e=>updateConfig('大鱼号(优酷)', 'desc', e.target.value)} />
              </div>
              <div className="border-t border-[#e8e8e8] pt-6 space-y-4">
                <label className="flex items-center cursor-pointer p-4 bg-[#fff9f5] border border-[#ffe0cc] hover:shadow-sm transition rounded-xl">
                  <input type="checkbox" className="mr-3 w-5 h-5 accent-[#FF6600]" checked={pConfig.syncAli ?? true} onChange={(e)=>updateConfig('大鱼号(优酷)', 'syncAli', e.target.checked)} />
                  <span className="text-[14px] text-[#333] font-bold">阿里系大鱼分发 (同步至 UC浏览器、优酷视频、夸克)</span>
                </label>
                <label className="flex items-center cursor-pointer p-4 hover:bg-[#fafafa] transition rounded-xl border border-transparent">
                  <input type="checkbox" className="mr-3 w-5 h-5 accent-[#FF6600]" checked={pConfig.isOriginal ?? uConfig.original} onChange={(e)=>updateConfig('大鱼号(优酷)', 'isOriginal', e.target.checked)} />
                  <span className="text-[14px] text-[#333] font-bold">原创声明 (星级权益)</span>
                </label>
                <label className="flex items-center cursor-pointer p-4 hover:bg-[#fafafa] transition rounded-xl border border-transparent">
                  <input type="checkbox" className="mr-3 w-5 h-5 accent-[#FF6600]" checked={pConfig.aigc ?? uConfig.aigc} onChange={(e)=>updateConfig('大鱼号(优酷)', 'aigc', e.target.checked)} />
                  <span className="text-[14px] text-[#333] font-bold">内容包含 AI 生成</span>
                </label>
              </div>
            </div>

            <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
              <button className="px-10 py-2.5 bg-white border border-[#e3e4e5] text-[#333] rounded-xl text-[14px] font-bold hover:bg-[#f9f9f9] transition shadow-sm">存草稿</button>
              <button onClick={() => handlePublish('大鱼号(优酷)')} className="px-12 py-2.5 bg-[#FF6600] text-white rounded-xl shadow-md text-[14px] font-bold hover:bg-[#e65c00] transition active:scale-95">发布大鱼号</button>
            </div>
          </div>
        </div>
      );
    }

    // ==================== 12. 爱奇艺号 ====================
    if (activeEditorTab === '爱奇艺号') {
      return (
        <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
          <div className="max-w-[840px] w-full mx-auto space-y-5">
            <PlatformHeader platform={activeEditorTab} />

            <div className="bg-white rounded-xl shadow-sm border border-[#e3e4e5] p-6 sm:p-8 space-y-8">
              <div>
                <label className="block text-[14px] font-bold text-[#333] mb-3">专属视频标题</label>
                <input className="w-full border border-[#e3e4e5] rounded-lg p-3.5 text-[14px] outline-none focus:border-emerald-600 bg-[#fcfcfc]" placeholder="填写爱奇艺标题" value={pConfig.title ?? uConfig.title} onChange={e=>updateConfig('爱奇艺号', 'title', e.target.value)} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-[14px] font-bold text-[#333]">专属简介</label>
                </div>
                <textarea className="w-full border border-[#e3e4e5] rounded-lg p-3.5 text-[14px] outline-none focus:border-emerald-600 h-36 resize-none bg-[#fcfcfc]" value={pConfig.desc ?? uConfig.desc} onChange={e=>updateConfig('爱奇艺号', 'desc', e.target.value)} />
              </div>
            </div>

            <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
              <button className="px-10 py-2.5 bg-white border border-[#e3e4e5] text-[#333] rounded-xl text-[14px] font-bold hover:bg-[#f9f9f9] transition shadow-sm">存草稿</button>
              <button onClick={() => handlePublish('爱奇艺号')} className="px-12 py-2.5 bg-emerald-600 text-white rounded-xl shadow-md text-[14px] font-bold hover:bg-emerald-700 transition active:scale-95">发布爱奇艺</button>
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  }; // 🚨 核心修复：这个大括号在这里收尾！

return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-500 overflow-hidden">
      {/* ─── 步骤指示器 ─── */}
      <div className="flex items-center justify-center gap-1 px-6 pt-4 pb-3 flex-shrink-0">
        {['媒体库', 'AI 填表', '审核发布'].map((label, i) => {
          const isActive = currentStep === i;
          const isDone = currentStep > i;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div className={`w-8 h-0.5 rounded-full ${isDone ? 'bg-purple-500' : 'bg-zinc-300'}`} />
              )}
              <button
                onClick={() => setCurrentStep(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all ${isActive ? 'bg-purple-600 text-white shadow-md' : isDone ? 'bg-purple-100 text-purple-600' : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-white text-purple-600' : isDone ? 'bg-purple-500 text-white' : 'bg-zinc-400 text-white'}`}>
                  {isDone ? <CheckCircle2 size={12} /> : i + 1}
                </span>
                {label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* ─── 步骤 0: 媒体库 ─── */}
      {currentStep === 0 && (
        <MediaLibraryPanel
          mediaFolders={mediaFolders}
          setMediaFolders={setMediaFolders}
          onAddToWorkbench={handleAddToWorkbench}
          onSkipToPublish={(files) => handleSkipToPublish(files)}
        />
      )}

      {/* ─── 步骤 1: AI 填表 ─── */}
      {currentStep === 1 && (
        <AIFillPanel
          workbenchVideos={workbenchVideos}
          setWorkbenchVideos={setWorkbenchVideos}
          onMapToPublish={handleMapToPublish}
          onBack={() => setCurrentStep(0)}
          onSkip={() => handleSkipToPublish(workbenchVideos)}
        />
      )}

      {/* ─── 步骤 2: 审核发布 (原有三栏布局) ─── */}
      {currentStep === 2 && (
      <div className="flex gap-4 pb-2 flex-1 overflow-hidden px-4">
      {/* 左侧：批量待发素材列队区 */}
      {!isPublishFullscreen && !isQueueCollapsed && (
      <div className="w-[260px] bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider">
            待发队列 ({videoList.length})
          </div>
          <button onClick={toggleQueueCollapsed} className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition" title="折叠队列">
            <PanelLeftClose size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {videoList.length === 0 ? (
            <div className="text-xs text-slate-400 text-center mt-10 flex flex-col items-center opacity-60"><Video size={32} className="mb-3" />列队池空空如也</div>
          ) : (
            videoList.map(vid => {
              const isActive = activeVideoId === vid.id;
              let statusColor = 'text-slate-400 bg-slate-100';
              if (vid.status === '已就绪') statusColor = 'text-emerald-600 bg-emerald-50 border border-emerald-200 shadow-sm';
              if (vid.status === '发布中') statusColor = 'text-blue-600 bg-blue-50 border border-blue-200 animate-pulse';

              return (
                <div key={vid.id} onClick={() => setActiveVideoId(vid.id)} className={`group p-3 rounded-xl cursor-pointer transition flex flex-col relative overflow-hidden ${isActive ? 'bg-slate-900 shadow-lg ring-2 ring-indigo-500' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'}`}>
                  <div className={`text-xs font-bold truncate mb-2 pr-8 ${isActive ? 'text-white' : 'text-slate-700'}`}>{vid.name}</div>
                  <div className="flex justify-between items-end">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor}`}>{vid.status}</span>
                  </div>
                  {vid.status !== '发布中' && (
                    <button onClick={(e) => handleRemoveVideo(e, vid.id, vid.name)} className={`absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${isActive ? 'text-red-400 hover:bg-slate-800' : 'text-slate-400 hover:text-red-500 hover:bg-slate-200'}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      )}
      {!isPublishFullscreen && isQueueCollapsed && (
        <div className="w-[44px] bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center flex-shrink-0 py-3 gap-3">
          <button onClick={toggleQueueCollapsed} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition" title="展开队列">
            <PanelLeftOpen size={16} />
          </button>
          <span className="text-[10px] font-black text-slate-400 writing-vertical" style={{ writingMode: 'vertical-rl' }}>
            队列{videoList.length}
          </span>
        </div>
      )}

      {/* 中间：千人千面工作站（左右分栏 + 空间优化） */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-w-[450px]">
        {!activeVideo ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <Globe size={64} className="mb-4 opacity-20" />
            <p className="font-bold text-slate-400">请在左侧导入或点选视频</p>
          </div>
        ) : (
            <>
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-center items-center gap-6 shadow-inner relative overflow-hidden flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className="w-[140px] h-[240px] bg-black rounded-xl overflow-hidden border-[4px] border-slate-700 relative shadow-2xl">
                  <video ref={videoRef} src={activeVideo.url} controls className="w-full h-full object-contain bg-black" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center h-[240px]">
                <div className="w-12 h-0.5 bg-slate-800 mb-4 rounded-full"></div>
                <button onClick={captureCurrentFrame} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-3 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.5)] transition active:scale-95 flex flex-col items-center group">
                  <Scissors size={20} className="mb-1 group-hover:-rotate-12 transition-transform" /> 抽帧封面
                </button>
                <div className="w-12 h-0.5 bg-slate-800 mt-4 rounded-full"></div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-[140px] h-[240px] bg-slate-800 rounded-xl border border-slate-700 relative flex items-center justify-center shadow-lg overflow-hidden">
                  {!activeVideo.config.universal.coverUrl ? <span className="text-[10px] text-slate-500 text-center px-4">物理封面占位图</span> : <img src={activeVideo.config.universal.coverUrl} className="w-full h-full object-cover" alt="封面" />}
                </div>
              </div>
              <button
                onClick={() => setIsPublishFullscreen(!isPublishFullscreen)}
                className="absolute right-3 top-3 p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                title={isPublishFullscreen ? '退出全屏' : '沉浸全屏编辑'}
              >
                {isPublishFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-[72px] bg-slate-50 border-r border-slate-200 flex flex-col items-center flex-shrink-0 overflow-y-auto py-4 gap-4 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                <button 
                  onClick={() => setActiveEditorTab('universal')} 
                  title="通用底稿"
                  className={`relative w-12 h-12 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                    activeEditorTab === 'universal' ? 'bg-slate-800 text-white rounded-xl shadow-md scale-105' : 'bg-white text-slate-500 rounded-full hover:bg-slate-200 hover:rounded-xl shadow-sm'
                  }`}
                >
                  <Globe size={22} />
                  {activeEditorTab === 'universal' && <div className="absolute -left-[14px] w-1.5 h-6 bg-slate-800 rounded-r-full"></div>}
                </button>

                <div className="w-6 h-[2px] bg-slate-200 rounded-full my-1 flex-shrink-0"></div>

                {selectedPlatforms.map(platform => {
                  const brand = getBrand(platform);
                  const isActive = activeEditorTab === platform;
                  const renderLogo = () => {
                    const colorClass = isActive ? "text-white" : brand.text;
                    const charMap = { '小红书': '小', '百家号': '百', '知乎': '知', '企鹅号(腾讯)': '企', '腾讯视频': '腾', '大鱼号(优酷)': '大', '爱奇艺号': '爱' };
                    if (platform === '抖音') return <svg width="22" height="22" viewBox="0 0 48 48" fill={isActive ? "currentColor" : "#fe2c55"} xmlns="http://www.w3.org/2000/svg"><path d="M14 8H22C22 15.6022 26.657 22.0623 34 24V32C30.6863 32 27.6863 30.6569 25.5 28.5C25.5 35.5 25.5 38 25.5 38C25.5 43.5228 21.0228 48 15.5 48C9.97715 48 5.5 43.5228 5.5 38C5.5 32.4772 9.97715 28 15.5 28C17.0673 28 18.5413 28.3614 19.832 29L20 29V19L14 19V8Z" /></svg>;
                    if (platform === 'B站') return <svg width="22" height="22" viewBox="0 0 48 48" fill="none" stroke={isActive ? "currentColor" : "#fb7299"} strokeWidth="4" strokeLinejoin="round"><rect x="6" y="14" width="36" height="28" rx="4"/><path d="M34 6L28 14"/><path d="M14 6L20 14"/><circle cx="16" cy="28" r="2" fill={isActive ? "currentColor" : "#fb7299"}/><circle cx="32" cy="28" r="2" fill={isActive ? "currentColor" : "#fb7299"}/></svg>;
                    if (platform === '微信视频号') return <MessageCircle size={22} className={colorClass} />;
                    if (platform === '快手') return <Video size={22} className={colorClass} />;
                    if (platform === '微博') return <Eye size={22} className={colorClass} />;
                    return <span className={`font-black text-[16px] ${colorClass}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{charMap[platform] || platform.substring(0, 1)}</span>;
                  };

                  return (
                    <button 
                      key={platform} 
                      onClick={() => setActiveEditorTab(platform)} 
                      title={`${platform} 原生站`}
                      className={`relative w-12 h-12 flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
                        isActive ? `${brand.tabBg} ${brand.tabText} rounded-xl shadow-md scale-105` : 'bg-white text-slate-600 rounded-full hover:rounded-xl shadow-sm hover:bg-slate-100'
                      }`}
                    >
                      {renderLogo()}
                      {isActive && <div className={`absolute -left-[14px] w-1.5 h-6 ${brand.bg} rounded-r-full`}></div>}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto relative bg-[#f5f6f7]">
                {renderPlatformEditor()}
              </div>
            </div>
            </>
        )}

        {/* ─── RPA 实时内嵌视图 ─── */}
        {rpaViewActive && activeRunningTask && (
          <div className="border-t border-slate-200 bg-slate-950 flex flex-col overflow-hidden" style={{ height: '280px' }}>
            <div className="h-10 bg-slate-900 text-white flex items-center justify-between px-3 flex-shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)] flex-shrink-0"></div>
                <span className="text-xs font-bold text-emerald-400 truncate">🤖 RPA 实时操作 · {activeRunningTask.platform || ''}</span>
                <span className="text-[10px] text-slate-500 truncate hidden sm:inline">{activeRunningTask.status}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setRpaViewActive(false)}
                  className="text-[10px] px-2 py-1 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                >
                  隐藏
                </button>
              </div>
            </div>
            <div ref={rpaDockRef} className="flex-1 bg-slate-800 w-full h-full relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                <RefreshCw size={32} className="animate-spin mb-3 opacity-40" />
                <p className="text-xs">BrowserView 画面吸附中...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：目标账号 + 发射塔 */}
      {!isPublishFullscreen && (
      <div className="w-80 flex flex-col gap-4 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden border-t-4 border-t-slate-900 h-1/2">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="font-black text-slate-900 text-sm">🎯 为当前视频选账号</span>
            {activeVideo && <span className="text-[10px] font-bold text-indigo-600">已选: {activeVideo.config.targetAccounts.length}</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {!activeVideo ? (
              <div className="text-xs text-slate-400 text-center mt-10 opacity-50">请先在中间选中视频</div>
            ) : accounts.length === 0 ? (
              <div className="text-xs text-slate-400 text-center mt-10">请去左侧主菜单添加账号</div>
            ) : (
              Object.entries(groupedAccounts).map(([groupName, groupAccs]) => {
                const currentTarget = activeVideo.config.targetAccounts || [];
                const groupVals = groupAccs.map(a => `${a.id}|${a.platform}|${a.alias}`);
                const selectedCount = groupVals.filter(val => currentTarget.includes(val)).length;
                const isFullySelected = selectedCount === groupVals.length;

                return (
                  <div key={groupName} className="mb-3">
                    <div onClick={() => handleGroupToggle(groupName)} className={`flex items-center px-4 py-2 rounded-3xl text-sm font-bold cursor-pointer transition-all mb-2 shadow-sm ${isFullySelected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      <span className="flex-1 truncate">{groupName}</span>
                      <span className="text-xs px-3 py-0.5 rounded-full bg-white/70">{selectedCount}/{groupAccs.length}</span>
                    </div>
                    <div className="pl-4 space-y-1">
                      {groupAccs.map(acc => {
                        const val = `${acc.id}|${acc.platform}|${acc.alias}`;
                        const isChecked = currentTarget.includes(val);
                        return (
                          <label key={acc.id} className={`flex items-center p-2.5 rounded-lg border cursor-pointer transition ${isChecked ? 'bg-indigo-50 border-indigo-200' : 'border-transparent'}`}>
                            <input type="checkbox" className="mr-3 w-4 h-4 rounded text-indigo-600" checked={isChecked} onChange={() => handleAccountToggle(val)} />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-slate-800 truncate">{acc.alias}</span>
                              <span className="text-[10px] text-slate-500">{acc.platform}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-3 border-t border-slate-100 bg-slate-50/80">
            <button onClick={handleSaveToLocalDraft} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition shadow-sm ${!activeVideo ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 active:scale-95'}`}>
              <FolderOpen size={16} className="mr-2" /> 📥 存为本地就绪草稿
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-950 rounded-2xl shadow-xl border border-slate-800 flex flex-col overflow-hidden relative">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isDryRun ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-slate-600'}`}></div>
              <span className={`text-[12px] font-black tracking-wider ${isDryRun ? 'text-amber-500' : 'text-slate-500'}`}>🛡️ 预览模式安全栓</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isDryRun} onChange={(e) => setIsDryRun(e.target.checked)} />
              <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600 shadow-inner"></div>
            </label>
          </div>

          <div className="p-4 relative overflow-hidden bg-black flex flex-col justify-center items-center group cursor-pointer active:scale-[0.98] transition-transform" onClick={launchAllQueue}>
            <div className={`absolute inset-0 transition-colors ${isDryRun ? 'bg-amber-900/20 group-hover:bg-amber-900/40' : 'bg-indigo-600/20 group-hover:bg-indigo-600/40'}`}></div>
            <Activity size={24} className={`mb-1 animate-pulse ${isDryRun ? 'text-amber-500' : 'text-indigo-500'}`} />
            <h2 className={`font-black text-lg tracking-widest relative z-10 drop-shadow-md ${isDryRun ? 'text-amber-400' : 'text-white'}`}>
              {isDryRun ? '🛡️ 启动全队列预览' : '🚀 启动全队列发布'}
            </h2>
          </div>
          
          <div className="p-2 border-b border-slate-800 flex justify-between items-center bg-slate-900 border-t">
            <span className="text-[10px] font-bold text-slate-400">实时战况记录仪</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {syncTasks.filter(t => t.status === '排队中' || t.status.includes('中') || t.status === '开始执行').map(task => (
              <div key={task.historyId} className="p-2.5 rounded-lg border bg-indigo-950/20 border-indigo-900/50 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex flex-col pr-2">
                    <span className="text-xs font-bold text-slate-200 truncate">{task.videoName}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{task.platform}</span>
                  </div>
                  <Loader2 size={14} className="text-indigo-400 animate-spin flex-shrink-0" />
                </div>
                <div className="text-[10px] font-mono text-indigo-400">[{task.time}] {task.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
      )}
    </div>
  );
}