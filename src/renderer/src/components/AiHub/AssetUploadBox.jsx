import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, CheckCircle2 } from 'lucide-react';
import { uploadToCloudinary } from '../../services/cloudinaryService';

export default function AssetUploadBox({ onAssetReady }) {
  // 组件内部状态机：idle (空闲) | uploading (上传中) | success (成功) | error (失败)
  const [assetStatus, setAssetStatus] = useState('idle'); 
  const [assetUrl, setAssetUrl] = useState(null);
  const fileInputRef = useRef(null);

  // 触发物理上传
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAssetStatus('uploading');
    
    // 调用 Service 层的纯函数
    const result = await uploadToCloudinary(file);

    if (result.success) {
      setAssetUrl(result.url);
      setAssetStatus('success');
      if (onAssetReady) onAssetReady(result.url); // 成功后，把 URL 传给外层的父组件
    } else {
      setAssetStatus('error');
      alert(`上传阻断: ${result.error}`);
    }
    
    // 清空 input，允许重新上传同名文件
    e.target.value = null; 
  };

  // 重置素材槽
  const handleReset = (e) => {
    e.stopPropagation();
    setAssetStatus('idle');
    setAssetUrl(null);
    if (onAssetReady) onAssetReady(null);
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-black tracking-tight mb-1">步骤 01 / 注入核心物理资产</h3>
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-6">Drag and drop raw material asset below</p>
        
        {/* 隐藏的真实物理输入框 */}
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          onChange={handleFileUpload}
        />

        {/* 动态感官反馈 UI */}
        <div 
          onClick={() => { if (assetStatus === 'idle' || assetStatus === 'error') fileInputRef.current.click(); }}
          className={`w-full h-48 rounded-sm flex flex-col items-center justify-center transition-all relative overflow-hidden ${
            assetStatus === 'success' ? 'border border-zinc-200 bg-zinc-900 shadow-inner' : 
            'border-2 border-dashed border-zinc-300 hover:border-zinc-500 bg-zinc-50/50 cursor-pointer group'
          }`}
        >
          {assetStatus === 'uploading' ? (
            <div className="flex flex-col items-center animate-in zoom-in duration-300">
              <Loader2 size={32} className="text-zinc-600 animate-spin mb-3" />
              <span className="text-xs font-black text-zinc-600">正在与云端存储库建立神经链接...</span>
            </div>
          ) : assetStatus === 'success' ? (
            <div className="w-full h-full relative group/preview animate-in fade-in duration-500">
                {/* 智能探测文件类型：视频直接播，图片直接渲 */}
                {assetUrl?.match(/\.(mp4|webm|mov)/i) ? (
                  <video src={assetUrl} className="w-full h-full object-cover opacity-80" autoPlay loop muted playsInline />
                ) : (
                  <img src={assetUrl} className="w-full h-full object-contain p-2" alt="Uploaded Asset" />
                )}
                
                {/* 悬浮重置遮罩层 */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <button onClick={handleReset} className="bg-white text-black text-xs font-black px-4 py-2 rounded-sm shadow-lg hover:scale-105 transition-transform">
                    丢弃并重置
                  </button>
                </div>
                {/* 成功状态标 */}
                <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur text-white text-[10px] font-black px-2.5 py-1 rounded-sm flex items-center shadow-md">
                  <CheckCircle2 size={12} className="mr-1.5"/> 资产就绪
                </div>
            </div>
          ) : (
            // Idle 状态
            <>
              <UploadCloud size={24} className="text-zinc-400 group-hover:text-black transition-colors mb-2" />
              <span className="text-xs font-black text-zinc-600 group-hover:text-black transition-colors">拖拽或点击上传本地素材</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}