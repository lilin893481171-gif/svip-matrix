// src/components/InteractionView.jsx
import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, MoreVertical, Bot, Clock, Shield, Pin, ShoppingBag, Zap, CheckSquare, Square, Video } from 'lucide-react';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return { ipcRenderer: { invoke: async () => ({}), on: () => {}, removeAllListeners: () => {} } };
};

// 🌟 抖音官方全量表情包破译字典 
const formatEmoji = (text) => {
    if (!text) return '';
    const emojiMap = {
        '[微笑]': '🙂', '[色]': '😍', '[爱慕]': '😍', '[捂脸]': '🤦‍♂️', '[呲牙]': '😁',
        '[大笑]': '😄', '[发怒]': '😡', '[灵机一动]': '💡', '[灵光一闪]': '💡', '[抠鼻]': '🤧',
        '[害羞]': '😳', '[调皮]': '😜', '[可爱]': '😜', '[吃瓜群众]': '🍉', '[晕]': '😵',
        '[闭嘴]': '🤐', '[笑哭]': '😂', '[难过]': '😢', '[亲亲]': '💋', '[吻]': '💋',
        '[来看我]': '👀', '[偷笑]': '🤭', '[打脸]': '🖐️', '[翻白眼]': '🙄', '[傲慢]': '🙄',
        '[睡]': '😴', '[鼾睡]': '😴', '[奸笑]': '😼', '[送心]': '💝', '[大哭]': '😭',
        '[抓狂]': '😫', '[惊讶]': '😲', '[酷拽]': '😎', '[泣不成声]': '😭', '[大金牙]': '😬',
        '[疑问]': '❓', '[what]': '❓', '[小鼓掌]': '👏', '[吐]': '🤮', '[拥抱]': '🤗',
        '[求抱抱]': '🤗', '[惊恐]': '😱', '[耶]': '✌️', '[醉了]': '🥴', '[看]': '👀',
        '[二哈]': '🐶', '[微笑袋鼠]': '🦘', '[冷漠]': '😐', '[暗中观察]': '🕵️', '[凝视]': '👁️',
        '[握爪]': '🤝', '[锦鲤]': '🐟', '[蜡烛]': '🕯️', '[加一]': '➕', '[我酸了]': '🍋',
        '[加鸡腿]': '🍗', '[我太南了]': '🍉', '[扎心]': '💔', '[给跪了]': '🧎', '[赞]': '👍',
        '[鼓掌]': '👏', '[比心]': '🫰', '[感谢]': '🙏', '[祈祷]': '🙏', '[胜利]': '✌️',
        '[强壮]': '💪', '[加油]': '💪', '[OK]': '👌', '[ok]': '👌', '[弱]': '👎',
        '[抱拳]': '👊', '[勾引]': '☝️', '[再见]': '👋', '[握手]': '🤝', '[玫瑰]': '🌹',
        '[666]': '🤙', '[爱心]': '❤️', '[心]': '❤️', '[胡瓜]': '🥒', '[嘴唇]': '👄',
        '[kiss]': '👄', '[给力]': '🐂', '[啤酒]': '🍻', '[派对]': '🎉', '[撒花]': '🎉',
        '[蛋糕]': '🎂', '[红包]': '🧧', '[礼物]': '🎁', '[发]': '🀄', '[咖啡]': '☕',
        '[太阳]': '☀️', '[月亮]': '🌙', '[心碎]': '💔', '[伤心]': '💔', '[便便]': '💩',
        '[屎]': '💩', '[福]': '🧧', '[一起加油]': '💪', '[戴口罩]': '😷', '[勤洗手]': '🧼',
        '[不信谣言]': '🚫', '[情书]': '💌', '[iloveyou]': '🤟', '[巧克力]': '🍫', '[戒指]': '💍',
        '[过年鼠]': '🐭', '[灯笼]': '🏮', '[饺子]': '🥟', '[汤圆]': '🍡', '[流泪]': '💧',
        '[愉快]': '😆', '[笑]': '😆', '[发呆]': '😶', '[惊呆]': '😶', '[机智]': '🤓',
        '[快哭了]': '🥺', '[击掌]': '✋', '[黑脸]': '🌚', '[飞吻]': '😘', '[碰拳]': '🤜',
        '[舔屏]': '👅', '[憨笑]': '憨', '[我想静静]': '🤫', '[思考]': '🤔', '[呆无辜]': '🥺',
        '[尴尬]': '😓', '[黑线]': '😓', '[得意]': '😏', '[衰]': '🥀', '[互粉]': '🤝',
        '[吐血]': '🩸', '[可怜]': '🥺', '[不看]': '🙈', '[摸头]': '💆', '[去污粉]': '🧼',
        '[钱]': '💰', '[撇嘴]': '撇', '[震惊]': '🙀', '[V5]': 'V5', '[菜刀]': '🔪',
        '[刀]': '🔪', '[做鬼脸]': '😝', '[皱眉]': '蹙', '[敲打]': '🔨', '[尬笑]': '😅',
        '[恐惧]': '😨', '[惊喜]': '🤩', '[石化]': '🗿', '[哈欠]': '🥱', '[炸弹]': '💣',
        '[嘘]': '🤫', '[吐舌]': '😛', '[委屈]': '委', '[吐彩虹]': '🌈', '[奋斗]': '🔥',
        '[生病]': '😷', '[雾霾]': '😷', '[擦汗]': '😅', '[如花]': '👩‍🦱', '[鄙视]': '😒',
        '[强]': '👍', '[紫薇别走]': '🏃', '[红脸]': '😳', '[困]': '🥱', '[流汗]': '😓',
        '[汗]': '😓', '[绿帽子]': '🧢', '[左上]': '↖️', '[熊吉]': '🐻', '[听歌]': '🎧',
        '[骷髅]': '💀', '[18禁]': '🔞', '[西瓜]': '🍉', '[斜眼]': '😒', '[阴险]': '险',
        '[白眼]': '🙄', '[凋谢]': '🥀', '[嘿哈]': '嘿', '[坏笑]': '😼', '[加好友]': '➕',
        '[囧]': '囧', '[泪奔]': '😭', '[不失礼貌的微笑]': '🙂', '[拳头]': '👊', '[右边]': '➡️',
        '[右哼哼]': '哼', '[悠闲]': '🍵', '[绝望的凝视]': '👁️', '[咒骂]': '🤬', '[猪头]': '🐷',
        '[左边]': '⬅️', '[左哼哼]': '哼'
    };
    return text.replace(/\[.*?\]/g, match => emojiMap[match] || match);
};

