import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Plus, Search, Star, Send, Trash2, Inbox, Clock, Paperclip,
  Sparkles, Settings, ChevronDown, ChevronRight, X, AtSign,
  Bold, Italic, Underline, List, Image, Link, AlignLeft, Eye,
  Reply, Forward, MoreHorizontal, Edit3, User, Globe, Server,
  Languages, Loader2
} from 'lucide-react';
import DOMPurify from 'dompurify';
import usePersistentState from '../../../hooks/usePersistentState';
import { useToast } from '../../ToastContext';
import { cfApiUrl, authHeaders } from '../../../config/matrixConfig';

// ─── 文件夹列表 ───
const FOLDERS = ['收件箱', '已发送', '草稿箱', '垃圾邮件', '已删除'];

export default function EmailMatrixPanel() {
  const { addToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // ─── UI 状态记忆 ───
  const [panelState, setPanelState] = usePersistentState('email_panel_state_v1', {
    selectedAccount: null,
    selectedFolder: '收件箱',
    targetLang: (navigator.language || 'zh-CN').split('-')[0],
  });
  const selectedAccount = panelState.selectedAccount || accounts[0]?.id || null;
  const selectedFolder = panelState.selectedFolder;
  const updatePanelState = (patch) => setPanelState(prev => ({ ...prev, ...patch }));

  const [selectedEmail, setSelectedEmail] = useState(null);
  const [composeMode, setComposeMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ─── 模态表单状态 ───
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formProvider, setFormProvider] = useState('腾讯企业邮');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formSmtpHost, setFormSmtpHost] = useState('');
  const [formSmtpPort, setFormSmtpPort] = useState('465');
  const [formImapHost, setFormImapHost] = useState('');
  const [formImapPort, setFormImapPort] = useState('993');

  // ─── 翻译态 ───
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedBody, setTranslatedBody] = useState('');
  const targetLang = panelState.targetLang;
  const setTargetLang = (v) => updatePanelState({ targetLang: v });
  const [detectedSrc, setDetectedSrc] = useState(null);

  // ─── 加载账户列表 ───
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const rows = await window.electron.ipcRenderer.invoke('email-accounts-get');
        if (rows && rows.length > 0) {
          setAccounts(rows.map(r => ({
            id: r.id,
            email: r.email,
            displayName: r.display_name,
            provider: r.provider,
            avatar: r.avatar || r.email.slice(0, 2).toUpperCase(),
            unread: r.unread_count || 0,
            imapHost: r.imap_host,
            imapPort: r.imap_port,
            smtpHost: r.smtp_host,
            smtpPort: r.smtp_port,
          })));
        }
      } catch (e) {
        console.error('加载邮件账户失败:', e);
      }
    };
    loadAccounts();
  }, []);

  // ─── 加载邮件列表 ───
  const loadEmails = useCallback(async (accountId, folder) => {
    if (!accountId) return;
    setLoading(true);
    try {
      const cached = await window.electron.ipcRenderer.invoke('email-messages-cached', { accountId, folder });
      if (cached && cached.length > 0) {
        setEmails(cached.map(m => ({
          id: m.id, uid: m.uid, from: m.from_address, name: m.from_name,
          subject: m.subject, preview: m.preview, time: formatTime(m.received_at),
          date: formatDate(m.received_at), unread: !m.is_read,
          starred: !!m.is_starred, folder: m.folder,
        })));
      }
      const fresh = await window.electron.ipcRenderer.invoke('email-inbox-fetch', { accountId, folder, limit: 50 });
      if (fresh && Array.isArray(fresh)) {
        setEmails(fresh.map(m => ({
          id: m.id, uid: m.uid, from: m.from_address, name: m.from_name,
          subject: m.subject, preview: m.preview, time: formatTime(m.received_at),
          date: formatDate(m.received_at), unread: !m.is_read,
          starred: !!m.is_starred, folder: m.folder,
        })));
      }
    } catch (e) {
      console.error('加载邮件失败:', e);
      addToast('error', '邮件加载失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadEmails(selectedAccount, selectedFolder);
  }, [selectedAccount, selectedFolder, loadEmails]);

  // ─── 新邮件实时推送 ───
  useEffect(() => {
    const unsub = window.electron.ipcRenderer.on('email-new-message', (data) => {
      if (data.accountId === selectedAccount) {
        const m = data.message;
        setEmails(prev => [{
          id: m.id || Date.now(), uid: m.uid, from: m.from_address, name: m.from_name,
          subject: m.subject, preview: m.preview, time: formatTime(m.received_at),
          date: formatDate(m.received_at), unread: true, starred: false, folder: m.folder,
        }, ...prev]);
      }
      setAccounts(prev => prev.map(a =>
        a.id === data.accountId ? { ...a, unread: (a.unread || 0) + 1 } : a
      ));
    });
    return unsub;
  }, [selectedAccount]);

  // ─── 链接点击 → 打开悬浮浏览器 ───
  const handleEmailBodyClick = async (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      await window.electron.ipcRenderer.invoke('email-browser-open', { url: link.href });
    } catch (err) {
      console.error('打开链接失败:', err);
    }
  };

  const LANG_OPTS = [
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
  ];

  const handleTranslate = async (email) => {
    if (showTranslation) { setShowTranslation(false); return; }
    setTranslating(true);
    setShowTranslation(true);

    try {
      const stripText = email.body.replace(/<[^>]+>/g, '').trim();
      if (!stripText) { throw new Error('邮件正文为空'); }

      const targetLabel = LANG_OPTS.find(l => l.value === targetLang)?.label || targetLang;

      const response = await fetch(cfApiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `你是一个智能商务邮件翻译引擎。请先判断邮件原文的语种，然后将其翻译成${targetLabel}。但如果原文已经是${targetLabel}，则翻译为另一语种（英文←→中文互译，其他语言统一译为${targetLabel}）。翻译要求：保持原文的商务语气和专业格式，结果直接输出。最后单独一行用 JSON 注明源语言，格式：{"src":"zh"}`
            },
            { role: 'user', content: stripText }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) throw new Error(`API 错误 (${response.status})`);

      const data = await response.json();
      const raw = data.choices[0].message.content;

      const srcMatch = raw.match(/\{"src":"(\w+)"\}/);
      let translatedText = raw;
      if (srcMatch) {
        setDetectedSrc(srcMatch[1]);
        translatedText = raw.slice(0, srcMatch.index).trim();
      }

      setTranslatedBody(
        `<p style="color:#a5b4fc;background:rgba(99,102,241,.08);padding:16px;border-radius:12px;border-left:3px solid #6366f1;margin-bottom:16px;font-style:italic;">${translatedText.replace(/\n/g, '<br/>')}</p>`
      );
      addToast('success', '翻译完成', `已翻译为${targetLabel}`);
    } catch (err) {
      console.error('翻译失败:', err);
      setShowTranslation(false);
      setTranslatedBody('');
      addToast('error', '翻译失败', err.message || '请检查网络连接后重试');
    } finally {
      setTranslating(false);
    }
  };

  const [composeState, setComposeState] = usePersistentState('email_compose_draft_v1', {
    to: '', subject: '', body: '', from: '', attachments: [],
  });
  const composeTo = composeState.to;
  const composeSubject = composeState.subject;
  const composeBody = composeState.body;
  const composeFrom = composeState.from || selectedAccount || '';
  const updateCompose = (patch) => setComposeState(prev => ({ ...prev, ...patch }));
  const attachments = composeState.attachments || [];

  const activeAccount = accounts.find(a => a.id === selectedAccount);

  const handleSelectEmail = async (email) => {
    setSelectedEmail({ ...email, body: email.body || '', bodyLoading: !email.body });
    setComposeMode(false);
    setShowTranslation(false);
    setTranslatedBody('');
    setDetectedSrc(null);

    try {
      const detail = await window.electron.ipcRenderer.invoke('email-message-get', {
        accountId: selectedAccount, uid: email.uid, folder: selectedFolder,
      });
      if (detail?.success && (detail.bodyHtml || detail.bodyText)) {
        const finalBody = detail.bodyHtml || `<div style="white-space:pre-wrap;">${(detail.bodyText || '').replace(/</g,'&lt;')}</div>`;
        setSelectedEmail(prev => prev ? { ...prev, body: finalBody, bodyLoading: false } : prev);
      } else {
        setSelectedEmail(prev => prev ? { ...prev, bodyLoading: false } : prev);
      }
    } catch (e) {
      console.error('获取正文失败:', e);
      setSelectedEmail(prev => prev ? { ...prev, bodyLoading: false } : prev);
    }

    try {
      await window.electron.ipcRenderer.invoke('email-mark-read', {
        accountId: selectedAccount, uid: email.uid, folder: selectedFolder,
      });
      setEmails(prev => prev.map(e => e.uid === email.uid ? { ...e, unread: false } : e));
      setAccounts(prev => prev.map(a =>
        a.id === selectedAccount ? { ...a, unread: Math.max(0, (a.unread || 0) - 1) } : a
      ));
    } catch (e) { /* ignore */ }
  };

  const handleAddAccount = async () => {
    if (!formEmail.trim() || !formPassword.trim()) {
      addToast('warning', '表单不完整', '请填写邮箱地址和密码/授权码');
      return;
    }
    try {
      const result = await window.electron.ipcRenderer.invoke('email-accounts-add', {
        email: formEmail.trim(),
        password: formPassword,
        provider: formProvider,
        displayName: formDisplayName || formEmail.split('@')[0],
        smtpHost: formSmtpHost, smtpPort: parseInt(formSmtpPort) || 465,
        imapHost: formImapHost, imapPort: parseInt(formImapPort) || 993,
      });
      if (result?.success) {
        const rows = await window.electron.ipcRenderer.invoke('email-accounts-get');
        if (rows?.length > 0) {
          setAccounts(rows.map(r => ({
            id: r.id, email: r.email, displayName: r.display_name,
            provider: r.provider, avatar: r.avatar, unread: r.unread_count || 0,
          })));
          if (!selectedAccount) updatePanelState({ selectedAccount: result.id });
        }
        window.electron.ipcRenderer.invoke('email-accounts-test', { accountId: result.id }).then(test => {
          if (test?.success) addToast('success', '连接测试通过', 'IMAP + SMTP 均正常');
          else addToast('warning', '连接测试未通过', test?.message || '');
        });
        addToast('success', '矩阵节点已接入', `${formEmail} 已成功挂载`);
      } else {
        addToast('error', '接入失败', result?.message || '请检查配置');
      }
    } catch (e) {
      addToast('error', '接入异常', e.message);
    }
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormEmail(''); setFormPassword(''); setFormProvider('腾讯企业邮');
    setFormDisplayName(''); setFormSmtpHost(''); setFormSmtpPort('465');
    setFormImapHost(''); setFormImapPort('993'); setShowAdvanced(false);
  };

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) {
      addToast('warning', '表单不完整', '请填写收件人和主题');
      return;
    }
    setSending(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('email-send', {
        accountId: composeFrom || selectedAccount,
        to: composeTo,
        subject: composeSubject,
        bodyHtml: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">${composeBody.replace(/\n/g, '<br/>')}</div>`,
        attachments: attachments.map(a => ({ filePath: a.path, filename: a.name, mimeType: a.type })),
      });
      if (result?.success) {
        addToast('success', '邮件已发送', `${composeTo} 将在数秒内收到`);
        setComposeMode(false);
        updateCompose({ to: '', subject: '', body: '', attachments: [] });
      } else {
        addToast('error', '发送失败', result?.message || '请检查网络和账户配置');
      }
    } catch (e) {
      addToast('error', '发送异常', e.message);
    } finally {
      setSending(false);
    }
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    setComposeMode(true);
    updateCompose({ from: selectedAccount, to: selectedEmail.from, subject: `Re: ${selectedEmail.subject}`, body: '' });
  };

  const handleForward = () => {
    if (!selectedEmail) return;
    setComposeMode(true);
    updateCompose({ from: selectedAccount, to: '', subject: `Fwd: ${selectedEmail.subject}`, body: '' });
  };

  const handleDeleteEmail = async () => {
    if (!selectedEmail) return;
    try {
      await window.electron.ipcRenderer.invoke('email-delete', {
        accountId: selectedAccount, uid: selectedEmail.uid, folder: selectedFolder,
      });
      setEmails(prev => prev.filter(e => e.uid !== selectedEmail.uid));
      setSelectedEmail(null);
      addToast('success', '已删除', '邮件已移至垃圾箱');
    } catch (e) {
      addToast('error', '删除失败', e.message);
    }
  };

  const handleToggleStar = async () => {
    if (!selectedEmail) return;
    const newStarred = !selectedEmail.starred;
    try {
      await window.electron.ipcRenderer.invoke('email-toggle-star', {
        accountId: selectedAccount, uid: selectedEmail.uid, folder: selectedFolder, starred: newStarred,
      });
      setSelectedEmail(prev => prev ? { ...prev, starred: newStarred } : prev);
      setEmails(prev => prev.map(e => e.uid === selectedEmail.uid ? { ...e, starred: newStarred } : e));
    } catch (e) {
      addToast('error', '操作失败', e.message);
    }
  };

  const handleAiReply = async () => {
    if (!selectedEmail) return;
    const body = selectedEmail.body || '';
    const stripText = body.replace(/<[^>]+>/g, '').trim();
    if (!stripText) { addToast('warning', '正文为空', '无法生成回复'); return; }

    setComposeMode(true);
    updateCompose({ from: selectedAccount, to: selectedEmail.from, subject: `Re: ${selectedEmail.subject}`, body: 'AI 正在生成回复，请稍候...' });

    try {
      const response = await fetch(cfApiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的商务邮件回复助手。根据收到的邮件内容，生成一封得体、专业的回复邮件。只输出回复正文，不要添加额外说明。'
            },
            { role: 'user', content: `请回复以下邮件：\n\n发件人：${selectedEmail.name} <${selectedEmail.from}>\n主题：${selectedEmail.subject}\n正文：\n${stripText}` }
          ],
          temperature: 0.3
        })
      });
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '生成失败，请手动回复';
      updateCompose({ body: reply });
      addToast('success', '智脑回信已生成', '可编辑后发送');
    } catch (e) {
      updateCompose({ body: '' });
      addToast('error', 'AI 回信失败', e.message);
    }
  };

  const handlePolish = async () => {
    if (!composeBody.trim()) { addToast('warning', '正文为空', '请先撰写草稿'); return; }
    try {
      const response = await fetch(cfApiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的商务邮件润色助手。只输出润色后的邮件正文，不要添加额外说明。'
            },
            { role: 'user', content: `请润色以下邮件草稿：\n\n${composeBody}` }
          ],
          temperature: 0.2
        })
      });
      const data = await response.json();
      const polished = data.choices?.[0]?.message?.content;
      if (polished) {
        updateCompose({ body: polished });
        addToast('success', '润色完成', '已替换为专业版本');
      }
    } catch (e) {
      addToast('error', '润色失败', e.message);
    }
  };

  const handleSelectAttachments = async () => {
    try {
      const files = await window.electron.ipcRenderer.invoke('email-select-attachments');
      if (files && files.length > 0) {
        setComposeState(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...files] }));
      }
    } catch (e) { /* ignore */ }
  };

  function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return '昨天';
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    } catch { return ''; }
  }
  
  function formatDate(isoStr) {
    if (!isoStr) return '';
    try { return new Date(isoStr).toISOString().split('T')[0]; } catch { return ''; }
  }

  const getProviderBadge = (provider) => {
    const map = { 'QQ邮箱': 'bg-blue-500', '腾讯企业邮': 'bg-blue-600', '网易企业邮': 'bg-red-500', '阿里企业邮': 'bg-orange-500', '自建邮局': 'bg-emerald-600', 'Gmail': 'bg-red-600', 'Outlook': 'bg-blue-500' };
    return map[provider] || 'bg-zinc-600';
  };

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* ─── 工具栏 ─── */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-4">
          <Mail size={20} className="text-indigo-400" />
          <h1 className="font-black text-sm tracking-widest uppercase text-zinc-300">
            全域邮件总控中心
          </h1>
          {activeAccount && (
            <span className="text-[10px] text-zinc-500 font-mono">
              {activeAccount.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedEmail && !composeMode && (
            <button
              onClick={handleAiReply}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 hover:from-indigo-500 hover:to-purple-500 transition shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Sparkles size={14} />
              ✨ 智脑回信
            </button>
          )}
          {composeMode && (
            <button
              onClick={handlePolish}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold flex items-center gap-1.5 hover:from-amber-500 hover:to-orange-500 transition shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Sparkles size={14} />
              ✨ 商务润色
            </button>
          )}
          <button
            onClick={() => { setComposeMode(true); setSelectedEmail(null); }}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-500 transition active:scale-95"
          >
            <Edit3 size={14} /> 写邮件
          </button>
        </div>
      </div>

      {/* ─── 三栏布局 ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ====== 左栏：账户 + 文件夹 ====== */}
        <div className="w-64 border-r border-zinc-800 bg-zinc-900/30 flex flex-col shrink-0">
          <div className="p-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:from-indigo-500 hover:to-purple-500 transition shadow-lg active:scale-95"
            >
              <Plus size={16} /> + 接入新节点
            </button>
          </div>

          <div className="px-3 pb-3 border-b border-zinc-800/50">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
              已挂载矩阵节点
            </div>
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => updatePanelState({ selectedAccount: acc.id })}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition mb-1 ${
                  selectedAccount === acc.id
                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                    : 'hover:bg-zinc-800/50 text-zinc-400 border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${getProviderBadge(acc.provider)} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>
                  {acc.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{acc.displayName}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{acc.email}</div>
                </div>
                {acc.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {acc.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
              邮件分类
            </div>
            {FOLDERS.map(folder => {
              const count = folder === '收件箱' ? emails.filter(e => e.folder === folder).length : 0;
              return (
                <button
                  key={folder}
                  onClick={() => { updatePanelState({ selectedFolder: folder }); setSelectedEmail(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition mb-0.5 ${
                    selectedFolder === folder
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  {folder === '收件箱' && <Inbox size={15} />}
                  {folder === '已发送' && <Send size={15} />}
                  {folder === '草稿箱' && <Edit3 size={15} />}
                  {folder === '垃圾邮件' && <Trash2 size={15} />}
                  {folder === '已删除' && <Trash2 size={15} />}
                  <span className="text-xs flex-1">{folder}</span>
                  {count > 0 && <span className="text-[10px] text-zinc-500 font-mono">{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 text-[10px] text-zinc-600">
              <Server size={12} />
              <span>SMTP/IMAP 矩阵已激活</span>
            </div>
          </div>
        </div>

        {/* ====== 中栏：邮件流 ====== */}
        <div className="w-80 border-r border-zinc-800 flex flex-col shrink-0 bg-zinc-900/20">
          <div className="p-3 border-b border-zinc-800/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                placeholder="搜索邮件..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                <Loader2 size={32} className="animate-spin text-indigo-400" />
                <span className="text-xs font-bold">正在同步邮件...</span>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                <Inbox size={40} />
                <span className="text-xs font-bold">此文件夹暂无邮件</span>
              </div>
            ) : (
              emails.map(email => (
                <button
                  key={email.id}
                  onClick={() => handleSelectEmail(email)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-800/30 transition hover:bg-zinc-800/30 ${
                    selectedEmail?.id === email.id ? 'bg-indigo-600/10 border-l-2 border-l-indigo-500' : ''
                  } ${email.unread ? 'bg-zinc-800/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-lg bg-zinc-700 flex items-center justify-center text-xs font-black text-zinc-300">
                        {email.name.slice(0, 2)}
                      </div>
                      {email.unread && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs truncate ${email.unread ? 'font-black text-white' : 'font-bold text-zinc-300'}`}>
                          {email.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono ml-2 shrink-0">{email.time}</span>
                      </div>
                      <div className={`text-xs truncate mb-0.5 ${email.unread ? 'text-zinc-200 font-bold' : 'text-zinc-400'}`}>
                        {email.subject}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 truncate flex-1">{email.from}</span>
                        {email.starred && <Star size={11} className="text-amber-500 fill-amber-500 shrink-0" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ====== 右栏：读信 / 写信 / 浏览器 ====== */}
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
          {composeMode ? (
            /* ─── 写信态 ─── */
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-zinc-800 bg-zinc-900/30">
                <h2 className="font-black text-lg text-white mb-4">新邮件</h2>

                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold text-zinc-500 w-12 uppercase">发件人</span>
                  <select
                    value={composeFrom}
                    onChange={e => updateCompose({ from: e.target.value })}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.email} ({acc.displayName})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold text-zinc-500 w-12 uppercase">收件人</span>
                  <div className="flex-1 relative">
                    <input
                      value={composeTo}
                      onChange={e => updateCompose({ to: e.target.value })}
                      placeholder="recipient@example.com"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2.5 px-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition"
                    />
                    <AtSign size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-zinc-500 w-12 uppercase">主题</span>
                  <input
                    value={composeSubject}
                    onChange={e => updateCompose({ subject: e.target.value })}
                    placeholder="邮件主题..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-2.5 px-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition"
                  />
                </div>
              </div>

              {/* 编辑器工具栏 */}
              <div className="flex items-center gap-1 px-5 py-2 border-b border-zinc-800 bg-zinc-900/20">
                {[Bold, Italic, Underline, 'divider', List, 'divider', Link, Image, 'divider', AlignLeft].map((item, i) => {
                  if (item === 'divider') {
                    return <div key={i} className="w-px h-4 bg-zinc-700 mx-1" />;
                  }
                  const IconComponent = item;
                  return (
                    <button
                      key={i}
                      onClick={() => addToast('info', '编辑器', '富文本编辑功能将在下期接入')}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
                    >
                      <IconComponent size={14} />
                    </button>
                  );
                })}
                <div className="flex-1" />
                <button
                  onClick={handlePolish}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[10px] font-bold flex items-center gap-1 hover:from-amber-500 hover:to-orange-500 transition active:scale-95"
                >
                  <Sparkles size={12} /> 润色
                </button>
              </div>

              <textarea
                value={composeBody}
                onChange={e => updateCompose({ body: e.target.value })}
                placeholder="在此撰写邮件正文..."
                className="flex-1 bg-zinc-950 text-zinc-200 text-sm p-5 resize-none focus:outline-none placeholder-zinc-600 leading-relaxed"
              />

              <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/30">
                <div className="flex items-center gap-3">
                  <button onClick={handleSelectAttachments} className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition" title="添加附件">
                    <Paperclip size={16} />
                  </button>
                  {attachments.length > 0 && (
                    <div className="flex items-center gap-1">
                      {attachments.map((a, i) => (
                        <span key={i} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded flex items-center gap-1">
                          {a.name}
                          <button onClick={() => setComposeState(prev => ({ ...prev, attachments: (prev.attachments || []).filter((_, j) => j !== i) }))} className="text-zinc-500 hover:text-zinc-200">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setComposeMode(false); updateCompose({ attachments: [] }); }}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  >
                    丢弃
                  </button>
                  <button
                    onClick={handleComposeSend}
                    disabled={sending}
                    className="px-6 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {sending ? '发送中...' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedEmail ? (
            /* ─── 读信态 ─── */
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-zinc-800 bg-zinc-900/30">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-black text-lg text-white flex-1 pr-4">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={targetLang}
                      onChange={e => { setTargetLang(e.target.value); setShowTranslation(false); setDetectedSrc(null); }}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg py-1 px-2 text-[10px] font-bold text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                    >
                      {LANG_OPTS.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleTranslate(selectedEmail)}
                      disabled={translating}
                      className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg active:scale-95 disabled:opacity-50 ${
                        showTranslation
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/20'
                      }`}
                    >
                      {translating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Languages size={14} />
                      )}
                      {translating
                        ? '翻译中...'
                        : showTranslation
                          ? '已翻译'
                          : detectedSrc
                            ? `${LANG_OPTS.find(l=>l.value===detectedSrc)?.label||detectedSrc}→${LANG_OPTS.find(l=>l.value===targetLang)?.label||targetLang}`
                            : '智能翻译'}
                    </button>
                    <button
                      onClick={handleAiReply}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 hover:from-indigo-500 hover:to-purple-500 transition shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                      <Sparkles size={14} />
                      ✨ 智脑回信
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-700 flex items-center justify-center text-sm font-black text-zinc-300">
                    {(selectedEmail.name || '').slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">{selectedEmail.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">&lt;{selectedEmail.from}&gt;</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      收件人：我 · {selectedEmail.date} {selectedEmail.time}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={handleReply} className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition" title="回复">
                    <Reply size={16} />
                  </button>
                  <button onClick={handleForward} className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition" title="转发">
                    <Forward size={16} />
                  </button>
                  <button onClick={handleDeleteEmail} className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition" title="删除">
                    <Trash2 size={16} />
                  </button>
                  <button onClick={handleToggleStar} className={`p-2 rounded-lg hover:bg-zinc-700 transition ${selectedEmail.starred ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-200'}`} title="星标">
                    <Star size={16} fill={selectedEmail.starred ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4" onClick={handleEmailBodyClick}>
                {selectedEmail.bodyLoading ? (
                  <div className="flex items-center gap-3 text-zinc-500 py-8">
                    <Loader2 size={20} className="animate-spin text-indigo-400" />
                    <span className="text-sm">正在加载邮件正文...</span>
                  </div>
                ) : selectedEmail.body ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.body) }}
                  />
                ) : (
                  <div className="text-sm text-zinc-500 py-8">
                    <p className="mb-2">无法加载邮件正文</p>
                    {selectedEmail.preview && (
                      <p className="text-zinc-600 italic">预览：{selectedEmail.preview}</p>
                    )}
                  </div>
                )}
                {showTranslation && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md bg-indigo-600/20 flex items-center justify-center">
                        <Languages size={11} className="text-indigo-400" />
                      </div>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        {LANG_OPTS.find(l=>l.value===targetLang)?.label} 翻译
                      </span>
                    </div>
                    <div
                      className="text-zinc-300 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(translatedBody) }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ─── 空状态 ─── */
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 gap-4">
              <Mail size={64} className="text-zinc-800" />
              <div className="text-center">
                <p className="font-black text-zinc-600 text-lg mb-1">全域邮件总控中心</p>
                <p className="text-xs text-zinc-700">选择左侧邮件节点，开始矩阵化管理你的商务邮件</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowAddModal(false); resetForm(); }} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-[520px] max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <Globe size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-white">接入新矩阵节点</h2>
                  <p className="text-[10px] text-zinc-500">配置邮箱账号，加入全域邮件总控</p>
                </div>
              </div>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">邮箱地址</label>
                <input
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (!v || !v.includes('@')) return;
                    const domain = v.split('@')[1].toLowerCase();
                    const DOMAIN_MAP = {
                      'qq.com': 'QQ邮箱', 'vip.qq.com': 'QQ邮箱', 'foxmail.com': 'QQ邮箱',
                      'exmail.qq.com': '腾讯企业邮',
                      '163.com': '网易企业邮', '126.com': '网易企业邮', 'yeah.net': '网易企业邮',
                      'aliyun.com': '阿里企业邮', 'alibaba-inc.com': '阿里企业邮',
                      'gmail.com': 'Gmail', 'googlemail.com': 'Gmail',
                      'outlook.com': 'Outlook', 'hotmail.com': 'Outlook', 'live.com': 'Outlook',
                      'office365.com': 'Outlook',
                    };
                    const detected = DOMAIN_MAP[domain];
                    if (detected) {
                      setFormProvider(detected);
                      setShowAdvanced(false);
                      addToast('info', '已识别', `检测到 ${detected}，服务器配置已自动填充`);
                    } else {
                      setFormProvider('自建邮局');
                      setShowAdvanced(true);
                    }
                  }}
                  placeholder="your@qq.com"
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2.5 px-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                  邮件服务商
                  {formProvider !== '自建邮局' && (
                    <span className="ml-2 text-emerald-500 normal-case tracking-normal">已自动识别</span>
                  )}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['QQ邮箱', '腾讯企业邮', '网易企业邮', '阿里企业邮', 'Gmail', 'Outlook', '自建邮局'].map(p => (
                    <button
                      key={p}
                      onClick={() => { setFormProvider(p); setShowAdvanced(p === '自建邮局'); }}
                      className={`py-2 px-2 rounded-lg text-[10px] font-bold transition border ${
                        formProvider === p
                          ? 'border-indigo-500 bg-indigo-600/20 text-white'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                  显示名称 <span className="text-zinc-600 normal-case tracking-normal">（可选）</span>
                </label>
                <input
                  value={formDisplayName}
                  onChange={e => setFormDisplayName(e.target.value)}
                  placeholder="如：YuMatrix 客服"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2.5 px-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                  {formProvider === '自建邮局' ? '邮箱密码' : '授权码'}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder={formProvider === '自建邮局' ? '邮箱登录密码' : '第三方客户端授权码'}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2.5 px-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition"
                />
                <p className="text-[10px] text-zinc-600 mt-1">
                  {formProvider === 'QQ邮箱' ? 'QQ邮箱设置 → 账户 → POP3/IMAP/SMTP → 开启IMAP后生成授权码' :
                   formProvider === 'Gmail' ? 'Google 账户 → 安全性 → 两步验证 → 应用专用密码' :
                   formProvider === '腾讯企业邮' ? '邮箱设置 → 客户端专用密码' :
                   formProvider === '网易企业邮' ? '邮箱设置 → 客户端授权密码' :
                   formProvider === '阿里企业邮' ? '邮箱设置 → 客户端密码' :
                   formProvider === 'Outlook' ? 'Microsoft 账户密码或应用密码' :
                   '请输入邮箱密码'}
                </p>
              </div>

              {formProvider === '自建邮局' && (
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition"
                  >
                    {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Server size={14} />
                    SMTP / IMAP 服务器配置
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">SMTP 服务器</label>
                          <input
                            value={formSmtpHost}
                            onChange={e => setFormSmtpHost(e.target.value)}
                            placeholder="smtp.example.com"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">SMTP 端口</label>
                          <input
                            value={formSmtpPort}
                            onChange={e => setFormSmtpPort(e.target.value)}
                            placeholder="465"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">IMAP 服务器</label>
                          <input
                            value={formImapHost}
                            onChange={e => setFormImapHost(e.target.value)}
                            placeholder="imap.example.com"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">IMAP 端口</label>
                          <input
                            value={formImapPort}
                            onChange={e => setFormImapPort(e.target.value)}
                            placeholder="993"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-relaxed">
                        SSL/TLS 加密已默认开启。自建邮局请确保服务器证书有效，否则请在本地信任该证书。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-zinc-800">
              <span className="text-[10px] text-zinc-600">
                {formProvider !== '自建邮局' ? '只需邮箱地址 + 授权码即可接入' : '请填写完整的服务器信息'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  取消
                </button>
                <button
                  onClick={handleAddAccount}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center gap-2 hover:from-indigo-500 hover:to-purple-500 transition shadow-lg active:scale-95"
                >
                  <Plus size={14} /> 接入节点
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}