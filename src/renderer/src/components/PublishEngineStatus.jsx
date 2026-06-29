import React from 'react';
import { Chrome, AlertCircle, CheckCircle } from 'lucide-react';

export default function PublishEngineStatus({ engineType, engineStatus, platform, accountId }) {
  // 根据引擎类型和状态显示不同的UI
  const getStatusInfo = () => {
    if (engineType === 'puppeteer') {
      if (engineStatus === 'connected') {
        return {
          icon: <Chrome size={16} className="text-green-500" />,
          text: '正在使用 Chrome 发布中...',
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200'
        };
      } else {
        return {
          icon: <AlertCircle size={16} className="text-yellow-500" />,
          text: 'Chrome 连接异常，降级为内嵌浏览器',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-200'
        };
      }
    } else {
      return {
        icon: <AlertCircle size={16} className="text-blue-500" />,
        text: '正在使用内嵌浏览器发布中...',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200'
      };
    }
  };

  const statusInfo = getStatusInfo();

  // 只在发布中的任务显示状态
  if (!['发布中', '排队中'].includes(engineStatus)) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.textColor} text-sm`}>
      {statusInfo.icon}
      <span className="font-medium">{statusInfo.text}</span>
    </div>
  );
}