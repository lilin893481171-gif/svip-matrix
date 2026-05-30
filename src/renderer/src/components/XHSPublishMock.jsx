import React, { useState } from 'react';

export default function XHSPublishMock({ config, onChange, onPublish, onSaveDraft }) {
  const [activeTab, setActiveTab] = useState('note');

  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  return (
    <div className="min-h-full bg-[#f8f8f8] py-6 flex justify-center font-sans text-[14px] text-gray-800 animate-in fade-in duration-300">
      <div className="flex gap-6 w-full max-w-[1200px] items-start px-4">

        {/* ================= 左侧：核心表单区 ================= */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative pb-[90px] overflow-hidden">

          <div className="p-6 lg:p-8 space-y-6">
            {/* 1. 视频文件 */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <span className="font-medium text-base">视频文件</span>
                <button className="text-gray-500 flex items-center gap-1 hover:text-gray-700 transition-colors text-sm">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 15.4h-.6c-1.96 0-3.55-1.58-3.55-3.54 0-1.96 1.59-3.54 3.55-3.54H5C5 5.83 6.51 3.33 10 3.33c3.49 0 5 2.5 5 5h.6c1.96 0 3.55 1.58 3.55 3.54 0 1.96-1.59 3.54-3.55 3.54H15"/></svg>
                  {cfg.videoName ? '重新上传' : '上传视频'}
                </button>
              </div>
              <div className="bg-[#fafafa] border border-gray-100 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                  {cfg.videoName ? 'VIDEO' : 'MP4'}
                </div>
                <div>
                  <div className="font-medium mb-1 text-sm">{cfg.videoName || '未选择视频文件'}</div>
                  {cfg.videoName && (
                    <div className="text-green-600 text-xs flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.33c4 0 7.33 3.13 7.33 7.17 0 3.65-2.6 6.72-6.13 7.16V14h4v-1.33h-4v-1.34h3.33V10H6.67v1.33h3.33V12.67H6v1.33h1.33v1.5C3.8 15 1.33 11.93 1.33 8.5c0-4.04 3.33-7.17 7.33-7.17z"/></svg>
                      检测为高清视频。清晰的画面能极大提升观看体验
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 2. 设置封面 */}
            <section>
              <div className="font-medium text-base mb-3">设置封面</div>
              <div className="flex gap-4">
                <div className="w-[140px] h-[186px] bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer border-2 border-dashed border-gray-200 hover:border-gray-400 flex items-center justify-center text-gray-400 text-sm">
                  {cfg.coverUrl ? (
                    <img src={cfg.coverUrl} className="w-full h-full object-cover" alt="cover" />
                  ) : (
                    <span>点击上传封面</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-gray-500 mb-3 flex justify-between text-sm">
                    智能推荐封面
                    <span className="text-blue-500 cursor-pointer text-xs">优质封面示例</span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-[90px] h-[120px] bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:border-gray-300 flex items-center justify-center text-gray-300 text-xs">
                        推荐{i}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. 标题与正文 */}
            <section className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 transition-colors">
              <div className="relative border-b border-gray-100">
                <input
                  type="text"
                  placeholder="填写标题会有更多赞哦"
                  className="w-full px-4 py-4 text-base font-medium outline-none placeholder-gray-400"
                  value={cfg.title || ''}
                  onChange={e => set('title', e.target.value)}
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-blue-100">
                  AI
                </button>
              </div>

              <div className="p-4 bg-white min-h-[180px] flex flex-col justify-between">
                <textarea
                  className="w-full h-[110px] outline-none resize-none placeholder-gray-400 text-sm leading-relaxed"
                  placeholder="输入正文描述，真诚有价值的分享予人温暖"
                  value={cfg.desc || ''}
                  onChange={e => set('desc', e.target.value)}
                />

                {/* 话题标签 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {(cfg.tags || ['#解压玩具', '#大人玩玩具', '#未来感家居']).map(tag => (
                    <span key={tag} className="px-3 py-1 bg-[#f4f8fb] text-[#1a59b7] rounded-full text-xs cursor-pointer hover:bg-[#e8f1f8]">{tag}</span>
                  ))}
                  <span className="px-3 py-1 text-gray-400 text-xs cursor-pointer hover:bg-gray-50 rounded-full">+ 添加</span>
                </div>

                <div className="flex justify-between items-center text-gray-400 text-sm">
                  <div className="flex gap-3">
                    <span className="hover:text-gray-600 cursor-pointer bg-gray-50 px-3 py-1 rounded-full text-xs"># 话题</span>
                    <span className="hover:text-gray-600 cursor-pointer bg-gray-50 px-3 py-1 rounded-full text-xs">@ 用户</span>
                    <span className="hover:text-gray-600 cursor-pointer bg-gray-50 px-3 py-1 rounded-full text-xs">☺ 表情</span>
                  </div>
                  <span className="text-xs">{(cfg.desc || '').length} / 1000</span>
                </div>
              </div>
            </section>

            {/* 4. 设置项 */}
            <div className="space-y-3">
              <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="font-medium text-sm">活动话题</span>
                <span className="text-gray-400 text-xs flex items-center">全职高手创作者激励... <span className="ml-2">›</span></span>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="font-medium text-sm">添加组件</span>
                <span className="text-gray-400 text-xs flex items-center">关联商品、标记地点等 <span className="ml-2">›</span></span>
              </div>

              {/* 地点 */}
              <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center">
                <span className="font-medium text-sm">添加地点</span>
                <input
                  className="flex-1 mx-4 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
                  placeholder="搜索地点"
                  value={cfg.poi || ''}
                  onChange={e => set('poi', e.target.value)}
                />
              </div>

              {/* 定时发布 */}
              <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                   onClick={() => set('scheduled', !cfg.scheduled)}>
                <span className="font-medium text-sm">定时发布</span>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${cfg.scheduled ? 'bg-[#ff2442]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cfg.scheduled ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
              </div>
              {cfg.scheduled && (
                <input
                  type="datetime-local"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
                  value={cfg.scheduleTime || ''}
                  onChange={e => set('scheduleTime', e.target.value)}
                />
              )}

              {/* 原创声明 */}
              <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                   onClick={() => set('isOriginal', !cfg.isOriginal)}>
                <span className="font-medium text-sm">原创声明</span>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${cfg.isOriginal ? 'bg-[#ff2442]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cfg.isOriginal ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* 底部发布按钮 */}
          <div className="absolute bottom-0 w-full h-[80px] bg-gradient-to-t from-white via-white to-white/0 flex justify-center items-center gap-6 border-t border-gray-50 z-10">
            <button
              onClick={onSaveDraft}
              className="w-[120px] h-[40px] rounded-full border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm text-sm"
            >
              暂存离开
            </button>
            <button
              onClick={onPublish}
              className="w-[120px] h-[40px] rounded-full bg-[#ff2442] font-medium text-white hover:bg-[#e0203a] transition-colors shadow-[0_4px_12px_rgba(255,36,66,0.3)] text-sm"
            >
              发布
            </button>
          </div>
        </div>

        {/* ================= 右侧：手机预览区 ================= */}
        <div className="w-[300px] flex-shrink-0 space-y-4 sticky top-6 hidden lg:block">

          <div className="bg-white rounded-3xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] border-[5px] border-gray-900 h-[580px] flex flex-col relative overflow-hidden">
            <div className="flex bg-gray-100 p-1 rounded-full text-xs font-medium mb-2 relative z-10">
              <button
                onClick={() => setActiveTab('note')}
                className={`flex-1 py-1.5 rounded-full transition-colors ${activeTab === 'note' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >
                笔记预览
              </button>
              <button
                onClick={() => setActiveTab('cover')}
                className={`flex-1 py-1.5 rounded-full transition-colors ${activeTab === 'cover' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >
                封面预览
              </button>
            </div>

            <div className="flex-1 bg-black rounded-xl overflow-hidden relative">
              {cfg.coverUrl ? (
                <img src={cfg.coverUrl} className="w-full h-full object-cover opacity-90" alt="preview" />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 text-xs">视频预览区</div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center pl-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>

              <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 text-white">
                <div className="w-8 h-8 bg-white/20 rounded-full border border-white/40" />
                <div className="flex flex-col items-center"><span className="text-xl">♡</span><span className="text-[9px]">赞</span></div>
                <div className="flex flex-col items-center"><span className="text-xl">☆</span><span className="text-[9px]">收藏</span></div>
                <div className="flex flex-col items-center"><span className="text-xl">💬</span><span className="text-[9px]">评论</span></div>
              </div>

              {/* 标题浮层 */}
              {cfg.title && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <p className="text-white text-xs font-medium leading-tight line-clamp-2">{cfg.title}</p>
                </div>
              )}
            </div>
          </div>

          {/* 创作助手卡片 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 font-medium text-sm mb-2">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M5.55 16.5C3.52 16.5 1.87 14.85 1.87 12.82V5.17C1.87 3.14 3.52 1.5 5.55 1.5H9.82C10.19 1.5 10.5 1.8 10.5 2.17C10.5 2.54 10.19 2.85 9.82 2.85H5.55C4.26 2.85 3.22 3.89 3.22 5.17V12.82C3.22 14.1 4.26 15.15 5.55 15.15H11.55C12.83 15.15 13.87 14.1 13.87 12.82V8.17C13.87 7.8 14.17 7.5 14.55 7.5C14.92 7.5 15.22 7.8 15.22 8.17V12.82C15.22 14.85 13.57 16.5 11.55 16.5H5.55Z" fill="#333"/></svg>
              创作助手
            </div>
            <div className="text-gray-500 text-xs mb-3">发文助手为你护航，检查笔记是否符合社区规范</div>
            <button className="w-full py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors">
              开始检测
            </button>
            <div className="text-center text-gray-400 text-xs mt-2">今日剩余 10 次</div>
          </div>
        </div>
      </div>
    </div>
  );
}