const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48Y2lyY2xlIGN4PSI2MCIgY3k9IjYwIiByPSI2MCIgZmlsbD0iI2U1ZThlYiIvPjxwYXRoIGQ9Ik02MCA3M2MyMC45IDAgMzggMTIuNSAzOCAyOC40Qzk4IDExMiA4MSAxMjAgNjAgMTIwUzIyIDExMiAyMiAxMDEuNEMyMiA4NS41IDM5LjEgNzMgNjAgNzN6TTYwIDE3YzE0LjkgMCAyNyAxMi4xIDI3IDI3cy0xMi4xIDI3LTI3IDI3LTI3LTEyLjEtMjctMjcgMTIuMS0yNyAyNy0yN3oiIGZpbGw9IiNjYmQ1ZTEiLz48L3N2Zz4=';
const DEFAULT_COVER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMzAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YxZjVmOSIvPjxwYXRoIGQ9Ik0xMDAgMTIwdjYwbDUwLTMwLTUwLTMweiIgZmlsbD0iI2NiZDVlMSIvPjwvc3ZnPg==';

export default function InteractionView({ accounts = [] }) {
  const electron = getElectron();
  const [messages, setMessages] = useState([]);
  const [viewMode, setViewMode] = useState('comments'); 
  const [replyText, setReplyText] = useState('');
  const [currentReplyId, setCurrentReplyId] = useState(null);
  const [radarAccountId, setRadarAccountId] = useState('');
  const [selectedVideos, setSelectedVideos] = useState([]);

  // 🌟 核心优化 1：视频列表接入本地持久化缓存，切换界面绝对不丢失！
  const [scannedVideos, setScannedVideos] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scannedVideos_cache');
      if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
      }
    }
    return [];
  });

  // 监听数据变化，实时存入本地缓存
  useEffect(() => {
    localStorage.setItem('scannedVideos_cache', JSON.stringify(scannedVideos));
  }, [scannedVideos]);

  const fetchMessages = async () => {
    try {
      const data = await electron.ipcRenderer.invoke('get-messages');
      if (data) setMessages(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSummonSandbox = async () => {
    if (viewMode === 'comments' && !activeMsg) return;
    if (viewMode === 'first_pin' && selectedVideos.length === 0) return;
    
    const targetVideoObjects = scannedVideos.filter(v => selectedVideos.includes(v.id));

    try {
      const res = await electron.ipcRenderer.invoke('open-reply-sandbox', { 
        messageId: viewMode === 'first_pin' ? 'batch_pin' : activeMsg?.id, 
        replyText: replyText,
        targetVideos: viewMode === 'first_pin' ? targetVideoObjects : []
      });
      
      if (res.success) { 
          setReplyText(''); 
          if (viewMode === 'first_pin') {
              // 🌟 核心优化 2：执行完毕后，自动从列表中销毁这些已发过置顶的视频！
              setScannedVideos(prev => prev.filter(v => !selectedVideos.includes(v.id)));
              setSelectedVideos([]); // 清空勾选项
          }
      } else { 
          alert(`唤起失败: ${res.message}`); 
      }
    } catch (e) { alert('调用降临引擎失败，请检查控制台。'); }
  };

  const handleStartRadar = async () => {
    if (!radarAccountId) { alert('⚠️ 请先在下拉菜单中选择一个要扫描的账号！'); return; }
    const targetAcc = accounts.find(a => String(a.id) === String(radarAccountId));
    if (!targetAcc) return;

    try {
      const res = await electron.ipcRenderer.invoke('sync-platform-interactions', { 
          accountId: targetAcc.id, 
          platform: targetAcc.platform,
          radarType: viewMode === 'first_pin' ? 'video' : 'comment'
      });
      alert(res?.message || '雷达探测结束！');
      
      fetchMessages(); 
      
      if (viewMode === 'first_pin' && res.scannedVideos && res.scannedVideos.length > 0) {
        // 🌟 核心优化 3：不要覆盖老视频，而是采用“增量去重追加”策略
        setScannedVideos(prev => {
           // 过滤掉已经在列表里的视频，防止重复
           const newItems = res.scannedVideos.filter(nv => !prev.some(pv => pv.id === nv.id));
           // 新抓的视频排在最前面，老的在后面
           return [...newItems, ...prev];
        });
      } else if (viewMode === 'first_pin') {
         alert('⚠️ 未能成功抓取到该账号的最新视频，请确认沙盒是否正常加载。');
      }
    } catch (error) {
      alert('雷达发射失败: ' + error.message);
    }
  };

  const toggleVideoSelection = (vid) => {
    setSelectedVideos(prev => 
      prev.includes(vid) ? prev.filter(id => id !== vid) : [...prev, vid]
    );
  };

  const activeMsg = messages.find(m => m.id === currentReplyId);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in max-w-7xl mx-auto pb-10">
      
      {/* 左侧消息列表侧边栏 */}
      <div className="w-[380px] border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-3 border-b border-slate-200">
          
          <div className="flex space-x-2 mb-3">
            <button onClick={() => { setViewMode('comments'); setCurrentReplyId(null); setReplyText(''); }} className={`flex-1 font-bold text-sm py-1.5 rounded-md shadow-sm transition flex items-center justify-center ${viewMode === 'comments' ? 'bg-white border border-red-500 text-red-600' : 'bg-transparent border border-transparent text-slate-500 hover:bg-slate-200'}`}>
              <Zap size={14} className="mr-1"/> 全域评论感知
            </button>
            <button onClick={() => { setViewMode('first_pin'); setSelectedVideos([]); setReplyText(''); }} className={`flex-1 font-bold text-sm py-1.5 rounded-md shadow-sm transition flex items-center justify-center ${viewMode === 'first_pin' ? 'bg-white border border-orange-500 text-orange-600' : 'bg-transparent border border-transparent text-slate-500 hover:bg-slate-200'}`}>
              <Pin size={14} className="mr-1"/> 首发置顶矩阵
            </button>
          </div>

          <div className="mb-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <select value={radarAccountId} onChange={(e) => setRadarAccountId(e.target.value)} className="w-full mb-2 bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500">
              <option value="">-- 请选择要扫描的账号 --</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>[{acc.platform}] {acc.alias}</option>)}
            </select>
            <button onClick={handleStartRadar} className={`w-full text-white text-xs font-bold py-2 rounded-md shadow-sm transition flex items-center justify-center gap-1 active:scale-95 ${viewMode === 'first_pin' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
              <span className="text-sm">🛸</span> {viewMode === 'first_pin' ? '扫描最新发布 1-3 个视频' : '启动底层收信雷达'}
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input type="text" placeholder={viewMode === 'first_pin' ? "搜索视频标题..." : "全局搜索粉丝或内容..."} className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-red-500 bg-white" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          
          {/* ================= 模式 1：全域评论感知 ================= */}
          {viewMode === 'comments' && messages.map((msg) => (
            <div key={msg.id} onClick={() => { setCurrentReplyId(msg.id); setReplyText(''); }} className={`p-4 border-b border-slate-100 cursor-pointer transition ${currentReplyId === msg.id ? 'bg-red-50/50 border-l-4 border-l-red-600' : 'hover:bg-white border-l-4 border-l-transparent'}`}>
              <div className="flex gap-3">
                <img src={msg.avatar || DEFAULT_AVATAR} onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }} alt="avatar" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full shadow-sm object-cover bg-slate-200 flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-sm font-bold text-slate-800">{msg.user}</div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{msg.time}</div>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-2 leading-relaxed">{formatEmoji(msg.content)}</p>
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 w-max">{msg.platform} · {msg.account}</span>
                      {msg.video_cover && <img src={msg.video_cover} onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_COVER; e.target.style.display = 'block'; }} referrerPolicy="no-referrer" className="w-12 h-16 object-cover rounded shadow-sm mt-1" alt="video_cover" />}
                    </div>
                    {msg.status !== '已回复' ? <span className="w-2 h-2 rounded-full bg-red-500 mb-1"></span> : <span className="text-[10px] text-emerald-500 flex items-center mb-1"><CheckCircle size={10} className="mr-0.5"/> 已复</span>}
                  </div>
                  {/* 左侧列表显示回复摘要 */}
                  {msg.status === '已回复' && msg.reply_content && (
                    <div className="mt-2 px-2 py-1.5 bg-emerald-50 rounded-md border border-emerald-100 text-[10px] text-emerald-700 line-clamp-1">
                      <span className="font-bold mr-1">机甲:</span>
                      {msg.reply_content.replace(/\[沙盒全自动\]\s*|\[沙盒手动\]\s*/g, '')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* ================= 模式 2：首发置顶矩阵 ================= */}
          {viewMode === 'first_pin' && scannedVideos.map((vid) => {
            const isSelected = selectedVideos.includes(vid.id);
            return (
              <div key={vid.id} onClick={() => toggleVideoSelection(vid.id)} className={`p-4 border-b border-slate-100 cursor-pointer transition flex gap-3 items-center ${isSelected ? 'bg-orange-50/50 border-l-4 border-l-orange-500' : 'hover:bg-white border-l-4 border-l-transparent'}`}>
                {isSelected ? <CheckSquare size={20} className="text-orange-500 flex-shrink-0" /> : <Square size={20} className="text-slate-300 flex-shrink-0" />}
                
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-sm font-bold text-slate-800 line-clamp-1">{vid.title}</div>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 w-max">{vid.platform} · {vid.account}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{vid.time}</span>
                  </div>
                </div>
                <img src={vid.cover?.startsWith('//') ? `https:${vid.cover}` : (vid.cover || DEFAULT_COVER)} onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_COVER; e.target.style.display = 'block'; }} referrerPolicy="no-referrer" alt="cover" className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0 bg-slate-100" />
              </div>
            );
          })}

          {viewMode === 'comments' && messages.length === 0 && <div className="text-center text-slate-400 text-xs py-10">暂无互动数据</div>}
          {viewMode === 'first_pin' && scannedVideos.length === 0 && <div className="text-center text-slate-400 text-xs py-10 px-4">请先选择账号并点击上方雷达扫描最新视频，<br/>由于各平台审核延迟，推荐发布后10分钟扫描</div>}
        </div>
      </div>

      {/* 右侧主面板：回复与引导置顶 */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shadow-sm z-10">
          <div>
            <div className="font-bold text-slate-800">
              {viewMode === 'comments' ? (activeMsg ? `回复粉丝: ${activeMsg.user}` : '选择左侧消息开始处理') : 
               (selectedVideos.length > 0 ? `批量下发首评: 已选中 ${selectedVideos.length} 个视频` : '勾选左侧最新视频进行批量置顶')}
            </div>
            {viewMode === 'comments' && activeMsg && <div className="text-xs text-slate-500 mt-0.5">操作对象：{activeMsg.platform}</div>}
          </div>
          <button className="text-slate-400 hover:text-slate-600"><MoreVertical size={18}/></button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {viewMode === 'comments' && activeMsg && (
            <>
              <div className="flex flex-col items-center mb-6"><span className="text-[10px] bg-slate-200 text-slate-500 px-3 py-1 rounded-full border border-slate-300">选中的目标评论</span></div>
              
              {/* 粉丝的灰色气泡 */}
              <div className="flex items-start mb-6">
                <img src={activeMsg.avatar || DEFAULT_AVATAR} onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full shadow-sm object-cover mr-3 bg-slate-200" alt="avatar" />
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-sm text-slate-700 max-w-lg">
                  {formatEmoji(activeMsg.content)}
                  {activeMsg.video_cover && <img src={activeMsg.video_cover} onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_COVER; e.target.style.display = 'block'; }} referrerPolicy="no-referrer" className="w-24 h-32 object-cover rounded mt-3 shadow-sm" alt="video_cover" />}
                  <div className="text-[10px] text-slate-400 mt-2">{activeMsg.time}</div>
                </div>
              </div>

              {/* 我们绿色的回复气泡 */}
              {activeMsg.status === '已回复' && activeMsg.reply_content && (
                <div className="flex items-start justify-end mb-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="bg-emerald-500 text-white p-4 rounded-2xl rounded-tr-none shadow-md text-sm max-w-lg">
                    {formatEmoji(activeMsg.reply_content.replace(/\[沙盒全自动\]\s*|\[沙盒手动\]\s*/g, ''))}
                    <div className="text-[10px] text-emerald-100 mt-2 flex justify-end items-center">
                      <CheckCircle size={10} className="mr-1"/> 已通过机甲发送
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 text-red-500 flex items-center justify-center font-black shadow-sm ml-3 flex-shrink-0">
                    N
                  </div>
                </div>
              )}
            </>
          )}

          {viewMode === 'first_pin' && selectedVideos.length > 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 animate-in zoom-in-95">
              <Video size={48} className="mb-4 text-orange-200" />
              <p className="text-sm">已锁定 {selectedVideos.length} 个跨平台视频实体</p>
              <p className="text-xs mt-2">请在下方配置您的“引流转化话术”，点击按钮将由沙盒自动降临执行</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="text-xs font-medium text-slate-500 flex items-center bg-slate-100 px-2 py-1 rounded"><ShoppingBag size={14} className="mr-1 text-orange-500"/> 电商引流话术:</span>
            <button onClick={() => setReplyText('🎉 视频同款已上架主页橱窗，喜欢的朋友可以直接下单哦~ 🛒')} className="text-xs border border-orange-200 text-orange-600 bg-orange-50 px-3 py-1 rounded-full hover:bg-orange-100 transition whitespace-nowrap">橱窗引导 (首评置顶)</button>
            <button onClick={() => setReplyText('👇 感谢大家喜欢！左下角小黄车链接可以直接购买同款哦！')} className="text-xs border border-orange-200 text-orange-600 bg-orange-50 px-3 py-1 rounded-full hover:bg-orange-100 transition whitespace-nowrap">小黄车引导</button>
            
            <div className="w-full h-0"></div> 
            
            <span className="text-xs font-medium text-slate-500 flex items-center bg-slate-100 px-2 py-1 rounded mt-1"><Bot size={14} className="mr-1 text-blue-500"/> 评论互动预设:</span>
            <button onClick={() => setReplyText('感谢支持！这款模型材质非常扎实，绝对物超所值~')} className="text-xs border border-blue-200 text-blue-600 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition whitespace-nowrap mt-1">模型材质解答</button>
            <button onClick={() => setReplyText('现货发售中，今天下单明天就能安排发货啦！📦')} className="text-xs border border-blue-200 text-blue-600 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition whitespace-nowrap mt-1">发货说明</button>
          </div>

          <div className="relative flex flex-col gap-2">
            <div className="relative">
              <textarea 
                value={replyText} onChange={e => setReplyText(e.target.value)} 
                disabled={(viewMode === 'comments' && !activeMsg) || (viewMode === 'first_pin' && selectedVideos.length === 0)}
                placeholder={(viewMode === 'comments' && !activeMsg) ? "请先选择一条评论" : (viewMode === 'first_pin' && selectedVideos.length === 0) ? "请先在左侧勾选需要置顶的视频" : "输入您的回复或首评引流内容..."} 
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 pb-14 outline-none focus:border-emerald-500 text-sm resize-none transition disabled:opacity-50"
                style={{ minHeight: '110px' }}
              ></textarea>
              <div className="absolute right-3 bottom-3 flex gap-2 items-center">
                <button className="p-2 text-slate-400 hover:text-emerald-600 transition bg-white border border-slate-200 rounded-lg shadow-sm" title="定时任务"><Clock size={16}/></button>
                <button 
                  onClick={handleSummonSandbox} 
                  disabled={!replyText.trim() || (viewMode === 'comments' && !activeMsg) || (viewMode === 'first_pin' && selectedVideos.length === 0)} 
                  className={`text-white font-bold py-2 px-4 rounded-lg shadow-md transition flex items-center text-sm disabled:opacity-50 active:scale-95 ${viewMode === 'first_pin' ? 'bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300'}`}
                >
                  {viewMode === 'first_pin' ? <><Pin size={14} className="mr-1.5"/>唤起沙盒：批量下发置顶</> : <><Shield size={14} className="mr-1.5"/>唤起沙盒：回复评论</>}
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-400 px-2 mt-1 flex justify-between">
              <span>💡 提示：话术将被自动复制，在真实网页按 <strong className="text-slate-600">Ctrl+V</strong> 即可发送。</span>
              {viewMode === 'first_pin' && <span className="text-orange-600 font-medium">✔️ 发送后记得点击右侧「...」设为置顶</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}