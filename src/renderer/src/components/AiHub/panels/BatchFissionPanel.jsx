import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  UploadCloud, Zap, Loader2, CheckCircle2, Download, Package,
  ArrowLeftRight, Sparkles, Megaphone, ImageIcon, X, Layers,
} from 'lucide-react';
import { useAiTasks } from '../AiTaskContext';

// ──────────────────────────────────────────────
// 工具元数据配置表
// ──────────────────────────────────────────────
const TOOL_META = {
  ec_ad_fission: {
    title: '广告素材裂变器',
    subtitle: '1 张主图 → 多平台 × 多尺寸 × 多风格，批量生成广告创意矩阵',
    icon: Megaphone,
    iconColor: 'text-orange-500',
    accent: 'orange',
    platforms: [
      { id: 'facebook', label: 'Facebook / Instagram', sizes: ['1080×1080', '1080×1920', '1200×628'] },
      { id: 'tiktok', label: 'TikTok Ads', sizes: ['1080×1920', '720×1280'] },
      { id: 'google', label: 'Google Shopping', sizes: ['1200×1200', '800×800'] },
      { id: 'pinterest', label: 'Pinterest Ads', sizes: ['1000×1500', '1000×1000'] },
      { id: 'amazon', label: 'Amazon DSP', sizes: ['1200×1200', '3000×3000'] },
    ],
    styles: [
      { value: 'clean_white', label: '简约白底 · 突出商品' },
      { value: 'lifestyle', label: '生活场景 · 沉浸代入' },
      { value: 'gradient_neon', label: '渐变霓虹 · 年轻潮流' },
      { value: 'dark_luxe', label: '暗调高级 · 奢侈品感' },
      { value: 'seasonal', label: '季节主题 · 应季营销' },
    ],
    defaultStyle: 'clean_white',
    copyCounts: [3, 5, 10, 20],
    defaultCopyCount: 5,
  },
};

const RENDER_STAGES = [
  '正在解析商品主体与品牌调性...',
  'AI 文案引擎生成多版本卖点文案...',
  '多尺寸布局自适应重排中...',
  '平台规范合规校验...',
  '最终素材打包与色彩校准...',
];

function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try { return window.localStorage.getItem(key) !== null ? JSON.parse(window.localStorage.getItem(key)) : defaultValue; }
    catch (e) { return defaultValue; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

function usePersistentSetState(key, defaultSet) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? new Set(JSON.parse(stored)) : defaultSet;
    } catch (e) { return defaultSet; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify([...value])); }, [key, value]);
  return [value, setValue];
}

