import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Video, Trash2, Edit, Globe, Scissors, Wand2, Hash, AtSign, MapPin,
  ShoppingBag, Eye, Settings, ToggleRight, Bot, Shield, Rss, Smile, Link as LinkIcon,
  FolderOpen, Activity, Loader2, Radio, MessageCircle, CheckCircle2,
  ChevronRight, Sparkles, RefreshCw, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, AlertTriangle,
} from 'lucide-react';
import MediaLibraryPanel from './MediaLibraryPanel';
import AIFillPanel from './AIFillPanel';
import XiaohongshuPanel from './XiaohongshuPanel';
import KuaishouPanel from './KuaishouPanel';
import BilibiliPanel from './BilibiliPanel';
import CommonConfigPanel from './CommonConfigPanel';
import WechatChannelsPanel from './WechatChannelsPanel';
import BaijiahaoPanel from './BaijiahaoPanel';
import DouyinPanel from './DouyinPanel';
import { SYSTEM_MEDIA_FOLDER } from '../config/matrixConfig';
import { useToast } from './ToastContext';
import getElectron from '../utils/electron';
import { PLATFORM_COLORS, getBrand } from '../utils/platformHelpers';
import { validatePlatform, getValidationErrorMessages } from '../utils/validation';
import { TaskStatusMonitor } from './TaskStatusMonitor';
import { toMatrixMediaUrl } from '../utils/safePath';

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
export default function PublishTask({ accounts, videoList, setVideoList, activeVideoId, setActiveVideoId, publishHistory, setPublishHistory, setActiveTab, publishStep, setPublishStep, publishEditorTab, setPublishEditorTab, publishWorkbenchVideos, setPublishWorkbenchVideos, isPublishFullscreen, setIsPublishFullscreen }) {
  const electron = getElectron();
  const videoRef = useRef(null);
  const { addToast } = useToast();

  const activeVideo = videoList.find(v => v.id === activeVideoId);
  // 🆕 syncTasks 从 publishHistory 派生（单一数据源，App.jsx 负责监听 IPC）
  const syncTasks = publishHistory
    .filter(t => !['任务圆满成功', '任务成功', '任务失败', '已取消', '任务已取消', '用户终止', '已转手动接管', '手动发布已完成', '需要重新扫码登录'].includes(t.status))
    .map(t => ({
      historyId: t.historyId,
      videoId: t.videoId,
      videoName: t.videoName,
      platform: t.platform,
      accountAlias: t.accountAlias,
      status: t.status,
      time: t.time,
      taskId: t.taskId || '',
      error: t.errorMessage || t.message || ''
    }));
  const [publishingPlatform, setPublishingPlatform] = useState(null);

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

      // 从 AI 结果中取第一个平台的文案作为通用默认值
      let defaultDesc = '';
      let defaultTags = '';
      const platforms = {};
      if (r.aiResult?.platforms) {
        const entries = Object.entries(r.aiResult.platforms);
        if (entries.length > 0) {
          const [, firstData] = entries[0];
          defaultDesc = firstData.desc || '';
          defaultTags = Array.isArray(firstData.tags) ? firstData.tags.join(',') : (firstData.tags || '');
        }
        for (const [pName, pData] of entries) {
          platforms[pName] = {
            title: pData.title || r.title,
            desc: pData.desc || defaultDesc,
            tags: Array.isArray(pData.tags) ? pData.tags.join(',') : (pData.tags || defaultTags),
            category: '科技数码',
          };
        }
      }

      const universal = {
        title: r.title,
        desc: defaultDesc,
        tags: defaultTags,
        category: '科技数码',
        coverUrl: '',
        coverPath: '',
        firstComment: '',
        original: true,
        aigc: false,
      };
      return {
        id,
        path: video.path,
        url: toMatrixMediaUrl(video.path),
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
        url: toMatrixMediaUrl(video.path),
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

    // ─── 发布前校验 ───
    const merged = { ...uConfig, ...pConfig };
    const validation = validatePlatform(merged, platformName);
    if (!validation.valid) {
      const errors = getValidationErrorMessages(validation);
      addToast('error', `${platformName}校验不通过`, errors.join('；'));
      return;
    }

    setPublishingPlatform(platformName);

    const taskData = {
      historyId: `hist_${Date.now()}`,
      videoId: activeVideo.id,
      videoName: activeVideo.name || '未知文件',
      title: (pConfig.title ?? uConfig.title) || '',
      videoPath: activeVideo.videoPath || activeVideo.path,
      coverPath: uConfig.coverPath || '',
      platform: platformName,
      accountId: currentAccountId,
      accountAlias: accountAlias,
      desc: pConfig.desc ?? uConfig.desc ?? '',
      tags: pConfig.tags ?? uConfig.tags ?? '',
      category: pConfig.category || '科技',
      isOriginal: pConfig.isOriginal ?? uConfig.original ?? false, 
      aigc: pConfig.aigc ?? uConfig.aigc ?? false,
      scheduled: (pConfig.scheduleType && pConfig.scheduleType !== 'now') || pConfig.scheduled || false,
      scheduleTime: pConfig.scheduleTime || uConfig.scheduleTime || '',
      syncToutiao: pConfig.syncToutiao ?? true,
      poi: pConfig.poi ?? '',
      productLink: pConfig.productLink ?? '',
      visibility: pConfig.visibility || 'public',
    };

    // 乐观 UI 更新
    setPublishHistory(prev => [{
      ...taskData, status: '排队中', time: new Date().toLocaleTimeString(), startTime: Date.now(),
      _videoSnapshot: { id: activeVideo.id, path: activeVideo.videoPath || activeVideo.path, name: activeVideo.name, config: activeVideo.config },
    }, ...prev]);

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
    } finally {
      setPublishingPlatform(null);
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

  // 🆕 Toast 通知（状态更新由 App.jsx 单一管理，这里只收成功/失败通知）
  useEffect(() => {
    const handleUpdate = (payload) => {
      if (payload.status === '任务圆满成功' || payload.status === '任务成功') {
        addToast('success', '发布成功', payload.title || '未知视频');
      } else if (payload.status === '任务失败') {
        const msg = payload.error || payload.message || '未知错误';
        addToast('error', '发布失败', msg);
      }
    };
    const unsub = electron.ipcRenderer.on('task-progress-update', handleUpdate);
    return () => { if (unsub) unsub(); };
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
    
    const confirmMsg = `🚀 [LIVE_FIRE_MODE]\n侦测到 ${readyQueue.length} 个实弹载荷。\n即将唤醒底层节点，请确认是否点火？`;

    if (!confirm(confirmMsg)) return;

    setVideoList(prev => prev.map(v => v.status === '已就绪' ? { ...v, status: '发布中' } : v));
    
    // 🚀 核心优化：大批量发射后，自动切入总控面板！
    setActiveTab('history'); 

    for (const vid of readyQueue) {
      for (const accStr of vid.config.targetAccounts) {
        const [accountId, platform, accountAlias] = accStr.split('|');
        const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        setPublishHistory(prev => [{ historyId, videoId: vid.id, videoName: vid.name, title: pConfig.title ?? uConfig.title ?? '', coverPath: uConfig.coverPath || '', platform, accountAlias, status: '排队中', time: new Date().toLocaleTimeString(), startTime: Date.now(), taskId: '', _videoSnapshot: { id: vid.id, path: vid.path, name: vid.name, config: vid.config } }, ...prev]);

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
          scheduled: (pConfig.scheduleType && pConfig.scheduleType !== 'now') || pConfig.scheduled || false,
          scheduleTime: pConfig.scheduleTime || uConfig.scheduleTime || '',
          syncToutiao: pConfig.syncToutiao ?? true,
          videoPath: vid.path,
          coverPath: uConfig.coverPath || ''
        });

        if (result.success) {
          setPublishHistory(prev => prev.map(h => h.historyId === historyId ? { ...h, taskId: result.taskId } : h));
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

// ==================== 🔥 1. 抖音（独立 DouyinPanel 组件） ====================
    if (activeEditorTab === '抖音') {
      const dyConfig = { ...uConfig, ...pConfig };
      return (
        <div className="bg-[#f6f6f6] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8 flex justify-center">
          <DouyinPanel
            config={dyConfig}
            onChange={(field, value) => updateConfig('抖音', field, value)}
            onPublish={() => handlePublish('抖音')}
            onSaveDraft={() => updateConfig('抖音', '_draftSaved', true)}
            isPublishing={publishingPlatform === '抖音'}
          />
        </div>
      );
    }

    // ==================== 🔥 2. 小红书（原生编辑器） ====================
    if (activeEditorTab === '小红书') {
      const xhsConfig = { ...uConfig, ...pConfig };
      return (
        <XiaohongshuPanel
          config={xhsConfig}
          onChange={(field, value) => updateConfig('小红书', field, value)}
          onPublish={() => handlePublish('小红书')}
          onSaveDraft={() => updateConfig('小红书', '_draftSaved', true)}
          isPublishing={publishingPlatform === '小红书'}
        />
      );
    }

// ==================== 🔥 3. 快手 ====================
    if (activeEditorTab === '快手') {
      const ksConfig = { ...uConfig, ...pConfig };
      return (
        <KuaishouPanel
          config={ksConfig}
          onChange={(field, value) => updateConfig('快手', field, value)}
          onPublish={() => handlePublish('快手')}
          onSaveDraft={() => updateConfig('快手', '_draftSaved', true)}
          isPublishing={publishingPlatform === '快手'}
        />
      );
    }

// ==================== 🔥 4. B站 ====================
    if (activeEditorTab === 'B站') {
      const biliConfig = { ...uConfig, ...pConfig };
      return (
        <BilibiliPanel
          config={biliConfig}
          onChange={(field, value) => updateConfig('B站', field, value)}
          onPublish={() => handlePublish('B站')}
          onSaveDraft={() => updateConfig('B站', '_draftSaved', true)}
          isPublishing={publishingPlatform === 'B站'}
        />
      );
    }

// ==================== 🔥 5. 微信视频号（全功能专属面板） ====================
if (activeEditorTab === '微信视频号') {
  const wxConfig = { ...uConfig, ...pConfig };
  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 flex justify-center">
      <WechatChannelsPanel
        config={wxConfig}
            onChange={(field, value) => { updateConfig('微信视频号', field, value); if (field === 'coverPath') { updateConfig('universal', 'coverUrl', value); updateConfig('universal', 'coverPath', value); } }}
        onPublish={() => handlePublish('微信视频号')}
        onSaveDraft={() => updateConfig('微信视频号', '_draftSaved', true)}
        activeVideo={activeVideo}
        isPublishing={publishingPlatform === '微信视频号'}
      />
    </div>
  );
}

    // ==================== 🔥 6. 百家号 ====================
    if (activeEditorTab === '百家号') {
      const bjhConfig = { ...uConfig, ...pConfig };
      return (
        <BaijiahaoPanel
          config={bjhConfig}
          onChange={(field, value) => updateConfig('百家号', field, value)}
          onPublish={() => handlePublish('百家号')}
          onSaveDraft={() => updateConfig('百家号', '_draftSaved', true)}
          isPublishing={publishingPlatform === '百家号'}
        />
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
                  {vid.status === '发布中' ? (
                    <button onClick={(e) => handleRemoveVideo(e, vid.id, vid.name)} className={`absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${isActive ? 'text-amber-400 hover:bg-slate-800' : 'text-amber-500 hover:text-red-500 hover:bg-slate-200'}`} title="正在发布中，强制移除将中断当前任务">
                      <AlertTriangle size={14} />
                    </button>
                  ) : (
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
                  {activeVideo.url ? (
                    <video ref={videoRef} src={activeVideo.url} controls className="w-full h-full object-contain bg-black" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">视频源不可用</div>
                  )}
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
                  {activeVideo.config.universal.coverUrl ? <img src={toMatrixMediaUrl(activeVideo.config.universal.coverUrl)} className="w-full h-full object-cover" alt="封面" /> : <span className="text-[10px] text-slate-500 text-center px-4">物理封面占位图</span>}
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
            <div className="bg-slate-900 border-t border-slate-800 px-2 py-1">
              <TaskStatusMonitor activeTasks={[activeRunningTask].filter(Boolean)} compact />
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
          <div className="p-4 relative overflow-hidden bg-black flex flex-col justify-center items-center group cursor-pointer active:scale-[0.98] transition-transform" onClick={launchAllQueue}>
            <div className="absolute inset-0 transition-colors bg-indigo-600/20 group-hover:bg-indigo-600/40"></div>
            <Activity size={24} className="mb-1 animate-pulse text-indigo-500" />
            <h2 className="font-black text-lg tracking-widest relative z-10 drop-shadow-md text-white">
              🚀 启动全队列发布</h2>
          </div>
          
          <div className="p-2 border-b border-slate-800 flex justify-between items-center bg-slate-900 border-t">
            <span className="text-[10px] font-bold text-slate-400">实时战况记录仪</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <TaskStatusMonitor activeTasks={syncTasks.filter(t => t.status === '排队中' || t.status.includes('中') || t.status === '开始执行')} />
            {syncTasks.filter(t => t.status === '排队中' || t.status.includes('中') || t.status === '开始执行').length === 0 && (
              <div className="text-[10px] text-slate-600 text-center py-4">暂无活跃任务</div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
      )}
    </div>
  );
}