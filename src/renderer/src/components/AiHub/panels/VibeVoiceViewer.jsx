import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function VibeVoiceViewer({ rawMarkdown }) {
  // 测试用占位数据，当没有真实数据传入时显示，带你感受一下大模型的 Markdown 排版之美
  const placeholderText = `
### 🎙️ 音频处理就绪 
> 宇阵自驱核心引擎正在待命，等待 VibeVoice 节点返回数据流...
  `;

  const content = rawMarkdown || placeholderText;

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-300 p-8 font-mono">
      
      {/* 极客风头部状态栏 */}
      <div className="border-b border-green-500/30 pb-4 mb-6 flex items-center justify-between">
        <h2 className="text-xl text-green-400 font-bold tracking-widest flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
          宇阵引擎 // VIBE_VOICE_ASR
        </h2>
        <div className="text-xs text-gray-500 border border-gray-800 px-3 py-1 rounded bg-gray-900/50">
          STATUS: {rawMarkdown ? "RENDERED" : "AWAITING_STREAM"}
        </div>
      </div>

      {/* 🚀 核心渲染区：大模型驱动 UI (Generative UI) */}
      <div className="max-w-4xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          // 拦截器：将大模型吐出的生硬 HTML 标签，全部映射为高级的 Tailwind 样式！
          components={{
            // 自动渲染时间轴表格
            table: ({node, ...props}) => (
              <div className="overflow-x-auto my-6 border border-gray-800 rounded-lg">
                <table className="w-full text-left border-collapse" {...props} />
              </div>
            ),
            th: ({node, ...props}) => (
              <th className="bg-gray-900/80 text-green-400 p-4 border-b border-gray-800 font-semibold tracking-wider text-sm" {...props} />
            ),
            td: ({node, ...props}) => (
              <td className="p-4 border-b border-gray-800/50 text-gray-300 leading-relaxed align-top" {...props} />
            ),
            
            // 自动渲染大纲标题
            h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-8 mb-4 tracking-wide" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-xl font-bold text-gray-100 mt-6 mb-3 flex items-center gap-2 before:content-['>'] before:text-green-500" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-lg font-medium text-gray-200 mt-5 mb-2" {...props} />,
            
            // 自动渲染正文与强调
            p: ({node, ...props}) => <p className="leading-relaxed my-3 text-gray-400" {...props} />,
            strong: ({node, ...props}) => <strong className="text-green-300 font-medium bg-green-900/20 px-1 rounded" {...props} />,
            
            // 自动渲染情绪块/引言
            blockquote: ({node, ...props}) => (
              <blockquote className="border-l-4 border-green-500 pl-4 italic text-gray-400 my-5 bg-gray-800/30 py-3 rounded-r-md" {...props} />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}