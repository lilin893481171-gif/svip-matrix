import React, { useState, useEffect } from 'react';
import { RefreshCw, Chrome, AlertCircle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export default function BrowserEngineSettings() {
  const [engineStatus, setEngineStatus] = useState('checking'); // checking, connected, degraded, error
  const [browserPath, setBrowserPath] = useState('');
  const [browserVersion, setBrowserVersion] = useState('');
  const [useSystemChrome, setUseSystemChrome] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // 模拟获取浏览器引擎状态
  useEffect(() => {
    const loadEngineStatus = async () => {
      setEngineStatus('checking');
      // 模拟异步加载
      setTimeout(() => {
        setEngineStatus('connected');
        setBrowserPath('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        setBrowserVersion('132.0.6834.110');
      }, 1500);
    };

    loadEngineStatus();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    // 模拟测试连接
    setTimeout(() => {
      setIsTesting(false);
      setTestResult({
        success: true,
        message: '连接成功，浏览器引擎已就绪'
      });
    }, 2000);
  };

  const handleBrowse = () => {
    // 在实际应用中，这里会调用 IPC 打开文件选择对话框
    alert('在实际应用中，这里会打开文件选择对话框');
  };

  const getStatusIcon = () => {
    switch (engineStatus) {
      case 'connected':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'degraded':
        return <AlertCircle size={20} className="text-yellow-500" />;
      case 'error':
        return <XCircle size={20} className="text-red-500" />;
      default:
        return <RefreshCw size={20} className="text-blue-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (engineStatus) {
      case 'connected':
        return '已连接 Chrome';
      case 'degraded':
        return '降级为内嵌浏览器';
      case 'error':
        return '连接失败';
      default:
        return '检测中...';
    }
  };

  const getStatusColor = () => {
    switch (engineStatus) {
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6">浏览器引擎设置</h3>

      {/* 引擎状态指示器 */}
      <div className="mb-6">
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor()}`}>
          {getStatusIcon()}
          <div>
            <div className="font-medium">{getStatusText()}</div>
            {engineStatus === 'connected' && browserVersion && (
              <div className="text-sm text-gray-500 mt-1">Chrome {browserVersion}</div>
            )}
          </div>
        </div>
      </div>

      {/* 浏览器引擎选择 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">浏览器引擎选择</label>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="engine"
              checked={useSystemChrome}
              onChange={() => setUseSystemChrome(true)}
              className="mt-1 w-4 h-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">自动检测 Chrome</div>
              <div className="text-sm text-gray-500 mt-1">
                优先使用系统已安装的 Chrome 浏览器，复用登录态，体验最佳
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="engine"
              checked={!useSystemChrome}
              onChange={() => setUseSystemChrome(false)}
              className="mt-1 w-4 h-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">手动指定路径</div>
              <div className="text-sm text-gray-500 mt-1">
                手动选择 Chrome 浏览器安装路径，或使用内嵌浏览器兜底
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Chrome 路径配置 */}
      {!useSystemChrome && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Chrome 安装路径</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={browserPath}
              onChange={(e) => setBrowserPath(e.target.value)}
              placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleBrowse}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              浏览
            </button>
          </div>
        </div>
      )}

      {/* 测试连接按钮 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTestConnection}
          disabled={isTesting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
        >
          {isTesting ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              测试中...
            </>
          ) : (
            <>
              <ExternalLink size={16} />
              测试连接
            </>
          )}
        </button>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {testResult.success ? (
              <CheckCircle size={16} />
            ) : (
              <XCircle size={16} />
            )}
            {testResult.message}
          </div>
        )}
      </div>

      {/* 异常处理提示 */}
      {engineStatus === 'error' && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 mt-0.5" />
            <div>
              <div className="font-medium text-red-800">Chrome 未安装或启动失败</div>
              <div className="text-sm text-red-700 mt-1">
                系统将自动降级为内嵌浏览器模式。为获得最佳体验，建议安装 Google Chrome 浏览器。
              </div>
              <a
                href="https://www.google.com/chrome/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-600 hover:text-red-800 font-medium mt-2 inline-flex items-center gap-1"
              >
                下载 Chrome 浏览器
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {engineStatus === 'degraded' && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-yellow-500 mt-0.5" />
            <div>
              <div className="font-medium text-yellow-800">已降级为内嵌浏览器</div>
              <div className="text-sm text-yellow-700 mt-1">
                未检测到系统 Chrome 浏览器，正在使用内嵌浏览器模式。部分功能可能受限。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}