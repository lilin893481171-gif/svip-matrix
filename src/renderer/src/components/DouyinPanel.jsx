import React from 'react';
import PlatformHeader from './shared/PlatformHeader';
import CharInput from './shared/CharInput';
import CharTextarea from './shared/CharTextarea';
import CoverUpload from './shared/CoverUpload';
import TagInput from './shared/TagInput';
import MentionInput from './shared/MentionInput';
import SchedulePicker from './shared/SchedulePicker';
import FirstComment from './shared/FirstComment';
import FooterActions from './shared/FooterActions';
import LabeledField from './shared/LabeledField';
import VisibilityRadio from './shared/VisibilityRadio';
import ProductLink from './shared/ProductLink';
import MusicSelect from './shared/MusicSelect';
import TrendInput from './shared/TrendInput';
import useScheduleState from '../hooks/useScheduleState';

const ACCENT = '#FE2C55';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开' },
  { value: 'friends', label: '好友可见' },
  { value: 'self', label: '仅自己可见' },
];

const DOWNLOAD_OPTIONS = [
  { value: 'allow', label: '允许' },
  { value: 'disallow', label: '不允许' },
];

const DECLARATION_MAP = {
  '个人观点': '内容为个人观点或见解',
  '虚构演绎': '含有虚构演绎内容',
  'AI生成': '含AI生成内容',
  '营销信息': '内容含营销信息',
  '危险行为': '危险行为，请勿模仿',
  '可能引人不适': '可能引人不适，请谨慎观看',
};

