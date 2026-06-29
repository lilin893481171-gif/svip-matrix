import React from 'react';
import { AlertCircle, Chrome, Download, RotateCw } from 'lucide-react';

export default function BrowserEngineErrorHandling({ errorType, onAction }) {
  const getErrorConfig = () => {
    switch (errorType) {
      case 'chrome_not_installed':
        return {
          icon: <AlertCircle size={20} className="text-red-500" />,
          title: 'Chrome 未安装',
          description: '系统未检测到 Google Chrome 浏览器，无法使用真实浏览器引擎发布。',
          actionText: '下载 Chrome 浏览器',
          actionIcon: <Download size={16} />,
          actionUrl: 'https://www.google.com/chrome/'
        };
      case 'chrome_launch_failed':
        return {
          icon: <AlertCircle size={20} className="text-red-500" />,
          title: 'Chrome 启动失败',
          description: '无法启动 Chrome 浏览器，系统将自动降级为内嵌浏览器模式。',
          actionText: '切换为内嵌浏览器',
          actionIcon: <RotateCw size={16} />,
          onAction: () => onAction('switch_to_embedded')
        };
      case 'login_required':
        return {
          icon: <AlertCircle size={20} className="text-orange-500" />,
          title: '需要登录',
          description: '请先在内嵌浏览器中登录小红书账号，以同步登录态到真实浏览器。',
          actionText: '前往内嵌浏览器登录',
          actionIcon: <Chrome size={16} />,
          onAction: () => onAction('go_to_login')
        };
      default:
        return {
          icon: <AlertCircle size={20} className="text-red-500" />,
          title: '未知错误',
          description: '浏览器引擎出现未知错误，请尝试重启应用或联系技术支持。',
          actionText: '重试',
          actionIcon: <RotateCw size={16} />,
          onAction: () => onAction('retry')
        };
    }
  };

  const config = getErrorConfig();

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <div className="font-medium text-red-800">{config.title}</div>
          <div className="text-sm text-red-700 mt-1">{config.description}</div>
          <button
            onClick={config.onAction || (() => window.open(config.actionUrl, '_blank'))}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            {config.actionIcon}
            {config.actionText}
          </button>
        </div>
      </div>
    </div>
  );
}