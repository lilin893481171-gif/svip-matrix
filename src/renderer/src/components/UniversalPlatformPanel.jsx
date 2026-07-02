import React from 'react';
import {
  Hash, AtSign, MapPin, ShoppingBag, Eye, Clock, Music,
  MessageCircle, Shield, TrendingUp, FolderTree, FileText
} from 'lucide-react';
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

/**
 * 统一平台编辑器
 * 根据平台配置动态渲染表单字段
 */
export default function UniversalPlatformPanel({
  platform,
  config,
  onChange,
  onPublish,
  onSaveDraft,
  isPublishing = false
}) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  // 平台配置
  const platformConfigs = {
    '抖音': {
      accentColor: '#FE2C55',
      icon: <svg width="16" height="16" viewBox="0 0 48 48" fill="currentColor"><path d="M41.26 21.43a18.3 18.3 0 0 1-8.58-2.12v11.53A15.16 15.16 0 1 1 17.52 15.7v8.42a6.74 6.74 0 1 0 6.74 6.72V6h8.05a14.73 14.73 0 0 0 8.95 8.16v7.27z"/></svg>,
      fields: {
        title: { maxLength: 30, required: true },
        desc: { maxLength: 2000 },
        cover: { required: true, multiple: true },
        productLink: true,
        tags: true,
        visibility: true,
        allowDownload: true,
        hotspotWord: true,
        declaration: true,
        schedule: true,
        firstComment: true,
        syncToutiao: true
      }
    },
    '小红书': {
      accentColor: '#ff2442',
      icon: '小',
      fields: {
        title: { maxLength: 20, required: true },
        desc: { maxLength: 1000 },
        cover: { required: true, ratio: true },
        tags: true,
        mention: true,
        poi: true,
        collection: true,
        isOriginal: true,
        declaration: true,
        visibility: true,
        schedule: true,
        firstComment: true,
        pinComment: true
      }
    },
    'B站': {
      accentColor: '#FB7299',
      icon: 'B',
      fields: {
        title: { maxLength: 80, required: true },
        desc: { maxLength: 2000 },
        cover: { required: true },
        tags: { required: true, maxCount: 12 },
        tid: { required: true },
        copyright: true,
        dynamic: true,
        schedule: { minAdvance: 4 * 3600 }, // 至少提前4小时
        firstComment: true
      }
    },
    '快手': {
      accentColor: '#FF7700',
      icon: '快',
      fields: {
        title: { maxLength: 30 },
        desc: { maxLength: 1000 },
        cover: { required: true },
        tags: true,
        poi: true,
        visibility: true,
        schedule: true,
        firstComment: true
      }
    },
    '微信视频号': {
      accentColor: '#07C160',
      icon: '视',
      fields: {
        title: { maxLength: 30 },
        desc: { maxLength: 1000 },
        cover: { required: true },
        tags: true,
        location: true,
        schedule: true,
        firstComment: true
      }
    },
    '百家号': {
      accentColor: '#2b88ff',
      icon: '百',
      fields: {
        title: { maxLength: 30, required: true },
        desc: { maxLength: 2000 },
        cover: { required: true },
        tags: true,
        category: true,
        schedule: true,
        firstComment: true
      }
    }
  };

  const platformConfig = platformConfigs[platform] || platformConfigs['抖音'];
  const { accentColor, icon, fields } = platformConfig;

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 font-sans text-[14px] text-[#333]">

          <PlatformHeader
            icon={icon}
            name={platform}
            accentColor={accentColor}
            badgeAccent={`bg-red-50 text-[${accentColor}] border-red-100`}
          />

          <div className="space-y-6">
            {/* 标题 */}
            {fields.title && (
              <LabeledField label="标题" required={fields.title.required} labelWidth="w-[110px]">
                <CharInput
                  value={cfg.title || ''}
                  onChange={v => set('title', v)}
                  maxLength={fields.title.maxLength}
                  accentColor={accentColor}
                  placeholder="请输入标题"
                />
              </LabeledField>
            )}

            {/* 封面 */}
            {fields.cover && (
              <LabeledField label="封面" required={fields.cover.required} labelWidth="w-[110px]" topPadding="pt-1">
                <div className="flex gap-6 flex-1">
                  <CoverUpload
                    value={cfg.coverUrl || ''}
                    onChange={v => set('coverUrl', v)}
                    accentColor={accentColor}
                  />
                  {fields.cover.multiple && (
                    <CoverUpload
                      value={cfg.cover2Url || ''}
                      onChange={v => set('cover2Url', v)}
                      accentColor={accentColor}
                      label="封面2"
                    />
                  )}
                </div>
              </LabeledField>
            )}

            {/* 简介 */}
            {fields.desc && (
              <LabeledField label="简介" labelWidth="w-[110px]">
                <CharTextarea
                  value={cfg.desc || ''}
                  onChange={v => set('desc', v)}
                  maxLength={fields.desc.maxLength}
                  accentColor={accentColor}
                  rows={3}
                  placeholder="说点什么吧..."
                />
              </LabeledField>
            )}

            {/* 标签/话题 */}
            {fields.tags && (
              <LabeledField label="话题" labelWidth="w-[110px]">
                <TagInput
                  value={cfg.tags || ''}
                  onChange={v => set('tags', v)}
                  accentColor={accentColor}
                  placeholder="输入话题，按回车添加"
                />
              </LabeledField>
            )}

            {/* @用户 */}
            {fields.mention && (
              <LabeledField label="@用户" labelWidth="w-[110px]">
                <MentionInput
                  value={cfg.mentionUser || ''}
                  onChange={v => set('mentionUser', v)}
                  accentColor={accentColor}
                />
              </LabeledField>
            )}

            {/* 地点 */}
            {(fields.poi || fields.location) && (
              <LabeledField label="地点" labelWidth="w-[110px]">
                <input
                  type="text"
                  value={cfg.poi || ''}
                  onChange={e => set('poi', e.target.value)}
                  placeholder="添加地点"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[${accentColor}]"
                />
              </LabeledField>
            )}

            {/* 商品链接 */}
            {fields.productLink && (
              <LabeledField label="商品链接" labelWidth="w-[110px]">
                <ProductLink
                  value={cfg.productLink || ''}
                  onChange={v => set('productLink', v)}
                  accentColor={accentColor}
                />
              </LabeledField>
            )}

            {/* 可见性 */}
            {fields.visibility && (
              <LabeledField label="可见范围" labelWidth="w-[110px]">
                <VisibilityRadio
                  value={cfg.visibility || 'public'}
                  onChange={v => set('visibility', v)}
                  accentColor={accentColor}
                />
              </LabeledField>
            )}

            {/* 定时发布 */}
            {fields.schedule && (
              <LabeledField label="定时发布" labelWidth="w-[110px]">
                <SchedulePicker
                  scheduleType={scheduleType}
                  scheduleTime={scheduleTime}
                  onScheduleTypeChange={handleScheduleChange}
                  onScheduleTimeChange={setScheduleTime}
                  accentColor={accentColor}
                />
              </LabeledField>
            )}

            {/* 追评 */}
            {fields.firstComment && (
              <LabeledField label="追评" labelWidth="w-[110px]">
                <FirstComment
                  value={cfg.firstComment || ''}
                  onChange={v => set('firstComment', v)}
                  accentColor={accentColor}
                  pinComment={cfg.pinComment ?? false}
                  onPinCommentChange={v => set('pinComment', v)}
                  hintText="要确保小红书前台页面未离线才能发表评论"
                  showPin={true}
                />
              </LabeledField>
            )}

            {/* 平台特定字段 */}
            {platform === '抖音' && (
              <>
                <LabeledField label="热点词" labelWidth="w-[110px]">
                  <TrendInput
                    value={cfg.hotspotWord || ''}
                    onChange={v => set('hotspotWord', v)}
                    accentColor={accentColor}
                  />
                </LabeledField>
                <LabeledField label="声明" labelWidth="w-[110px]">
                  <select
                    value={cfg.declaration || '个人观点'}
                    onChange={e => set('declaration', e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none"
                  >
                    <option value="个人观点">个人观点</option>
                    <option value="虚构演绎">虚构演绎</option>
                    <option value="AI生成">AI生成</option>
                    <option value="营销信息">营销信息</option>
                  </select>
                </LabeledField>
              </>
            )}

            {/* 断层 */}
            <LabeledField label="断层" labelWidth="w-[110px]">
              <select
                value={cfg.poi || ''}
                onChange={e => set('poi', e.target.value)}
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-orange-500 transition-colors shadow-sm outline-none text-sm text-gray-700"
              >
                <option value="">请选择</option>
                <option value="美食">美食</option>
                <option value="旅行">旅行</option>
                <option value="时尚">时尚</option>
                <option value="美妆">美妆</option>
                <option value="家居">家居</option>
                <option value="数码">数码</option>
              </select>
            </LabeledField>

            {/* 添加到合集 */}
            <LabeledField label="添加到合集" labelWidth="w-[110px]">
              <select
                value={cfg.collection || ''}
                onChange={e => set('collection', e.target.value)}
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-orange-500 transition-colors shadow-sm outline-none text-sm text-gray-700"
              >
                <option value="">请选择</option>
                <option value="好物分享">好物分享</option>
                <option value="生活记录">生活记录</option>
                <option value="穿搭搭配">穿搭搭配</option>
                <option value="美妆护肤">美妆护肤</option>
                <option value="旅行日记">旅行日记</option>
              </select>
            </LabeledField>

            {/* 声明原创 */}
            <LabeledField label="声明原创" labelWidth="w-[110px]" topPadding="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-700 leading-relaxed font-medium">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded-sm mt-0.5 accent-orange-500"
                  checked={cfg.isOriginal ?? true}
                  onChange={e => set('isOriginal', e.target.checked)}
                />
                <span>声明后将获得原创笔记标记，且平台会保护你的作品</span>
              </label>
            </LabeledField>

            {/* 内容声明 */}
            <LabeledField label="内容声明" labelWidth="w-[110px]">
              <select
                value={cfg.declaration || '虚构演绎，用于娱乐'}
                onChange={e => set('declaration', e.target.value)}
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-orange-500 transition-colors shadow-sm outline-none text-sm text-gray-700"
              >
                <option value="虚构演绎，用于娱乐">虚构演绎，用于娱乐</option>
                <option value="真人出镜">真人出镜</option>
                <option value="AI生成内容">AI生成内容</option>
                <option value="商业推广">商业推广</option>
                <option value="品牌合作">品牌合作</option>
              </select>
            </LabeledField>

            {/* 关联群聊 */}
            <LabeledField label="关联群聊" labelWidth="w-[110px]">
              <select
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-orange-500 transition-colors shadow-sm outline-none text-sm text-gray-700"
              >
                <option value="">选择群</option>
                <option value="闺蜜团">闺蜜团</option>
                <option value="穿搭交流群">穿搭交流群</option>
                <option value="美食分享群">美食分享群</option>
              </select>
            </LabeledField>

            {/* 权限设置 */}
            <LabeledField label="权限设置" labelWidth="w-[110px]">
              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="visibility"
                    checked={(cfg.visibility || 'public') === 'public'}
                    onChange={() => set('visibility', 'public')}
                    className="w-4 h-4 accent-orange-500"
                  /> 公开
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="visibility"
                    checked={(cfg.visibility || 'public') === 'private'}
                    onChange={() => set('visibility', 'private')}
                    className="w-4 h-4 accent-orange-500"
                  /> 仅自身可见
                </label>
              </div>
            </LabeledField>

            {platform === 'B站' && (
              <>
                <LabeledField label="分区" required labelWidth="w-[110px]">
                  <select
                    value={cfg.tid || ''}
                    onChange={e => set('tid', e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none"
                  >
                    <option value="">选择分区</option>
                    <option value={161}>手工</option>
                    <option value={174}>生活</option>
                    <option value={188}>科技数码</option>
                    <option value={183}>知识</option>
                    <option value={211}>美食</option>
                  </select>
                </LabeledField>
                <LabeledField label="动态" labelWidth="w-[110px]">
                  <CharTextarea
                    value={cfg.dynamic || ''}
                    onChange={v => set('dynamic', v)}
                    maxLength={233}
                    accentColor={accentColor}
                    rows={2}
                    placeholder="发布动态..."
                  />
                </LabeledField>
              </>
            )}

          </div>

          <FooterActions
            onPublish={onPublish}
            onSaveDraft={onSaveDraft}
            isPublishing={isPublishing}
            accentColor={accentColor}
          />

        </div>
      </div>
    </div>
  );
}
