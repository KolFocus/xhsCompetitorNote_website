// ==UserScript==
// @name         小红书笔记详情自动保存
// @namespace    http://tampermonkey.net/
// @version      2024-11-26
// @description  在小红书笔记详情页自动抓取并保存笔记数据到 Supabase
// @author       You
// @match        https://www.xiaohongshu.com/explore/*
// @match        https://xhslink.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xiaohongshu.com
// @grant        GM_xmlhttpRequest
// @connect      plvjtbzwbxmajnkanhbe.supabase.co
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Supabase 配置（使用与千瓜脚本相同的配置）
    const SUPABASE_URL = 'https://plvjtbzwbxmajnkanhbe.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdmp0Ynp3YnhtYWpua2FuaGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODE4NjUsImV4cCI6MjA3NTk1Nzg2NX0.oQVOyp-dGdUqctn6dfvhWnFp2TUDOwY_y0M5_vl9e7U';
    const TABLE_NAME = 'qiangua_note_info';

    // 调试开关
    window.XHS_DEBUG = window.XHS_DEBUG === undefined ? false : window.XHS_DEBUG;
    function debugLog(...args) {
        if (window.XHS_DEBUG) {
            console.log('[XHS保存]', ...args);
        }
    }

    // 显示 Toast 提示
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3';
        
        toast.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            padding: 16px 24px;
            background-color: ${bgColor};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            word-wrap: break-word;
            animation: slideUp 0.3s ease-out;
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);

        // 添加从底部滑入动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from { transform: translate(-50%, 100px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // 3秒后自动移除
        setTimeout(() => {
            toast.style.transition = 'all 0.3s ease-out';
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 100px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 从 URL 中提取小红书笔记 ID
    function extractNoteIdFromUrl() {
        const url = window.location.href;
        // 匹配 /explore/xxxxx 格式
        const match = url.match(/\/explore\/([a-f0-9]+)/i);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }

    // 从页面中提取笔记数据
    function extractNoteDataFromPage() {
        debugLog('开始从页面提取数据...');
        
        // 方式1：尝试从 window.__INITIAL_STATE__ 获取
        if (window.__INITIAL_STATE__) {
            debugLog('找到 __INITIAL_STATE__');
            const state = window.__INITIAL_STATE__;
            
            if (!state.note) {
                debugLog('错误：__INITIAL_STATE__.note 不存在');
                console.error('[XHS保存] __INITIAL_STATE__ 结构:', Object.keys(state));
                return null;
            }
            
            if (!state.note.noteDetailMap) {
                debugLog('错误：__INITIAL_STATE__.note.noteDetailMap 不存在');
                console.error('[XHS保存] state.note 结构:', Object.keys(state.note));
                return null;
            }
            
            const noteId = extractNoteIdFromUrl();
            debugLog('查找笔记 ID:', noteId);
            debugLog('noteDetailMap 中的 keys:', Object.keys(state.note.noteDetailMap));
            
            const noteData = state.note.noteDetailMap[noteId];
            if (!noteData) {
                debugLog('错误：找不到对应的笔记数据');
                return null;
            }
            
            if (!noteData.note) {
                debugLog('错误：noteData.note 不存在');
                console.error('[XHS保存] noteData 结构:', Object.keys(noteData));
                return null;
            }
            
            debugLog('成功从 noteDetailMap 提取到数据');
            debugLog('note 数据结构:', Object.keys(noteData.note));
            return parseNoteData(noteData.note);
        }

        // 方式2：从 HTML 源码的 script 标签中提取完整 JSON
        debugLog('方式1失败，尝试方式2：从 HTML script 标签解析');
        const scripts = document.querySelectorAll('script');
        debugLog('找到 script 标签数量:', scripts.length);
        
        for (let i = 0; i < scripts.length; i++) {
            const script = scripts[i];
            const content = script.textContent || script.innerHTML;
            
            if (content.includes('window.__INITIAL_STATE__')) {
                debugLog(`在第 ${i} 个 script 标签中找到 __INITIAL_STATE__`);
                
                try {
                    // 找到 = 后面的 JSON 对象
                    const startIndex = content.indexOf('window.__INITIAL_STATE__');
                    const equalSignIndex = content.indexOf('=', startIndex);
                    let jsonStart = content.indexOf('{', equalSignIndex);
                    
                    if (jsonStart === -1) {
                        debugLog('未找到 JSON 开始标记');
                        continue;
                    }
                    
                    // 使用括号匹配找到完整的 JSON（处理嵌套）
                    let braceCount = 0;
                    let jsonEnd = -1;
                    
                    for (let j = jsonStart; j < content.length; j++) {
                        const char = content[j];
                        if (char === '{') {
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                jsonEnd = j + 1;
                                break;
                            }
                        }
                    }
                    
                    if (jsonEnd === -1) {
                        debugLog('未找到 JSON 结束标记');
                        continue;
                    }
                    
                    const jsonStr = content.substring(jsonStart, jsonEnd);
                    debugLog('提取到 JSON 字符串长度:', jsonStr.length);
                    
                    // JavaScript 对象字符串转换为对象
                    // 因为可能包含 undefined 等非 JSON 标准值，所以不能用 JSON.parse
                    // 使用 Function 构造函数来安全地执行（比 eval 更安全）
                    let state;
                    try {
                        state = (new Function('return ' + jsonStr))();
                        debugLog('成功解析 __INITIAL_STATE__');
                    } catch (e) {
                        debugLog('Function 方式解析失败，尝试清理后再解析');
                        // 清理 undefined、null 等，然后再尝试 JSON.parse
                        const cleanedJson = jsonStr
                            .replace(/:\s*undefined\s*(,|})/g, ':null$1')  // undefined -> null
                            .replace(/,\s*}/g, '}')  // 移除尾随逗号
                            .replace(/,\s*]/g, ']'); // 移除数组尾随逗号
                        state = JSON.parse(cleanedJson);
                        debugLog('清理后成功解析');
                    }
                    
                    // 检查数据结构
                    if (state.note && state.note.noteDetailMap) {
                        const noteId = extractNoteIdFromUrl();
                        const noteData = state.note.noteDetailMap[noteId];
                        if (noteData && noteData.note) {
                            debugLog('从 HTML 源码成功提取到笔记数据');
                            return parseNoteData(noteData.note);
                        }
                    }
                    
                } catch (e) {
                    console.error('[XHS保存] 解析 script 标签失败:', e);
                    debugLog('解析失败:', e.message);
                    continue;
                }
            }
        }

        debugLog('所有方式都失败，未能从页面提取到数据');
        return null;
    }

    // 解析笔记数据
    function parseNoteData(noteData) {
        debugLog('解析笔记数据...');
        debugLog('笔记类型:', noteData.type);
        debugLog('标题:', noteData.title);

        // 转换图片 URL 格式
        // 从 http://sns-webpic-qc.xhscdn.com/.../1040g00831o4mmhgg5m00400vldghvll8i1g39mg!nd_dft_wlteh_webp_3
        // 转换为 http://ci.xiaohongshu.com/1040g00831o4mmhgg5m00400vldghvll8i1g39mg?imageView2/2/w/1080/format/jpg
        function convertImageUrl(url) {
            if (!url) return '';
            
            // 提取图片 ID（从最后一个 / 到 ! 之间的部分）
            const match = url.match(/\/([^\/]+?)(?:!|$)/);
            if (match && match[1]) {
                const imageId = match[1];
                return `http://ci.xiaohongshu.com/${imageId}?imageView2/2/w/1080/format/jpg`;
            }
            
            // 如果无法匹配，返回原 URL
            return url;
        }

        // 提取图片 URL
        let imageUrls = [];
        if (noteData.imageList && Array.isArray(noteData.imageList)) {
            debugLog('找到 imageList，长度:', noteData.imageList.length);
            imageUrls = noteData.imageList.map(img => {
                if (typeof img === 'string') {
                    return convertImageUrl(img);
                }
                // 优先使用 urlDefault，然后是 infoList 中的 URL
                const url = img.urlDefault || img.url || (img.infoList && img.infoList[0]?.url) || '';
                return convertImageUrl(url);
            }).filter(Boolean);
            debugLog('提取并转换图片 URLs:', imageUrls.length, '个');
            if (imageUrls.length > 0) {
                debugLog('示例图片 URL:', imageUrls[0]);
            }
        } else if (noteData.images && Array.isArray(noteData.images)) {
            debugLog('找到 images 字段');
            imageUrls = noteData.images.map(img => {
                if (typeof img === 'string') {
                    return convertImageUrl(img);
                }
                const url = img.url || img.original || img.originUrl || '';
                return convertImageUrl(url);
            }).filter(Boolean);
        } else {
            debugLog('未找到图片数据');
        }

        // 提取视频 URL（优先从 backupUrls 获取第一条）
        let videoUrl = null;
        if (noteData.video) {
            debugLog('找到 video 数据');
            
            // 优先从 backupUrls 获取第一条
            if (noteData.video.media?.stream?.h264?.[0]?.backupUrls && 
                Array.isArray(noteData.video.media.stream.h264[0].backupUrls) &&
                noteData.video.media.stream.h264[0].backupUrls.length > 0) {
                videoUrl = noteData.video.media.stream.h264[0].backupUrls[0];
                debugLog('从 backupUrls 提取到视频 URL:', videoUrl);
            }
            // 备用：其他可能的视频 URL 位置
            else if (noteData.video.consumer && noteData.video.consumer.originVideoKey) {
                videoUrl = noteData.video.consumer.originVideoKey;
                debugLog('从 originVideoKey 提取到视频 URL:', videoUrl);
            } else if (noteData.video.media?.stream?.h264?.[0]?.masterUrl) {
                videoUrl = noteData.video.media.stream.h264[0].masterUrl;
                debugLog('从 masterUrl 提取到视频 URL:', videoUrl);
            } else if (typeof noteData.video === 'string') {
                videoUrl = noteData.video;
            } else if (noteData.video.url) {
                videoUrl = noteData.video.url;
            }
        }

        const xhsNoteId = extractNoteIdFromUrl();
        const noteLink = window.location.href.split('?')[0];

        // 提取用户 ID
        const userId = noteData.user?.userId || noteData.userId || null;
        debugLog('用户 ID:', userId);

        const payload = {
            XhsNoteId: xhsNoteId,
            XhsNoteLink: noteLink,
            XhsTitle: noteData.title || '',
            XhsContent: noteData.desc || noteData.content || '',
            XhsImages: imageUrls.length > 0 ? imageUrls.join(',') : null,
            XhsVideo: videoUrl,
            XhsUserId: userId,
            XhsNoteJson: noteData
        };

        debugLog('解析后的 payload:', {
            XhsNoteId: payload.XhsNoteId,
            XhsTitle: payload.XhsTitle,
            XhsContentLength: payload.XhsContent?.length || 0,
            XhsImagesCount: imageUrls.length,
            XhsVideo: payload.XhsVideo ? '有' : '无',
            XhsUserId: payload.XhsUserId
        });
        
        return payload;
    }

    // 带重试的请求函数
    async function fetchWithRetry(url, options, retry = 2, timeoutMs = 30000) {
        let lastErr = null;
        for (let attempt = 0; attempt <= retry; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(timer);
                
                if (response.ok) {
                    return response;
                }
                
                if (response.status >= 500 || response.status === 429) {
                    lastErr = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    continue;
                } else {
                    const errorText = await response.text();
                    throw new Error(errorText || `HTTP ${response.status}`);
                }
            } catch (e) {
                clearTimeout(timer);
                lastErr = e;
                if (attempt < retry) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
        }
        throw lastErr || new Error('请求失败');
    }

    // 保存笔记数据到 Supabase
    async function saveNoteToSupabase(noteData) {
        debugLog('开始保存到 Supabase...');
        
        if (!noteData.XhsNoteId) {
            throw new Error('缺少 XhsNoteId，无法保存');
        }

        // 先查询当前记录的 AiStatus
        const selectUrl = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?XhsNoteId=eq.${encodeURIComponent(noteData.XhsNoteId)}&select=AiStatus`;
        
        try {
            const selectResponse = await fetchWithRetry(selectUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }, 2, 30000);

            if (selectResponse.ok) {
                const records = await selectResponse.json();
                if (records && records.length > 0) {
                    const currentStatus = records[0].AiStatus;
                    debugLog('当前 AiStatus:', currentStatus);
                    
                    // 如果当前状态是"分析失败"，重置为"待分析"
                    if (currentStatus === '分析失败') {
                        noteData.AiStatus = '待分析';
                        debugLog('检测到"分析失败"状态，重置为"待分析"');
                    }
                }
            }
        } catch (e) {
            // 查询失败不影响保存流程，继续执行
            debugLog('查询 AiStatus 失败:', e.message);
        }

        // 构建查询 URL（通过 XhsNoteId 查找并更新）
        const queryUrl = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?XhsNoteId=eq.${encodeURIComponent(noteData.XhsNoteId)}`;
        
        // 清理 payload（移除 undefined 值）
        const cleanedPayload = {};
        Object.keys(noteData).forEach(key => {
            if (noteData[key] !== undefined) {
                cleanedPayload[key] = noteData[key];
            }
        });

        debugLog('清理后的 payload:', cleanedPayload);

        // 使用 PATCH 方法更新（如果记录存在）
        const response = await fetchWithRetry(queryUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(cleanedPayload)
        }, 2, 30000);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`保存失败: ${errorText}`);
        }

        debugLog('保存成功');
        return { success: true };
    }

    // 主执行函数
    async function main() {
        try {
            debugLog('开始执行...');
            
            const noteId = extractNoteIdFromUrl();
            if (!noteId) {
                debugLog('未能从 URL 提取笔记 ID');
                return;
            }

            debugLog('笔记 ID:', noteId);
            showToast('正在获取笔记数据...', 'info');

            // 从页面 HTML 源码提取数据
            const noteData = extractNoteDataFromPage();
            if (!noteData) {
                console.error('[XHS保存] 提取数据失败');
                console.error('[XHS保存] 请在控制台执行 window.XHS_checkData() 查看详情');
                showToast('未能获取笔记数据，请查看控制台', 'error');
                return;
            }

            debugLog('提取到笔记数据:', noteData);
            showToast('正在保存到数据库...', 'info');

            // 保存到数据库
            await saveNoteToSupabase(noteData);
            
            showToast('✓ 笔记数据已成功保存', 'success');
            debugLog('执行完成');

        } catch (error) {
            console.error('[XHS保存] 执行失败:', error);
            showToast(`保存失败: ${error.message}`, 'error');
        }
    }

    // 等待 DOM 加载完成后执行（确保 script 标签都已加载）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(main, 1000); // 延迟 1 秒确保所有 script 标签都加载完成
        });
    } else {
        setTimeout(main, 1000);
    }

    // 暴露调试函数到全局
    window.XHS_extractNoteData = extractNoteDataFromPage;
    window.XHS_saveNote = main;
    window.XHS_checkData = function() {
        console.log('=== XHS 数据检查 ===');
        console.log('1. 笔记 ID:', extractNoteIdFromUrl());
        
        // 检查 script 标签
        const scripts = document.querySelectorAll('script');
        console.log('2. 页面 script 标签数量:', scripts.length);
        
        let foundState = false;
        for (let i = 0; i < scripts.length; i++) {
            const content = scripts[i].textContent || scripts[i].innerHTML;
            if (content.includes('window.__INITIAL_STATE__')) {
                console.log(`3. 在第 ${i} 个 script 中找到 __INITIAL_STATE__`);
                console.log('4. script 内容长度:', content.length);
                foundState = true;
                break;
            }
        }
        
        if (!foundState) {
            console.log('3. ❌ 未在任何 script 标签中找到 __INITIAL_STATE__');
        }
        
        console.log('5. window.__INITIAL_STATE__ 存在?', !!window.__INITIAL_STATE__);
        
        console.log('=== 尝试提取数据 ===');
        window.XHS_DEBUG = true; // 开启详细日志
        const extracted = extractNoteDataFromPage();
        console.log('提取结果:', extracted);
        return extracted;
    };

    debugLog('脚本已加载');
    console.log('[XHS保存] 脚本已加载，调试命令：window.XHS_checkData()');
    console.log('[XHS保存] 开启调试模式：window.XHS_DEBUG = true');
    console.log('[XHS保存] 手动执行保存：window.XHS_saveNote()');

})();

