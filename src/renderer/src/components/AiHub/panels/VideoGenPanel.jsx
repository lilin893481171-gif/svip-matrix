import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud, Video, Zap, Loader2, CheckCircle2, Download,
  ArrowLeftRight, Sparkles, Play, User, Globe, Camera, Music,
} from 'lucide-react';
import { useAiTasks } from '../AiTaskContext';
import usePersistentState from '../../../hooks/usePersistentState';

// ──────────────────────────────────────────────
// 工具元数据配置表（配置驱动，不改组件逻辑）
// ──────────────────────────────────────────────
const TOOL_META = {
  ec_video_snap: {
    title: '商品短视频工厂',
    subtitle: '单张主图直出 15s 运镜展示视频，BGM + 卖点字幕自动合成',
    icon: Video,
    iconColor: 'text-purple-500',
    configLabel: '运镜风格',
    configIcon: Camera,
    options: [
      { value: '360_orbit', label: '360° 环绕运镜' },
      { value: 'macro_detail', label: '微距细节展示' },
      { value: 'lifestyle', label: '生活场景叙事' },
      { value: 'cinematic', label: '电影级推拉摇移' },
      { value: 'vertical_unbox', label: '竖版开箱节奏' },
    ],
    defaultOption: '360_orbit',
    accent: 'purple',
    secondaryLabel: 'BGM 风格',
    secondaryOptions: [
      { value: 'tech', label: '科技感电子' },
      { value: 'fresh', label: '清新自然' },
      { value: 'dynamic', label: '动感促销' },
      { value: 'elegant', label: '优雅轻奢' },
    ],
    secondaryDefault: 'tech',
  },
  ec_digital_human: {
    title: '数字人直播间',
    subtitle: '克隆老板形象与声音，24h 多语种自动直播带货',
    icon: User,
    iconColor: 'text-blue-500',
    configLabel: '数字人风格',
    configIcon: User,
    options: [
      { value: 'pro_male', label: '专业男主播 · 西装革履' },
      { value: '亲和女主播', label: '亲和女主播 · 休闲自然' },
      { value: 'young_female', label: '元气少女 · 活泼带货' },
      { value: 'senior_male', label: '资深大叔 · 信任感强' },
    ],
    defaultOption: 'pro_male',
    accent: 'blue',
    secondaryLabel: '直播语种',
    secondaryOptions: [
      { value: 'zh', label: '中文普通话' },
      { value: 'en', label: 'English (美式)' },
      { value: 'es', label: 'Español (西班牙语)' },
      { value: 'ar', label: 'العربية (阿拉伯语)' },
    ],
    secondaryDefault: 'zh',
  },
  ec_overseas: {
    title: '出海本地化套件',
    subtitle: '一键切换模特种族 + 目标语言配音 + 唇形同步，素材全球适配',
    icon: Globe,
    iconColor: 'text-cyan-500',
    configLabel: '目标市场',
    configIcon: Globe,
    options: [
      { value: 'us', label: '美国 · 欧美肤色 + 英语' },
      { value: 'me', label: '中东 · 阿拉伯肤色 + 阿语' },
      { value: 'latam', label: '拉美 · 拉丁肤色 + 西语' },
      { value: 'sea', label: '东南亚 · 亚洲深肤 + 泰/越/印尼' },
    ],
    defaultOption: 'us',
    accent: 'cyan',
    secondaryLabel: '输出类型',
    secondaryOptions: [
      { value: 'image_set', label: '静态素材套图 (6 张)' },
      { value: 'short_video', label: '15s 短视频' },
      { value: 'full_pack', label: '全套装 (图+视频+字幕)' },
    ],
    secondaryDefault: 'image_set',
  },
};

const RENDER_STAGES = [
  '正在解析素材帧与运动矢量...',
  'AI 语义分割与深度估计中...',
  '多模态视频扩散模型渲染中...',
  'BGM 合成与字幕时间轴对齐...',
  '最终视频编码与色彩分级...',
];