export default function DouyinPanel({ config, onChange, onPublish, onSaveDraft, isPublishing = false }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const shopLink = cfg.productLink || '';
  const firstComment = cfg.firstComment || '';
  const syncToutiao = cfg.syncToutiao ?? true;
  const visibility = cfg.visibility || 'public';
  const allowDownload = cfg.allowDownload ?? false;
  const hotspotWord = cfg.hotspotWord || '';
  const declaration = cfg.declaration || '个人观点';
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  return (
    <div className="w-full max-w-[720px] bg-white rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 font-sans text-[14px] text-[#333]">

      <PlatformHeader
        icon={<svg width="16" height="16" viewBox="0 0 48 48" fill="currentColor"><path d="M41.26 21.43a18.3 18.3 0 0 1-8.58-2.12v11.53A15.16 15.16 0 1 1 17.52 15.7v8.42a6.74 6.74 0 1 0 6.74 6.72V6h8.05a14.73 14.73 0 0 0 8.95 8.16v7.27z"/></svg>}
        name="抖音"
        accentColor={ACCENT}
        badgeAccent="bg-red-50 text-[#FE2C55] border-red-100"
      />

      <div className="space-y-6">

        <LabeledField label="标题" labelWidth="w-[126px]">
          <CharInput value={title} onChange={v => set('title', v)} maxLength={30} accentColor={ACCENT} placeholder="请输入" />
        </LabeledField>

        <LabeledField label="封面" required labelWidth="w-[126px]" topPadding="pt-1">
          <CoverUpload
            value={cfg.coverUrl || ''}
            onChange={v => set('coverUrl', v)}
            accentColor={ACCENT}
            secondCover={{ value: cfg.cover2Url || '', onChange: v => set('cover2Url', v), label: '封面2' }}
          />
        </LabeledField>

        <LabeledField label="简介" labelWidth="w-[126px]">
          <CharTextarea
            value={desc}
            onChange={v => set('desc', v)}
            maxLength={900}
            accentColor={ACCENT}
            rows={3}
            placeholder="请输入视频描述，最少5个字"
            hint={'不要在简介中输入带#的话题，请使用下方话题功能'}
          />
        </LabeledField>

        <LabeledField label="话题" labelWidth="w-[126px]">
          <TagInput value={cfg.tags || ''} onChange={v => set('tags', v)} accentColor={ACCENT} />
        </LabeledField>

        <LabeledField label="@好友" labelWidth="w-[126px]">
          <MentionInput
            value={cfg.mentionUser || ''}
            onChange={v => set('mentionUser', v)}
            accentColor={ACCENT}
            position={cfg.mentionPosition || '末尾'}
            onPositionChange={v => set('mentionPosition', v)}
          />
        </LabeledField>

        {/* ========== 挂载组件 — 平台特有,保留内联 ========== */}
        <LabeledField label="挂载组件" labelWidth="w-[126px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-[140px] h-[38px] border border-[#FE2C55] rounded-lg px-3 flex items-center justify-between bg-red-50/20 cursor-pointer shadow-sm">
                <span className="text-[#FE2C55] text-sm font-medium flex items-center gap-1">🛒 购物车</span>
                <span className="text-[10px] text-[#FE2C55]">▼</span>
              </div>
              <div className="flex-1 h-[38px] border border-gray-300 rounded-lg flex items-center bg-white focus-within:border-[#FE2C55] focus-within:ring-2 focus-within:ring-red-100 transition-all overflow-hidden shadow-sm">
                <input
                  type="text"
                  value={shopLink}
                  onChange={(e) => set('productLink', e.target.value)}
                  placeholder="粘贴商品链接"
                  className="flex-1 h-full px-3 outline-none text-sm"
                />
                <button className="h-full px-4 border-l border-gray-200 bg-gray-50 text-[#FE2C55] hover:bg-red-50 text-sm font-medium transition-colors">
                  识别链接
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 text-sm">星图任务</span>
              <button className="h-[32px] px-5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:border-[#FE2C55] hover:text-[#FE2C55] transition-colors text-sm shadow-sm font-medium">
                选择任务
              </button>
            </div>
          </div>
        </LabeledField>

        {/* ========== 音乐 ========== */}
        <LabeledField label="音乐" labelWidth="w-[126px]">
          <MusicSelect value={cfg.musicName || ''} onChange={v => set('musicName', v)} accentColor={ACCENT} />
        </LabeledField>

        {/* ========== 关联热点 ========== */}
        <LabeledField label="关联热点" labelWidth="w-[126px]">
          <TrendInput value={hotspotWord} onChange={v => set('hotspotWord', v)} accentColor={ACCENT} placeholder="点击输入热点词" />
        </LabeledField>

        {/* ========== 合集与声明 — 平台特有,保留内联 ========== */}
        <LabeledField label="合集与声明" labelWidth="w-[126px]">
          <div className="flex gap-3">
            <div className="text-gray-400 text-[13px] h-[38px] flex items-center bg-gray-50 px-3 rounded-lg border border-gray-100 w-[200px]">
              暂不支持合并设置
            </div>
            <select
              className="flex-1 h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-white cursor-pointer hover:border-[#FE2C55] transition-colors shadow-sm outline-none text-sm text-[#333] appearance-none"
              value={declaration}
              onChange={(e) => set('declaration', e.target.value)}
            >
              {Object.entries(DECLARATION_MAP).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </LabeledField>

        <LabeledField label="谁可以看" labelWidth="w-[126px]" topPadding="pt-1">
          <VisibilityRadio value={visibility} onChange={v => set('visibility', v)} accentColor={ACCENT} options={VISIBILITY_OPTIONS} name="dy_privacy" />
        </LabeledField>

        <LabeledField label="允许他人保存" labelWidth="w-[126px]" topPadding="pt-1">
          <VisibilityRadio
            value={allowDownload ? 'allow' : 'disallow'}
            onChange={v => set('allowDownload', v === 'allow')}
            accentColor={ACCENT}
            options={DOWNLOAD_OPTIONS}
            name="dy_download"
          />
        </LabeledField>

        {/* ========== 头条跨端同步 — 平台特有,保留内联 ========== */}
        <LabeledField label="同步发布" labelWidth="w-[126px]" topPadding="pt-3">
          <div>
            <div className="inline-flex items-center gap-3 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg shadow-sm">
              <div className="w-6 h-6 bg-red-600 rounded text-white flex items-center justify-center font-bold text-xs">头</div>
              <span className="text-sm font-medium text-gray-800">今日头条</span>
              <div
                className={`ml-4 w-10 h-5 rounded-full relative cursor-pointer transition-colors ${syncToutiao ? 'bg-[#FE2C55]' : 'bg-gray-300'}`}
                onClick={() => set('syncToutiao', !syncToutiao)}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${syncToutiao ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </div>
            </div>
            <div className="text-[11px] text-gray-400 mt-2">请确认已在抖音官方绑定账号，否则同步功能无效</div>
          </div>
        </LabeledField>

        <LabeledField label="发布时间" labelWidth="w-[126px]" topPadding="pt-1">
          <SchedulePicker
            scheduleType={scheduleType}
            scheduleTime={scheduleTime}
            onScheduleTypeChange={handleScheduleChange}
            onScheduleTimeChange={setScheduleTime}
            accentColor={ACCENT}
            name="dy_timing"
          />
        </LabeledField>

        <LabeledField label="抢占追评" labelWidth="w-[126px]">
          <FirstComment
            value={firstComment}
            onChange={v => set('firstComment', v)}
            accentColor={ACCENT}
            placeholder="在此设置视频发布后的首发评论..."
            hintText="底层机器人将在稿件发布成功且过审后，自动为您在评论区发表该言论。"
            showPin={false}
          />
        </LabeledField>

      </div>

      <FooterActions
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        accentColor={ACCENT}
        publishLabel="立即发布至抖音"
        isPublishing={isPublishing}
      />
    </div>
  );
}

export function validateDouyin(config) {
  const errors = [];
  if (!config.title || config.title.trim().length < 1) errors.push({ field: 'title', message: '请输入视频标题' });
  if (!config.coverUrl) errors.push({ field: 'coverUrl', message: '请上传视频封面' });
  if (config.scheduleType !== 'now' && !config.scheduleTime) errors.push({ field: 'scheduleTime', message: '定时发布必须设置时间' });
  return { valid: errors.length === 0, errors };
}
