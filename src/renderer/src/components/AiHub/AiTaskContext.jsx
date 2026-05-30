import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { cfApiUrl, authHeaders } from '../../config/matrixConfig';

// 1. 创建 Context
const AiTaskContext = createContext();

// 2. 导出自定义 Hook 供子组件使用
export const useAiTasks = () => useContext(AiTaskContext);

// 3. 全局 Provider 组件
export const AiTaskProvider = ({ children, isPhoneBound, onRequestBind }) => {
  const [messages, setMessages] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const abortControllers = useRef({});

  // 软件启动时加载硬盘记录
  useEffect(() => {
    localforage.getItem('matrix_chat_history').then(savedMessages => {
      if (savedMessages) setMessages(savedMessages);
    });
  }, []);

  // 消息变化时自动存盘
  useEffect(() => {
    if (messages.length > 0) localforage.setItem('matrix_chat_history', messages);
  }, [messages]);

  // 🔒 统一守卫 — 所有 AI 任务提交的唯一安检入口
  const guardDispatch = () => {
    if (!isPhoneBound) {
      if (onRequestBind) onRequestBind();
      return false;
    }
    return true;
  };

  // 🌟 核心调度引擎
  const dispatchTask = async (taskConfig) => {
    if (!guardDispatch()) return;
    const { input, generateType, modelId, modelName, finalPrompt, modelParams = {}, attachments = {} } = taskConfig;
    const aiMsgId = Date.now() + 1;
    
    setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', model: modelName, type: generateType, content: '📡 任务已下发至全局调度中心，算力分配中...' }]);

    if (generateType === 'text') {
      await handleTextStream(aiMsgId, modelId, input);
    } else {
      setPendingTasks(prev => [...prev, aiMsgId]);
      await handleMediaTask(aiMsgId, generateType, modelId, input, finalPrompt, modelParams, attachments);
      setPendingTasks(prev => prev.filter(id => id !== aiMsgId));
    }
  };

  // 🌟 纯文本流式处理逻辑
  const handleTextStream = async (msgId, modelId, input) => {
    const controller = new AbortController();
    abortControllers.current[msgId] = controller;

    try {
      const response = await fetch(cfApiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: input }], stream: true }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`网关异常: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices[0].delta.content || data.choices[0].delta.reasoning_content;
              if (delta) {
                accumulatedContent += delta;
                setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, content: accumulatedContent } : msg));
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, content: `⛔ **文本输出已中断**\n\n> 您已手动打断此任务。` } : msg));
      } else {
        setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, content: `⚠️ **系统报错**\n\n\`\`\`\n${error.message}\n\`\`\`` } : msg));
      }
    } finally {
      delete abortControllers.current[msgId];
    }
  };

  // =====================================================================
  // 🌟 全模态核心拼装枢纽 (精准绑定协议，清洗历史数据污染)
  // =====================================================================
  const handleMediaTask = async (msgId, type, modelId, originalInput, finalPrompt, modelParams, attachments) => {
    try {
      let finalPayload = {};
      let apiInput = { ...modelParams, ...attachments };
      const hasUploadedFiles = Object.keys(attachments).length > 0;

      // 🎵 情况 A：音乐与音频赛道
      if (type === 'music') {
        if (modelId.toLowerCase().includes('suno')) {
          finalPayload = {
            model: "suno", task_type: "music",
            input: { ...apiInput, prompt: finalPrompt, mv: "chirp-v3-5" }
          };
        } else if (modelId.includes('tts')) {
          finalPayload = { model: modelId, task_type: "zero-shot", input: { ...apiInput, gen_text: finalPrompt } };
        } else {
          finalPayload = { model: modelId, task_type: "generate_music", input: { ...apiInput, gpt_description_prompt: finalPrompt } };
        }
      } 
      
      // 🎬 情况 B：动态视频赛道
      else if (type === 'video') {
        let vTaskType = hasUploadedFiles ? 'img2video' : 'txt2video';
        if (modelId.includes('kling')) vTaskType = 'video_generation';
        if (modelId.includes('sora')) vTaskType = 'sora2-video';
        if (modelId.includes('omni-human')) vTaskType = 'omni-human-1.5';

        finalPayload = {
          model: modelId,
          task_type: vTaskType,
          input: { ...apiInput, prompt: finalPrompt }
        };

        if (modelId.includes('kling') && finalPayload.input.duration) {
          finalPayload.input.duration = parseInt(finalPayload.input.duration, 10);
        }
      } 

      // 📦 情况 C：3D 模型赛道
      else if (type === '3d') {
        finalPayload = { model: modelId, task_type: "image-to-3d", input: apiInput };
      }

      // =================================================================
      // 🛠️ 情况 D：后期模板赛道 (🌟 核心：清洗由于跨模型切换带来的交叉污染参数)
      // =================================================================
      else if (type === 'templates') {
        let tTaskType = 'face-swap';
        let cleanedInput = {};

        if (modelId.includes('face-swap')) {
          tTaskType = 'face-swap';
          // 换脸接口极度挑剔，洗干净多余的旧数据残留
          if (attachments.target_image) cleanedInput.target_image = attachments.target_image;
          if (attachments.swap_image) cleanedInput.swap_image = attachments.swap_image;
        } 
        else if (modelId.includes('upscale')) {
          tTaskType = 'Image Upscaling';
          cleanedInput = { image: attachments.image, scale: modelParams.scale || '2' };
        } 
        else if (modelId.includes('bg')) {
          tTaskType = 'Image Background Removal';
          cleanedInput = { image: attachments.image };
        } 
        else if (modelId.includes('video-toolkit')) {
          tTaskType = 'Video Upscaling';
          cleanedInput = { video: attachments.video, invert_output: Boolean(modelParams.invert_output) };
        } 
        else if (modelId.includes('kling-effects')) {
          tTaskType = 'kling-effects'; // 👈 强力校正官方接口类型！
          cleanedInput = { image: attachments.image, effect_type: modelParams.effect_type || 'expansion' };
        } 
        else if (modelId.includes('kling-tryon')) {
          tTaskType = 'kling-tryon'; // 👈 强力校正官方接口类型！
          if (attachments.model_input) cleanedInput.model_input = attachments.model_input;
          if (attachments.dress_input) cleanedInput.dress_input = attachments.dress_input;
        } 
        else if (modelId.includes('hug-video')) {
          tTaskType = 'hug-video';
          cleanedInput = { image: attachments.image };
        }

        finalPayload = {
          model: modelId,
          task_type: tTaskType,
          input: cleanedInput
        };
      }

      // 🖼️ 情况 E：极清绘图赛道
      else {
        let iTaskType = hasUploadedFiles ? 'img2img' : 'txt2img';
        let w = 1024, h = 1024;
        const ratio = modelParams.aspect_ratio || '1:1';
        if (ratio === '16:9') { w = 1280; h = 720; }
        else if (ratio === '9:16') { w = 720; h = 1280; }
        else if (ratio === '21:9') { w = 1536; h = 640; }
        apiInput.width = w;
        apiInput.height = h;

        finalPayload = {
          model: modelId,
          task_type: iTaskType,
          input: { ...apiInput, prompt: finalPrompt }
        };
      }

      console.log("【System Log】任务载荷已准备就绪:", JSON.stringify(finalPayload, null, 2));

      const submitRes = await fetch(cfApiUrl('/piapi/api/v1/task'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(finalPayload)
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || submitData.code !== 200) {
        throw new Error(submitData.message || "网关拦截并拒绝了此 Payload 请求");
      }

      const taskId = submitData.data?.task_id;
      setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, content: `⏳ 渲染任务已排队 (ID: ${taskId.slice(0,8)}...)` } : msg));

      let isFinished = false;
      let finalUrl = "";
      let pollCount = 0;

      while (!isFinished && pollCount < 150) { 
        await new Promise(r => setTimeout(r, 4000));
        pollCount++;
        const fetchRes = await fetch(cfApiUrl(`/piapi/api/v1/task/${taskId}`), {
          method: 'GET',
          headers: authHeaders()
        });
        const fetchData = await fetchRes.json();
        const status = fetchData.data?.status;
        
        if (status === 'finished' || status === 'success' || status === 'completed') {
          isFinished = true;
          finalUrl = fetchData.data?.output?.image_url || fetchData.data?.image_url || 
                     fetchData.data?.output?.video_url || fetchData.data?.video_url || 
                     fetchData.data?.output?.audio_url || fetchData.data?.audio_url || 
                     fetchData.data?.output?.model_url || fetchData.data?.model_url || 
                     fetchData.data?.output?.url;
        } else if (status === 'failed') {
          throw new Error(`【API 内部报错】:\n${JSON.stringify(fetchData, null, 2)}`);
        } else {
          setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, content: `🔥 后台集群渲染中... 进度: **${fetchData.data?.progress || "排队中"}**` } : msg));
        }
      }
      
      if (!isFinished) throw new Error("任务轮询超时");
      
      setMessages(prev => prev.map(msg => msg.id === msgId ? { 
        ...msg, 
        content: `🎉 **渲染生成成功！**\n\n> 初始工程：*${originalInput}*\n> 翻译转译：*${finalPrompt}*`, 
        mediaUrl: finalUrl 
      } : msg));

    } catch (error) {
      setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, content: `⚠️ **系统报错**\n\n\`\`\`\n${error.message}\n\`\`\`` } : msg));
    }
  };

  const interruptLatestText = () => {
    const textMsgIds = Object.keys(abortControllers.current);
    if (textMsgIds.length > 0) {
      const latestId = textMsgIds[textMsgIds.length - 1];
      abortControllers.current[latestId].abort();
    }
  };

  const clearCache = async () => {
    await localforage.clear();
    setMessages([]);
  };

  return (
    <AiTaskContext.Provider value={{ 
      messages, setMessages, dispatchTask, guardDispatch, interruptLatestText, clearCache, pendingTasks
    }}>
      {children}
    </AiTaskContext.Provider>
  );
};