import React from 'react';
import { Chrome, AlertCircle } from 'lucide-react';

export default function EngineStatusIndicator({ engineType, status, message }) {
  // 根据引擎类型和状态显示不同的UI
  if (engineType === 'puppeteer') {
    if (status === 'success' || status.includes('成功')) {
      return (
        <div className="inline-flex items-center gap-1.5 text-green-600">
          <Chrome size={14} className="flex-shrink-0" />
          <span className="font-bold text-xs">Chrome 发布成功</span>
        </div>
      );
    } else if (status === 'error' || status.includes('失败')) {
      return (
        <div className="inline-flex items-center gap-1.5 text-red-500">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="font-bold text-xs">Chrome 发布失败</span>
        </div>
      );
    } else if (status === 'cancelled' || status.includes('取消')) {
      return (
        <div className="inline-flex items-center gap-1.5 text-gray-500">
          <Chrome size={14} className="flex-shrink-0" />
          <span className="font-bold text-xs">Chrome 已取消</span>
        </div>
      );
    } else {
      return (
        <div className="inline-flex items-center gap-1.5 text-blue-500">
          <Chrome size={14} className="flex-shrink-0 animate-pulse" />
          <span className="font-bold text-xs">Chrome 发布中...</span>
        </div>
      );
    }
  } else {
    if (status === 'success' || status.includes('成功')) {
      return (
        <div className="inline-flex items-center gap-1.5 text-green-600">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="font-bold text-xs">内嵌浏览器发布成功</span>
        </div>
      );
    } else if (status === 'error' || status.includes('失败')) {
      return (
        <div className="inline-flex items-center gap-1.5 text-red-500">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="font-bold text-xs">内嵌浏览器发布失败</span>
        </div>
      );
    } else if (status === 'cancelled' || status.includes('取消')) {
      return (
        <div className="inline-flex items-center gap-1.5 text-gray-500">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="font-bold text-xs">内嵌浏览器已取消</span>
        </div>
      );
    } else {
      return (
        <div className="inline-flex items-center gap-1.5 text-blue-500">
          <AlertCircle size={14} className="flex-shrink-0 animate-pulse" />
          <span className="font-bold text-xs">内嵌浏览器发布中...</span>
        </div>
      );
    }
  }
}