import React, { useState } from 'react';

const CATEGORIES = ['科技数码', '游戏', '生活', '知识', '动画', '音乐', '舞蹈', '影视', '娱乐', '鬼畜', '时尚', '其他'];
const DECLARATION_OPTIONS = ['无需声明', '含AI生成内容', '内容为转载', '含虚构演绎内容', '内容含营销信息', '个人观点'];
const SUPPLEMENTARY_DECLARATIONS = ['无', '内容可能引人不适', '内容含有高危险行为', '请理性适度消费', '未成年人请在监护人指导下浏览'];

const SUGGESTED_TOPICS = ['#花生AI创作', '#在剑网3玩大富翁', '#第一视角讨生活'];

export default function BilibiliPanel({ config, onChange, onPublish, onSaveDraft }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const tags = cfg.tags || '';
  const coverUrl = cfg.coverUrl || '';
  const videoType = cfg.type || '自制';
  const category = cfg.category || '科技数码';
  const dynamic = cfg.dynamic || '';
  const firstComment = cfg.firstComment || '';
  const pinComment = cfg.pinComment ?? false;
  const allowRecreate = cfg.allowRecreate ?? false;
  const commercial = cfg.commercial ?? false;
  const noReprint = cfg.noReprint ?? true;
  const enableCharge = cfg.enableCharge ?? true;
  const dolbyAudio = cfg.dolbyAudio ?? false;
  const hifiAudio = cfg.hifiAudio ?? false;
  const watermark = cfg.watermark ?? false;
  const closeDanmu = cfg.closeDanmu ?? false;
  const closeComment = cfg.closeComment ?? false;
  const selectedComment = cfg.selectedComment ?? false;
  const declaration = cfg.declaration || '';
  const supplementaryDeclaration = cfg.supplementaryDeclaration || '无';
  const scheduleType = cfg.scheduleType || 'now';
  const scheduleTime = cfg.scheduleTime || '';

  const handleScheduleChange = (type) => {
    set('scheduleType', type);
    set('scheduled', type !== 'now');
  };

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 font-sans text-[14px] text-[#333]">

          {/* ================= 平台 Header ================= */}
          <div className="mb-8 flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-7 h-7 bg-[#FB7299] rounded-lg flex items-center justify-center text-white shadow-sm font-bold text-sm">
              B
            </div>
            <span className="font-bold text-gray-800 text-[16px]">B站(哔哩哔哩) 专属配置</span>
            <span className="ml-auto text-xs bg-pink-50 text-[#FB7299] px-2 py-1.5 rounded font-medium border border-pink-100">
              全功能开放版
            </span>
          </div>

          <div className="space-y-6">

            {/* ================= 1. 标题 (上限 80 字符) ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>标题</div>
              <div className="flex-1">
                <div className="relative flex items-center border border-gray-300 rounded-lg focus-within:border-[#FB7299] focus-within:ring-2 focus-within:ring-pink-100 transition-all bg-gray-50/50">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => set('title', e.target.value)}
                    maxLength={80}
                    placeholder="请输入标题"
                    className="w-full px-4 py-2.5 outline-none rounded-lg bg-transparent text-sm"
                  />
                  <div className="flex items-center gap-2 pr-3">
                    <button className="text-gray-400 hover:text-gray-600" onClick={() => set('title', '')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                    </button>
                    <span className="text-gray-400 text-xs font-mono">{title.length} / 80</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 2. 封面 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>封面</div>
              <div className="flex-1">
                <div className="w-[104px] h-[104px] border border-gray-200 rounded-lg p-1.5 flex flex-col items-center justify-center cursor-pointer hover:border-[#FB7299] transition-all relative overflow-hidden group shadow-sm bg-white"
                  onClick={() => document.getElementById('bili-cover-input')?.click()}
                >
                  {coverUrl ? (
                    <img src={coverUrl} className="w-full h-full object-cover rounded" alt="cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-sm mt-1 font-medium">上传封面</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <span className="text-xl leading-none">+</span>
                    <span className="text-xs mt-1 font-medium">重新上传</span>
                  </div>
                </div>
                <input
                  id="bili-cover-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => set('coverUrl', reader.result);
                    reader.readAsDataURL(file);
                    e.target.value = null;
                  }}
                />
              </div>
            </div>

            {/* ================= 3. 类型与分区 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1.5 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>类型</div>
              <div className="flex-1 flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800 font-medium">
                  <input type="radio" name="bili_type" checked={videoType === '自制'} onChange={() => set('type', '自制')} className="accent-[#FB7299] w-4 h-4"/> 自制
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800">
                  <input type="radio" name="bili_type" checked={videoType === '转载'} onChange={() => set('type', '转载')} className="accent-[#FB7299] w-4 h-4"/> 转载
                </label>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>分区</div>
              <div className="flex-1">
                <select
                  className="w-[180px] h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FB7299] transition-colors shadow-sm focus:border-[#FB7299] focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                  value={category}
                  onChange={e => set('category', e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ================= 4. 标签与参与话题 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>标签</div>
              <div className="flex-1">
                <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#FB7299] transition-colors focus-within:border-[#FB7299] focus-within:ring-2 focus-within:ring-pink-100 mb-3">
                  <input
                    type="text"
                    placeholder="请输入标签进行搜索 (按回车添加)"
                    className="w-full bg-transparent outline-none text-sm text-gray-700"
                    value={tags}
                    onChange={e => set('tags', e.target.value)}
                  />
                </div>

                <div className="text-xs text-gray-500 mb-2 font-medium">参与话题（推荐）</div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TOPICS.map(tag => (
                    <span
                      key={tag}
                      className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs cursor-pointer hover:bg-pink-50 hover:text-[#FB7299] transition-colors border border-gray-200 hover:border-pink-200"
                      onClick={() => set('tags', tags ? `${tags} ${tag}` : tag)}
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-[#FB7299] text-xs cursor-pointer py-1 px-2 hover:underline">搜索更多话题 &gt;</span>
                </div>
              </div>
            </div>

            {/* ================= 5. 简介 (上限 250 字符) ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">简介</div>
              <div className="flex-1">
                <div className="border border-gray-300 rounded-lg focus-within:border-[#FB7299] focus-within:ring-2 focus-within:ring-pink-100 transition-all relative bg-gray-50/50">
                  <textarea
                    rows={3}
                    value={desc}
                    onChange={(e) => set('desc', e.target.value)}
                    maxLength={250}
                    placeholder="介绍一下你的作品吧"
                    className="w-full p-3 pb-8 outline-none resize-none rounded-lg text-sm bg-transparent leading-relaxed"
                  />
                  <span className="absolute bottom-2 right-3 text-gray-400 text-xs font-mono">{desc.length} / 250</span>
                </div>
              </div>
            </div>

            {/* ================= 6. 核心专业设置 (聚合版) ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">版权与变现</div>
              <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                    checked={noReprint} onChange={e => set('noReprint', e.target.checked)} />
                  未经作者允许 禁止转载
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                    checked={allowRecreate} onChange={e => set('allowRecreate', e.target.checked)} />
                  允许二创
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                    checked={enableCharge} onChange={e => set('enableCharge', e.target.checked)} />
                  <span className="flex items-center gap-1">启用充电面板 <span className="text-gray-400 text-xs">（需加入计划）</span></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                    checked={commercial} onChange={e => set('commercial', e.target.checked)} />
                  增加商业推广信息
                </label>
                {/* 创作声明 */}
                <div className="col-span-2 mt-3 space-y-3">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">创作声明</div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FB7299] transition-colors shadow-sm focus:border-[#FB7299] focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                      value={declaration}
                      onChange={e => set('declaration', e.target.value)}
                    >
                      <option value="">必选声明</option>
                      {DECLARATION_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <select
                      className="h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FB7299] transition-colors shadow-sm focus:border-[#FB7299] focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                      value={supplementaryDeclaration}
                      onChange={e => set('supplementaryDeclaration', e.target.value)}
                    >
                      {SUPPLEMENTARY_DECLARATIONS.map(opt => (
                        <option key={opt} value={opt}>{opt === '无' ? '补充声明（可选）' : opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">视听与互动</div>
              <div className="flex-1 bg-gray-50/80 p-4 rounded-lg border border-gray-200">
                <div className="text-xs font-bold text-gray-500 mb-3 tracking-wider">高级音效设定</div>
                <div className="flex gap-6 mb-4 pb-4 border-b border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-[#FB7299] transition-colors">
                    <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                      checked={dolbyAudio} onChange={e => set('dolbyAudio', e.target.checked)} /> 杜比音效
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-[#FB7299] transition-colors">
                    <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                      checked={hifiAudio} onChange={e => set('hifiAudio', e.target.checked)} /> Hi-Res无损音质
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 ml-auto">
                    <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                      checked={watermark} onChange={e => set('watermark', e.target.checked)} /> 开启水印
                  </label>
                </div>

                <div className="text-xs font-bold text-gray-500 mb-3 tracking-wider">互动与弹幕管控</div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                      checked={closeDanmu} onChange={e => set('closeDanmu', e.target.checked)} /> 关闭弹幕
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                      checked={closeComment} onChange={e => set('closeComment', e.target.checked)} /> 关闭评论
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" className="accent-[#FB7299] w-4 h-4 rounded-sm"
                      checked={selectedComment} onChange={e => set('selectedComment', e.target.checked)} /> 开启精选评论
                  </label>
                </div>
              </div>
            </div>

            {/* ================= 7. 粉丝动态 (233 字符) ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">粉丝动态</div>
              <div className="flex-1">
                <div className="relative flex items-center border border-gray-300 rounded-lg focus-within:border-[#FB7299] focus-within:ring-2 focus-within:ring-pink-100 transition-all bg-white shadow-sm">
                  <input
                    type="text"
                    value={dynamic}
                    onChange={(e) => set('dynamic', e.target.value)}
                    maxLength={233}
                    placeholder="有趣的动态描述，会增加被小编捕捉为热门动态的机会哟~"
                    className="w-full px-4 py-2.5 outline-none rounded-lg bg-transparent text-sm"
                  />
                  <div className="flex items-center gap-2 pr-3">
                    <span className="text-gray-400 text-xs font-mono">{dynamic.length} / 233</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 8. 发布时间 ================= */}
            <div className="flex items-start pt-2">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">发布时间</div>
              <div className="flex-1 flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="bili_timing" className="accent-[#FB7299] w-4 h-4"
                    checked={scheduleType === 'now'} onChange={() => handleScheduleChange('now')} /> 立即发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="bili_timing" className="accent-[#FB7299] w-4 h-4"
                    checked={scheduleType === 'platform'} onChange={() => handleScheduleChange('platform')} /> 定时发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="bili_timing" className="accent-[#FB7299] w-4 h-4"
                    checked={scheduleType === 'local'} onChange={() => handleScheduleChange('local')} /> 本机定时
                </label>
              </div>
            </div>

            {scheduleType !== 'now' && (
              <div className="flex items-start">
                <div className="w-[110px] flex-shrink-0"></div>
                <div className="flex-1">
                  <input
                    type="datetime-local"
                    className="w-full max-w-xs border border-gray-300 rounded-lg h-10 px-3 text-sm outline-none focus:border-[#FB7299]"
                    value={scheduleTime}
                    onChange={e => set('scheduleTime', e.target.value)}
                  />
                  <div className="text-[11px] text-gray-400 mt-1">可选择距离当前最早≥5分钟/最晚≤15天的时间</div>
                </div>
              </div>
            )}

            {/* ================= 9. 抢占首评 ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">抢占首评</div>
              <div className="flex-1">
                <div className="relative border border-gray-300 rounded-lg p-3 bg-white focus-within:border-[#FB7299] focus-within:ring-2 focus-within:ring-pink-100 transition-all shadow-sm">
                  <div className="text-right text-[#FB7299] text-[12px] mb-2 cursor-pointer font-medium hover:text-pink-600">历史记录</div>
                  <textarea
                    value={firstComment}
                    onChange={(e) => set('firstComment', e.target.value)}
                    rows={3}
                    placeholder="作为UP主发布第一条置顶评论，引导一键三连..."
                    className="w-full outline-none resize-none bg-transparent text-sm leading-relaxed"
                  />
                  <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded accent-[#FB7299] w-4 h-4"
                        checked={pinComment}
                        onChange={e => set('pinComment', e.target.checked)}
                      /> 尝试置顶该评论
                    </label>
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  底层机器人将在稿件发布成功且过审后，自动执行置顶神评操作。
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 底部按钮 */}
        <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
          <button
            onClick={onSaveDraft}
            className="px-8 py-2.5 bg-white text-[#666] font-bold rounded-xl text-[13px] hover:bg-slate-50 transition border border-[#e3e4e5] shadow-sm"
          >
            存入草稿
          </button>
          <button
            onClick={onPublish}
            className="px-12 py-2.5 bg-[#FB7299] text-white rounded-xl shadow-md text-[14px] font-black hover:bg-[#e86080] transition active:scale-95 shadow-[#FB7299]/30"
          >
            立即投稿
          </button>
        </div>
      </div>
    </div>
  );
}
