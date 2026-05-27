import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Store,
  UserRound,
  Zap,
  Loader2,
  CheckCircle2,
  Download,
  ArrowLeftRight,
  Sparkles,
  Palette,
  Users,
} from 'lucide-react';

const SCENE_STYLES = [
  { value: 'nordic', label: '极简北欧' },
  { value: 'cyber-neon', label: '赛博霓虹' },
  { value: 'nature', label: '自然户外' },
  { value: 'studio', label: '影棚柔光' },
  { value: 'retro', label: '复古胶片' },
];

const MODEL_FEATURES = [
  { value: 'asian', label: '亚洲面孔' },
  { value: 'european', label: '欧美面孔' },
  { value: 'mixed', label: '混血面孔' },
  { value: 'african', label: '非洲面孔' },
];

const RENDER_STAGES = [
  '正在解析 SKU 光影特征...',
  '材质纹理映射中...',
  '场景语义理解与重构...',
  '多模态生成对抗网络渲染...',
  '4K 超分辨率增强中...',
];

export default function EcommerceCorePanel() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [taskMode, setTaskMode] = useState('scene');
  const [sceneStyle, setSceneStyle] = useState('nordic');
  const [modelFeature, setModelFeature] = useState('asian');
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderComplete, setRenderComplete] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [stageIndex, setStageIndex] = useState(0);
  const fileInputRef = useRef(null);

  const resetCanvas = () => {
    setRenderComplete(false);
    setRenderProgress(0);
    setGeneratedImageUrl(null);
    setStageIndex(0);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result);
      resetCanvas();
    };
    reader.readAsDataURL(file);
  };

  const startRender = () => {
    if (!uploadedImage) {
      alert('请先上传产品 SKU / 样衣图片');
      return;
    }
    resetCanvas();
    setIsRendering(true);
    setRenderProgress(0);
    setStageIndex(0);

    const totalStages = RENDER_STAGES.length;
    const stageDuration = 600;
    const tickInterval = 80;
    const totalTicks = (totalStages * stageDuration) / tickInterval;
    let tick = 0;

    const interval = setInterval(() => {
      tick++;
      const progress = Math.min(Math.round((tick / totalTicks) * 100), 99);
      const currentStage = Math.min(
        Math.floor((tick / totalTicks) * totalStages),
        totalStages - 1,
      );
      setRenderProgress(progress);
      setStageIndex(currentStage);

      if (tick >= totalTicks) {
        clearInterval(interval);
        setRenderProgress(100);
        setGeneratedImageUrl('https://picsum.photos/800/600');
        setTimeout(() => {
          setIsRendering(false);
          setRenderComplete(true);
        }, 600);
      }
    }, tickInterval);
  };

  const handleDownload = () => {
    const url =
      generatedImageUrl || 'https://picsum.photos/1600/1200';
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `YuMatrix_4K_${taskMode}_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
      })
      .catch(() => alert('下载失败，请检查网络链路'));
  };

  const currentStageText =
    RENDER_STAGES[stageIndex] || RENDER_STAGES[0];

  return (
    <div className="flex-1 bg-zinc-100 p-6 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-7xl mx-auto w-full h-full">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-300">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              <Store size={22} className="mr-2.5 text-amber-600" />
              AI 电商视觉生成专区
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">
              Product Visual Engine · 场景重构 & 虚拟模特
            </p>
          </div>
          {!isRendering && !renderComplete && (
            <span className="text-[10px] font-black text-zinc-400 bg-zinc-200 px-3 py-1.5 rounded-sm uppercase tracking-widest">
              Cloud GPU Standby
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
          {/* ========== 左侧控制台 ========== */}
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-6 flex-1">
              {/* 上传区 */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-all ${
                  uploadedImage
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-zinc-300 bg-zinc-50 hover:border-amber-400 hover:bg-amber-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadedImage ? (
                  <div className="space-y-2">
                    <img
                      src={uploadedImage}
                      alt="uploaded"
                      className="w-full h-32 object-cover rounded-sm border border-zinc-200"
                    />
                    <p className="text-[10px] font-mono text-emerald-700 bg-emerald-100 py-1 px-2 rounded-sm truncate">
                      {uploadedImageName}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-400">
                      点击或拖拽替换素材
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud
                      size={32}
                      className="mx-auto text-zinc-400"
                    />
                    <p className="text-xs font-black text-zinc-600">
                      上传产品 SKU / 样衣
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      拖拽至此或点击选择 · 支持 JPG/PNG/WebP
                    </p>
                  </div>
                )}
              </div>

              {/* 任务模式切换 */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                  核心任务
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 p-1 rounded-sm">
                  <button
                    onClick={() => {
                      setTaskMode('scene');
                      resetCanvas();
                    }}
                    className={`py-2.5 text-xs font-black rounded-sm flex items-center justify-center gap-1.5 transition-all ${
                      taskMode === 'scene'
                        ? 'bg-white text-black shadow-sm border border-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <Palette size={14} />
                    场景重构
                  </button>
                  <button
                    onClick={() => {
                      setTaskMode('model');
                      resetCanvas();
                    }}
                    className={`py-2.5 text-xs font-black rounded-sm flex items-center justify-center gap-1.5 transition-all ${
                      taskMode === 'model'
                        ? 'bg-white text-black shadow-sm border border-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <UserRound size={14} />
                    虚拟模特
                  </button>
                </div>
              </div>

              {/* 条件参数 */}
              {taskMode === 'scene' ? (
                <div>
                  <label className="text-xs font-black flex items-center mb-3 text-zinc-700">
                    <Palette size={14} className="mr-1.5 text-amber-500" />
                    场景风格
                  </label>
                  <select
                    value={sceneStyle}
                    onChange={(e) => {
                      setSceneStyle(e.target.value);
                      resetCanvas();
                    }}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-amber-400 bg-white font-medium"
                  >
                    {SCENE_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-black flex items-center mb-3 text-zinc-700">
                    <Users size={14} className="mr-1.5 text-violet-500" />
                    模特特征
                  </label>
                  <select
                    value={modelFeature}
                    onChange={(e) => {
                      setModelFeature(e.target.value);
                      resetCanvas();
                    }}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-violet-400 bg-white font-medium"
                  >
                    {MODEL_FEATURES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 计费提示 */}
              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                  预估算力消耗
                </span>
                <span className="text-xs font-black text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-sm">
                  -{taskMode === 'scene' ? '18' : '22'} 算力点
                </span>
              </div>
            </div>

            {/* 渲染按钮 */}
            <button
              onClick={startRender}
              disabled={isRendering || !uploadedImage}
              className="mt-6 w-full py-3.5 bg-black text-white text-sm font-black flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-lg rounded-sm uppercase tracking-wider"
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

          {/* ========== 右侧视觉主画布 ========== */}
          <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col">
            {/* 默认状态：空态 */}
            {!isRendering && !renderComplete && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Sparkles
                  size={56}
                  className="text-zinc-700 mb-6 animate-pulse"
                />
                <h3 className="text-lg font-black text-zinc-500 tracking-wider uppercase mb-2">
                  等待多模态视觉引擎接入...
                </h3>
                <p className="text-xs text-zinc-600 font-medium max-w-md text-center">
                  请在左侧上传产品图片并选择任务模式，点击「启动云端渲染」开始生成
                </p>
                {uploadedImage && (
                  <div className="mt-8 flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-sm">
                    <ImageIcon size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-400">
                      素材已就绪 · {uploadedImageName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 渲染中 */}
            {isRendering && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                {/* 脉冲环 */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-amber-500/30 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-amber-500/50 animate-ping absolute" />
                    <Loader2
                      size={32}
                      className="text-amber-400 animate-spin"
                    />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-sm font-black text-amber-400 uppercase tracking-widest animate-pulse">
                    GPU 渲染矩阵工作中
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {currentStageText}
                  </p>
                </div>

                {/* 进度条 */}
                <div className="w-80 space-y-1.5">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 rounded-full"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                    <span>Tensor Core</span>
                    <span>{renderProgress}%</span>
                  </div>
                </div>

                {/* 阶段指示器 */}
                <div className="flex items-center gap-2">
                  {RENDER_STAGES.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i <= stageIndex
                          ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                          : 'bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 完成态：对比图 */}
            {renderComplete && (
              <div className="flex-1 flex flex-col justify-center space-y-6 animate-in zoom-in-95">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2
                    size={28}
                    className="text-emerald-500"
                    strokeWidth={2.5}
                  />
                  <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                    视觉资产已生成
                  </span>
                </div>

                {/* 左右对比 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">
                      原图 · Original
                    </p>
                    <div className="aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
                      {uploadedImage ? (
                        <img
                          src={uploadedImage}
                          alt="original"
                          className="w-full h-full object-cover opacity-70"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">
                          NO SOURCE
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest text-center">
                      生成图 · Generated
                    </p>
                    <div className="aspect-[4/3] bg-zinc-900 border border-amber-500/30 rounded-sm overflow-hidden relative">
                      <img
                        src={
                          generatedImageUrl ||
                          'https://picsum.photos/800/600'
                        }
                        alt="generated"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm">
                        4K
                      </div>
                    </div>
                  </div>
                </div>

                {/* 操作栏 */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleDownload}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center gap-1.5 transition-all"
                  >
                    <Download size={14} />
                    下载 4K 高清图
                  </button>
                  <button
                    onClick={resetCanvas}
                    className="border border-zinc-700 hover:border-zinc-400 text-xs font-black px-6 py-2.5 rounded-sm transition-colors text-zinc-400 hover:text-white"
                  >
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
