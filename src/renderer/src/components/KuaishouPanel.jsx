import React, { useState } from 'react';

const AUTHOR_SERVICES = ['不关联', '游戏推广', '电商带货', '品牌广告', '本地生活'];
const COLUMN_SERVICES = ['不关联', '课程专栏', '付费直播', '限时活动'];
const AUTHOR_DECLARATIONS = [
  '内容无需添加声明',
  '含AI生成内容',
  '内容含营销信息',
  '含虚构演绎内容，仅供娱乐',
  '内容为转载',
  '个人观点，仅供参考',
  '危险行为，请勿模仿',
  '可能引人不适，请谨慎观看',
];
const COLLECTIONS = ['无', '技术教程', '生活Vlog', '游戏集锦'];

export default function KuaishouPanel({ config, onChange, onPublish, onSaveDraft }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const desc = cfg.desc || '';
  const tags = cfg.tags || '';
  const coverUrl = cfg.coverUrl || '';
  const mentionUser = cfg.mentionUser || '';
  const mentionPosition = cfg.mentionPosition || '末尾';
  const authorService = cfg.authorService || '不关联';
  const columnService = cfg.columnService || '不关联';
  const showPoi = cfg.showPoi ?? false;
  const poi = cfg.poi || '';
  const authorDeclare = cfg.authorDeclare || '';
  const collection = cfg.collection || '';
  const pkCover = cfg.pkCover ?? true;
  const noDownload = cfg.noDownload ?? false;
  const hideFromCity = cfg.hideFromCity ?? false;
  const visibility = cfg.visibility || 'public';
  const scheduleType = cfg.scheduleType || 'now';
  const scheduleTime = cfg.scheduleTime || '';
  const firstComment = cfg.firstComment || '';
  const pinComment = cfg.pinComment ?? false;

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
            <div className="w-7 h-7 bg-[#FF7700] rounded-lg flex items-center justify-center text-white shadow-sm font-bold text-sm tracking-wider">
              快
            </div>
            <span className="font-bold text-gray-800 text-[16px]">快手 专属配置</span>
            <span className="ml-auto text-xs bg-orange-50 text-[#FF7700] px-2 py-1.5 rounded font-medium border border-orange-100">
              全功能开放版
            </span>
          </div>

          <div className="space-y-6">

            {/* ================= 1. 封面 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>封面</div>
              <div className="flex-1">
                <div className="w-[104px] h-[104px] border border-gray-200 rounded-lg p-1.5 flex flex-col items-center justify-center cursor-pointer hover:border-[#FF7700] transition-all relative overflow-hidden group shadow-sm bg-white"
                  onClick={() => document.getElementById('ks-cover-input')?.click()}
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
                  id="ks-cover-input"
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
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 mt-2 ml-1">
                  <input type="checkbox" className="accent-[#FF7700] w-4 h-4 rounded-sm"
                    checked={pkCover} onChange={e => set('pkCover', e.target.checked)} />
                  设置PK封面
                </label>
              </div>
            </div>

            {/* ================= 2. 简介 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">简介</div>
              <div className="flex-1">
                <div className="border border-gray-300 rounded-lg focus-within:border-[#FF7700] focus-within:ring-2 focus-within:ring-orange-100 transition-all relative bg-gray-50/50">
                  <textarea
                    rows={4}
                    value={desc}
                    onChange={(e) => set('desc', e.target.value)}
                    maxLength={500}
                    placeholder="快手无独立标题，请输入吸睛的文案描述..."
                    className="w-full p-4 pb-8 outline-none resize-none rounded-lg text-sm bg-transparent leading-relaxed"
                  />
                  <span className="absolute bottom-3 right-4 text-gray-400 text-xs font-mono">{desc.length} / 500</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1.5">不要在简介中输入带#的话题，请使用下方"话题"功能</div>
              </div>
            </div>

            {/* ================= 3. 话题 & @好友 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">话题</div>
              <div className="flex-1">
                <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#FF7700] transition-colors focus-within:border-[#FF7700] focus-within:ring-2 focus-within:ring-orange-100">
                  <input type="text" placeholder="请输入话题进行搜索" className="w-full bg-transparent outline-none text-sm text-gray-700"
                    value={tags} onChange={e => set('tags', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">@好友</div>
              <div className="flex-1">
                <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#FF7700] transition-colors focus-within:border-[#FF7700] focus-within:ring-2 focus-within:ring-orange-100 mb-2">
                  <input type="text" placeholder="请输入关键词搜索好友" className="w-full bg-transparent outline-none text-sm text-gray-700"
                    value={mentionUser} onChange={e => set('mentionUser', e.target.value)} />
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>@将追加到简介</span>
                  <select
                    className="border border-gray-300 rounded-md px-3 py-1 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                    value={mentionPosition}
                    onChange={e => set('mentionPosition', e.target.value)}
                  >
                    <option value="末尾">末尾</option>
                    <option value="开头">开头</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ================= 4. 商业任务组件 ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">作者变现</div>
              <div className="flex-1">
                <select
                  className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                  value={authorService}
                  onChange={e => set('authorService', e.target.value)}
                >
                  {AUTHOR_SERVICES.map(s => (
                    <option key={s} value={s}>{s === '不关联' ? '不关联' : s}</option>
                  ))}
                </select>
                <div className="text-[11px] text-gray-400 mt-1.5">请确保你的账号有相关的任务权限再选择</div>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">通栏服务</div>
              <div className="flex-1">
                <select
                  className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                  value={columnService}
                  onChange={e => set('columnService', e.target.value)}
                >
                  {COLUMN_SERVICES.map(s => (
                    <option key={s} value={s}>{s === '不关联' ? '不关联' : s}</option>
                  ))}
                </select>
                <div className="text-[11px] text-orange-500 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded mt-1.5">
                  通栏服务和作者变现任务不可同时设置
                </div>
              </div>
            </div>

            {/* ================= 5. 地理位置 & 声明 & 合集 ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">添加地点</div>
              <div className="flex-1 flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_location" className="accent-[#FF7700] w-4 h-4"
                    checked={!showPoi} onChange={() => set('showPoi', false)} /> 不展示
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_location" className="accent-[#FF7700] w-4 h-4"
                    checked={showPoi} onChange={() => set('showPoi', true)} /> 展示
                </label>
              </div>
            </div>

            {showPoi && (
              <div className="flex items-start">
                <div className="w-[110px] flex-shrink-0"></div>
                <div className="flex-1">
                  <input type="text" placeholder="搜索位置" className="w-full max-w-[280px] h-[38px] border border-gray-300 rounded-lg px-3 text-sm outline-none focus:border-[#FF7700]"
                    value={poi} onChange={e => set('poi', e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex items-start mt-4">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">作者声明</div>
              <div className="flex-1">
                <select
                  className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                  value={authorDeclare}
                  onChange={e => set('authorDeclare', e.target.value)}
                >
                  <option value="">选择声明</option>
                  {AUTHOR_DECLARATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-start mt-4">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">添加到合集</div>
              <div className="flex-1">
                <select
                  className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                  value={collection}
                  onChange={e => set('collection', e.target.value)}
                >
                  <option value="">请选择合集</option>
                  {COLLECTIONS.filter(c => c !== '无').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ================= 6. 社交与权限管控 ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">个性化设置</div>
              <div className="flex-1 flex flex-col gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="accent-[#FF7700] w-4 h-4 rounded-sm"
                    checked={pkCover} onChange={e => set('pkCover', e.target.checked)} />
                  <span>允许别人跟我拍同框 <span className="text-gray-400 text-xs">（时长15分钟内的作品支持拍同框）</span></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="accent-[#FF7700] w-4 h-4 rounded-sm"
                    checked={noDownload} onChange={e => set('noDownload', e.target.checked)} /> 不允许下载此作品
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="accent-[#FF7700] w-4 h-4 rounded-sm"
                    checked={hideFromCity} onChange={e => set('hideFromCity', e.target.checked)} /> 作品在同城不展示
                </label>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">查看权限</div>
              <div className="flex-1 flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_privacy" className="accent-[#FF7700] w-4 h-4"
                    checked={visibility === 'public'} onChange={() => set('visibility', 'public')} /> 公开（所有人可见）
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_privacy" className="accent-[#FF7700] w-4 h-4"
                    checked={visibility === 'friends'} onChange={() => set('visibility', 'friends')} /> 好友可见
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_privacy" className="accent-[#FF7700] w-4 h-4"
                    checked={visibility === 'private'} onChange={() => set('visibility', 'private')} /> 私密（仅自己可见）
                </label>
              </div>
            </div>

            {/* ================= 7. 发布时间 ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">发布时间</div>
              <div className="flex-1 flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_timing" className="accent-[#FF7700] w-4 h-4"
                    checked={scheduleType === 'now'} onChange={() => handleScheduleChange('now')} /> 立即发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_timing" className="accent-[#FF7700] w-4 h-4"
                    checked={scheduleType === 'platform'} onChange={() => handleScheduleChange('platform')} /> 定时发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="ks_timing" className="accent-[#FF7700] w-4 h-4"
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
                    className="w-full max-w-xs border border-gray-300 rounded-lg h-10 px-3 text-sm outline-none focus:border-[#FF7700]"
                    value={scheduleTime}
                    onChange={e => set('scheduleTime', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ================= 8. 抢占首评 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">抢占首评</div>
              <div className="flex-1">
                <div className="relative border border-gray-300 rounded-lg p-3 bg-white focus-within:border-[#FF7700] focus-within:ring-2 focus-within:ring-orange-100 transition-all shadow-sm">
                  <div className="text-right text-[#FF7700] text-[12px] mb-2 cursor-pointer font-medium hover:text-orange-600">历史记录</div>
                  <textarea
                    value={firstComment}
                    onChange={(e) => set('firstComment', e.target.value)}
                    rows={3}
                    placeholder="设置第一条评论，老铁们快来评论区集合..."
                    className="w-full outline-none resize-none bg-transparent text-sm leading-relaxed"
                  />
                  <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="rounded accent-[#FF7700] w-4 h-4"
                        checked={pinComment} onChange={e => set('pinComment', e.target.checked)} /> 置顶评论
                    </label>
                  </div>
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
            className="px-12 py-2.5 bg-[#FF7700] text-white rounded-xl shadow-md text-[14px] font-black hover:bg-[#e66a00] transition active:scale-95 shadow-[#FF7700]/30"
          >
            发布至快手
          </button>
        </div>
      </div>
    </div>
  );
}