// ──────────────────────────────────────────────
// 组件本体
// ──────────────────────────────────────────────
export default function BatchFissionPanel({ activeWorkspace, workspaceMeta }) {
  const { guardDispatch } = useAiTasks();
  const meta = useMemo(() => TOOL_META[activeWorkspace] || TOOL_META.ec_ad_fission, [activeWorkspace]);
  const Icon = meta.icon;

  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = usePersistentSetState(`batch_platforms_${activeWorkspace}`, new Set(['facebook']));
  const [selectedSizes, setSelectedSizes] = usePersistentSetState(`batch_sizes_${activeWorkspace}`, new Set(['1080×1080']));
  const [styleVariant, setStyleVariant] = usePersistentState(`batch_style_${activeWorkspace}`, meta.defaultStyle);
  const [copyCount, setCopyCount] = usePersistentState(`batch_count_${activeWorkspace}`, meta.defaultCopyCount);

  const [isRendering, setIsRendering] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [renderComplete, setRenderComplete] = usePersistentState(`batch_complete_${activeWorkspace}`, false);
  const [stageIndex, setStageIndex] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);

  const fileInputRef = useRef(null);

  // ── 计算任务数 ──
  const totalTasks = selectedPlatforms.size * selectedSizes.size * copyCount;

  // ── 平台切换 ──
  const togglePlatform = (id) => {
    if (isRendering) return;
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // 清除该平台不支持的大小
    setSelectedSizes((prev) => {
      const allValidSizes = new Set();
      const newPlatforms = selectedPlatforms.has(id)
        ? new Set([...selectedPlatforms].filter((p) => p !== id))
        : new Set([...selectedPlatforms, id]);
      newPlatforms.forEach((pid) => {
        const p = meta.platforms.find((p) => p.id === pid);
        if (p) p.sizes.forEach((s) => allValidSizes.add(s));
      });
      const next = new Set([...prev].filter((s) => allValidSizes.has(s)));
      if (next.size === 0 && allValidSizes.size > 0) next.add([...allValidSizes][0]);
      return next;
    });
  };

  // ── 尺寸切换 ──
  const toggleSize = (size) => {
    if (isRendering) return;
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) {
        if (next.size > 1) next.delete(size);
      } else {
        next.add(size);
      }
      return next;
    });
  };

  // ── 重置 ──
  const resetCanvas = () => {
    setRenderComplete(false);
    setOverallProgress(0);
    setTasks([]);
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

  const handleFileChange = (e) => {
    processFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFile(e.dataTransfer.files?.[0]);
  };

  // ── 渲染（任务队列） ──
  const startRender = useCallback(() => {
    if (!uploadedImage) {
      alert('请先上传商品图片');
      return;
    }
    if (!guardDispatch()) return;
    resetCanvas();
    setIsRendering(true);

    // 构建任务列表
    const taskList = [];
    [...selectedPlatforms].forEach((platformId) => {
      const platform = meta.platforms.find((p) => p.id === platformId);
      [...selectedSizes].forEach((size) => {
        for (let i = 0; i < copyCount; i++) {
          taskList.push({
            id: `${platformId}_${size.replace('×', 'x')}_v${i + 1}`,
            platformId,
            platformLabel: platform?.label || platformId,
            size,
            status: 'queued',
            progress: 0,
            resultUrl: null,
          });
        }
      });
    });
    setTasks(taskList);

    const totalStages = RENDER_STAGES.length;
    const stageDuration = 600;
    const tickInterval = 100;
    const totalStageTicks = (totalStages * stageDuration) / tickInterval;
    const ticksPerTask = Math.max(1, Math.floor(totalStageTicks / taskList.length));

    let tick = 0;
    let completedTasks = 0;

    const interval = setInterval(() => {
      tick++;
      const currentTaskIdx = Math.min(Math.floor(tick / ticksPerTask), taskList.length - 1);
      const taskProgress = Math.min(
        Math.round(((tick % ticksPerTask) / ticksPerTask) * 100),
        100,
      );

      // 更新阶段
      const currentStage = Math.min(
        Math.floor((tick / totalStageTicks) * totalStages),
        totalStages - 1,
      );
      setStageIndex(currentStage);
      setOverallProgress(Math.min(Math.round((tick / totalStageTicks) * 100), 99));

      // 更新任务状态
      setTasks((prev) =>
        prev.map((t, i) => {
          if (i < currentTaskIdx) {
            return t.status === 'done'
              ? t
              : { ...t, status: 'done', progress: 100, resultUrl: `https://picsum.photos/seed/${t.id}/400/400` };
          }
          if (i === currentTaskIdx) {
            return { ...t, status: 'rendering', progress: taskProgress };
          }
          return t;
        }),
      );

      if (tick >= totalStageTicks) {
        clearInterval(interval);
        setOverallProgress(100);
        setTasks((prev) =>
          prev.map((t) => ({
            ...t,
            status: 'done',
            progress: 100,
            resultUrl: `https://picsum.photos/seed/${t.id}/400/400`,
          })),
        );
        setTimeout(() => {
          setIsRendering(false);
          setRenderComplete(true);
        }, 500);
      }
    }, tickInterval);
  }, [uploadedImage, selectedPlatforms, selectedSizes, copyCount, meta]);

  // ── 单张下载 ──
  const handleDownloadSingle = (task) => {
    const url = task.resultUrl || `https://picsum.photos/seed/${task.id}/800/800`;
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `YuMatrix_${task.platformId}_${task.size}_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
      })
      .catch(() => alert('下载失败'));
  };

  // ── 批量打包下载 ──
  const handleBatchDownload = () => {
    const doneTasks = tasks.filter((t) => t.status === 'done');
    if (doneTasks.length === 0) {
      alert('没有可下载的素材');
      return;
    }
    doneTasks.forEach((task, i) => {
      setTimeout(() => handleDownloadSingle(task), i * 200);
    });
  };

  // ── 颜色映射 ──
  const accentMap = {
    orange: { border: 'border-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', btn: 'bg-orange-500', glow: 'shadow-[0_0_6px_rgba(249,115,22,0.6)]', bar: 'from-orange-500 to-amber-500' },
  };
  const ac = accentMap[meta.accent] || accentMap.orange;

  const stageText = RENDER_STAGES[stageIndex] || RENDER_STAGES[0];
  const doneCount = tasks.filter((t) => t.status === 'done').length;

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
          <div className="flex items-center gap-3">
            {!isRendering && !renderComplete && (
              <span className="text-[10px] font-black text-zinc-400 bg-zinc-200 px-3 py-1.5 rounded-sm uppercase tracking-widest">
                GPU Standby
              </span>
            )}
            {isRendering && (
              <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-sm uppercase tracking-widest animate-pulse">
                Batch Rendering · {doneCount}/{totalTasks}
              </span>
            )}
            {renderComplete && (
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-sm uppercase tracking-widest">
                {totalTasks} Assets Generated
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
          {/* ═══ 左侧控制台 ═══ */}
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5 flex-1">
              {/* 上传区 */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-4 text-center cursor-pointer transition-all ${
                  uploadedImage
                    ? `${ac.border} ${ac.bg}`
                    : `border-zinc-300 bg-zinc-50 hover:${ac.border} hover:${ac.bg}`
                }`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                {uploadedImage ? (
                  <div className="space-y-2">
                    <img src={uploadedImage} alt="uploaded" className="w-full h-28 object-cover rounded-sm border border-zinc-200" />
                    <p className={`text-[10px] font-mono ${ac.text} py-1 px-2 rounded-sm bg-white/60 truncate`}>
                      {uploadedImageName}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-400">点击或拖拽替换素材</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <UploadCloud size={28} className="mx-auto text-zinc-400" />
                    <p className="text-xs font-black text-zinc-600">上传商品主图</p>
                    <p className="text-[10px] text-zinc-400 font-medium">拖拽至此或点击选择 · JPG / PNG / WebP</p>
                  </div>
                )}
              </div>

              {/* 投放平台（多选） */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                  投放平台（多选）
                </label>
                <div className="space-y-1.5">
                  {meta.platforms.map((p) => {
                    const checked = selectedPlatforms.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2.5 p-2 rounded-sm cursor-pointer border transition-all text-xs font-medium ${
                          checked
                            ? `${ac.border} ${ac.bg} ${ac.text}`
                            : 'border-zinc-200 hover:border-zinc-300 text-zinc-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePlatform(p.id)}
                          className="sr-only"
                        />
                        <div className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked ? `${ac.border} bg-orange-500 border-orange-500` : 'border-zinc-300'
                        }`}>
                          {checked && <CheckCircle2 size={10} className="text-white" strokeWidth={4} />}
                        </div>
                        <span className="truncate">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 输出尺寸（多选） */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                  输出尺寸（多选）
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const allSizes = new Set();
                    selectedPlatforms.forEach((pid) => {
                      const p = meta.platforms.find((p) => p.id === pid);
                      if (p) p.sizes.forEach((s) => allSizes.add(s));
                    });
                    return [...allSizes].map((size) => {
                      const checked = selectedSizes.has(size);
                      return (
                        <button
                          key={size}
                          onClick={() => toggleSize(size)}
                          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-sm border transition-all ${
                            checked
                              ? `${ac.border} ${ac.bg} ${ac.text}`
                              : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 风格变体 */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                  视觉风格
                </label>
                <select
                  value={styleVariant}
                  onChange={(e) => setStyleVariant(e.target.value)}
                  className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-orange-400 bg-white font-medium transition-colors"
                >
                  {meta.styles.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* 文案变体数 */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                  每尺寸文案变体数
                </label>
                <div className="flex gap-1.5">
                  {meta.copyCounts.map((n) => (
                    <button
                      key={n}
                      onClick={() => setCopyCount(n)}
                      className={`flex-1 text-xs font-bold py-2 rounded-sm border transition-all ${
                        copyCount === n
                          ? `${ac.border} ${ac.bg} ${ac.text}`
                          : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* 任务摘要 */}
              <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">选中平台</span>
                  <span className="text-xs font-black text-zinc-700">{selectedPlatforms.size} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">输出尺寸</span>
                  <span className="text-xs font-black text-zinc-700">{selectedSizes.size} 种</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">文案变体</span>
                  <span className="text-xs font-black text-zinc-700">{copyCount} 版/尺寸</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">生成总量</span>
                  <span className={`text-sm font-black ${ac.text}`}>{totalTasks} 套素材</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">预估算力</span>
                  <span className={`text-xs font-black ${ac.text}`}>-{Math.min(totalTasks * 2, 50)} 算力点</span>
                </div>
              </div>
            </div>

            {/* 渲染按钮 */}
            <button
              onClick={startRender}
              disabled={isRendering || !uploadedImage || totalTasks === 0}
              className={`mt-5 w-full py-3.5 text-white text-sm font-black flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-lg rounded-sm uppercase tracking-wider ${
                isRendering ? 'bg-zinc-500' : 'bg-black hover:bg-zinc-800'
              }`}
            >
              {isRendering ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  批量渲染中...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  启动批量裂变 ({totalTasks} 套)
                </>
              )}
            </button>
          </div>

          {/* ═══ 右侧主画布 ═══ */}
          <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col overflow-y-auto">
            {/* ── 空态 ── */}
            {!isRendering && !renderComplete && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Sparkles size={56} className="text-zinc-700 mb-6 animate-pulse" />
                <h3 className="text-lg font-black text-zinc-500 tracking-wider uppercase mb-2">
                  等待批量裂变引擎接入...
                </h3>
                <p className="text-xs text-zinc-600 font-medium max-w-md text-center mb-4">
                  上传商品主图，选择平台、尺寸和风格，一键生成全矩阵广告素材
                </p>
                {uploadedImage && (
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-sm">
                    <ImageIcon size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-400">
                      素材就绪 · {uploadedImageName}
                    </span>
                  </div>
                )}
                {/* 配置预览 */}
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                    平台：{[...selectedPlatforms].map((pid) => meta.platforms.find((p) => p.id === pid)?.label.split(' ')[0]).join(' / ')}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                    尺寸：{[...selectedSizes].join(' / ')}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                    风格：{meta.styles.find((s) => s.value === styleVariant)?.label}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                    总量：{totalTasks} 套
                  </span>
                </div>
              </div>
            )}

            {/* ── 渲染中：任务队列 ── */}
            {isRendering && (
              <div className="flex-1 flex flex-col space-y-5 animate-in fade-in">
                {/* 总进度 */}
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="text-orange-400 animate-spin" />
                    <p className="text-sm font-black text-orange-400 uppercase tracking-widest animate-pulse">
                      GPU 集群批量运算中
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono">{stageText}</p>
                  <div className="w-80 mx-auto space-y-1">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${ac.bar} transition-all duration-300 rounded-full`}
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                      <span>Overall Progress</span>
                      <span>{doneCount}/{totalTasks} tasks</span>
                    </div>
                  </div>
                </div>

                {/* 任务队列列表 */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-sm border transition-all ${
                        task.status === 'done'
                          ? 'border-emerald-800 bg-emerald-950/30'
                          : task.status === 'rendering'
                          ? 'border-orange-800 bg-orange-950/20'
                          : 'border-zinc-800 bg-zinc-900/30'
                      }`}
                    >
                      {/* 状态图标 */}
                      <div className="shrink-0">
                        {task.status === 'done' && (
                          <CheckCircle2 size={16} className="text-emerald-500" strokeWidth={2.5} />
                        )}
                        {task.status === 'rendering' && (
                          <Loader2 size={16} className="text-orange-400 animate-spin" />
                        )}
                        {task.status === 'queued' && (
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-600" />
                        )}
                      </div>
                      {/* 任务信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-zinc-400 uppercase">
                            {task.platformLabel}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">{task.size}</span>
                          {task.resultUrl && (
                            <button
                              onClick={() => handleDownloadSingle(task)}
                              className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400 ml-auto flex items-center gap-1"
                            >
                              <Download size={10} /> 下载
                            </button>
                          )}
                        </div>
                        {/* 单任务进度条 */}
                        {task.status !== 'done' && (
                          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full bg-gradient-to-r ${ac.bar} transition-all duration-200 rounded-full`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 完成态：画廊网格 ── */}
            {renderComplete && (
              <div className="flex-1 flex flex-col space-y-5 animate-in zoom-in-95">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={24} className="text-emerald-500" strokeWidth={2.5} />
                    <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                      裂变完成 · {totalTasks} 套素材已生成
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBatchDownload}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-4 py-2 rounded-sm shadow-md flex items-center gap-1.5 transition-all uppercase"
                    >
                      <Package size={14} />
                      批量打包下载
                    </button>
                    <button
                      onClick={resetCanvas}
                      className="border border-zinc-700 hover:border-zinc-400 text-[10px] font-black px-4 py-2 rounded-sm transition-colors text-zinc-400 hover:text-white uppercase flex items-center gap-1.5"
                    >
                      <ArrowLeftRight size={14} />
                      重新裂变
                    </button>
                  </div>
                </div>

                {/* 画廊网格 */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden group hover:border-zinc-600 transition-all"
                      >
                        <div className="aspect-square bg-zinc-900 relative overflow-hidden">
                          <img
                            src={task.resultUrl}
                            alt={task.id}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <button
                            onClick={() => handleDownloadSingle(task)}
                            className="absolute bottom-2 right-2 bg-black/80 hover:bg-black text-white p-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                        <div className="p-2 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-zinc-400 uppercase truncate">
                              {task.platformLabel}
                            </span>
                            <span className="text-[9px] font-mono text-zinc-500">{task.size}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
