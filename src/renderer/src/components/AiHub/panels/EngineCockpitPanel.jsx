import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud, Zap, Loader2, CheckCircle2, Download, ArrowLeftRight,
  Sparkles, MonitorPlay, Film, Palette, ImageIcon, FileText, Camera,
  Wand2, Sun, Box, MessageSquare, Music, Video, Globe, Users, Layout,
  Clapperboard, Mic, HeadphonesIcon, PenTool, Gamepad2, Rocket, Package,
  TrendingUp, User,
} from 'lucide-react';
import { useAiTasks } from '../AiTaskContext';

// ──────────────────────────────────────────────
// 引擎驾驶舱元数据配置表
// ──────────────────────────────────────────────
const ENGINE_META = {
  content_core: {
    title: '内容驾驶舱',
    engine: '短视频创作引擎',
    tagline: '从灵感到发布，一站式内容创作流水线',
    icon: MonitorPlay,
    themeColor: 'text-teal-400',
    accent: 'teal',
    inputType: 'text',
    inputLabel: '创作灵感 / 脚本大纲',
    inputPlaceholder: '输入你的视频创意或脚本大纲...\n\n例如：做一个关于"早起的 5 个习惯"的 30 秒短视频，治愈系视觉风格，需要黄金 3 秒钩子开头。',
    configLabel: '内容类型',
    configOptions: [
      { value: 'trending', label: '热点追踪 · 追热点出爆款' },
      { value: 'tutorial', label: '教程干货 · 知识科普' },
      { value: 'vlog', label: 'Vlog 日常 · 生活记录' },
      { value: 'commercial', label: '商业带货 · 产品种草' },
      { value: 'story', label: '剧情短剧 · 情绪共鸣' },
    ],
    defaultConfig: 'trending',
    secondaryLabel: '目标平台',
    secondaryOptions: [
      { value: 'douyin', label: '抖音 (9:16)' },
      { value: 'xiaohongshu', label: '小红书 (3:4)' },
      { value: 'bilibili', label: 'B站 (16:9)' },
      { value: 'all', label: '全平台适配' },
    ],
    secondaryDefault: 'douyin',
    stages: [
      '正在分析热点趋势与受众画像...',
      'AI 脚本引擎生成多版本文案...',
      '智能匹配素材库与视觉风格...',
      '自动卡点剪辑 + BGM 合成...',
      '多平台格式适配与字幕渲染...',
    ],
    stats: [
      { label: '日更产能', value: '50+ 条' },
      { label: '平均耗时', value: '3 min/条' },
      { label: '爆款率', value: '提升 3×' },
    ],
    tools: [
      { icon: TrendingUp, label: '热点选题雷达', color: 'text-teal-400' },
      { icon: Zap, label: '黄金 3 秒脚本', color: 'text-teal-400' },
      { icon: FileText, label: '多平台文案裂变', color: 'text-teal-400' },
      { icon: Mic, label: '声音克隆 & 配音', color: 'text-teal-400' },
      { icon: Camera, label: 'AI 口播增强', color: 'text-teal-400' },
      { icon: Clapperboard, label: '一键成片', color: 'text-teal-400' },
      { icon: Music, label: 'BGM 定制工坊', color: 'text-teal-400' },
      { icon: MonitorPlay, label: '多平台格式适配', color: 'text-teal-400' },
    ],
  },
  film_core: {
    title: '制片驾驶舱',
    engine: '影视 & 短剧引擎',
    tagline: '从剧本到成片，一个人就是一支剧组',
    icon: Film,
    themeColor: 'text-purple-400',
    accent: 'purple',
    inputType: 'text',
    inputLabel: '剧本梗概 / 场次描述',
    inputPlaceholder: '输入你的故事梗概或关键场次描述...\n\n例如：赛博朋克世界，一个退役AI杀手为保护街头孤儿重出江湖。第一场：雨夜小巷追击戏。',
    configLabel: '视觉风格',
    configOptions: [
      { value: 'anime', label: '新海诚唯美 · 治愈系' },
      { value: 'cyberpunk', label: '赛博朋克 · 暗黑霓虹' },
      { value: 'ink', label: '中国水墨 · 东方美学' },
      { value: 'ghibli', label: '吉卜力手绘 · 奇幻风' },
      { value: 'realistic', label: '电影级写实 · 8K' },
    ],
    defaultConfig: 'cyberpunk',
    secondaryLabel: '输出类型',
    secondaryOptions: [
      { value: 'script', label: '完整剧本 + 分场大纲' },
      { value: 'storyboard', label: '动态分镜故事板' },
      { value: 'short_film', label: '3 分钟概念短片' },
      { value: 'char_design', label: '角色设定集 + 场景图' },
    ],
    secondaryDefault: 'storyboard',
    stages: [
      '正在解析故事结构与情感弧线...',
      'AI 编剧引擎扩展分场对白...',
      '角色一致性建模与场景构建...',
      '动态分镜渲染与运镜设计...',
      '最终画面合成与影视级调色...',
    ],
    stats: [
      { label: '剧本产能', value: '10 场/次' },
      { label: '分镜速度', value: '30 镜/min' },
      { label: '画质上限', value: '8K 电影级' },
    ],
    tools: [
      { icon: PenTool, label: '剧本加速器', color: 'text-purple-400' },
      { icon: Users, label: '角色 & 世界观', color: 'text-purple-400' },
      { icon: Layout, label: 'AI 动态分镜', color: 'text-purple-400' },
      { icon: Sparkles, label: 'Sora 级大片', color: 'text-purple-400' },
      { icon: Wand2, label: '视频风格转绘', color: 'text-purple-400' },
      { icon: HeadphonesIcon, label: '声音后期全链路', color: 'text-purple-400' },
      { icon: User, label: '人物活化', color: 'text-purple-400' },
      { icon: Globe, label: '海外发行本地化', color: 'text-purple-400' },
    ],
  },
  design_core: {
    title: '视觉设计驾驶舱',
    engine: '创意 & 空间设计引擎',
    tagline: '像素到现实，灵感零延迟的可视化设计中枢',
    icon: Palette,
    themeColor: 'text-cyan-400',
    accent: 'cyan',
    inputType: 'upload',
    inputLabel: '参考图 / 线稿上传',
    inputPlaceholder: '',
    uploadHint: '拖拽至此或点击选择 · JPG / PNG / WebP / SKP截图',
    configLabel: '设计模式',
    configOptions: [
      { value: 'cad_render', label: '线稿/CAD → 3D 效果图' },
      { value: 'rough_finish', label: '毛坯房 → 一键精装' },
      { value: 'lighting', label: '光影氛围重构' },
      { value: 'material', label: '材质 & 质感模拟' },
      { value: 'ip_design', label: 'IP 潮玩盲盒设计' },
    ],
    defaultConfig: 'cad_render',
    secondaryLabel: '风格方向',
    secondaryOptions: [
      { value: 'modern_minimal', label: '现代极简' },
      { value: 'french_luxe', label: '法式轻奢' },
      { value: 'japanese_wabi', label: '日式侘寂' },
      { value: 'industrial', label: '赛博工业风' },
      { value: 'natural_wood', label: '自然原木' },
    ],
    secondaryDefault: 'modern_minimal',
    stages: [
      '正在解析空间结构与材质语义...',
      'AI 空间理解引擎分析光影关系...',
      '多模态扩散模型重构场景...',
      '4K 超分辨率细节增强...',
      '最终画面合成与色彩校准...',
    ],
    stats: [
      { label: '设计迭代', value: '秒级出图' },
      { label: '风格库', value: '50+' },
      { label: '输出分辨率', value: '4K-8K' },
    ],
    tools: [
      { icon: PenTool, label: 'CAD 极速渲染', color: 'text-cyan-400' },
      { icon: Layout, label: '毛坯房精装', color: 'text-cyan-400' },
      { icon: Sun, label: '光影季节切换', color: 'text-cyan-400' },
      { icon: Box, label: '3D 模型生成', color: 'text-cyan-400' },
      { icon: Package, label: 'IP 潮玩设计', color: 'text-cyan-400' },
      { icon: Gamepad2, label: '游戏资产批量', color: 'text-cyan-400' },
      { icon: Camera, label: '摄影后期增强', color: 'text-cyan-400' },
      { icon: Rocket, label: '材质质感模拟', color: 'text-cyan-400' },
    ],
  },
};

