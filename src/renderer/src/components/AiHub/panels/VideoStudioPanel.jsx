import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud, Video, Zap, Loader2, CheckCircle2, Download,
  ArrowLeftRight, Sparkles, Play, Camera, Music, Globe, User,
  Wand2, Clapperboard, Monitor, Film, ImageIcon, Palette,
} from 'lucide-react';
import { useAiTasks } from '../AiTaskContext';

const TOOL_META = {
  sv_talking_head: {
    title: 'AI 口播增强器',
    subtitle: '单机位口播 → 自动切多机位 + 素材填充 + 动效字幕',
    icon: Camera,
    iconColor: 'text-teal-400',
    configLabel: '增强风格',
    configIcon: Camera,
    options: [
      { value: 'professional', label: '专业严肃 · 商务讲解' },
      { value: 'energetic', label: '活泼快节奏 · 种草带货' },
      { value: 'calm', label: '治愈慢节奏 · 知识分享' },
      { value: 'vlog', label: 'Vlog 日常 · 轻松随意' },
    ],
    defaultOption: 'energetic',
    accent: 'teal',
    secondaryLabel: '增强项目',
    secondaryOptions: [
      { value: 'all', label: '全流程增强 (机位+素材+字幕)' },
      { value: 'multi_cam', label: '智能多机位切换' },
      { value: 'broll', label: 'B-Roll 素材填充' },
      { value: 'captions', label: '动态字幕特效' },
    ],
    secondaryDefault: 'all',
  },
  sv_auto_clip: {
    title: '一键成片',
    subtitle: '输入文案自动匹配素材 + 智能卡点 + BGM + 字幕，极速出片',
    icon: Clapperboard,
    iconColor: 'text-teal-400',
    configLabel: '视觉风格',
    configIcon: Palette,
    options: [
      { value: 'healing', label: '治愈风景 · 舒缓自然' },
      { value: 'cyber', label: '赛博科技 · 霓虹光影' },
      { value: 'retro', label: '复古胶片 · 文艺质感' },
      { value: 'business', label: '商务极简 · 专业大气' },
      { value: 'food', label: '美食诱惑 · 暖色特写' },
    ],
    defaultOption: 'healing',
    accent: 'teal',
    secondaryLabel: '成片时长',
    secondaryOptions: [
      { value: '15', label: '15 秒 · 短视频' },
      { value: '30', label: '30 秒 · 标准片' },
      { value: '60', label: '60 秒 · 深度内容' },
    ],
    secondaryDefault: '30',
  },
  sv_format_adapter: {
    title: '多平台格式适配器',
    subtitle: '一次创作 → 抖音 9:16 / 小红书 3:4 / B站 16:9 多版本',
    icon: Monitor,
    iconColor: 'text-teal-400',
    configLabel: '目标平台',
    configIcon: Monitor,
    options: [
      { value: 'douyin', label: '抖音 · 9:16 竖屏' },
      { value: 'xiaohongshu', label: '小红书 · 3:4 竖版' },
      { value: 'bilibili', label: 'B 站 · 16:9 横屏' },
      { value: 'weishi', label: '视频号 · 9:16 / 16:9' },
      { value: 'youtube_shorts', label: 'YouTube Shorts · 9:16' },
    ],
    defaultOption: 'douyin',
    accent: 'teal',
    secondaryLabel: '裁剪策略',
    secondaryOptions: [
      { value: 'smart', label: 'AI 智能构图 · 主体追踪' },
      { value: 'center', label: '居中裁剪 · 安全区域' },
      { value: 'reframe', label: '动态重构图 · 关键帧适配' },
    ],
    secondaryDefault: 'smart',
  },
  fl_storyboard: {
    title: 'AI 动态分镜',
    subtitle: '文本描述 → 连贯分镜动画，新海诚/赛博/水墨多种风格',
    icon: Film,
    iconColor: 'text-purple-400',
    configLabel: '视觉风格',
    configIcon: Palette,
    options: [
      { value: 'shinkai', label: '新海诚唯美 · 治愈光影' },
      { value: 'cyberpunk', label: '暗黑赛博朋克 · 霓虹都市' },
      { value: 'ink', label: '中国水墨 · 东方禅意' },
      { value: 'ghibli', label: '吉卜力手绘 · 奇幻童话' },
      { value: 'realistic', label: '写实电影 · 纪实质感' },
    ],
    defaultOption: 'cyberpunk',
    accent: 'purple',
    secondaryLabel: '镜头时长',
    secondaryOptions: [
      { value: '3', label: '3 秒/镜 · 快节奏' },
      { value: '5', label: '5 秒/镜 · 标准叙事' },
      { value: '8', label: '8 秒/镜 · 沉浸体验' },
    ],
    secondaryDefault: '5',
  },
  fl_sora: {
    title: 'Sora 级大片引擎',
    subtitle: '高保真物理规律文生视频，8K 电影级画质输出',
    icon: Sparkles,
    iconColor: 'text-purple-400',
    configLabel: '输出画质',
    configIcon: Film,
    options: [
      { value: '8k', label: '8K 电影级 · 超高保真' },
      { value: '4k', label: '4K 超清 · 标准制作' },
      { value: '2k', label: '2K 高清 · 快速预览' },
    ],
    defaultOption: '4k',
    accent: 'purple',
    secondaryLabel: '影片风格',
    secondaryOptions: [
      { value: 'realistic', label: '写实 · 真实物理世界' },
      { value: 'fantasy', label: '奇幻 · 魔法与神话' },
      { value: 'scifi', label: '科幻 · 未来与太空' },
      { value: 'nature', label: '自然纪录片 · 地球脉动' },
    ],
    secondaryDefault: 'realistic',
  },
  fl_style_transfer: {
    title: '视频风格转绘',
    subtitle: '实拍视频逐帧重绘 → 二次元/机甲/日漫/乐高/GTA 风',
    icon: Wand2,
    iconColor: 'text-purple-400',
    configLabel: '目标风格',
    configIcon: Wand2,
    options: [
      { value: 'anime_90s', label: '90 年代日漫 · 赛璐珞' },
      { value: 'mecha', label: '赛博机甲 · 硬核科幻' },
      { value: 'lego', label: '乐高定格 · 趣味积木' },
      { value: 'gta', label: 'GTA 游戏画面 · 开放世界' },
      { value: 'oil_painting', label: '油画风 · 艺术笔触' },
      { value: 'watercolor', label: '水彩 · 清新淡雅' },
    ],
    defaultOption: 'anime_90s',
    accent: 'purple',
  },
  fl_animate_photo: {
    title: '人物活化',
    subtitle: '静态照片/画像 → 开口说话 + 自然微表情 + 头部微动',
    icon: User,
    iconColor: 'text-purple-400',
    configLabel: '驱动方式',
    configIcon: User,
    options: [
      { value: 'audio', label: '上传音频驱动' },
      { value: 'text', label: '输入文本 · AI 朗读' },
    ],
    defaultOption: 'audio',
    accent: 'purple',
    secondaryLabel: '表情强度',
    secondaryOptions: [
      { value: 'subtle', label: '自然微动 · 看不出 AI 痕迹' },
      { value: 'expressive', label: '丰富表情 · 生动活泼' },
      { value: 'dramatic', label: '夸张演绎 · 戏剧感强' },
    ],
    secondaryDefault: 'subtle',
  },
  fl_global_dist: {
    title: '海外发行本地化',
    subtitle: '多语种翻译 + AI 配音 + 唇形同步 + 字幕本地化',
    icon: Globe,
    iconColor: 'text-purple-400',
    configLabel: '目标语言',
    configIcon: Globe,
    options: [
      { value: 'en_us', label: 'English (美式)' },
      { value: 'es', label: 'Español (西班牙语)' },
      { value: 'ar', label: 'العربية (阿拉伯语)' },
      { value: 'ja', label: '日本語' },
      { value: 'ko', label: '한국어 (韩语)' },
    ],
    defaultOption: 'en_us',
    accent: 'purple',
    secondaryLabel: '输出类型',
    secondaryOptions: [
      { value: 'full', label: '全包 (配音+字幕+唇形)' },
      { value: 'dub', label: '仅 AI 配音' },
      { value: 'sub', label: '仅本地化学幕' },
    ],
    secondaryDefault: 'full',
  },
};

