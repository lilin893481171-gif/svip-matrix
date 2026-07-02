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
  const cover2Src = toMatrixMediaUrl(cfg.cover2Url || cfg.cover2Path);
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
    <div className="w-full max-w-[840px] bg-white rounded-xl shadow-sm border border-gray-200 font-sans text-[14px] text-gray-800 animate-in fade-in duration-300">
      {/* 标题栏 */}
      <div className="px-8 py-5 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">通用配置</h2>
      </div>

      <div className="p-8 space-y-6">
        {/* ================= 1. 通用封面 ================= */}
        <div className="flex items-start">
          <div className="w-[100px] flex-shrink-0 pt-1 text-right pr-6 text-gray-700 font-medium">通用封面：</div>
          <div className="flex-1">
            <div className="w-[280px] h-[160px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/30 transition-all bg-gray-50/50 group">
              {coverSrc ? (
                <div className="relative w-full h-full overflow-hidden rounded-lg">
                  <img src={coverSrc} className="w-full h-full object-cover" alt="封面" />
                  <div className="absolute inset-0 bg-black/-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <span className="text-2xl leading-none">+</span>
                    <span className="text-sm mt-1 font-medium">更换封面</span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-3xl leading-none text-gray-400">+</span>
                  <span className="text-sm mt-2 text-gray-500 font-medium">上传</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================= 2. 通用封面2 ================= */}
        <div className="flex items-start">
          <div className="w-[100px] flex-shrink-0 pt-1 text-right pr-6 text-gray-700 font-medium">通用封面2：</div>
          <div className="flex-1 flex items-start gap-6">
            <div className="w-[280px] h-[160px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/30 transition-all bg-gray-50/50 group">
              {cover2Src ? (
                <div className="relative w-full h-full overflow-hidden rounded-lg">
                  <img src={cover2Src} className="w-full h-full object-cover" alt="封面2" />
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <span className="text-2xl leading-none">+</span>
                    <span className="text-sm mt-1 font-medium">更换封面</span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-3xl leading-none text-gray-400">+</span>
                  <span className="text-sm mt-2 text-gray-500 font-medium">上传</span>
                </>
              )}
            </div>
            <div className="flex-1 pt-2">
              <p className="text-sm text-gray-500 leading-relaxed">目前仅支持抖音平台需要第二个封面</p>
            </div>
          </div>
        </div>

        {/* ================= 3. 通用标题 ================= */}
        <div className="flex items-start">
          <div className="w-[100px] flex-shrink-0 pt-2 text-right pr-6 text-gray-700 font-medium">通用标题：</div>
          <div className="flex-1">
            <div className="relative flex items-center border border-gray-300 rounded-lg focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition-all bg-white">
              <input
                type="text"
                value={title}
                onChange={e => set('title', e.target.value)}
                maxLength={20}
                placeholder="请输入"
                className="w-full px-4 py-2.5 outline-none rounded-lg text-sm"
              />
              <div className="flex items-center gap-2 pr-3">
                <span className="text-gray-400 text-xs whitespace-nowrap">{title.length} / 20</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 4. 通用简介 ================= */}
        <div className="flex items-start">
          <div className="w-[100px] flex-shrink-0 pt-2 text-right pr-6 text-gray-700 font-medium">通用简介：</div>
          <div className="flex-1">
            <div className="border border-gray-300 rounded-lg focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition-all relative bg-white">
              <textarea
                rows={4}
                placeholder="请输入"
                className="w-full p-4 pb-8 outline-none resize-none rounded-lg text-sm leading-relaxed"
                value={desc}
                onChange={e => set('desc', e.target.value)}
                maxLength={1000}
              />
              <span className="absolute bottom-3 right-4 text-gray-400 text-xs">{desc.length} / 1000</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              不要在简介中输入带#的话题，请使用下方"标签/话题"功能
            </div>
          </div>
        </div>

        {/* ================= 5. 标签/话题 ================= */}
        <div className="flex items-start">
          <div className="w-[100px] flex-shrink-0 pt-2 text-right pr-6 text-gray-700 font-medium">标签/话题：</div>
          <div className="flex-1">
            <div className="border border-gray-300 rounded-lg focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition-all bg-white">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="请输入话题进行搜索"
                className="w-full px-4 py-2.5 outline-none rounded-lg text-sm"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag, idx) => (
                  <span key={idx} className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-md text-sm flex items-center gap-1.5">
                    {tag}
                    <span className="cursor-pointer text-amber-400 hover:text-red-500 font-bold text-xs" onClick={() => handleRemoveTag(idx)}>×</span>
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <p>输入后按回车键可添加；根据平台不同，如果超出数量限制，将自动保留最大个数。</p>
              <p>可粘贴长文本内容，添加空格,#;；、字符自动分割成多个话题</p>
            </div>
          </div>
        </div>

        {/* ================= 6. 发布时间 ================= */}
        <div className="flex items-start">
          <div className="w-[100px] flex-shrink-0 pt-2 text-right pr-6 text-gray-700 font-medium">发布时间：</div>
          <div className="flex-1 space-y-3">
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                <input type="radio" name="scheduleType" className="accent-amber-500 w-4 h-4" checked={scheduleType === 'now'} onChange={() => handleScheduleChange('now')} />
                <span className="text-sm">立即发布</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                <input type="radio" name="scheduleType" className="accent-amber-500 w-4 h-4" checked={scheduleType === 'platform'} onChange={() => handleScheduleChange('platform')} />
                <span className="text-sm">定时发布</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                <input type="radio" name="scheduleType" className="accent-amber-500 w-4 h-4" checked={scheduleType === 'local'} onChange={() => handleScheduleChange('local')} />
                <span className="text-sm">本机定时</span>
              </label>
            </div>
            {scheduleType !== 'now' && (
              <div className="pt-2">
                <input
                  type="datetime-local"
                  className="w-full max-w-xs border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  value={cfg.scheduleTime || ''}
                  onChange={e => set('scheduleTime', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* ================= 7. 追评 ================= */}
        <div className="flex items-start">
          <div className="w-[100px] flex-shrink-0 pt-2 text-right pr-6 text-gray-700 font-medium">追评：</div>
          <div className="flex-1">
            <div className="relative border border-gray-300 rounded-lg p-4 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition-all bg-white">
              <div className="absolute -top-2 right-3">
                <button className="text-xs text-amber-600 hover:text-amber-700 font-medium px-2 py-0.5 bg-white border border-amber-200 rounded">
                  历史记录
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="输入追评内容..."
                className="w-full outline-none resize-none text-sm mt-2 bg-transparent"
                value={firstComment}
                onChange={e => set('firstComment', e.target.value)}
              />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded accent-amber-500 w-4 h-4"
                    checked={cfg.pinComment ?? false}
                    onChange={e => set('pinComment', e.target.checked)}
                  />
                  <span>置顶</span>
                </label>
                <span className="text-gray-400 text-xs">{firstComment.length}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              作品发布成功后，追加一条评论。定时发布的作品将在定时发布完成之后追加评论。不支持发表评论的平台将忽略。
            </div>
          </div>
        </div>

        {/* ================= 8. 底部操作区 ================= */}
        <div className="flex items-start pt-6 mt-4 border-t border-gray-100">
          <div className="w-[100px] flex-shrink-0"></div>
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <button
                className="px-8 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                onClick={() => {
                  set('title', '');
                  set('desc', '');
                  set('tags', '');
                  set('firstComment', '');
                  setTagInput('');
                }}
              >
                清空
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={isAiGenerating}
                className="px-8 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-500/20 font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
              >
                {isAiGenerating ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                )}
                {isAiGenerating ? 'AI 脑力激荡中...' : 'AI智能填表与文案裂变'}
              </button>
            </div>
            <div className="text-xs text-gray-500 leading-relaxed">
              点击后，AI将根据以上核心元素，自动提取小红书(种草风)、B站(干货风)、抖音(钩子风)等所有平台的专属的多版本文案，并自动填充至右侧所有已勾选的平台账号中。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
