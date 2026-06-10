import React from 'react';
import PlatformHeader from './shared/PlatformHeader';
import CharTextarea from './shared/CharTextarea';
import CoverUpload from './shared/CoverUpload';
import TagInput from './shared/TagInput';
import MentionInput from './shared/MentionInput';
import SchedulePicker from './shared/SchedulePicker';
import FirstComment from './shared/FirstComment';
import FooterActions from './shared/FooterActions';
import LabeledField from './shared/LabeledField';
import VisibilityRadio from './shared/VisibilityRadio';
import useScheduleState from '../hooks/useScheduleState';

const ACCENT = '#FF7700';

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
const COLLECTIONS = ['技术教程', '生活Vlog', '游戏集锦'];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开（所有人可见）' },
  { value: 'friends', label: '好友可见' },
  { value: 'private', label: '私密（仅自己可见）' },
];

export default function KuaishouPanel({ config, onChange, onPublish, onSaveDraft, isPublishing = false }) {
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
  const firstComment = cfg.firstComment || '';
  const pinComment = cfg.pinComment ?? false;
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 font-sans text-[14px] text-[#333]">

          <PlatformHeader icon="快" name="快手" accentColor={ACCENT} badgeAccent="bg-orange-50 text-[#FF7700] border-orange-100" />

          <div className="space-y-6">

            <LabeledField label="封面" required labelWidth="w-[110px]" topPadding="pt-1">
              <div>
                <CoverUpload value={coverUrl} onChange={v => set('coverUrl', v)} accentColor={ACCENT} />
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 mt-2 ml-1">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={pkCover} onChange={e => set('pkCover', e.target.checked)} />
                  设置PK封面
                </label>
              </div>
            </LabeledField>

            <LabeledField label="简介" labelWidth="w-[110px]">
              <CharTextarea
                value={desc}
                onChange={v => set('desc', v)}
                maxLength={500}
                accentColor={ACCENT}
                rows={4}
                placeholder="快手无独立标题，请输入吸睛的文案描述..."
                hint={'不要在简介中输入带#的话题，请使用下方话题功能'}
              />
            </LabeledField>

            <LabeledField label="话题" labelWidth="w-[110px]">
              <TagInput value={tags} onChange={v => set('tags', v)} accentColor={ACCENT} />
            </LabeledField>

            <LabeledField label="@好友" labelWidth="w-[110px]">
              <MentionInput
                value={mentionUser}
                onChange={v => set('mentionUser', v)}
                accentColor={ACCENT}
                position={mentionPosition}
                onPositionChange={v => set('mentionPosition', v)}
              />
            </LabeledField>

            {/* ========== 商业任务 — 平台特有 ========== */}
            <LabeledField label="作者变现" labelWidth="w-[110px]">
              <div>
                <select
                  className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                  value={authorService}
                  onChange={e => set('authorService', e.target.value)}
                >
                  {AUTHOR_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="text-[11px] text-gray-400 mt-1.5">请确保你的账号有相关的任务权限再选择</div>
              </div>
            </LabeledField>

            <LabeledField label="通栏服务" labelWidth="w-[110px]">
              <div>
                <select
                  className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                  value={columnService}
                  onChange={e => set('columnService', e.target.value)}
                >
                  {COLUMN_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="text-[11px] text-orange-500 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded mt-1.5">
                  通栏服务和作者变现任务不可同时设置
                </div>
              </div>
            </LabeledField>

            {/* ========== 地理位置 ========== */}
            <LabeledField label="添加地点" labelWidth="w-[110px]" topPadding="pt-1">
              <div>
                <div className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="ks_location" style={{ accentColor: ACCENT }} className="w-4 h-4"
                      checked={!showPoi} onChange={() => set('showPoi', false)} /> 不展示
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="ks_location" style={{ accentColor: ACCENT }} className="w-4 h-4"
                      checked={showPoi} onChange={() => set('showPoi', true)} /> 展示
                  </label>
                </div>
                {showPoi && (
                  <div className="mt-3">
                    <input type="text" placeholder="搜索位置" className="w-full max-w-[280px] h-[38px] border border-gray-300 rounded-lg px-3 text-sm outline-none focus:border-[#FF7700]"
                      value={poi} onChange={e => set('poi', e.target.value)} />
                  </div>
                )}
              </div>
            </LabeledField>

            <LabeledField label="作者声明" labelWidth="w-[110px]">
              <select
                className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                value={authorDeclare}
                onChange={e => set('authorDeclare', e.target.value)}
              >
                <option value="">选择声明</option>
                {AUTHOR_DECLARATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </LabeledField>

            <LabeledField label="添加到合集" labelWidth="w-[110px]">
              <select
                className="h-[38px] w-full max-w-[280px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FF7700] transition-colors shadow-sm outline-none text-sm"
                value={collection}
                onChange={e => set('collection', e.target.value)}
              >
                <option value="">请选择合集</option>
                {COLLECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </LabeledField>

            {/* ========== 个性化设置 — 平台特有 ========== */}
            <LabeledField label="个性化设置" labelWidth="w-[110px]" topPadding="pt-1">
              <div className="flex flex-col gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={pkCover} onChange={e => set('pkCover', e.target.checked)} />
                  <span>允许别人跟我拍同框 <span className="text-gray-400 text-xs">（时长15分钟内的作品支持拍同框）</span></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={noDownload} onChange={e => set('noDownload', e.target.checked)} /> 不允许下载此作品
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={hideFromCity} onChange={e => set('hideFromCity', e.target.checked)} /> 作品在同城不展示
                </label>
              </div>
            </LabeledField>

            <LabeledField label="查看权限" labelWidth="w-[110px]" topPadding="pt-1">
              <VisibilityRadio value={visibility} onChange={v => set('visibility', v)} accentColor={ACCENT} options={VISIBILITY_OPTIONS} name="ks_privacy" />
            </LabeledField>

            <LabeledField label="发布时间" labelWidth="w-[110px]" topPadding="pt-1">
              <SchedulePicker
                scheduleType={scheduleType}
                scheduleTime={scheduleTime}
                onScheduleTypeChange={handleScheduleChange}
                onScheduleTimeChange={setScheduleTime}
                accentColor={ACCENT}
                name="ks_timing"
              />
            </LabeledField>

            <LabeledField label="抢占首评" labelWidth="w-[110px]">
              <FirstComment
                value={firstComment}
                onChange={v => set('firstComment', v)}
                accentColor={ACCENT}
                pinComment={pinComment}
                onPinCommentChange={v => set('pinComment', v)}
                placeholder="设置第一条评论，老铁们快来评论区集合..."
                pinLabel="置顶评论"
              />
            </LabeledField>

          </div>
        </div>

        <FooterActions
          onSaveDraft={onSaveDraft}
          onPublish={onPublish}
          accentColor={ACCENT}
          publishLabel="发布至快手"
          isPublishing={isPublishing}
        />
      </div>
    </div>
  );
}

export function validateKuaishou(config) {
  const errors = [];
  if (!config.coverUrl) errors.push({ field: 'coverUrl', message: '请上传视频封面' });
  if (!config.desc || config.desc.trim().length < 1) errors.push({ field: 'desc', message: '请输入视频简介' });
  if (config.scheduleType !== 'now' && !config.scheduleTime) errors.push({ field: 'scheduleTime', message: '定时发布必须设置时间' });
  return { valid: errors.length === 0, errors };
}
