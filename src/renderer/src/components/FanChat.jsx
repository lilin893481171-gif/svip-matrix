// FanChat.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import './FanChat.css'; // 记得建这个CSS文件

export default function FanChat() {
  // ================== 1. 假数据 (通灵) ==================
  const [contacts, setContacts] = useState([
    { id: 1, name: '热爱生活的阿柴', platform: '小红书', accountAlias: '极客好物', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Chai', lastMessage: '请问这款键盘还有黑色吗？', lastTime: '10:42' },
    { id: 2, name: '硬核数码君', platform: 'B站', accountAlias: '品牌宣传号', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Tech', lastMessage: '三连了！视频做得太棒了！', lastTime: '昨天' },
    { id: 3, name: '买买买小能手', platform: '抖音', accountAlias: 'NIKOLA官方主号', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Buy', lastMessage: '发什么快递呀？', lastTime: '星期二' }
  ]);

  const [messagesDB, setMessagesDB] = useState({
    1: [
      { id: 101, sender: 'them', text: '你好，在吗？' },
      { id: 102, sender: 'them', text: '请问这款键盘还有黑色吗？' }
    ],
    2: [
      { id: 201, sender: 'them', text: '这期视频剪辑太帅了，三连了！' },
      { id: 202, sender: 'me', text: '感谢支持！下期更精彩哦~' },
      { id: 203, sender: 'them', text: '期待期待！' }
    ],
    3: [
      { id: 301, sender: 'them', text: '想买这个，发什么快递呀？' }
    ]
  });

  // ================== 2. 状态与交互 ==================
  const [activeContactId, setActiveContactId] = useState(1);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const activeContact = useMemo(() => contacts.find(c => c.id === activeContactId), [contacts, activeContactId]);
  const currentMessages = useMemo(() => messagesDB[activeContactId] || [], [messagesDB, activeContactId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const getPlatformIcon = (platform) => {
    const icons = { '小红书': '📕', 'B站': '📺', '抖音': '🎵' };
    return icons[platform] || '💬';
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !activeContactId) return;

    // 更新消息库
    setMessagesDB(prev => ({
      ...prev,
      [activeContactId]: [
        ...(prev[activeContactId] || []),
        { id: Date.now(), sender: 'me', text: inputText.trim() }
      ]
    }));

    // 更新左侧列表摘要
    setContacts(prev => prev.map(c => 
      c.id === activeContactId 
        ? { ...c, lastMessage: inputText.trim(), lastTime: '刚刚' } 
        : c
    ));

    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ================== 3. 渲染页面 ==================
  return (
    <div className="chat-layout">
      {/* 左侧：会话列表 */}
      <div className="conversation-list">
        <div className="list-header">
          <h3>全部消息 ({contacts.length})</h3>
        </div>
        <div className="list-body">
          {contacts.map(contact => (
            <div 
              key={contact.id} 
              className={`contact-item ${activeContactId === contact.id ? 'active' : ''}`}
              onClick={() => setActiveContactId(contact.id)}
            >
              <div className="avatar-wrap">
                <img src={contact.avatar} alt="avatar" className="avatar" />
                <span className={`platform-badge ${contact.platform}`}>{getPlatformIcon(contact.platform)}</span>
              </div>
              <div className="contact-info">
                <div className="info-top">
                  <span className="name">{contact.name}</span>
                  <span className="time">{contact.lastTime}</span>
                </div>
                <div className="info-bottom">
                  <span className="account-alias">[{contact.accountAlias}]</span>
                  <span className="preview-text">{contact.lastMessage}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：聊天主视窗 */}
      {activeContact ? (
        <div className="chat-window">
          <div className="chat-header">
            <span className="chat-title">{activeContact.name}</span>
            <span className="chat-subtitle">来自 {activeContact.platform} ({activeContact.accountAlias})</span>
          </div>

          <div className="chat-messages">
            {currentMessages.map(msg => (
              <div key={msg.id} className={`message-row ${msg.sender === 'me' ? 'message-right' : 'message-left'}`}>
                {msg.sender !== 'me' && <img src={activeContact.avatar} className="msg-avatar" alt="them" />}
                <div className="msg-bubble">{msg.text}</div>
                {msg.sender === 'me' && <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Admin" className="msg-avatar me-avatar" alt="me" />}
              </div>
            ))}
            <div ref={messagesEndRef} /> {/* 滚动锚点 */}
          </div>

          <div className="chat-input-area">
            <div className="toolbar">
              <span className="tool-btn">😊 表情</span>
              <span className="tool-btn">⚡ 快捷回复</span>
            </div>
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入回复内容，按 Enter 发送..." 
            />
            <div className="input-actions">
              <button className="send-btn" onClick={handleSendMessage}>发送 (Enter)</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-window empty-state">
          <p>请选择左侧会话开始聊天</p>
        </div>
      )}
    </div>
  );
}