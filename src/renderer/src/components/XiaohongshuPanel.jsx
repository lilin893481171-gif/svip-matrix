import React from 'react';
import PlatformHeader from './shared/PlatformHeader';
import LabeledField from './shared/LabeledField';
import CharInput from './shared/CharInput';
import CharTextarea from './shared/CharTextarea';
import CoverUpload from './shared/CoverUpload';
import TagInput from './shared/TagInput';
import MentionInput from './shared/MentionInput';
import SchedulePicker from './shared/SchedulePicker';
import FirstComment from './shared/FirstComment';
import FooterActions from './shared/FooterActions';
import useScheduleState from '../hooks/useScheduleState';

export default function XiaohongshuPanel({ config, onChange, onPublish, onSaveDraft, isPublishing = false }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const tags = cfg.tags || '';
  const coverUrl = cfg.coverUrl || '';
  const coverRatio = cfg.coverRatio || '';
  const poi = cfg.poi || '';
  const collection = cfg.collection || '';
  const mentionUser = cfg.mentionUser || '';
  const mentionPosition = cfg.mentionPosition || '补充';
  const isOriginal = cfg.isOriginal ?? true;
  const declaration = cfg.declaration || '虚构演绎，用于娱乐';
  const visibility = cfg.visibility || 'public';
  const firstComment = cfg.firstComment || '';
  const pinComment = cfg.pinComment ?? false;

  // 小红书主题色
  const accentColor = '#ff6b00';

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 font-sans text-[14px] text-[#333]">

          {/* 标题栏 */}
          <PlatformHeader
            icon="小"
            name="小红书"
            accentColor={accentColor}
            badgeAccent="bg-orange-50 text-orange-500 border-orange-100"
          />

          <div className="p-8 space-y-6">
            {/* 标题 */}
            <LabeledField label="标题" required labelWidth="w-[110px]">
              <CharInput
                value={title}
                onChange={v => set('title', v)}
                maxLength={20}
                accentColor={accentColor}
                placeholder="请输入"
              />
            </LabeledField>

            {/* 封面 */}
            <LabeledField label="封面" required labelWidth="w-[110px]" topPadding="pt-1">
              <CoverUpload
                value={coverUrl}
                onChange={v => set('coverUrl', v)}
                accentColor={accentColor}
              />
            </LabeledField>

            {/* 封面比例 */}
            <LabeledField label="封面比例" labelWidth="w-[110px]">
              <select
                value={coverRatio}
                onChange={e => set('coverRatio', e.target.value)}
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-orange-500 transition-colors shadow-sm outline-none text-sm text-gray-700"
              >
                <option value="">请选择封面比例</option>
                <option value="3:4">3:4</option>
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </LabeledField>

            {/* 简介 */}
            <LabeledField label="简介" labelWidth="w-[110px]">
              <div className="relative">
                <CharTextarea
                  value={desc}
                  onChange={v => set('desc', v)}
                  maxLength={1000}
                  accentColor={accentColor}
                  rows={4}
                  placeholder="说点什么吧..."
                />
                <div className="text-xs text-gray-500 mt-1">
                  不要在简介中输入带#的话题，请使用下方"话题"功能
                </div>
              </div>
            </LabeledField>

            {/* 话题 */}
            <LabeledField label="话题" labelWidth="w-[110px]">
              <TagInput
                value={tags}
                onChange={v => set('tags', v)}
                accentColor={accentColor}
                placeholder="请输入话题进行搜索"
              />
            </LabeledField>

            {/* @用户 */}
            <LabeledField label="@用户" labelWidth="w-[110px]">
              <MentionInput
                value={mentionUser}
                onChange={v => set('mentionUser', v)}
                accentColor={accentColor}
                position={mentionPosition}
                onPositionChange={v => set('mentionPosition', v)}
                hintText="@将追加到简介"
              />
            </LabeledField>

            {/* 断层 */}
            <LabeledField label="断层" labelWidth="w-[110px]">
              <select
                value={poi}
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
                value={collection}
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
                  checked={isOriginal}
                  onChange={e => set('isOriginal', e.target.checked)}
                />
                <span>声明后将获得原创笔记标记，且平台会保护你的作品</span>
              </label>
            </LabeledField>

            {/* 内容声明 */}
            <LabeledField label="内容声明" labelWidth="w-[110px]">
              <select
                value={declaration}
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
                    checked={visibility === 'public'}
                    onChange={() => set('visibility', 'public')}
                    className="w-4 h-4 accent-orange-500"
                  /> 公开
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'private'}
                    onChange={() => set('visibility', 'private')}
                    className="w-4 h-4 accent-orange-500"
                  /> 仅自身可见
                </label>
              </div>
            </LabeledField>

            {/* 发布时间 */}
            <LabeledField label="发布时间" labelWidth="w-[110px]">
              <SchedulePicker
                scheduleType={scheduleType}
                scheduleTime={scheduleTime}
                onScheduleTypeChange={handleScheduleChange}
                onScheduleTimeChange={setScheduleTime}
                accentColor={accentColor}
              />
            </LabeledField>

            {/* 追评 */}
            <LabeledField label="追评" labelWidth="w-[110px]">
              <FirstComment
                value={firstComment}
                onChange={v => set('firstComment', v)}
                accentColor={accentColor}
                pinComment={pinComment}
                onPinCommentChange={v => set('pinComment', v)}
                hintText="要确保小红书前台页面未离线才能发表评论"
                showPin={true}
              />
            </LabeledField>
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