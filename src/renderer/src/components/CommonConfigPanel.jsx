import React, { useState } from 'react';
import { toMatrixMediaUrl } from '../utils/safePath';

export default function CommonConfigPanel({ config, onChange, activeVideo }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const tags = (cfg.tags || '').split(/\s+/).filter(Boolean);
  const firstComment = cfg.firstComment || '';
  const scheduled = cfg.scheduled || false;
  const scheduleType = cfg.scheduleType || 'now';
  const coverSrc = toMatrixMediaUrl(cfg.coverUrl || cfg.coverPath);
  const [tagInput, setTagInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const newTag = tagInput.trim();
      if (!tags.includes(newTag)) {
        const next = [...tags, newTag];
        set('tags', next.join(' '));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (idx) => {
    const next = tags.filter((_, i) => i !== idx);
    set('tags', next.join(' '));
  };

  const handleAIGenerate = () => {
    setIsAiGenerating(true);
    setTimeout(() => setIsAiGenerating(false), 2000);
  };

  const handleScheduleChange = (type) => {
    set('scheduleType', type);
    set('scheduled', type !== 'now');
  };

  return (
    <div className="w-full max-w-[620px] bg-white rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 font-sans text-[14px] text-gray-800 animate-in fade-in duration-300">
      <div className="mb-8 border-b border-gray-100 pb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">所有平台统一设置发布编辑</h2>
        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded font-medium border border-purple-100">
          AI 智能中枢已就绪
        </span>
      </div>

      <div className="space-y-6">

        {/* ================= 1. 主视觉区域：横封面 + 竖封面 ================= */}
        <div className="flex items-start">
          <div className="w-[80px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">主视觉</div>
          <div className="flex gap-6 flex-1">
            {/* 横板封面 */}
            <div>
              <div className="w-[104px] h-[104px] border border-gray-200 rounded-xl p-1.5 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors relative overflow-hidden group shadow-sm">
                {coverSrc ? (
                  <img src={coverSrc} className="w-full h-full object-cover rounded-lg" alt="cover" />
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <span className="text-xl leading-none">+</span>
                    <span className="text-xs mt-1">横板封面</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                  <span className="text-xl leading-none">+</span>
                  <span className="text-xs mt-1 font-medium">更换</span>
                </div>
              </div>
            </div>

            {/* 竖版封面 */}
            <div>
              <div className="w-[104px] h-[104px] border border-dashed border-gray-300 bg-gray-50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors">
                <span className="text-gray-400 text-xl leading-none">+</span>
                <span className="text-gray-500 text-sm mt-2 font-medium">竖版封面</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-2 max-w-[120px] leading-relaxed">
                选填：为抖音/快手提供竖屏高清素材
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. 核心标题 ================= */}
        <div className="flex items-start">
          <div className="w-[80px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">核心标题</div>
          <div className="flex-1">
            <div className="relative flex items-center border border-gray-300 rounded-lg focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 transition-all bg-gray-50/50">
              <input
                type="text"
                value={title}
                onChange={e => set('title', e.target.value)}
                maxLength={30}
                placeholder="输入基础描述即可，AI 将自动润色扩写..."
                className="w-full px-4 py-2.5 outline-none rounded-lg bg-transparent"
              />
              <div className="flex items-center gap-2 pr-3">
                <button className="text-gray-400 hover:text-gray-600" onClick={() => set('title', '')}>✕</button>
                <span className="text-gray-400 text-xs whitespace-nowrap">{title.length} / 30</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. 核心大纲/简介 ================= */}
        <div className="flex items-start">
          <div className="w-[80px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">正文大纲</div>
          <div className="flex-1">
            <div className="border border-gray-300 rounded-lg focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 transition-all relative bg-gray-50/50">
              <textarea
                rows={3}
                placeholder="只需输入核心卖点或流水账，AI 将根据平台特性（小红书种草、B站硬核、抖音下沉）自动生成多版本文案..."
                className="w-full p-4 pb-8 outline-none resize-none rounded-lg text-sm bg-transparent leading-relaxed"
                value={desc}
                onChange={e => set('desc', e.target.value)}
                maxLength={1000}
              />
              <span className="absolute bottom-3 right-4 text-gray-400 text-xs">{desc.length} / 1000</span>
            </div>
          </div>
        </div>

        {/* ================= 4. 种子标签 ================= */}
        <div className="flex items-start">
          <div className="w-[80px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">种子标签</div>
          <div className="flex-1">
            <div className="min-h-[42px] border border-gray-300 rounded-lg p-1.5 flex flex-wrap gap-1.5 items-center focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 bg-gray-50/50 cursor-text transition-all">
              {tags.map((tag, idx) => (
                <span key={idx} className="bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md text-sm flex items-center gap-1.5 shadow-sm">
                  {tag}
                  <span className="cursor-pointer text-gray-400 hover:text-red-500 font-bold" onClick={() => handleRemoveTag(idx)}>×</span>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={tags.length === 0 ? "输入品类词回车，AI 将自动裂变热门长尾词" : ""}
                className="flex-1 min-w-[150px] outline-none px-2 text-sm bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* ================= 5. 发布时间 ================= */}
        <div className="flex items-start">
          <div className="w-[80px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">调度时间</div>
          <div className="flex-1 flex gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input type="radio" name="scheduleType" className="accent-purple-500 w-4 h-4" checked={scheduleType === 'now'} onChange={() => handleScheduleChange('now')} /> 立即调度
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input type="radio" name="scheduleType" className="accent-purple-500 w-4 h-4" checked={scheduleType === 'platform'} onChange={() => handleScheduleChange('platform')} /> 平台定时
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input type="radio" name="scheduleType" className="accent-purple-500 w-4 h-4" checked={scheduleType === 'local'} onChange={() => handleScheduleChange('local')} /> 挂机定时
            </label>
          </div>
        </div>

        {/* 定时时间选择器 */}
        {scheduleType !== 'now' && (
          <div className="flex items-start">
            <div className="w-[80px] flex-shrink-0"></div>
            <div className="flex-1">
              <input
                type="datetime-local"
                className="w-full max-w-xs border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-purple-500"
                value={cfg.scheduleTime || ''}
                onChange={e => set('scheduleTime', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ================= 6. 互动追评 ================= */}
        <div className="flex items-start">
          <div className="w-[80px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">首评互动</div>
          <div className="flex-1">
            <div className="relative border border-gray-300 rounded-lg p-3 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 transition-all bg-white shadow-sm">
              <span className="absolute -top-2.5 right-2 text-purple-600 text-xs bg-white px-2 font-medium">智能短句库</span>
              <textarea
                rows={2}
                placeholder="设置抢占沙发的首条评论，支持放置微信号或购买引导..."
                className="w-full outline-none mt-1 resize-none text-sm bg-transparent"
                value={firstComment}
                onChange={e => set('firstComment', e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded accent-purple-500 w-4 h-4"
                    checked={cfg.pinComment ?? false}
                    onChange={e => set('pinComment', e.target.checked)}
                  /> 尝试置顶该评论
                </label>
              </div>
            </div>
            <div className="text-[11px] text-gray-400 mt-1.5">
              RPA 引擎将在视频发布成功后，静默执行追加评论动作。不支持的平台将自动跳过。
            </div>
          </div>
        </div>

        {/* ================= 7. 底部全局开关 ================= */}
        <div className="flex items-start pt-4 mt-2">
          <div className="w-[80px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">全局声明</div>
          <div className="flex-1 flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                className="rounded accent-purple-500 w-4 h-4"
                checked={cfg.original ?? true}
                onChange={e => set('original', e.target.checked)}
              /> 原创声明
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                className="rounded accent-purple-500 w-4 h-4"
                checked={cfg.aigc ?? false}
                onChange={e => set('aigc', e.target.checked)}
              /> 含 AI 生成内容
            </label>
          </div>
        </div>

        {/* ================= 8. 底部 AI 调度操作区 ================= */}
        <div className="flex items-start pt-6 mt-6 border-t border-gray-100">
          <div className="w-[80px] flex-shrink-0"></div>
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={handleAIGenerate}
                disabled={isAiGenerating}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md shadow-purple-500/20 font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isAiGenerating ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                )}
                {isAiGenerating ? 'AI 脑力激荡中...' : 'AI 智能填表与文案裂变'}
              </button>

              <button
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                onClick={() => {
                  set('title', '');
                  set('desc', '');
                  set('tags', '');
                  set('firstComment', '');
                  setTagInput('');
                }}
              >
                清空数据
              </button>
            </div>
            <div className="text-gray-400 text-xs">
              🤖 点击后，AI 将根据以上核心元素，自动提取小红书（种草风）、B站（干货风）、抖音（钩子风）等所有平台的专属的多版本文案，并自动填充至右侧所有已勾选的平台账号中。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