const RENDER_STAGES = [
  '正在解析素材帧与语义特征...',
  'AI 多模态模型分析中...',
  '视频扩散模型逐帧渲染...',
  '音频合成与字幕时间轴对齐...',
  '最终视频编码与质量校验...',
];

const ACCENT_MAP = {
  teal: { border: 'border-teal-400', bg: 'bg-teal-50', text: 'text-teal-700', bar: 'from-teal-500 to-cyan-500' },
  purple: { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', bar: 'from-purple-500 to-violet-500' },
};

function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try { return window.localStorage.getItem(key) !== null ? JSON.parse(window.localStorage.getItem(key)) : defaultValue; }
    catch (e) { return defaultValue; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

const PLACEHOLDER_ART = [
  'https://picsum.photos/seed/video1/800/600',
  'https://picsum.photos/seed/video2/800/600',
  'https://picsum.photos/seed/video3/800/600',
];

export default function VideoStudioPanel({ activeWorkspace, workspaceMeta }) {
  const { guardDispatch } = useAiTasks();
  const meta = useMemo(() => TOOL_META[activeWorkspace] || TOOL_META.sv_auto_clip, [activeWorkspace]);
  const Icon = meta.icon;
  const ac = ACCENT_MAP[meta.accent] || ACCENT_MAP.teal;

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileType, setUploadedFileType] = useState('');
  const [primaryOption, setPrimaryOption] = usePersistentState(`vidstudio_primary_${activeWorkspace}`, meta.defaultOption);
  const [secondaryOption, setSecondaryOption] = usePersistentState(`vidstudio_secondary_${activeWorkspace}`, meta.secondaryDefault || '');

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderComplete, setRenderComplete] = usePersistentState(`vidstudio_complete_${activeWorkspace}`, false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = usePersistentState(`vidstudio_result_${activeWorkspace}`, null);
  const [stageIndex, setStageIndex] = useState(0);

  const fileInputRef = useRef(null);

  const resetCanvas = () => {
    setRenderComplete(false);
    setRenderProgress(0);
    setGeneratedVideoUrl(null);
    setStageIndex(0);
  };

  const processFile = (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return;
    setUploadedFileName(file.name);
    setUploadedFileType(isVideo ? 'video' : 'image');
    const reader = new FileReader();
    reader.onload = () => { setUploadedFile(reader.result); resetCanvas(); };
    reader.readAsDataURL(file);
  };

  const startRender = () => {
    if (!uploadedFile) { alert('请先上传素材文件'); return; }
    if (!guardDispatch()) return;
    resetCanvas();
    setIsRendering(true);
    const totalStages = RENDER_STAGES.length;
    const stageDuration = 700;
    const tickInterval = 80;
    const totalTicks = (totalStages * stageDuration) / tickInterval;
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      const progress = Math.min(Math.round((tick / totalTicks) * 100), 99);
      setRenderProgress(progress);
      setStageIndex(Math.min(Math.floor((tick / totalTicks) * totalStages), totalStages - 1));
      if (tick >= totalTicks) {
        clearInterval(interval);
        setRenderProgress(100);
        setGeneratedVideoUrl(PLACEHOLDER_ART[tick % PLACEHOLDER_ART.length]);
        setTimeout(() => { setIsRendering(false); setRenderComplete(true); }, 600);
      }
    }, tickInterval);
  };

  const handleDownload = () => {
    fetch(generatedVideoUrl || PLACEHOLDER_ART[0])
      .then((r) => r.blob())
      .then((blob) => {
        const u = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = `YuMatrix_${activeWorkspace}_${Date.now()}.mp4`;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(u);
      })
      .catch(() => alert('下载失败'));
  };

  const acceptFormats = ['fl_style_transfer', 'sv_talking_head', 'sv_format_adapter'].includes(activeWorkspace)
    ? 'video/*'
    : 'image/*,video/*';

  const stageText = RENDER_STAGES[stageIndex] || RENDER_STAGES[0];

  return (
    <div className="flex-1 bg-zinc-100 p-6 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-7xl mx-auto w-full h-full">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-300">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              <Icon size={22} className={`mr-2.5 ${meta.iconColor}`} />
              {meta.title}
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">{meta.subtitle}</p>
          </div>
          {!isRendering && !renderComplete && (
            <span className="text-[10px] font-black text-zinc-400 bg-zinc-200 px-3 py-1.5 rounded-sm uppercase tracking-widest">GPU Standby</span>
          )}
          {isRendering && (
            <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-sm uppercase tracking-widest animate-pulse">Rendering</span>
          )}
          {renderComplete && (
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-sm uppercase tracking-widest">Completed</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-5 flex-1">
              <div
                onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files?.[0]); }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-5 text-center cursor-pointer transition-all ${uploadedFile ? `${ac.border} ${ac.bg}` : `border-zinc-300 bg-zinc-50 hover:${ac.border} hover:${ac.bg}`}`}
              >
                <input ref={fileInputRef} type="file" accept={acceptFormats} onChange={(e) => processFile(e.target.files?.[0])} className="hidden" />
                {uploadedFile ? (
                  <div className="space-y-2">
                    {uploadedFileType === 'video' ? (
                      <div className="w-full h-32 bg-zinc-900 rounded-sm border border-zinc-200 flex items-center justify-center">
                        <Play size={28} className="text-zinc-500" />
                      </div>
                    ) : (
                      <img src={uploadedFile} alt="uploaded" className="w-full h-32 object-cover rounded-sm border border-zinc-200" />
                    )}
                    <p className={`text-[10px] font-mono ${ac.text} py-1 px-2 rounded-sm bg-white/60 truncate`}>{uploadedFileName}</p>
                    <p className="text-[10px] font-bold text-zinc-400">点击或拖拽替换素材</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud size={30} className="mx-auto text-zinc-400" />
                    <p className="text-xs font-black text-zinc-600">上传素材文件</p>
                    <p className="text-[10px] text-zinc-400 font-medium">拖拽至此或点击选择 · 图片 / 视频</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">核心参数</label>
                <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                  <meta.configIcon size={14} className={`mr-1.5 ${meta.iconColor}`} />{meta.configLabel}
                </label>
                <select value={primaryOption} onChange={(e) => { setPrimaryOption(e.target.value); resetCanvas(); }}
                  className={`w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:${ac.border} bg-white font-medium transition-colors`}>
                  {meta.options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>

              {meta.secondaryLabel && meta.secondaryOptions && (
                <div>
                  <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                    <Music size={14} className="mr-1.5 text-zinc-400" />{meta.secondaryLabel}
                  </label>
                  <select value={secondaryOption} onChange={(e) => { setSecondaryOption(e.target.value); resetCanvas(); }}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-zinc-400 bg-white font-medium transition-colors">
                    {meta.secondaryOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">预估算力</span>
                <span className={`text-xs font-black ${ac.text} ${ac.bg} border px-2.5 py-1 rounded-sm ${ac.border}`}>-15 算力点</span>
              </div>
            </div>

            <button onClick={startRender} disabled={isRendering || !uploadedFile}
              className={`mt-5 w-full py-3.5 text-white text-sm font-black flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-lg rounded-sm uppercase tracking-wider ${isRendering ? 'bg-zinc-500' : 'bg-black hover:bg-zinc-800'}`}>
              {isRendering ? (<><Loader2 size={16} className="animate-spin" />云端渲染中...</>) : (<><Zap size={16} />启动云端渲染</>)}
            </button>
          </div>

          <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col">
            {!isRendering && !renderComplete && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Sparkles size={56} className="text-zinc-700 mb-6 animate-pulse" />
                <h3 className="text-lg font-black text-zinc-500 tracking-wider uppercase mb-2">等待视频渲染引擎接入...</h3>
                <p className="text-xs text-zinc-600 font-medium max-w-md text-center">上传素材文件，选择 {meta.configLabel}，点击「启动云端渲染」即刻生成</p>
                {uploadedFile && (
                  <div className="mt-8 flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-sm">
                    <Video size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-400">素材就绪 · {uploadedFileName}</span>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                    {meta.configLabel}：{meta.options.find((o) => o.value === primaryOption)?.label || primaryOption}
                  </span>
                  {meta.secondaryLabel && secondaryOption && (
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                      {meta.secondaryLabel}：{meta.secondaryOptions?.find((o) => o.value === secondaryOption)?.label || secondaryOption}
                    </span>
                  )}
                </div>
              </div>
            )}

            {isRendering && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-zinc-700 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-zinc-600 animate-ping absolute" />
                    <Loader2 size={32} className={`${meta.iconColor} animate-spin`} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className={`text-sm font-black ${meta.iconColor} uppercase tracking-widest animate-pulse`}>GPU 张量核心运算中</p>
                  <p className="text-xs text-zinc-500 font-mono">{stageText}</p>
                </div>
                <div className="w-80 space-y-1.5">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${ac.bar} transition-all duration-300 rounded-full`} style={{ width: `${renderProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-600"><span>Render Progress</span><span>{renderProgress}%</span></div>
                </div>
                <div className="flex items-center gap-2">
                  {RENDER_STAGES.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i <= stageIndex ? `${meta.iconColor} shadow-[0_0_6px_rgba(168,85,247,0.6)]` : 'bg-zinc-700'}`} />
                  ))}
                </div>
              </div>
            )}

            {renderComplete && (
              <div className="flex-1 flex flex-col justify-center space-y-6 animate-in zoom-in-95">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={2.5} />
                  <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">{meta.title} · 已完成</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">原素材 · Original</p>
                    <div className="aspect-video bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden flex items-center justify-center">
                      {uploadedFile ? (
                        uploadedFileType === 'video' ? (
                          <div className="flex items-center justify-center"><Play size={36} className="text-zinc-600" /></div>
                        ) : (
                          <img src={uploadedFile} alt="original" className="w-full h-full object-cover opacity-70" />
                        )
                      ) : (<span className="text-zinc-700 text-xs font-bold">—</span>)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-[10px] font-black ${meta.iconColor} uppercase tracking-widest text-center`}>生成视频 · Generated</p>
                    <div className={`aspect-video bg-zinc-900 border ${ac.border}/30 rounded-sm overflow-hidden relative flex items-center justify-center`}>
                      <Play size={40} className="text-zinc-500" />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm">1080P</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center gap-1.5 transition-all">
                    <Download size={14} />下载视频文件
                  </button>
                  <button onClick={resetCanvas} className="border border-zinc-700 hover:border-zinc-400 text-xs font-black px-6 py-2.5 rounded-sm transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeftRight size={14} className="inline mr-1.5" />重新生成
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