// ──────────────────────────────────────────────
// 颜色映射
// ──────────────────────────────────────────────
const ACCENT_MAP = {
  teal: { border: 'border-teal-400', bg: 'bg-teal-50', text: 'text-teal-700', btn: 'bg-teal-500', glow: 'shadow-[0_0_6px_rgba(45,212,191,0.6)]', bar: 'from-teal-500 to-cyan-500', lightBg: 'bg-teal-500/10', lightBorder: 'border-teal-500/30' },
  purple: { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', btn: 'bg-purple-500', glow: 'shadow-[0_0_6px_rgba(168,85,247,0.6)]', bar: 'from-purple-500 to-violet-500', lightBg: 'bg-purple-500/10', lightBorder: 'border-purple-500/30' },
  cyan: { border: 'border-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-700', btn: 'bg-cyan-500', glow: 'shadow-[0_0_6px_rgba(6,182,212,0.6)]', bar: 'from-cyan-500 to-teal-500', lightBg: 'bg-cyan-500/10', lightBorder: 'border-cyan-500/30' },
};

function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try { return window.localStorage.getItem(key) !== null ? JSON.parse(window.localStorage.getItem(key)) : defaultValue; }
    catch (e) { return defaultValue; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

// ──────────────────────────────────────────────
// 组件本体
// ──────────────────────────────────────────────
export default function EngineCockpitPanel({ activeWorkspace, workspaceMeta }) {
  const { guardDispatch } = useAiTasks();
  const coreId = workspaceMeta?.coreId || 'content_core';
  const meta = useMemo(() => ENGINE_META[coreId] || ENGINE_META.content_core, [coreId]);
  const EngineIcon = meta.icon;
  const ac = ACCENT_MAP[meta.accent] || ACCENT_MAP.teal;

  const [textInput, setTextInput] = usePersistentState(`cockpit_input_${coreId}`, '');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [primaryOption, setPrimaryOption] = usePersistentState(`cockpit_primary_${coreId}`, meta.defaultConfig);
  const [secondaryOption, setSecondaryOption] = usePersistentState(`cockpit_secondary_${coreId}`, meta.secondaryDefault || '');

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderComplete, setRenderComplete] = usePersistentState(`cockpit_complete_${coreId}`, false);
  const [generatedUrl, setGeneratedUrl] = usePersistentState(`cockpit_result_${coreId}`, null);
  const [stageIndex, setStageIndex] = useState(0);

  const fileInputRef = useRef(null);

  const resetCanvas = () => {
    setRenderComplete(false);
    setRenderProgress(0);
    setGeneratedUrl(null);
    setStageIndex(0);
  };

  // ── 上传 ──
  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result);
      resetCanvas();
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFile(e.dataTransfer.files?.[0]);
  };

  // ── 渲染模拟 ──
  const startRender = () => {
    if (meta.inputType === 'upload' && !uploadedImage) {
      alert('请先上传参考图');
      return;
    }
    if (meta.inputType === 'text' && !textInput.trim()) {
      alert('请输入创作灵感或脚本大纲');
      return;
    }
    if (!guardDispatch()) return;
    resetCanvas();
    setIsRendering(true);

    const stages = meta.stages;
    const totalStages = stages.length;
    const stageDuration = 700;
    const tickInterval = 80;
    const totalTicks = (totalStages * stageDuration) / tickInterval;
    let tick = 0;

    const interval = setInterval(() => {
      tick++;
      const progress = Math.min(Math.round((tick / totalTicks) * 100), 99);
      const currentStage = Math.min(Math.floor((tick / totalTicks) * totalStages), totalStages - 1);
      setRenderProgress(progress);
      setStageIndex(currentStage);

      if (tick >= totalTicks) {
        clearInterval(interval);
        setRenderProgress(100);
        setGeneratedUrl(`https://picsum.photos/seed/${coreId}_${Date.now()}/800/600`);
        setTimeout(() => {
          setIsRendering(false);
          setRenderComplete(true);
        }, 600);
      }
    }, tickInterval);
  };

  const handleDownload = () => {
    const url = generatedUrl || 'https://picsum.photos/1600/1200';
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `YuMatrix_${coreId}_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
      })
      .catch(() => alert('下载失败'));
  };

  const stageText = meta.stages[stageIndex] || meta.stages[0];
  const canLaunch = meta.inputType === 'upload' ? !!uploadedImage : textInput.trim().length > 0;

  return (
    <div className="flex-1 bg-zinc-100 flex flex-col animate-in slide-in-from-bottom-6 duration-500">
      {/* 顶部横幅 */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-zinc-900 border border-zinc-800`}>
              <EngineIcon size={28} className={meta.themeColor} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">{meta.title}</h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">{meta.engine} · {meta.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {meta.stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className={`text-lg font-black ${meta.themeColor}`}>{stat.value}</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
            {!isRendering && !renderComplete && (
              <span className="text-[10px] font-black text-zinc-500 bg-zinc-800 px-3 py-1.5 rounded-sm uppercase tracking-widest">
                Standby
              </span>
            )}
            {isRendering && (
              <span className={`text-[10px] font-black ${meta.themeColor} bg-zinc-800 px-3 py-1.5 rounded-sm uppercase tracking-widest animate-pulse`}>
                Processing
              </span>
            )}
            {renderComplete && (
              <span className="text-[10px] font-black text-emerald-400 bg-zinc-800 px-3 py-1.5 rounded-sm uppercase tracking-widest">
                Complete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* ═══ 左侧控制台 ═══ */}
            <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-5 flex-1">
                {/* 输入区：文本 或 上传 */}
                {meta.inputType === 'text' ? (
                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                      {meta.inputLabel}
                    </label>
                    <textarea
                      value={textInput}
                      onChange={(e) => { setTextInput(e.target.value); resetCanvas(); }}
                      placeholder={meta.inputPlaceholder}
                      rows={7}
                      className="w-full text-xs p-3 border border-zinc-200 rounded-sm outline-none focus:border-zinc-400 resize-none font-medium leading-relaxed placeholder:text-zinc-400"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-zinc-400 font-mono">{textInput.length} 字符</span>
                      {textInput.trim() && (
                        <span className="text-[9px] text-emerald-500 font-bold">内容已就绪</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-sm p-5 text-center cursor-pointer transition-all ${
                      uploadedImage
                        ? `${ac.border} ${ac.bg}`
                        : `border-zinc-300 bg-zinc-50 hover:${ac.border} hover:${ac.bg}`
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => processFile(e.target.files?.[0])} className="hidden" />
                    {uploadedImage ? (
                      <div className="space-y-2">
                        <img src={uploadedImage} alt="uploaded" className="w-full h-32 object-cover rounded-sm border border-zinc-200" />
                        <p className={`text-[10px] font-mono ${ac.text} py-1 px-2 rounded-sm bg-white/60 truncate`}>{uploadedImageName}</p>
                        <p className="text-[10px] font-bold text-zinc-400">点击或拖拽替换素材</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <UploadCloud size={30} className="mx-auto text-zinc-400" />
                        <p className="text-xs font-black text-zinc-600">上传参考图</p>
                        <p className="text-[10px] text-zinc-400 font-medium">{meta.uploadHint}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 主配置 */}
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">核心参数</label>
                  <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                    <EngineIcon size={14} className={`mr-1.5 ${meta.themeColor}`} />
                    {meta.configLabel}
                  </label>
                  <select
                    value={primaryOption}
                    onChange={(e) => { setPrimaryOption(e.target.value); resetCanvas(); }}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-zinc-400 bg-white font-medium transition-colors"
                  >
                    {meta.configOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* 副配置 */}
                {meta.secondaryLabel && meta.secondaryOptions && (
                  <div>
                    <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                      <MonitorPlay size={14} className="mr-1.5 text-zinc-400" />
                      {meta.secondaryLabel}
                    </label>
                    <select
                      value={secondaryOption}
                      onChange={(e) => { setSecondaryOption(e.target.value); resetCanvas(); }}
                      className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-zinc-400 bg-white font-medium transition-colors"
                    >
                      {meta.secondaryOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 算力 */}
                <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-sm">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">预估算力</span>
                  <span className={`text-xs font-black ${ac.text} ${ac.bg} border px-2.5 py-1 rounded-sm ${ac.border}`}>
                    -{meta.inputType === 'upload' ? 8 : 5} 算力点
                  </span>
                </div>
              </div>

              <button
                onClick={startRender}
                disabled={isRendering || !canLaunch}
                className={`mt-5 w-full py-3.5 text-white text-sm font-black flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-lg rounded-sm uppercase tracking-wider ${
                  isRendering ? 'bg-zinc-500' : 'bg-black hover:bg-zinc-800'
                }`}
              >
                {isRendering ? (
                  <><Loader2 size={16} className="animate-spin" />引擎运算中...</>
                ) : (
                  <><Zap size={16} />启动 {meta.engine.split('&')[0].trim()}</>
                )}
              </button>
            </div>

            {/* ═══ 右侧画布 ═══ */}
            <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col">
              {/* 空态 */}
              {!isRendering && !renderComplete && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Sparkles size={56} className="text-zinc-700 mb-6 animate-pulse" />
                  <h3 className="text-lg font-black text-zinc-500 tracking-wider uppercase mb-2">
                    {meta.engine} · 待命中
                  </h3>
                  <p className="text-xs text-zinc-600 font-medium max-w-md text-center">
                    {meta.inputType === 'text'
                      ? '输入创作灵感，选择内容类型和目标平台，即刻启动 AI 创作流水线'
                      : '上传参考图，选择设计模式和风格方向，即刻启动 AI 设计引擎'}
                  </p>
                  {/* 配置预览 */}
                  <div className="mt-4 flex gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                      {meta.configLabel}：{meta.configOptions.find((o) => o.value === primaryOption)?.label}
                    </span>
                    {secondaryOption && (
                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                        {meta.secondaryLabel}：{meta.secondaryOptions?.find((o) => o.value === secondaryOption)?.label}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 渲染中 */}
              {isRendering && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                  <div className="relative">
                    <div className={`w-20 h-20 rounded-full border-2 ${ac.lightBorder} flex items-center justify-center`}>
                      <div className={`w-16 h-16 rounded-full border-2 ${ac.lightBorder} animate-ping absolute`} />
                      <Loader2 size={32} className={`${meta.themeColor} animate-spin`} />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className={`text-sm font-black ${meta.themeColor} uppercase tracking-widest animate-pulse`}>
                      GPU 集群全力运算中
                    </p>
                    <p className="text-xs text-zinc-500 font-mono">{stageText}</p>
                  </div>
                  <div className="w-80 space-y-1.5">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${ac.bar} transition-all duration-300 rounded-full`}
                        style={{ width: `${renderProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                      <span>Render Progress</span>
                      <span>{renderProgress}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {meta.stages.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          i <= stageIndex ? `${meta.themeColor} ${ac.glow}` : 'bg-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 完成态 */}
              {renderComplete && (
                <div className="flex-1 flex flex-col justify-center space-y-6 animate-in zoom-in-95">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={2.5} />
                    <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                      {meta.title} · 生成完成
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">输入 · Input</p>
                      <div className="aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden flex items-center justify-center p-4">
                        {meta.inputType === 'upload' && uploadedImage ? (
                          <img src={uploadedImage} alt="input" className="w-full h-full object-cover opacity-70 rounded-sm" />
                        ) : (
                          <p className="text-xs text-zinc-600 font-mono text-center leading-relaxed line-clamp-6">
                            {textInput || '(空输入)'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className={`text-[10px] font-black ${meta.themeColor} uppercase tracking-widest text-center`}>生成结果 · Output</p>
                      <div className={`aspect-[4/3] bg-zinc-900 border ${ac.lightBorder} rounded-sm overflow-hidden relative`}>
                        <img src={generatedUrl} alt="output" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm">4K</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center gap-1.5 transition-all">
                      <Download size={14} />下载结果
                    </button>
                    <button onClick={resetCanvas} className="border border-zinc-700 hover:border-zinc-400 text-xs font-black px-6 py-2.5 rounded-sm transition-colors text-zinc-400 hover:text-white">
                      <ArrowLeftRight size={14} className="inline mr-1.5" />重新生成
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 底部工具条 */}
          <div className="mt-6 bg-white border border-zinc-200 rounded-sm p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                引擎工具箱 · {meta.tools.length} 项能力
              </span>
              <span className="text-[9px] text-zinc-400 font-mono">点击首页工具卡片进入专项工作台</span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {meta.tools.map((tool, i) => {
                const ToolIcon = tool.icon;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 p-2 rounded-sm bg-zinc-50 border border-zinc-100 hover:border-zinc-300 hover:bg-white transition-all cursor-default group">
                    <ToolIcon size={16} className={tool.color} />
                    <span className="text-[9px] font-bold text-zinc-500 group-hover:text-zinc-700 text-center leading-tight">
                      {tool.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
