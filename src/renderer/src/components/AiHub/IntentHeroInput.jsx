import React, { useState } from 'react';
import { Loader2, Sparkles, Command } from 'lucide-react';

export default function IntentHeroInput({ onLaunchIntent, isAnalyzing }) {
  const [intentInput, setIntentInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (intentInput.trim() && !isAnalyzing) {
      onLaunchIntent(intentInput); 
    }
  };

  return (
    <section className="bg-zinc-950 text-white py-14 px-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 背景点阵 */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
      
      <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-center z-10">
        描述商业意图，重构多模态资产。
      </h1>
      <p className="text-zinc-400 text-xs mb-6 font-medium z-10 tracking-widest uppercase">
        YuMatrix AGI 引擎将自动为您分配最经济的算力路径与工作流。
      </p>

      {/* 🚀 真正的巨无霸表单区 */}
      <form onSubmit={handleSubmit} className="w-full max-w-4xl relative z-10 group mt-4">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
          {isAnalyzing ? <Loader2 size={24} className="text-white animate-spin" /> : <Sparkles size={24} className="text-zinc-500 group-focus-within:text-white transition-colors" />}
        </div>
        <input 
          type="text" 
          value={intentInput}
          onChange={(e) => setIntentInput(e.target.value)}
          disabled={isAnalyzing}
          placeholder="例如：我想给一双跑鞋生成带有雨水特效的电商短视频..." 
          className="w-full bg-zinc-900/90 border-2 border-zinc-800 focus:border-zinc-500 text-white text-lg font-medium py-6 pl-16 pr-40 rounded-md outline-none transition-all placeholder:text-zinc-600 shadow-2xl disabled:opacity-75"
        />
        <button type="submit" disabled={isAnalyzing || !intentInput.trim()} className="absolute inset-y-2.5 right-2.5 bg-white text-black hover:bg-zinc-200 px-8 font-black text-sm rounded-md transition-colors flex items-center disabled:bg-zinc-800 disabled:text-zinc-500">
          {isAnalyzing ? '语义破译中...' : '智能调度'} <Command size={16} className="ml-2" />
        </button>
      </form>

      {/* 快捷推荐 Tag */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5 z-10">
        {['✦ 自动化营销广告', '✦ 电商主图场景重构', '✦ 爆款文案多调性裂变', '✦ 声音克隆旁白配音'].map((tag) => (
          <button 
            key={tag} 
            type="button" 
            onClick={() => { setIntentInput(tag.replace('✦ ', '')); }} 
            className="text-[11px] font-bold text-zinc-400 border border-zinc-800 hover:border-zinc-500 hover:text-white px-4 py-1.5 rounded-full transition-all bg-zinc-900/30 backdrop-blur-sm"
          >
            {tag}
          </button>
        ))}
      </div>
    </section>
  );
}