// ──────────────────────────────────────────────
// 组件本体
// ──────────────────────────────────────────────
export default function VideoGenPanel({ activeWorkspace, workspaceMeta }) {
  const { guardDispatch } = useAiTasks();
  const meta = useMemo(() => TOOL_META[activeWorkspace] || TOOL_META.ec_video_snap, [activeWorkspace]);
  const Icon = meta.icon;

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileType, setUploadedFileType] = useState('');
  const [primaryOption, setPrimaryOption] = usePersistentState(`vidgen_primary_${activeWorkspace}`, meta.defaultOption);
  const [secondaryOption, setSecondaryOption] = usePersistentState(`vidgen_secondary_${activeWorkspace}`, meta.secondaryDefault || '');

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderComplete, setRenderComplete] = usePersistentState(`vidgen_complete_${activeWorkspace}`, false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = usePersistentState(`vidgen_result_${activeWorkspace}`, null);
  const [stageIndex, setStageIndex] = useState(0);

  const fileInputRef = useRef(null);

  // ── 重置 ──
  const resetCanvas = () => {
    setRenderComplete(false);
    setRenderProgress(0);
    setGeneratedVideoUrl(null);
    setStageIndex(0);
  };

  const handlePrimaryChange = (val) => {
    setPrimaryOption(val);
    resetCanvas();
  };
  const handleSecondaryChange = (val) => {
    setSecondaryOption(val);
    resetCanvas();
  };

  // ── 上传（支持图片和视频） ──
  const processFile = (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return;

    setUploadedFileName(file.name);
    setUploadedFileType(isVideo ? 'video' : 'image');
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFile(reader.result);
      resetCanvas();
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFile(e.dataTransfer.files?.[0]);
  };

  // ── 渲染 ──
  const startRender = () => {
    if (!uploadedFile) {
      alert('请先上传素材文件');
      return;
    }
    if (!guardDispatch()) return;
    resetCanvas();
    setIsRendering(true);
    setRenderProgress(0);
    setStageIndex(0);

    const totalStages = RENDER_STAGES.length;
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
        setGeneratedVideoUrl('https://picsum.photos/800/600');
        setTimeout(() => {
          setIsRendering(false);
          setRenderComplete(true);
        }, 600);
      }
    }, tickInterval);
  };

  // ── 下载 ──
  const handleDownload = () => {
    const url = generatedVideoUrl || 'https://picsum.photos/1600/1200';
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `YuMatrix_${activeWorkspace}_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
      })
      .catch(() => alert('下载失败，请检查网络链路'));
  };

  const stageText = RENDER_STAGES[stageIndex] || RENDER_STAGES[0];

  // ── 颜色映射 ──
  const accentMap = {
    purple: { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', btn: 'bg-purple-500', glow: 'shadow-[0_0_6px_rgba(168,85,247,0.6)]', bar: 'from-purple-500 to-violet-500' },
    blue: { border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', btn: 'bg-blue-500', glow: 'shadow-[0_0_6px_rgba(59,130,246,0.6)]', bar: 'from-blue-500 to-cyan-500' },
    cyan: { border: 'border-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-700', btn: 'bg-cyan-500', glow: 'shadow-[0_0_6px_rgba(6,182,212,0.6)]', bar: 'from-cyan-500 to-teal-500' },
  };
  const ac = accentMap[meta.accent] || accentMap.purple;

  const acceptFormats = activeWorkspace === 'ec_digital_human'
    ? 'video/*'
    : 'image/*,video/*';

  const uploadHint = activeWorkspace === 'ec_digital_human'
    ? '拖拽至此或点击选择 · MP4 / MOV / WebM (30s 以内)'
    : '拖拽至此或点击选择 · JPG / PNG / MP4 / MOV';

  return (
    <div className="flex-1 bg-zinc-100 p-6 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-7xl mx-auto w-full h-full">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-300">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              <Icon size={22} className={`mr-2.5 ${meta.iconColor}`} />
              {meta.title}
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">
              {meta.subtitle}
            </p>
          </div>
          {!isRendering && !renderComplete && (
            <span className="text-[10px] font-black text-zinc-400 bg-zinc-200 px-3 py-1.5 rounded-sm uppercase tracking-widest">
              GPU Standby
            </span>
          )}
          {isRendering && (
            <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-sm uppercase tracking-widest animate-pulse">
              Rendering
            </span>
          )}
          {renderComplete && (
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-sm uppercase tracking-widest">
              Completed
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
          {/* ═══ 左侧控制台 ═══ */}
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-5 flex-1">
              {/* 上传区 */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-5 text-center cursor-pointer transition-all ${
                  uploadedFile
                    ? `${ac.border} ${ac.bg}`
                    : `border-zinc-300 bg-zinc-50 hover:${ac.border} hover:${ac.bg}`
                }`}
              >
                <input ref={fileInputRef} type="file" accept={acceptFormats} onChange={handleFileChange} className="hidden" />
                {uploadedFile ? (
                  <div className="space-y-2">
                    {uploadedFileType === 'video' ? (
                      <div className="w-full h-32 bg-zinc-900 rounded-sm border border-zinc-200 flex items-center justify-center">
                        <Play size={28} className="text-zinc-500" />
                      </div>
                    ) : (
                      <img src={uploadedFile} alt="uploaded" className="w-full h-32 object-cover rounded-sm border border-zinc-200" />
                    )}
                    <p className={`text-[10px] font-mono ${ac.text} py-1 px-2 rounded-sm bg-white/60 truncate`}>
                      {uploadedFileName}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-400">点击或拖拽替换素材</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud size={30} className="mx-auto text-zinc-400" />
                    <p className="text-xs font-black text-zinc-600">上传素材文件</p>
                    <p className="text-[10px] text-zinc-400 font-medium">{uploadHint}</p>
                  </div>
                )}
              </div>

              {/* 主配置 */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                  核心参数
                </label>
                <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                  <meta.configIcon size={14} className={`mr-1.5 ${meta.iconColor}`} />
                  {meta.configLabel}
                </label>
                <select
                  value={primaryOption}
                  onChange={(e) => handlePrimaryChange(e.target.value)}
                  className={`w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:${ac.border} bg-white font-medium transition-colors`}
                >
                  {meta.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 副配置 */}
              {meta.secondaryLabel && meta.secondaryOptions && (
                <div>
                  <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                    <Music size={14} className="mr-1.5 text-zinc-400" />
                    {meta.secondaryLabel}
                  </label>
                  <select
                    value={secondaryOption}
                    onChange={(e) => handleSecondaryChange(e.target.value)}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-zinc-400 bg-white font-medium transition-colors"
                  >
                    {meta.secondaryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 算力提示 */}
              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">预估算力</span>
                <span className={`text-xs font-black ${ac.text} ${ac.bg} border px-2.5 py-1 rounded-sm ${ac.border}`}>
                  -15 算力点
                </span>
              </div>
            </div>

            {/* 渲染按钮 */}
            <button
              onClick={startRender}
              disabled={isRendering || !uploadedFile}
              className={`mt-5 w-full py-3.5 text-white text-sm font-black flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-lg rounded-sm uppercase tracking-wider ${
                isRendering ? 'bg-zinc-500' : 'bg-black hover:bg-zinc-800'
              }`}
            >
              {isRendering ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  云端渲染中...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  启动云端渲染
                </>
              )}
            </button>
          </div>

          {/* ═══ 右侧主画布 ═══ */}
          <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col">
            {/* ── 空态 ── */}
            {!isRendering && !renderComplete && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Sparkles size={56} className="text-zinc-700 mb-6 animate-pulse" />
                <h3 className="text-lg font-black text-zinc-500 tracking-wider uppercase mb-2">
                  等待视频渲染引擎接入...
                </h3>
                <p className="text-xs text-zinc-600 font-medium max-w-md text-center">
                  上传素材文件，选择 {meta.configLabel}，点击「启动云端渲染」即刻生成
                </p>
                {uploadedFile && (
                  <div className="mt-8 flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-sm">
                    <Video size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-400">
                      素材就绪 · {uploadedFileName}
                    </span>
                  </div>
                )}
                {/* 配置预览 */}
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

            {/* ── 渲染中 ── */}
            {isRendering && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                <div className="relative">
                  <div className={`w-20 h-20 rounded-full border-2 border-${meta.accent}-500/30 flex items-center justify-center`}>
                    <div className={`w-16 h-16 rounded-full border-2 border-${meta.accent}-500/50 animate-ping absolute`} />
                    <Loader2 size={32} className={`text-${meta.accent}-400 animate-spin`} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className={`text-sm font-black text-${meta.accent}-400 uppercase tracking-widest animate-pulse`}>
                    GPU 张量核心运算中
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
                {/* 阶段指示器 */}
                <div className="flex items-center gap-2">
                  {RENDER_STAGES.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i <= stageIndex ? `bg-${meta.accent}-400 ${ac.glow}` : 'bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── 完成态：对比图 ── */}
            {renderComplete && (
              <div className="flex-1 flex flex-col justify-center space-y-6 animate-in zoom-in-95">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={2.5} />
                  <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                    {meta.title} · 已完成
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">
                      原素材 · Original
                    </p>
                    <div className="aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
                      {uploadedFile ? (
                        uploadedFileType === 'video' ? (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                            <Play size={36} className="text-zinc-600" />
                          </div>
                        ) : (
                          <img src={uploadedFile} alt="original" className="w-full h-full object-cover opacity-70" />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">—</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-[10px] font-black text-${meta.accent}-400 uppercase tracking-widest text-center`}>
                      生成视频 · Generated
                    </p>
                    <div className={`aspect-[4/3] bg-zinc-900 border ${ac.border}/30 rounded-sm overflow-hidden relative flex items-center justify-center`}>
                      <Play size={40} className="text-zinc-500" />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm">1080P</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center gap-1.5 transition-all">
                    <Download size={14} />
                    下载视频文件
                  </button>
                  <button onClick={resetCanvas} className="border border-zinc-700 hover:border-zinc-400 text-xs font-black px-6 py-2.5 rounded-sm transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeftRight size={14} className="inline mr-1.5" />
                    重新生成
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
