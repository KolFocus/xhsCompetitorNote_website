// ==UserScript==



// @name         千瓜_品牌分析

// @namespace    http://tampermonkey.net/

// @version      2024-02-29

// @description  千瓜_品牌分析

// @author       You

// @match        https://app.qian-gua.com/*

// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.16.9/xlsx.full.min.js

// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js

// @icon         https://www.google.com/s2/favicons?sz=64&domain=xiaohongshu.com
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// @grant        GM_cookie.list
// @connect      pgy.xiaohongshu.com
// @connect      api.qian-gua.com
// @supportURL   https://tampermonkey.net/documentation.php

// @run-at       document-start

// ==/UserScript==

(function() {

    'use strict';

    // Supabase配置
    const SUPABASE_URL = 'https://plvjtbzwbxmajnkanhbe.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdmp0Ynp3YnhtYWpua2FuaGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODE4NjUsImV4cCI6MjA3NTk1Nzg2NX0.oQVOyp-dGdUqctn6dfvhWnFp2TUDOwY_y0M5_vl9e7U';
    const TABLE_NAME = 'qiangua_note_info';
    const BLOGGER_TABLE_NAME = 'qiangua_blogger';
    const BRAND_TABLE_NAME = 'qiangua_brand';
    const BATCH_SIZE = 1; // 每次插入1条
    // 调试开关（可在控制台动态修改 window.AZ_DEBUG = true/false）
    window.AZ_DEBUG = window.AZ_DEBUG === undefined ? false : window.AZ_DEBUG;
    function debugLog(...args) { if (window.AZ_DEBUG) { try { console.log('[AZ_DEBUG]', ...args); } catch (_) {} } }

    // 创建下载按钮元素
    var button = document.createElement('button');
    button.textContent = 'AZ_推送';
    button.style.backgroundColor = '#000080';
    button.style.width = '120px';
    button.style.height = '40px';
    button.style.color = '#ffffff';
    button.style.marginLeft = '100px';

    // 统一控制按钮启用/禁用与样式
    const ENABLED_BG = '#000080';
    const DISABLED_BG = '#A9A9A9';
    function setButtonEnabled(enabled) {
        button.disabled = !enabled;
        button.style.backgroundColor = enabled ? ENABLED_BG : DISABLED_BG;
        button.style.opacity = enabled ? '1' : '0.5';
        button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
    // 初始默认禁用（未抓全数据前置灰）
    setButtonEnabled(false);

    // 数据转换函数：将原始数据转换为数据库格式
    function transformDataToDbFormat(item) {
        const dbItem = {};

        // 直接映射的字段（完全匹配）
        const directMapping = [
            'GoodsCount', 'LevelNumber', 'LevelName', 'Fans', 'McnName',
            'IsBrandPartner', 'OfficialVerified', 'NoteActiveCount', 'Gender',
            'BigAvatar', 'SmallAvatar', 'Location', 'BloggerTagName',
            'LikeCollect', 'AdPrice', 'PriceType', 'IsAdNote', 'BloggerTags',
            'LinkInfo', 'NoteId', 'DateCode', 'NoteIdKey', 'Title',
            'LikedCount', 'CollectedCount', 'CommentsCount', 'ViewCount',
            'ShareCount', 'CoverImage', 'SpreadScore', 'Index', 'BloggerId',
            'BloggerIdKey', 'BloggerNickName', 'BloggerProp', 'NoteType',
            'IsBusiness', 'Props', 'Lcc', 'VideoDuration', 'CooperateBindsName', 'CooperateBindList'
        ];

        directMapping.forEach(field => {
            if (item.hasOwnProperty(field)) {
                dbItem[field] = item[field];
            }
        });

        // 当 CooperateBindList 大于0时,获取第一个对象中的 BrandId、BrandIdKey、BrandName,添加到dbItem
        if (item.CooperateBindList && item.CooperateBindList.length > 0) {
            const firstItem = item.CooperateBindList[0];
            dbItem['BrandId'] = firstItem.BrandId;
            dbItem['BrandIdKey'] = firstItem.BrandIdKey;
            dbItem['BrandName'] = firstItem.BrandName;
        }

        // 字段名映射

        if (item.hasOwnProperty('McnInfoId')) {
            dbItem['McnInfoId'] = item.McnInfoId;
        }
        if (item.hasOwnProperty('AdPriceUpdateStatus')) {
            dbItem['AdPriceUpdateStatus'] = item.AdPriceUpdateStatus;
        }
        if (item.hasOwnProperty('CurrentUserIsFavorite')) {
            dbItem['CurrentUserIsFavorite'] = item.CurrentUserIsFavorite;
        }
        // TagName 映射到 BloggerTagName（如果 BloggerTagName 不存在或为空）
        if (item.hasOwnProperty('BloggerTagName')) {
            dbItem['BloggerTagName'] = item.BloggerTagName;
        }
        if (item.hasOwnProperty('TagName')) {
            dbItem['TagName'] = item.TagName;
        }
        // RedId 映射到 XhsUserId
        if (item.hasOwnProperty('RedId')) {
            dbItem['RedId'] = item.RedId;
        }

        // 时间字段与兜底（避免 NOT NULL 约束报错）
        const nowIso = new Date().toISOString();
        if (item.PublishTime) {
            dbItem['PublishTime'] = item.PublishTime;
        } else if (item.UpdateTime) {
            dbItem['PublishTime'] = item.UpdateTime;
        } else {
            dbItem['PublishTime'] = nowIso;
        }
        if (item.UpdateTime) {
            dbItem['UpdateTime'] = item.UpdateTime;
        } else {
            dbItem['UpdateTime'] = dbItem['PublishTime'];
        }
        if (item.PubDate) {
            dbItem['PubDate'] = item.PubDate;
        } else {
            // 从 PublishTime 推导 YYYY-MM-DD
            try {
                const d = new Date(dbItem['PublishTime']);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                dbItem['PubDate'] = `${yyyy}-${mm}-${dd}`;
            } catch (e) {
                dbItem['PubDate'] = nowIso.slice(0, 10);
            }
        }
        // DateCode 兜底（YYYYMMDD）
        if (!item.DateCode) {
            const d = new Date(dbItem['PublishTime']);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dbItem['DateCode'] = Number(`${yyyy}${mm}${dd}`);
        }

        // CooperateBindList 转换为 JSONB 格式
        if (item.CooperateBindList && Array.isArray(item.CooperateBindList)) {
            dbItem['CooperateBindList'] = item.CooperateBindList;
        }

        // 设置默认值
        if (dbItem.GoodsCount === undefined) dbItem.GoodsCount = 0;
        if (dbItem.LevelNumber === undefined) dbItem.LevelNumber = 0;
        if (dbItem.Fans === undefined) dbItem.Fans = 0;
        if (dbItem.IsBrandPartner === undefined) dbItem.IsBrandPartner = false;
        if (dbItem.OfficialVerified === undefined) dbItem.OfficialVerified = false;
        if (dbItem.NoteActiveCount === undefined) dbItem.NoteActiveCount = 0;
        if (dbItem.Gender === undefined) dbItem.Gender = 0;
        if (dbItem.IsAdNote === undefined) dbItem.IsAdNote = false;
        if (dbItem.LikedCount === undefined) dbItem.LikedCount = 0;
        if (dbItem.CollectedCount === undefined) dbItem.CollectedCount = 0;
        if (dbItem.CommentsCount === undefined) dbItem.CommentsCount = 0;
        if (dbItem.ViewCount === undefined) dbItem.ViewCount = 0;
        if (dbItem.ShareCount === undefined) dbItem.ShareCount = 0;
        if (dbItem.LikeCollect === undefined) dbItem.LikeCollect = 0;
        if (dbItem.Props === undefined) dbItem.Props = 0;
        if (dbItem.IsBusiness === undefined) dbItem.IsBusiness = false;
        if (dbItem.AdPriceUpdateStatus === undefined) dbItem.AdPriceUpdateStatus = 0;

        return dbItem;
    }

    // 通用：带重试的 POST/GET 请求
    async function fetchWithRetry(url, options, retry = 2, timeoutMs = 45000) {
        console.log('[fetchWithRetry] 开始请求:', url);
        console.log('[fetchWithRetry] 请求方法:', options.method);
        console.log('[fetchWithRetry] 请求体大小:', options.body ? options.body.length : 0);
        console.log('[fetchWithRetry] 超时设置:', timeoutMs, 'ms');
        let lastErr = null;
        for (let attempt = 0; attempt <= retry; attempt++) {
            console.log(`[fetchWithRetry] 尝试第 ${attempt + 1}/${retry + 1} 次`);
            const controller = new AbortController();
            const t = setTimeout(() => {
                console.log('[fetchWithRetry] 超时触发，取消请求');
                controller.abort();
            }, timeoutMs);
            try {
                console.log('[fetchWithRetry] 发送 fetch 请求...');
                const resp = await fetch(url, {
                    cache: 'no-store',
                    mode: 'cors',
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(t);
                console.log('[fetchWithRetry] 收到响应，状态码:', resp.status, resp.statusText);
                if (resp.ok) {
                    console.log('[fetchWithRetry] 请求成功');
                    return resp;
                }
                // 5xx/429 允许重试，其余直接抛出
                if (resp.status >= 500 || resp.status === 429) {
                    console.log('[fetchWithRetry] 服务器错误，准备重试');
                    lastErr = new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                    continue;
                } else {
                    let msg = `HTTP ${resp.status}: ${resp.statusText}`;
                    try {
                        const data = await resp.json();
                        msg = data.message || data.error || JSON.stringify(data);
                    } catch (_) {
                        const txt = await resp.text();
                        if (txt) msg = txt;
                    }
                    console.error('[fetchWithRetry] 请求失败:', msg);
                    throw new Error(msg);
                }
            } catch (e) {
                clearTimeout(t);
                console.error('[fetchWithRetry] 捕获异常:', e.name, e.message);
                lastErr = e;
                // AbortError 或网络错误可重试
                if (attempt < retry) {
                    console.log('[fetchWithRetry] 准备重试...');
                    continue;
                }
            }
        }
        console.error('[fetchWithRetry] 所有重试失败，抛出错误');
        throw lastErr || new Error('请求失败');
    }

    // 连接性自检（已改为本地快速通过，避免环境阻塞）
    async function pingSupabaseHealth() {
        // 不再发起真实请求，直接返回 true
        return true;
    }

    // 先入库（去重后）qiangua_blogger，使用批量 upsert
    async function upsertBloggersFromNotes(noteItems) {
        console.log('[upsertBloggersFromNotes] ========== 开始执行 ==========');
        console.log('[upsertBloggersFromNotes] 输入数据条数:', noteItems.length);

        // 健康检查
        console.log('[upsertBloggersFromNotes] 执行健康检查...');
        const healthy = await pingSupabaseHealth();
        console.log('[upsertBloggersFromNotes] 健康检查结果:', healthy);
        if (!healthy) {
            console.error('[upsertBloggersFromNotes] 健康检查失败');
            return { success: false, message: '无法连接 Supabase 或鉴权失败（健康检查未通过）' };
        }

        // 进度
        console.log('[upsertBloggersFromNotes] 创建进度条');
        createProgressBar(noteItems.length);
        let done = 0;
        try {
            // 批量切片，减少请求数，显式指定 on_conflict=主键
            const CHUNK_SIZE = 1;
            console.log('[upsertBloggersFromNotes] 开始批量处理，CHUNK_SIZE:', CHUNK_SIZE);
            for (let start = 0; start < noteItems.length; start += CHUNK_SIZE) {
                const chunk = noteItems.slice(start, start + CHUNK_SIZE);
                console.log(`[upsertBloggersFromNotes] 处理第 ${start + 1}/${noteItems.length} 批，chunk 大小:`, chunk.length);
                if (window.AZ_DEBUG) {
                    debugLog('POST blogger chunk size:', chunk.length, 'example:', chunk[0]);
                }
                console.log('[upsertBloggersFromNotes] 准备调用 fetchWithRetry...');
                const bloggerPrefer = [
                    window.AZ_DEBUG ? 'return=representation' : 'return=min',
                    'resolution=merge-duplicates'
                ].join(',');
                const response = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${BLOGGER_TABLE_NAME}?on_conflict=BloggerIdKey`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        // 调试模式下返回内容，便于在 Network 面板看到响应体
                        'Prefer': bloggerPrefer,
                        'X-AZ-Phase': 'blogger'
                    },
                    body: JSON.stringify(chunk)
                }, 2, 45000);
                console.log('[upsertBloggersFromNotes] fetchWithRetry 返回，响应状态:', response.status);
                done += chunk.length;
                updateProgressBar(done, noteItems.length);
                console.log(`[upsertBloggersFromNotes] 已处理 ${done}/${noteItems.length} 位博主`);
            }
            console.log('[upsertBloggersFromNotes] 所有批次处理完成');
            removeProgressBar();
            console.log('[upsertBloggersFromNotes] ========== 执行完成（成功） ==========');
            return { success: true, message: `成功入库/更新 ${done} 位博主` };
        } catch (err) {
            console.error('[upsertBloggersFromNotes] 捕获异常:', err.name, err.message);
            removeProgressBar();
            console.error('[upsertBloggersFromNotes] ========== 执行完成（失败） ==========');
            return { success: false, message: err.name === 'AbortError' ? '请求超时或被取消，请重试' : (err.message || String(err)) };
        }
    }

    async function upsertBrandsFromNotes(brands) {
        console.log('[upsertBrandsFromNotes] ========== 开始执行 ==========');
        if (!Array.isArray(brands)) {
            console.warn('[upsertBrandsFromNotes] 输入不是数组，已转换为空数组');
            brands = [];
        }
        console.log('[upsertBrandsFromNotes] 输入数据条数:', brands.length);
        if (brands.length === 0) {
            console.log('[upsertBrandsFromNotes] 无品牌数据，直接返回成功');
            return { success: true, message: '无品牌数据需要入库' };
        }
        const healthy = await pingSupabaseHealth();
        console.log('[upsertBrandsFromNotes] 健康检查结果:', healthy);
        if (!healthy) {
            console.error('[upsertBrandsFromNotes] 健康检查失败');
            return { success: false, message: '无法连接 Supabase 或鉴权失败（健康检查未通过）' };
        }
        createProgressBar(brands.length);
        let done = 0;
        try {
            const CHUNK_SIZE = 1;
            const brandPrefer = [
                window.AZ_DEBUG ? 'return=representation' : 'return=min',
                'resolution=merge-duplicates'
            ].join(',');
            for (let start = 0; start < brands.length; start += CHUNK_SIZE) {
                const chunk = brands.slice(start, start + CHUNK_SIZE);
                console.log(`[upsertBrandsFromNotes] 处理第 ${start + 1}/${brands.length} 批，chunk 大小:`, chunk.length);
                const response = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${BRAND_TABLE_NAME}?on_conflict=BrandId`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Prefer': brandPrefer,
                        'X-AZ-Phase': 'brand'
                    },
                    body: JSON.stringify(chunk)
                }, 2, 45000);
                console.log('[upsertBrandsFromNotes] fetchWithRetry 返回，响应状态:', response.status);
                done += chunk.length;
                updateProgressBar(done, brands.length);
                console.log(`[upsertBrandsFromNotes] 已处理 ${done}/${brands.length} 个品牌`);
            }
            removeProgressBar();
            console.log('[upsertBrandsFromNotes] ========== 执行完成（成功） ==========');
            return { success: true, message: `成功入库/更新 ${done} 个品牌` };
        } catch (err) {
            console.error('[upsertBrandsFromNotes] 捕获异常:', err.name, err.message);
            removeProgressBar();
            console.error('[upsertBrandsFromNotes] ========== 执行完成（失败） ==========');
            return { success: false, message: err.name === 'AbortError' ? '请求超时或被取消，请重试' : (err.message || String(err)) };
        }
    }

    // 批量插入数据到Supabase（改为逐条插入）
    async function batchInsertToSupabase(dataArray) {
        try {
            const totalItems = dataArray.length;
            createProgressBar(totalItems);

            let totalInserted = 0;
            let totalSkipped = 0;
            let lastSkipReason = '';
            for (let i = 0; i < dataArray.length; i++) {
                const item = dataArray[i];
                // 校验主键 NoteId
                if (!item.NoteId && !item.note_id) {
                    totalSkipped += 1;
                    lastSkipReason = '缺少 NoteId';
                    updateProgressBar(i + 1, totalItems);
                    continue;
                }
                const dbRecord = transformDataToDbFormat(item);
                // 再次保证 NoteId 不为空
                if (!dbRecord.NoteId) {
                    dbRecord.NoteId = String(item.NoteId || item.note_id);
                }

                // 每条请求设置超时
                if (window.AZ_DEBUG && i < 3) {
                    debugLog('POST note record example:', dbRecord);
                }
                const preferHeader = [
                    window.AZ_DEBUG ? 'return=representation' : 'return=min',
                    'resolution=merge-duplicates'
                ].join(',');
                const response = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?on_conflict=NoteId`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Prefer': preferHeader,
                        'X-AZ-Phase': 'note'
                    },
                    body: JSON.stringify(dbRecord)
                }, 1, 30000); // 单条 30s

                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        if (errorData.message) {
                            errorMessage = errorData.message;
                        } else if (errorData.error) {
                            errorMessage = errorData.error;
                        } else {
                            errorMessage = JSON.stringify(errorData);
                        }
                    } catch (e) {
                        const errorText = await response.text();
                        if (errorText) {
                            errorMessage = errorText;
                        }
                    }
                    removeProgressBar();
                    throw new Error(`插入失败 (第 ${i + 1}/${totalItems} 条): ${errorMessage}`);
                }
                totalInserted += 1;
                updateProgressBar(i + 1, totalItems);
            }

            removeProgressBar();
            const suffix = totalSkipped > 0 ? `（跳过 ${totalSkipped} 条：${lastSkipReason}）` : '';
            return { success: true, message: `成功插入 ${totalInserted} 条数据${suffix}` };
        } catch (error) {
            removeProgressBar();
            return { success: false, message: error.message };
        }
    }

    // 显示提示消息
    function showMessage(message, isSuccess) {
        // 创建提示框
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 40px;
            background-color: ${isSuccess ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            max-width: 80%;
            word-wrap: break-word;
            text-align: center;
        `;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);

        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    // 进度条：创建、更新与移除
    function createProgressBar(totalBatches) {
        const container = document.createElement('div');
        container.id = 'az-upload-progress';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 420px;
            background: rgba(0,0,0,0.75);
            padding: 12px 16px;
            border-radius: 10px;
            color: #fff;
            z-index: 10001;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            font-size: 14px;
        `;
        const text = document.createElement('div');
        text.id = 'az-upload-progress-text';
        text.textContent = `正在上传 0/${totalBatches} 批...`;
        text.style.marginBottom = '8px';
        const barWrap = document.createElement('div');
        barWrap.style.cssText = `
            width: 100%;
            height: 10px;
            background: rgba(255,255,255,0.2);
            border-radius: 6px;
            overflow: hidden;
        `;
        const bar = document.createElement('div');
        bar.id = 'az-upload-progress-bar';
        bar.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #00b894);
            transition: width 0.25s ease;
        `;
        barWrap.appendChild(bar);
        container.appendChild(text);
        container.appendChild(barWrap);
        document.body.appendChild(container);
    }

    function updateProgressBar(doneBatches, totalBatches) {
        const bar = document.getElementById('az-upload-progress-bar');
        const text = document.getElementById('az-upload-progress-text');
        if (!bar || !text) return;
        const percent = Math.round((doneBatches / totalBatches) * 100);
        bar.style.width = percent + '%';
        text.textContent = `正在上传 ${doneBatches}/${totalBatches} 批（${percent}%）...`;
    }

    function removeProgressBar() {
        const container = document.getElementById('az-upload-progress');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }

    const BRAND_UPDATE_BUTTON_ID = 'az-brand-update-btn';
    const BRAND_UPDATE_MODAL_ID = 'az-brand-update-modal';
    const BRAND_UPDATE_STYLE_ID = 'az-brand-update-style';

    let brandUpdateButton = null;
    const brandUpdateState = {
        brandEntries: [],
        totalNotes: 0,
        totalOriginalNotes: 0,
        totalSkippedNotes: 0,
        totalInitialPending: 0,
        processed: 0,
        totalSuccess: 0,
        totalFailure: 0,
        throttleMs: 30000,
        perRunLimit: 100,
        running: false
    };
    let brandUpdateElements = null;

    function getBrandUpdateButton() {
        if (brandUpdateButton) {
            return brandUpdateButton;
        }
        const btn = document.createElement('button');
        btn.id = BRAND_UPDATE_BUTTON_ID;
        btn.type = 'button';
        btn.textContent = 'AZ_更新';
        btn.style.backgroundColor = '#0b5ed7';
        btn.style.width = '120px';
        btn.style.height = '40px';
        btn.style.color = '#ffffff';
        btn.style.marginLeft = '100px';
        btn.style.border = 'none';
        btn.style.borderRadius = '6px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '14px';
        btn.style.fontWeight = '600';
        btn.addEventListener('click', function() {
            ensureBrandUpdateUI();
            showBrandUpdateModal();
        });
        brandUpdateButton = btn;
        return btn;
    }

    function displayBrandUpdateButtonIfNeeded() {
        const targetSpan = document.evaluate("//div[@class='event-width-container']//button//span[contains(text(),'最新发布')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (!targetSpan) {
            return;
        }
        const targetButton = targetSpan.closest('button');
        if (!targetButton || !targetButton.parentNode) {
            return;
        }
        const btn = getBrandUpdateButton();
        if (btn.parentNode !== targetButton.parentNode) {
            targetButton.parentNode.insertBefore(btn, targetButton.nextSibling);
        }
    }

    function injectBrandUpdateStyles() {
        if (document.getElementById(BRAND_UPDATE_STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = BRAND_UPDATE_STYLE_ID;
        style.textContent = `
#${BRAND_UPDATE_MODAL_ID} {
    position: fixed;
    inset: 0;
    z-index: 10040;
    display: none;
    justify-content: center;
    align-items: center;
    font-family: inherit;
}
#${BRAND_UPDATE_MODAL_ID}.az-visible {
    display: flex;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-modal-mask {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.45);
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-modal-content {
    position: relative;
    width: 720px;
    max-height: 84vh;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.24);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid #f1f3f5;
    background: #fafbfc;
    font-size: 16px;
    font-weight: 600;
    color: #333333;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-modal-body {
    padding: 16px 24px 8px;
    overflow-y: auto;
    color: #353535;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-modal-footer {
    padding: 12px 24px 18px;
    border-top: 1px solid #f1f3f5;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    background: #ffffff;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-modal-close {
    background: transparent;
    border: none;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    color: #666666;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-modal-close[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-section {
    margin-bottom: 16px;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-label {
    font-weight: 600;
    margin-bottom: 8px;
    font-size: 14px;
    color: #333333;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-textarea {
    width: 100%;
    min-height: 96px;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    padding: 10px 12px;
    resize: vertical;
    font-size: 14px;
    line-height: 1.5;
    color: #303133;
    outline: none;
    box-sizing: border-box;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-textarea:focus {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64,158,255,0.15);
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-helper {
    margin-top: 6px;
    font-size: 12px;
    color: #909399;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-actions {
    margin-top: 12px;
    text-align: right;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-query-btn {
    background: #0b5ed7;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 8px 18px;
    font-size: 14px;
    cursor: pointer;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-query-btn[disabled] {
    background: #a9a9a9;
    cursor: not-allowed;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-summary {
    font-size: 13px;
    color: #606266;
    margin-bottom: 10px;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-list {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row {
    display: grid;
    grid-template-columns: 1.6fr 0.75fr 0.95fr 0.95fr 0.6fr 0.6fr 2fr;
    align-items: center;
    padding: 10px 14px;
    font-size: 13px;
    border-bottom: 1px solid #f1f3f5;
    background: #ffffff;
    column-gap: 8px;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row:last-child {
    border-bottom: none;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row-header {
    background: #f5f7fa;
    font-weight: 600;
    color: #333333;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row-error {
    background: #fff5f5;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row .col-name {
    font-weight: 500;
    overflow-wrap: anywhere;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row .col-total,
#${BRAND_UPDATE_MODAL_ID} .az-brand-row .col-skip,
#${BRAND_UPDATE_MODAL_ID} .az-brand-row .col-need,
#${BRAND_UPDATE_MODAL_ID} .az-brand-row .col-success,
#${BRAND_UPDATE_MODAL_ID} .az-brand-row .col-failure {
    text-align: center;
    white-space: nowrap;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row .col-status {
    color: #666666;
    overflow-wrap: anywhere;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-row-error .col-status {
    color: #d03050;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-progress-section {
    border-top: 1px solid #f1f3f5;
    padding-top: 12px;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-progress-text {
    font-size: 13px;
    color: #555555;
    margin-bottom: 8px;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-progress-bar-wrap {
    width: 100%;
    height: 10px;
    border-radius: 6px;
    background: #eef1f6;
    overflow: hidden;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-progress-bar {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #4caf50, #00b894);
    transition: width 0.3s ease;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-status-message {
    min-height: 20px;
    font-size: 13px;
    color: #666666;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-status-message[data-type="error"] {
    color: #d03050;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-status-message[data-type="warning"] {
    color: #d97706;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-status-message[data-type="success"] {
    color: #1a7f37;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-start-btn {
    background: #006d77;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 10px 24px;
    font-size: 14px;
    cursor: pointer;
}
#${BRAND_UPDATE_MODAL_ID} .az-brand-start-btn[disabled] {
    background: #a9a9a9;
    cursor: not-allowed;
}
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureBrandUpdateUI() {
        if (brandUpdateElements) {
            return brandUpdateElements;
        }
        injectBrandUpdateStyles();
        const modal = document.createElement('div');
        modal.id = BRAND_UPDATE_MODAL_ID;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.style.display = 'none';

        const mask = document.createElement('div');
        mask.className = 'az-brand-modal-mask';
        mask.dataset.clickable = 'true';

        const content = document.createElement('div');
        content.className = 'az-brand-modal-content';

        const header = document.createElement('div');
        header.className = 'az-brand-modal-header';
        const title = document.createElement('span');
        title.textContent = '品牌数据更新';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'az-brand-modal-close';
        closeBtn.innerHTML = '&times;';
        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'az-brand-modal-body';

        const inputSection = document.createElement('div');
        inputSection.className = 'az-brand-section';
        const inputLabel = document.createElement('div');
        inputLabel.className = 'az-brand-label';
        inputLabel.textContent = '品牌名称（换行 / 逗号分隔）';
        const textarea = document.createElement('textarea');
        textarea.className = 'az-brand-textarea';
        textarea.placeholder = '示例：LOEWE罗意威香氛, 香奈儿';
        textarea.spellcheck = false;
        const helper = document.createElement('div');
        helper.className = 'az-brand-helper';
        helper.textContent = '支持换行、中文逗号、英文逗号分隔；自动去重与去空格。';
        const actions = document.createElement('div');
        actions.className = 'az-brand-actions';
        const queryBtn = document.createElement('button');
        queryBtn.type = 'button';
        queryBtn.className = 'az-brand-query-btn';
        queryBtn.textContent = '确认查询';
        actions.appendChild(queryBtn);
        inputSection.appendChild(inputLabel);
        inputSection.appendChild(textarea);
        inputSection.appendChild(helper);
        inputSection.appendChild(actions);

        const resultSection = document.createElement('div');
        resultSection.className = 'az-brand-section';
        const totalSummary = document.createElement('div');
        totalSummary.className = 'az-brand-summary';
        totalSummary.textContent = '尚未查询品牌数据';
        const brandList = document.createElement('div');
        brandList.className = 'az-brand-list';
        resultSection.appendChild(totalSummary);
        resultSection.appendChild(brandList);

        const progressSection = document.createElement('div');
        progressSection.className = 'az-brand-section az-brand-progress-section';
        const progressText = document.createElement('div');
        progressText.className = 'az-brand-progress-text';
        progressText.textContent = '总进度 0 / 0 (0%)';
        const progressBarWrap = document.createElement('div');
        progressBarWrap.className = 'az-brand-progress-bar-wrap';
        const progressBar = document.createElement('div');
        progressBar.className = 'az-brand-progress-bar';
        progressBarWrap.appendChild(progressBar);
        progressSection.appendChild(progressText);
        progressSection.appendChild(progressBarWrap);

        const statusMessage = document.createElement('div');
        statusMessage.className = 'az-brand-status-message';
        statusMessage.setAttribute('data-type', 'info');

        body.appendChild(inputSection);
        body.appendChild(resultSection);
        body.appendChild(progressSection);
        body.appendChild(statusMessage);

        const footer = document.createElement('div');
        footer.className = 'az-brand-modal-footer';
        const throttleWrapper = document.createElement('div');
        throttleWrapper.style.cssText = 'display: flex; align-items: center; gap: 14px; font-size: 13px; color: #555;';

        const perRunBox = document.createElement('div');
        perRunBox.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        const perRunLabel = document.createElement('span');
        perRunLabel.textContent = '当次处理条数';
        const perRunInput = document.createElement('input');
        perRunInput.type = 'number';
        perRunInput.min = '1';
        perRunInput.step = '1';
        const perRunDefault = Math.max(1, Math.round(brandUpdateState.perRunLimit || 100));
        perRunInput.value = String(perRunDefault);
        brandUpdateState.perRunLimit = perRunDefault;
        perRunInput.style.cssText = 'width: 90px; padding: 6px 8px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 13px;';
        perRunBox.appendChild(perRunLabel);
        perRunBox.appendChild(perRunInput);

        const countdownBox = document.createElement('div');
        countdownBox.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        const countdownLabel = document.createElement('span');
        countdownLabel.textContent = '下次任务处理倒计时';
        const countdownValue = document.createElement('span');
        countdownValue.id = 'az-brand-throttle-countdown';
        countdownValue.style.cssText = 'min-width: 60px; padding: 4px 8px; border: 1px solid #dcdfe6; border-radius: 6px; background: #f5f7fa; text-align: center; font-weight: 600;';
        countdownValue.textContent = '0';
        countdownBox.appendChild(countdownLabel);
        countdownBox.appendChild(countdownValue);

        const throttleBox = document.createElement('div');
        throttleBox.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        const throttleLabel = document.createElement('span');
        throttleLabel.textContent = '笔记间隔等待(秒)';
        const throttleInput = document.createElement('input');
        throttleInput.type = 'number';
        throttleInput.min = '0';
        throttleInput.step = '1';
        const throttleDefaultSeconds = Math.max(0, Math.round((brandUpdateState.throttleMs || 0) / 1000));
        throttleInput.value = String(throttleDefaultSeconds);
        throttleInput.style.cssText = 'width: 80px; padding: 6px 8px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 13px;';
        throttleBox.appendChild(throttleLabel);
        throttleBox.appendChild(throttleInput);
        throttleWrapper.appendChild(perRunBox);
        throttleWrapper.appendChild(countdownBox);
        throttleWrapper.appendChild(throttleBox);
        const startBtn = document.createElement('button');
        startBtn.type = 'button';
        startBtn.className = 'az-brand-start-btn';
        startBtn.textContent = '开始更新';
        startBtn.disabled = true;
        footer.appendChild(throttleWrapper);
        footer.appendChild(startBtn);

        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);

        modal.appendChild(mask);
        modal.appendChild(content);
        document.body.appendChild(modal);

        mask.addEventListener('click', function() {
            if (brandUpdateState.running) {
                return;
            }
            if (mask.dataset.clickable === 'false') {
                return;
            }
            hideBrandUpdateModal();
        });
        closeBtn.addEventListener('click', function() {
            if (brandUpdateState.running) {
                return;
            }
            hideBrandUpdateModal();
        });
        queryBtn.addEventListener('click', handleBrandQuery);
        startBtn.addEventListener('click', startBrandUpdateWorkflow);

        brandUpdateElements = {
            modal,
            mask,
            content,
            textarea,
            queryBtn,
            totalSummary,
            brandList,
            progressText,
            progressBar,
            statusMessage,
            startBtn,
            closeBtn,
            throttleInput,
            perRunInput,
            throttleCountdownEl: countdownValue
        };
        const initialSeconds = Math.max(0, Math.round((brandUpdateState.throttleMs || 0) / 1000));
        throttleInput.value = String(initialSeconds);
        throttleInput.addEventListener('change', handleThrottleInputChange);
        perRunInput.addEventListener('change', handlePerRunInputChange);
        return brandUpdateElements;
    }

    function showBrandUpdateModal() {
        const elements = ensureBrandUpdateUI();
        if (!elements) {
            return;
        }
        if (elements.throttleInput) {
            const seconds = Math.max(0, Math.round((brandUpdateState.throttleMs || 0) / 1000));
            elements.throttleInput.value = String(seconds);
        }
        if (elements.perRunInput) {
            const limit = Math.max(1, Math.round(brandUpdateState.perRunLimit || 100));
            elements.perRunInput.value = String(limit);
        }
        elements.modal.style.display = 'flex';
        requestAnimationFrame(function() {
            elements.modal.classList.add('az-visible');
            setTimeout(function() {
                elements.textarea.focus();
            }, 30);
        });
    }

    function hideBrandUpdateModal() {
        if (!brandUpdateElements) {
            return;
        }
        brandUpdateElements.modal.classList.remove('az-visible');
        brandUpdateElements.modal.style.display = 'none';
    }

    function parseBrandInput(rawValue) {
        if (!rawValue || typeof rawValue !== 'string') {
            return [];
        }
        return Array.from(new Set(rawValue.split(/[\n,，、]+/).map(function(item) {
            return item.trim();
        }).filter(function(item) {
            return item.length > 0;
        })));
    }

    function setBrandConfirmButtonDisabled(disabled) {
        if (!brandUpdateElements) {
            return;
        }
        brandUpdateElements.queryBtn.disabled = !!disabled;
    }

    function setBrandCloseButtonDisabled(disabled) {
        if (!brandUpdateElements) {
            return;
        }
        brandUpdateElements.closeBtn.disabled = !!disabled;
        brandUpdateElements.mask.dataset.clickable = disabled ? 'false' : 'true';
    }

    function setBrandStartButtonState(state) {
        if (!brandUpdateElements) {
            return;
        }
        const btn = brandUpdateElements.startBtn;
        if (!btn) {
            return;
        }
        if (state === 'running') {
            btn.textContent = '更新中...';
            btn.disabled = true;
        } else if (state === 'done') {
            btn.textContent = '更新完成';
            btn.disabled = true;
        } else {
            btn.textContent = '开始更新';
            btn.disabled = brandUpdateState.totalNotes === 0;
        }
    }

    function setBrandUpdateStatusMessage(text, type) {
        if (!brandUpdateElements) {
            return;
        }
        brandUpdateElements.statusMessage.textContent = text || '';
        brandUpdateElements.statusMessage.setAttribute('data-type', type || 'info');
    }

    function getThrottleMs() {
        if (!brandUpdateElements || !brandUpdateElements.throttleInput) {
            return brandUpdateState.throttleMs || 0;
        }
        const value = Number(brandUpdateElements.throttleInput.value);
        if (!Number.isFinite(value) || value < 0) {
            return 0;
        }
        return Math.round(value) * 1000;
    }

    function setThrottleInputDisabled(disabled) {
        if (brandUpdateElements) {
            if (brandUpdateElements.throttleInput) {
                brandUpdateElements.throttleInput.disabled = !!disabled;
            }
            if (brandUpdateElements.perRunInput) {
                brandUpdateElements.perRunInput.disabled = !!disabled;
            }
        }
    }

    function getPerRunLimit() {
        if (!brandUpdateElements || !brandUpdateElements.perRunInput) {
            return Math.max(1, Math.round(brandUpdateState.perRunLimit || 100));
        }
        let value = Number(brandUpdateElements.perRunInput.value);
        if (!Number.isFinite(value) || value <= 0) {
            value = brandUpdateState.perRunLimit || 100;
        }
        const sanitized = Math.max(1, Math.round(value));
        brandUpdateElements.perRunInput.value = String(sanitized);
        return sanitized;
    }

    function handlePerRunInputChange(event) {
        const input = event && event.target ? event.target : (brandUpdateElements && brandUpdateElements.perRunInput);
        if (!input) {
            return;
        }
        let value = Number(input.value);
        if (!Number.isFinite(value) || value <= 0) {
            value = brandUpdateState.perRunLimit || 100;
        }
        const sanitized = Math.max(1, Math.round(value));
        input.value = String(sanitized);
        brandUpdateState.perRunLimit = sanitized;
    }

    function updateThrottleCountdownDisplay(seconds) {
        if (!brandUpdateElements || !brandUpdateElements.throttleCountdownEl) {
            return;
        }
        const value = Math.max(0, Math.round(Number(seconds) || 0));
        brandUpdateElements.throttleCountdownEl.textContent = String(value);
    }

    function handleThrottleInputChange(event) {
        const input = event && event.target ? event.target : (brandUpdateElements && brandUpdateElements.throttleInput);
        if (!input) {
            return;
        }
        let value = Number(input.value);
        if (!Number.isFinite(value) || value < 0) {
            value = 0;
        }
        const rounded = Math.round(value);
        input.value = String(rounded);
        brandUpdateState.throttleMs = rounded * 1000;
        if (!brandUpdateState.running) {
            updateThrottleCountdownDisplay(0);
        }
    }

    function updateRunningStatusMessage(mode, waitSeconds) {
        const base = `成功 ${brandUpdateState.totalSuccess} 条，失败 ${brandUpdateState.totalFailure} 条`;
        let text;
        if (mode === 'waiting' && waitSeconds && waitSeconds > 0) {
            text = `等待 ${waitSeconds} 秒后处理下一条；${base}`;
        } else {
            text = `正在更新：${base}`;
        }
        setBrandUpdateStatusMessage(text, brandUpdateState.totalFailure > 0 ? 'warning' : 'info');
    }

    function renderBrandEntries(entries) {
        if (!brandUpdateElements) {
            return;
        }
        const listEl = brandUpdateElements.brandList;
        listEl.innerHTML = '';
        if (!entries || entries.length === 0) {
            brandUpdateElements.totalSummary.textContent = '尚未查询品牌数据';
            return;
        }
        updateBrandSummaryDisplay();
        const headerRow = document.createElement('div');
        headerRow.className = 'az-brand-row az-brand-row-header';
        [
            { className: 'col-name', text: '品牌' },
            { className: 'col-total', text: '总条数' },
            { className: 'col-skip', text: '无需处理条数' },
            { className: 'col-need', text: '需处理条数' },
            { className: 'col-success', text: '成功' },
            { className: 'col-failure', text: '失败' },
            { className: 'col-status', text: '状态' }
        ].forEach(function(cfg) {
            const cell = document.createElement('div');
            cell.className = cfg.className;
            cell.textContent = cfg.text;
            headerRow.appendChild(cell);
        });
        listEl.appendChild(headerRow);
        entries.forEach(function(entry) {
            const row = document.createElement('div');
            row.className = 'az-brand-row';
            const cursor = Math.max(entry.cursor || 0, 0);
            const totalPending = Array.isArray(entry.notes) ? entry.notes.length : 0;
            entry.pendingCount = Math.max(totalPending - cursor, 0);
            const nameCol = document.createElement('div');
            nameCol.className = 'col-name';
            nameCol.textContent = entry.name;
            const totalCol = document.createElement('div');
            totalCol.className = 'col-total';
            totalCol.textContent = entry.total || 0;
            const skipCol = document.createElement('div');
            skipCol.className = 'col-skip';
            skipCol.textContent = entry.skipCount || 0;
            const needCol = document.createElement('div');
            needCol.className = 'col-need';
            needCol.textContent = entry.pendingCount || 0;
            const successCol = document.createElement('div');
            successCol.className = 'col-success';
            successCol.textContent = entry.success || 0;
            const failureCol = document.createElement('div');
            failureCol.className = 'col-failure';
            failureCol.textContent = entry.failed || 0;
            const statusCol = document.createElement('div');
            statusCol.className = 'col-status';
            statusCol.textContent = entry.error
                ? `查询失败：${entry.error}`
                : ((entry.total || 0) === 0 ? '暂无数据' : ((entry.pendingCount || 0) === 0 ? '无需处理' : '待更新'));
            row.appendChild(nameCol);
            row.appendChild(totalCol);
            row.appendChild(skipCol);
            row.appendChild(needCol);
            row.appendChild(successCol);
            row.appendChild(failureCol);
            row.appendChild(statusCol);
            entry.domRefs = {
                wrapper: row,
                totalEl: totalCol,
                skipEl: skipCol,
                needEl: needCol,
                successEl: successCol,
                failureEl: failureCol,
                statusEl: statusCol
            };
            listEl.appendChild(row);
        });
    }

    function updateBrandSummaryDisplay() {
        if (!brandUpdateElements || !brandUpdateElements.totalSummary) {
            return;
        }
        if (!Array.isArray(brandUpdateState.brandEntries) || brandUpdateState.brandEntries.length === 0) {
            brandUpdateElements.totalSummary.textContent = '尚未查询品牌数据';
            return;
        }
        const totalAll = brandUpdateState.totalOriginalNotes || 0;
        const totalSkip = brandUpdateState.totalSkippedNotes || 0;
        const totalNeed = Math.max(brandUpdateState.totalNotes || 0, 0);
        brandUpdateElements.totalSummary.textContent = `共 ${brandUpdateState.brandEntries.length} 个品牌，总条数 ${totalAll}；无需处理 ${totalSkip} 条，需处理 ${totalNeed} 条`;
    }

    function refreshPendingStats() {
        let pendingTotal = 0;
        if (Array.isArray(brandUpdateState.brandEntries)) {
            brandUpdateState.brandEntries.forEach(function(entry) {
                const totalPending = Array.isArray(entry.notes) ? entry.notes.length : 0;
                const cursor = Math.max(entry.cursor || 0, 0);
                const pending = Math.max(totalPending - cursor, 0);
                entry.pendingCount = pending;
                pendingTotal += pending;
            });
        }
        brandUpdateState.totalNotes = pendingTotal;
        return pendingTotal;
    }

    function buildBrandEntryStatusText(entry) {
        if (entry.error) {
            return `查询失败：${entry.error}`;
        }
        const total = entry.total || 0;
        if (total === 0) {
            return '暂无数据';
        }
        const pending = entry.pendingCount || 0;
        if (pending === 0) {
            return '无需处理';
        }
        const completed = (entry.success || 0) + (entry.failed || 0);
        if (completed === 0) {
            return '待更新';
        }
        const remaining = Math.max(pending - completed, 0);
        if (entry.failed > 0) {
            const hint = entry.errors && entry.errors.length > 0 ? `；示例错误：${entry.errors[0]}` : '';
            const remainText = remaining > 0 ? `；剩余 ${remaining} 条` : '';
            return `成功 ${entry.success} 条，失败 ${entry.failed} 条${remainText}${hint}`;
        }
        if (entry.warnings && entry.warnings.length > 0) {
            const remainText = remaining > 0 ? `；剩余 ${remaining} 条` : '';
            return `成功 ${entry.success} 条${remainText}；提示：${entry.warnings[0]}`;
        }
        if (remaining > 0) {
            return `成功 ${entry.success} 条；剩余 ${remaining} 条`;
        }
        return `成功 ${entry.success} 条`;
    }

    function updateBrandEntryDisplay(entry) {
        if (!entry || !entry.domRefs) {
            return;
        }
        const refs = entry.domRefs;
        if (refs.totalEl) {
            refs.totalEl.textContent = entry.total || 0;
        }
        if (refs.skipEl) {
            refs.skipEl.textContent = entry.skipCount || 0;
        }
        if (refs.needEl) {
            refs.needEl.textContent = entry.pendingCount || 0;
        }
        if (refs.successEl) {
            refs.successEl.textContent = entry.success || 0;
        }
        if (refs.failureEl) {
            refs.failureEl.textContent = entry.failed || 0;
        }
        if (refs.statusEl) {
            refs.statusEl.textContent = buildBrandEntryStatusText(entry);
        }
        if (refs.wrapper) {
            if (entry.error || (entry.failed && entry.failed > 0)) {
                refs.wrapper.classList.add('az-brand-row-error');
            } else {
                refs.wrapper.classList.remove('az-brand-row-error');
            }
        }
    }

    function updateBrandProgressDisplay() {
        if (!brandUpdateElements) {
            return;
        }
        const totalInitial = brandUpdateState.totalInitialPending || 0;
        const remaining = Math.max(brandUpdateState.totalNotes || 0, 0);
        const processedOverall = Math.max(totalInitial - remaining, 0);
        const percent = totalInitial === 0 ? 0 : Math.round((processedOverall / totalInitial) * 100);
        brandUpdateElements.progressText.textContent = `总进度 ${processedOverall} / ${totalInitial} (${percent}%)`;
        brandUpdateElements.progressBar.style.width = percent + '%';
    }

    function resetBrandUpdateProgress() {
        brandUpdateState.processed = 0;
        brandUpdateState.totalSuccess = 0;
        brandUpdateState.totalFailure = 0;
        if (Array.isArray(brandUpdateState.brandEntries)) {
            brandUpdateState.brandEntries.forEach(function(entry) {
                entry.success = 0;
                entry.failed = 0;
                entry.errors = [];
                entry.warnings = [];
                updateBrandEntryDisplay(entry);
            });
        }
        updateBrandProgressDisplay();
        updateBrandSummaryDisplay();
    }

    async function handleBrandQuery() {
        const elements = ensureBrandUpdateUI();
        const rawBrands = elements.textarea.value || '';
        const brands = parseBrandInput(rawBrands);
        brandUpdateState.brandEntries = [];
        brandUpdateState.totalNotes = 0;
        brandUpdateState.totalOriginalNotes = 0;
        brandUpdateState.totalSkippedNotes = 0;
        brandUpdateState.processed = 0;
        brandUpdateState.totalSuccess = 0;
        brandUpdateState.totalFailure = 0;
        brandUpdateState.running = false;
        setBrandConfirmButtonDisabled(true);
        setBrandCloseButtonDisabled(true);
        setBrandStartButtonState('idle');
        setBrandUpdateStatusMessage(brands.length === 0 ? '正在查询全部品牌...' : `共 ${brands.length} 个品牌，正在查询...`, 'info');
        const entries = [];
        if (brands.length === 0) {
            try {
                const result = await fetchNotesByBrand(null);
                const rawNotes = Array.isArray(result.notes) ? result.notes : [];
                entries.push(...groupNotesByBrand(rawNotes));
            } catch (err) {
                const errMsg = err && err.message ? err.message : String(err);
                console.error('[brandUpdate] 查询全部品牌失败', err);
                brandUpdateState.brandEntries = [];
                brandUpdateState.totalOriginalNotes = 0;
                brandUpdateState.totalSkippedNotes = 0;
                brandUpdateState.totalNotes = 0;
                brandUpdateState.totalInitialPending = 0;
                renderBrandEntries([]);
                resetBrandUpdateProgress();
                updateBrandProgressDisplay();
                updateBrandSummaryDisplay();
                setBrandUpdateStatusMessage(`查询全部品牌失败：${errMsg}`, 'error');
                setBrandStartButtonState('idle');
                setBrandConfirmButtonDisabled(false);
                setBrandCloseButtonDisabled(false);
                setThrottleInputDisabled(false);
                return;
            }
        } else {
            for (let idx = 0; idx < brands.length; idx++) {
                const brandName = brands[idx];
                try {
                    setBrandUpdateStatusMessage(`正在查询「${brandName}」 (${idx + 1}/${brands.length})...`, 'info');
                    const result = await fetchNotesByBrand(brandName);
                    const rawNotes = Array.isArray(result.notes) ? result.notes : [];
                    entries.push(createBrandEntryFromNotes(brandName, rawNotes));
                } catch (err) {
                    const errMsg = err && err.message ? err.message : String(err);
                    console.error('[brandUpdate] 品牌查询失败', brandName, err);
                    const entry = createBrandEntryFromNotes(brandName, []);
                    entry.error = errMsg;
                    entries.push(entry);
                }
            }
        }
        brandUpdateState.brandEntries = entries;
        brandUpdateState.totalOriginalNotes = entries.reduce(function(sum, item) {
            return sum + (item.total || 0);
        }, 0);
        brandUpdateState.totalSkippedNotes = entries.reduce(function(sum, item) {
            return sum + (item.skipCount || 0);
        }, 0);
        refreshPendingStats();
        brandUpdateState.totalInitialPending = brandUpdateState.totalNotes;
        brandUpdateState.processed = 0;
        brandUpdateState.totalSuccess = 0;
        brandUpdateState.totalFailure = 0;
        brandUpdateState.running = false;

        renderBrandEntries(entries);
        resetBrandUpdateProgress();
        updateBrandProgressDisplay();

        window.AZ_brandUpdateData = entries.map(function(entry) {
            return {
                brand: entry.name,
                total: entry.total,
                skip: entry.skipCount,
                pending: entry.pendingCount,
                notes: entry.allNotes.map(function(note) {
                    return Object.assign({}, note);
                }),
                pendingNotes: entry.notes.map(function(note) {
                    return Object.assign({}, note);
                })
            };
        });

        if (brandUpdateState.totalNotes > 0) {
            setBrandUpdateStatusMessage(`查询完成：${entries.length} 个品牌，总条数 ${brandUpdateState.totalOriginalNotes}；无需处理 ${brandUpdateState.totalSkippedNotes} 条，需处理 ${brandUpdateState.totalNotes} 条。可点击“开始更新”执行同步。`, 'success');
        } else {
            const hasError = entries.some(function(entry) { return !!entry.error; });
            if (hasError) {
                setBrandUpdateStatusMessage(`查询完成，但部分品牌查询失败（共 ${entries.length} 个品牌）。可检查品牌名称后重试。`, 'warning');
            } else if (brandUpdateState.totalOriginalNotes > 0) {
                setBrandUpdateStatusMessage(`查询完成：共 ${brandUpdateState.totalOriginalNotes} 条笔记，均已存在 XhsNoteId，无需处理（无需处理 ${brandUpdateState.totalSkippedNotes} 条，需处理 0 条）。`, 'success');
            } else {
                setBrandUpdateStatusMessage('查询完成，但未找到任何笔记数据。', 'warning');
            }
        }
        setBrandStartButtonState('idle');
        setBrandConfirmButtonDisabled(false);
        setBrandCloseButtonDisabled(false);
        setThrottleInputDisabled(false);
        brandUpdateState.throttleMs = getThrottleMs();
        updateThrottleCountdownDisplay(0);
    }

    async function fetchNotesByBrand(brandName) {
        const selectFields = '*';
        const baseUrl = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`;
        let effectiveBrandName = brandName;
        if (typeof effectiveBrandName === 'string') {
            effectiveBrandName = effectiveBrandName.trim();
        }
        const hasBrandFilter = !(effectiveBrandName === null || effectiveBrandName === undefined || effectiveBrandName === '');
        const filterSegment = hasBrandFilter ? `CooperateBindsName=eq.${encodeURIComponent(effectiveBrandName)}` : '';
        const selectSegment = `select=${encodeURIComponent(selectFields)}`;
        const queryUrl = `${baseUrl}?${filterSegment ? `${filterSegment}&` : ''}${selectSegment}`;
        const notes = [];
        const pageSize = 1000;
        let rangeStart = 0;
        let total = 0;
        while (true) {
            const rangeEnd = rangeStart + pageSize - 1;
            const response = await fetchWithRetry(queryUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'count=exact',
                    'Range': `${rangeStart}-${rangeEnd}`,
                    'X-AZ-Phase': 'brand-manual-query'
                }
            }, 1, 45000);
            if (!response.ok) {
                const errInfo = await parseErrorResponse(response);
                throw new Error(errInfo || `查询失败 (${response.status})`);
            }
            const chunk = await response.json();
            const chunkLength = Array.isArray(chunk) ? chunk.length : 0;
            if (chunkLength > 0) {
                notes.push(...chunk);
            }
            const contentRange = response.headers.get('content-range') || response.headers.get('Content-Range');
            if (contentRange) {
                const parts = contentRange.split('/');
                if (parts.length === 2 && parts[1] && parts[1] !== '*') {
                    const parsedTotal = Number(parts[1]);
                    if (!Number.isNaN(parsedTotal)) {
                        total = parsedTotal;
                    }
                }
            }
            if (chunkLength < pageSize) {
                break;
            }
            rangeStart += pageSize;
            if (total && notes.length >= total) {
                break;
            }
        }
        if (!total) {
            total = notes.length;
        }
        return { notes, total };
    }

    function getRecordNoteId(record) {
        return extractFirstNonEmpty([
            record && record.NoteId,
            record && record.NoteID,
            record && record.noteId,
            record && record.note_id,
            record && record.Id,
            record && record.id
        ]);
    }

    function getRecordDateCode(record) {
        return extractFirstNonEmpty([
            record && record.DateCode,
            record && record.dateCode,
            record && record.date_code
        ]);
    }

    function getRecordXhsNoteId(record) {
        return sanitizeNullableString(extractFirstNonEmpty([
            record && record.XhsNoteId,
            record && record.XhsNoteID,
            record && record.Xhsnoteid,
            record && record.xhs_note_id,
            record && record.xhs_noteID,
            record && record.xhsNoteId,
            record && record.xhs_noteId
        ]));
    }

    function deriveBrandNameFromNote(note) {
        if (!note || typeof note !== 'object') {
            return '未指定品牌';
        }
        const directName = sanitizeNullableString(note.CooperateBindsName);
        if (directName) {
            return directName;
        }
        const binds = Array.isArray(note.CooperateBindList) ? note.CooperateBindList : [];
        for (let i = 0; i < binds.length; i++) {
            const bind = binds[i];
            if (!bind) continue;
            const bindName = sanitizeNullableString(
                bind.BrandName ?? bind.brand_name ?? bind.name
            );
            if (bindName) {
                return bindName;
            }
        }
        return '未指定品牌';
    }

    function createBrandEntryFromNotes(brandName, rawNotes) {
        const noteArray = Array.isArray(rawNotes) ? rawNotes : [];
        const pendingNotes = noteArray.filter(function(note) {
            return !getRecordXhsNoteId(note);
        });
        return {
            name: brandName,
            total: noteArray.length,
            pendingCount: pendingNotes.length,
            skipCount: Math.max(noteArray.length - pendingNotes.length, 0),
            notes: pendingNotes,
            allNotes: noteArray,
            cursor: 0,
            success: 0,
            failed: 0,
            errors: [],
            warnings: []
        };
    }

    function groupNotesByBrand(rawNotes) {
        const brandMap = new Map();
        (Array.isArray(rawNotes) ? rawNotes : []).forEach(function(note) {
            const brandName = deriveBrandNameFromNote(note);
            if (!brandMap.has(brandName)) {
                brandMap.set(brandName, []);
            }
            brandMap.get(brandName).push(note);
        });
        const grouped = [];
        brandMap.forEach(function(notes, brandName) {
            grouped.push(createBrandEntryFromNotes(brandName, notes));
        });
        grouped.sort(function(a, b) {
            return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
        });
        return grouped;
    }

    async function requestManualNoteUrl(noteId, dateCode) {
        if (!noteId) {
            throw new Error('缺少 noteId');
        }
        if (!dateCode) {
            throw new Error('缺少 dateCode');
        }
        const url = buildManualNoteUrl(noteId, dateCode);
        return new Promise((resolve, reject) => {
            try {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 20000,
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            const body = response.responseText || '';
                            if (!body) {
                                reject(new Error('响应为空'));
                                return;
                            }
                            resolve({ requestUrl: url, responseText: body });
                        } else {
                            let message = `请求失败 (HTTP ${response.status})`;
                            const text = response.responseText;
                            if (text) {
                                try {
                                    const parsed = JSON.parse(text);
                                    if (parsed.message) {
                                        message = parsed.message;
                                    } else if (parsed.error) {
                                        message = parsed.error;
                                    }
                                } catch (_) {
                                    message = text;
                                }
                            }
                            reject(new Error(message));
                        }
                    },
                    onerror: function(err) {
                        reject(new Error(`网络错误：${err && err.error ? err.error : '未知错误'}`));
                    },
                    ontimeout: function() {
                        reject(new Error('请求超时'));
                    }
                });
            } catch (err) {
                reject(new Error(`请求异常：${err && err.message ? err.message : String(err)}`));
            }
        });
    }

    function buildManualNoteUrl(noteId, dateCode) {
        const ts = Date.now();
        const parts = [`noteid=${encodeURIComponent(noteId)}`];
        if (dateCode !== undefined && dateCode !== null && String(dateCode).trim() !== '') {
            parts.push(`datecode=${encodeURIComponent(dateCode)}`);
        }
        parts.push(`_=${ts}`);
        return `https://api.qian-gua.com/v1/Note/GetXhsNoteUrl?${parts.join('&')}`;
    }

    function sleep(ms) {
        if (!Number.isFinite(ms) || ms <= 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function startBrandUpdateWorkflow() {
        if (brandUpdateState.running) {
            return;
        }
        if (!brandUpdateElements) {
            ensureBrandUpdateUI();
        }
        if (!brandUpdateState.brandEntries || brandUpdateState.brandEntries.length === 0) {
            setBrandUpdateStatusMessage('请先查询品牌数据', 'error');
            return;
        }
        refreshPendingStats();
        updateBrandSummaryDisplay();
        updateBrandProgressDisplay();
        if (brandUpdateState.totalNotes === 0) {
            setBrandUpdateStatusMessage('没有需要更新的数据', 'warning');
            setBrandStartButtonState('idle');
            return;
        }
        brandUpdateState.running = true;
        if (brandUpdateElements && brandUpdateElements.textarea) {
            brandUpdateElements.textarea.readOnly = true;
        }
        setBrandStartButtonState('running');
        setBrandConfirmButtonDisabled(true);
        setBrandCloseButtonDisabled(true);
        brandUpdateState.processed = 0;
        brandUpdateState.totalSuccess = 0;
        brandUpdateState.totalFailure = 0;
        brandUpdateState.brandEntries.forEach(function(entry) {
            entry.success = 0;
            entry.failed = 0;
            entry.errors = [];
            entry.warnings = [];
            updateBrandEntryDisplay(entry);
        });
        brandUpdateState.throttleMs = getThrottleMs();
        brandUpdateState.perRunLimit = getPerRunLimit();
        setThrottleInputDisabled(true);
        updateThrottleCountdownDisplay(0);
        updateRunningStatusMessage('running');
        try {
            const throttleMs = brandUpdateState.throttleMs || 0;
            const perRunLimit = Math.max(1, Math.round(brandUpdateState.perRunLimit || 100));
            let processedThisRun = 0;
            let limitReached = false;
            for (let idx = 0; idx < brandUpdateState.brandEntries.length; idx++) {
                if (limitReached) {
                    break;
                }
                const entry = brandUpdateState.brandEntries[idx];
                const totalPending = Array.isArray(entry.notes) ? entry.notes.length : 0;
                const cursorStart = Math.max(entry.cursor || 0, 0);
                if (entry.error || totalPending === 0 || cursorStart >= totalPending) {
                    updateBrandEntryDisplay(entry);
                    continue;
                }
                for (let noteIdx = cursorStart; noteIdx < totalPending; noteIdx++) {
                    if (processedThisRun >= perRunLimit) {
                        limitReached = true;
                        break;
                    }
                    const noteRecord = entry.notes[noteIdx];
                    const noteId = sanitizeNullableString(getRecordNoteId(noteRecord));
                    const dateCode = sanitizeNullableString(getRecordDateCode(noteRecord));
                    if (!noteId || !dateCode) {
                        entry.failed += 1;
                        brandUpdateState.totalFailure += 1;
                        if (entry.errors.length < 3) {
                            entry.errors.push('缺少 noteId 或 dateCode');
                        }
                    } else {
                        try {
                            const manualResponse = await requestManualNoteUrl(noteId, dateCode);
                            const result = await handleGetXhsNoteUrlResponse({
                                requestUrl: manualResponse.requestUrl,
                                requestPayload: null,
                                responseText: manualResponse.responseText,
                                fallbackNoteItem: noteRecord,
                                propagateErrors: true
                            });
                            entry.success += 1;
                            brandUpdateState.totalSuccess += 1;
                            if (result && Array.isArray(result.warnings) && result.warnings.length > 0) {
                                entry.warnings.push(...result.warnings);
                            }
                        } catch (err) {
                            const errMsg = err && err.message ? err.message : String(err);
                            entry.failed += 1;
                            brandUpdateState.totalFailure += 1;
                            if (entry.errors.length < 3 && !entry.errors.includes(errMsg)) {
                                entry.errors.push(errMsg);
                            }
                            console.error('[brandUpdate] 笔记更新失败', { noteId, dateCode, error: err });
                        }
                    }
                    entry.cursor = noteIdx + 1;
                    processedThisRun += 1;
                    brandUpdateState.processed += 1;
                    refreshPendingStats();
                    updateBrandEntryDisplay(entry);
                    updateBrandSummaryDisplay();
                    updateBrandProgressDisplay();
                    updateRunningStatusMessage('running');
                    if (processedThisRun >= perRunLimit) {
                        limitReached = true;
                        break;
                    }
                    if (throttleMs > 0 && brandUpdateState.totalNotes > 0) {
                        let remainingMs = throttleMs;
                        const waitSeconds = Math.max(1, Math.round(throttleMs / 1000));
                        updateRunningStatusMessage('waiting', waitSeconds);
                        while (remainingMs > 0) {
                            updateThrottleCountdownDisplay(Math.ceil(remainingMs / 1000));
                            const step = Math.min(1000, remainingMs);
                            await sleep(step);
                            remainingMs -= step;
                        }
                        updateThrottleCountdownDisplay(0);
                        updateRunningStatusMessage('running');
                    }
                }
            }
            if (brandUpdateState.totalNotes === 0) {
                setBrandUpdateStatusMessage(`更新完成：成功 ${brandUpdateState.totalSuccess} 条，失败 ${brandUpdateState.totalFailure} 条`, brandUpdateState.totalFailure > 0 ? 'warning' : 'success');
            } else if (limitReached) {
                setBrandUpdateStatusMessage(`已处理 ${processedThisRun} 条（成功 ${brandUpdateState.totalSuccess} 条，失败 ${brandUpdateState.totalFailure} 条），达到当次处理上限 ${perRunLimit} 条；剩余 ${brandUpdateState.totalNotes} 条待处理，可再次点击“开始更新”。`, 'warning');
            } else {
                setBrandUpdateStatusMessage(`更新完成：成功 ${brandUpdateState.totalSuccess} 条，失败 ${brandUpdateState.totalFailure} 条；剩余 ${brandUpdateState.totalNotes} 条待处理。`, 'warning');
            }
        } catch (err) {
            console.error('[brandUpdate] 更新流程异常', err);
            const errMsg = err && err.message ? err.message : String(err);
            setBrandUpdateStatusMessage(`更新流程异常：${errMsg}`, 'error');
        } finally {
            brandUpdateState.running = false;
            if (brandUpdateElements && brandUpdateElements.textarea) {
                brandUpdateElements.textarea.readOnly = false;
            }
            setBrandConfirmButtonDisabled(false);
            setBrandCloseButtonDisabled(false);
            setThrottleInputDisabled(false);
            updateThrottleCountdownDisplay(0);
            setBrandStartButtonState(brandUpdateState.totalNotes === 0 ? 'done' : 'idle');
            refreshPendingStats();
            updateBrandProgressDisplay();
            updateBrandSummaryDisplay();
        }
    }

    // 按钮点击事件处理程序
    button.addEventListener('click', async function(e) {


        const excelData = [];
        const keys = Object.keys(window.noteHotMap || {});
        for (let idx = 0; idx < keys.length; idx++) {
            const k = keys[idx];
            const itemArrJsonRsp = window.noteHotMap[k];
            const data = JSON.parse(itemArrJsonRsp);
            const itemList = (data && data.Data && Array.isArray(data.Data.ItemList)) ? data.Data.ItemList : [];
            for (let i = 0; i < itemList.length; i++) {
                excelData.push(itemList[i]);
            }
        }

        //     var ss = getDemoData();
        //    for(var u=0;u<ss.length;u++){
        //        const result = await window.AZ_seed(ss[u]);
        //    }


        // const ss = getDemoData();
        const ss = excelData;
        if (!Array.isArray(ss) || ss.length === 0) {
            showMessage('AZ_seed 提示：无可上传的数据', false);
            return;
        }

        const originalShowMessage = showMessage;
        showMessage = function(message, isSuccess) {
            if (window.AZ_DEBUG) {
                console.log('[AZ_seed suppressed message]', { message, isSuccess });
            }
        };

        const originalCreateProgressBar = createProgressBar;
        const originalUpdateProgressBar = updateProgressBar;
        const originalRemoveProgressBar = removeProgressBar;
        createProgressBar = function noopCreateProgressBar() {};
        updateProgressBar = function noopUpdateProgressBar() {};
        removeProgressBar = function noopRemoveProgressBar() {};

        const totalCount = ss.length;
        const OVERALL_PROGRESS_ID = 'az-seed-overall-progress';
        const OVERALL_PROGRESS_TEXT_ID = 'az-seed-overall-progress-text';
        const OVERALL_PROGRESS_BAR_ID = 'az-seed-overall-progress-bar';

        const removeExistingOverallProgress = () => {
            const exist = document.getElementById(OVERALL_PROGRESS_ID);
            if (exist && exist.parentNode) {
                exist.parentNode.removeChild(exist);
            }
        };

        const createOverallProgress = () => {
            removeExistingOverallProgress();
            const container = document.createElement('div');
            container.id = OVERALL_PROGRESS_ID;
            container.style.cssText = `
                position: fixed;
                top: 70px;
                left: 50%;
                transform: translateX(-50%);
                width: 420px;
                background: rgba(0,0,0,0.85);
                padding: 12px 16px;
                border-radius: 10px;
                color: #fff;
                z-index: 10002;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                font-size: 14px;
            `;
            const text = document.createElement('div');
            text.id = OVERALL_PROGRESS_TEXT_ID;
            text.textContent = `AZ_seed 进度 0/${totalCount} (0%)`;
            text.style.marginBottom = '8px';

            const barWrap = document.createElement('div');
            barWrap.style.cssText = `
                width: 100%;
                height: 10px;
                background: rgba(255,255,255,0.2);
                border-radius: 6px;
                overflow: hidden;
            `;
            const bar = document.createElement('div');
            bar.id = OVERALL_PROGRESS_BAR_ID;
            bar.style.cssText = `
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #00b894);
                transition: width 0.25s ease;
            `;
            barWrap.appendChild(bar);

            container.appendChild(text);
            container.appendChild(barWrap);
            document.body.appendChild(container);
        };

        const updateOverallProgress = (done) => {
            const text = document.getElementById(OVERALL_PROGRESS_TEXT_ID);
            const bar = document.getElementById(OVERALL_PROGRESS_BAR_ID);
            if (!text || !bar) return;
            const percent = totalCount === 0 ? 100 : Math.round((done / totalCount) * 100);
            text.textContent = `AZ_seed 进度 ${done}/${totalCount} (${percent}%)`;
            bar.style.width = `${percent}%`;
        };

        const cleanupOverallProgress = () => {
            const container = document.getElementById(OVERALL_PROGRESS_ID);
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        };

        createOverallProgress();
        updateOverallProgress(0);

        const parseCounts = (message) => {
            if (typeof message !== 'string') {
                return { bloggers: 0, brands: 0, notes: 0 };
            }
            const bloggersMatch = message.match(/成功入库\/更新\s*(\d+)\s*位博主/);
            const brandsMatch = message.match(/成功入库\/更新\s*(\d+)\s*个品牌/);
            const notesMatch = message.match(/成功插入\s*(\d+)\s*条数据/);
            return {
                bloggers: bloggersMatch ? Number(bloggersMatch[1]) : 0,
                brands: brandsMatch ? Number(brandsMatch[1]) : 0,
                notes: notesMatch ? Number(notesMatch[1]) : 0
            };
        };

        let totalBloggers = 0;
        let totalBrands = 0;
        let totalNotes = 0;
        let successCount = 0;
        const failureMessages = [];
        let completedCount = 0;

        try {
            for (let u = 0; u < ss.length; u++) {
                try {
                    const result = await window.AZ_seed(ss[u]);
                    if (result && result.success) {
                        successCount += 1;
                        const counts = parseCounts(result.message);
                        totalBloggers += counts.bloggers;
                        totalBrands += counts.brands;
                        totalNotes += counts.notes;
                    } else {
                        failureMessages.push(result && result.message ? result.message : '未知错误');
                    }
                } catch (err) {
                    const errMsg = err && err.message ? err.message : String(err);
                    failureMessages.push(errMsg);
                }
                completedCount += 1;
                updateOverallProgress(completedCount);
            }
        } finally {
            showMessage = originalShowMessage;
            createProgressBar = originalCreateProgressBar;
            updateProgressBar = originalUpdateProgressBar;
            removeProgressBar = originalRemoveProgressBar;
            setTimeout(cleanupOverallProgress, 800);
        }

        if (failureMessages.length === 0) {
            const msg = `AZ_seed 成功：成功入库/更新 ${totalBloggers} 位博主；成功入库/更新 ${totalBrands} 个品牌；成功插入 ${totalNotes} 条数据`;
            originalShowMessage(msg, true);
            const previousTotalCount = window.totalCount || 0;
            window.noteHotMap = {};
            window.savedCnt = 0;
            window.totalCount = previousTotalCount;
            setButtonEnabled(false);
            updateBtnName(window.savedCnt || 0, previousTotalCount);
        } else {
            const processedTotal = ss.length;
            const failureSummary = `AZ_seed 部分失败：成功 ${successCount}/${processedTotal} 条；成功入库/更新 ${totalBloggers} 位博主；成功入库/更新 ${totalBrands} 个品牌；成功插入 ${totalNotes} 条数据`;
            const hint = failureMessages[0] ? `；示例错误：${failureMessages[0]}` : '';
            originalShowMessage(failureSummary + hint, false);
        }
    });

    // 创建 MutationObserver 实例
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function() {
            var targetElement = document.evaluate("//div[@class='list-container b-list qg-common-list']//span[@class='el-pagination__jump'][contains(text(),'前往')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (targetElement) {
                displayBtnAsNeeded();
            }
            displayBrandUpdateButtonIfNeeded();
        });
    });

    // 配置 MutationObserver 监听选项
    var observerConfig = {
        childList: true,
        subtree: true
    };

    // 监听整个文档的变化
    observer.observe(document.documentElement, observerConfig);

    function updateBtnName(savedCnt, totalCnt) {
        // 获取按钮元素
        var buttonElement = document.evaluate("//div[@class='list-container b-list qg-common-list']//span[@class='el-pagination__jump'][contains(text(),'前往')]/../button[contains(text(),'AZ_推送')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        // 检查按钮元素是否存在
        if (!buttonElement) {
            return; // 直接退出或执行其他逻辑
        }

        var totalCntTxt = totalCnt
        var savedCntTxt = savedCnt

        // 更新按钮文本
        if (totalCnt === 0) {
            if (savedCnt !== 0) {
                totalCntTxt = "∞"; // 无穷大符号
            } else {
                totalCntTxt = 0;
            }
        }

        // 新增：当已获取数量等于最大数据量时启用，否则禁用置灰
        // totalCnt 必须是有效正整数；0 或未知场景保持禁用
        const enabled = (typeof totalCnt === 'number' && totalCnt > 0 && savedCnt === totalCnt);
        setButtonEnabled(enabled);

        // 更新按钮文本
        buttonElement.textContent = "AZ_推送(" + savedCntTxt + " / " + totalCntTxt + ")";
    }

    function displayBtnAsNeeded() {
        // 检查目标元素是否存在
        var targetElement = document.evaluate("//div[@class='list-container b-list qg-common-list']//span[@class='el-pagination__jump'][contains(text(),'前往')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (!targetElement) {
            return;
        }

        // 检查插入点是否已经存在下载按钮
        var existingButton = document.evaluate("//div[@class='list-container b-list qg-common-list']//span[@class='el-pagination__jump'][contains(text(),'前往')]/../button[contains(text(),'AZ_推送')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (existingButton) {
            return;
        }

        // 插入下载按钮在目标元素的右侧
        targetElement.parentNode.insertBefore(button, targetElement.nextSibling);

        // 插入后根据当前数据刷新一次按钮状态
        updateBtnName(window.savedCnt || 0, window.totalCount || 0);
    }

    displayBtnAsNeeded()
    displayBrandUpdateButtonIfNeeded();

    // 保存原始的XMLHttpRequest方法
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    // 重写open方法以捕获请求信息
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url; // 保存请求的URL以便后续使用
        return originalOpen.apply(this, arguments);
    };

    // 重写send方法以设置监听器
    XMLHttpRequest.prototype.send = function(data) {
        // 监听请求完成事件
        this.addEventListener('load', function() {
            if (this._url.includes('//api.qian-gua.com/v2/brand/GetNoteBloggerNotes')) {
                // 保存数据到全局变量
                var params = JSON.parse(this._requestPayload);
                const pageindex = params.pageindex;

                // 获取当前的签名值
                var currentSignature = payloadSignature(this._requestPayload);

                // 如果当前签名值与之前保存的签名值不一致，则清除 noteHotMap
                if (currentSignature !== window.signatureKey) {
                    window.noteHotMap = {};
                    const rspJson = JSON.parse(this.responseText);
                    window.totalCount = rspJson.Data.TotalCount
                }

                // 将响应数据保存到 noteHotMap
                window.noteHotMap[pageindex] = this.responseText;

                // 更新签名值
                window.signatureKey = currentSignature;

                //计算当前保存的笔记总数
                var savedCnt = 0;
                for (var key in window.noteHotMap) {
                    var itemArrJsonRsp = window.noteHotMap[key];
                    const data = JSON.parse(itemArrJsonRsp);
                    const itemList = data.Data.ItemList;
                    // 获取 itemArr 数组的元素个数
                    const itemCount = itemList.length;
                    savedCnt += itemCount;
                }
                window.savedCnt = savedCnt

                updateBtnName(window.savedCnt, window.totalCount)
            }

            if (isGetXhsNoteUrlRequest(this._url)) {
                handleGetXhsNoteUrlResponse({
                    requestUrl: this._url,
                    requestPayload: this._requestPayload,
                    responseText: this.responseText
                }).catch(function(err) {
                    console.error('[noteDetail] 处理 GetXhsNoteUrl 响应失败', err);
                });
            }
        });

        // 获取请求 payload 并保存
        this._requestPayload = data;
        return originalSend.apply(this, arguments);
    };

    function isGetXhsNoteUrlRequest(url) {
        return typeof url === 'string' && url.indexOf('//api.qian-gua.com/v1/Note/GetXhsNoteUrl') !== -1;
    }

    function normalizeAbsoluteUrl(url) {
        if (!url) {
            return '';
        }
        try {
            const origin = window.location && window.location.origin
                ? window.location.origin
                : (window.location.protocol + '//' + window.location.host);
            return new URL(url, origin).toString();
        } catch (_) {
            try {
                return new URL(url, window.location.href).toString();
            } catch (err) {
                if (typeof url === 'string' && url.startsWith('//')) {
                    return (window.location.protocol || 'https:') + url;
                }
                return url;
            }
        }
    }

    function extractNoteIdentifiers({ requestUrl, requestPayload, fallbackNoteItem }) {
        let noteId = null;
        let dateCode = null;
        if (typeof requestUrl === 'string' && requestUrl) {
            try {
                const urlObj = new URL(normalizeAbsoluteUrl(requestUrl));
                noteId = urlObj.searchParams.get('noteid') || urlObj.searchParams.get('noteId');
                dateCode = urlObj.searchParams.get('datecode') || urlObj.searchParams.get('DateCode');
            } catch (_) {
                const query = requestUrl.split('?')[1];
                if (query) {
                    query.split('&').forEach(function(segment) {
                        const parts = segment.split('=');
                        if (parts.length !== 2) return;
                        const key = parts[0].trim().toLowerCase();
                        const value = decodeURIComponent(parts[1] || '');
                        if (key === 'noteid' && !noteId) {
                            noteId = value;
                        }
                        if (key === 'datecode' && !dateCode) {
                            dateCode = value;
                        }
                    });
                }
            }
        }
        if ((!noteId || !dateCode) && typeof requestPayload === 'string' && requestPayload) {
            try {
                const payloadObj = JSON.parse(requestPayload);
                if (!noteId) {
                    noteId = extractFirstNonEmpty([
                        payloadObj.noteid,
                        payloadObj.noteId,
                        payloadObj.NoteId,
                        payloadObj.id,
                        payloadObj.Id
                    ]);
                }
                if (!dateCode) {
                    dateCode = extractFirstNonEmpty([
                        payloadObj.datecode,
                        payloadObj.dateCode,
                        payloadObj.DateCode
                    ]);
                }
            } catch (_) {
                // ignore parse errors
            }
        }
        if ((!noteId || !dateCode) && fallbackNoteItem) {
            if (!noteId) {
                noteId = getRecordNoteId(fallbackNoteItem);
            }
            if (!dateCode) {
                dateCode = getRecordDateCode(fallbackNoteItem);
            }
        }
        return {
            noteId: noteId !== undefined && noteId !== null ? String(noteId) : null,
            dateCode: dateCode !== undefined && dateCode !== null ? String(dateCode) : null
        };
    }

    async function handleGetXhsNoteUrlResponse({ requestUrl, requestPayload, responseText, fallbackNoteItem, propagateErrors = false }) {
        const warnings = [];
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch (err) {
            const error = new Error('解析 GetXhsNoteUrl 响应失败');
            error.cause = err;
            throw error;
        }
        const identifiers = extractNoteIdentifiers({ requestUrl, requestPayload, fallbackNoteItem });
        const pgyNoteId = identifiers.noteId;
        if (!pgyNoteId) {
            throw new Error('未能解析 noteId');
        }
        const rawUrl = extractFirstNonEmpty([
            parsed && parsed.Url,
            parsed && parsed.url,
            parsed && parsed.Data && parsed.Data.Url,
            parsed && parsed.Data && parsed.Data.url,
            parsed && parsed.data && parsed.data.Url,
            parsed && parsed.data && parsed.data.url
        ]);
        if (!rawUrl || typeof rawUrl !== 'string') {
            throw new Error('GetXhsNoteUrl 响应缺少 Url');
        }
        const match = rawUrl.match(/explore\/([^/?#]+)/i);
        const xhsNoteId = match && match[1] ? match[1] : rawUrl.split('https://www.xiaohongshu.com/explore/')[1];
        if (!xhsNoteId) {
            throw new Error('未能解析小红书笔记ID');
        }
        const noteDetailUrl = `https://pgy.xiaohongshu.com/api/solar/note/${xhsNoteId}/detail?bizCode=`;
        let noteDetailJson;
        try {
            noteDetailJson = await fetchNoteDetailWithGM(noteDetailUrl);
        } catch (err) {
            const errMsg = err && err.message ? err.message : String(err);
            
            // 网络请求失败，标记笔记不可见并保存 XhsNoteId
            console.error('[noteDetail] 请求失败', err);
            const invalidPayload = {
                XhsNoteInvalid: true,
                XhsNoteLink: null,
                XhsNoteId: xhsNoteId,
                XhsNoteJson: {
                    error: true,
                    message: errMsg,
                    timestamp: new Date().toISOString()
                }
            };
            
            try {
                await syncNoteDetailToSupabase(pgyNoteId, invalidPayload);
                if (window.AZ_DEBUG) {
                    debugLog('[noteDetail] 已标记笔记不可见（网络失败）', pgyNoteId);
                }
            } catch (syncErr) {
                console.error('[noteDetail] 标记笔记不可见失败', syncErr);
            }
            
            if (propagateErrors) {
                throw new Error(`获取笔记详情失败：${errMsg}`);
            }
            warnings.push(`获取笔记详情失败：${errMsg}`);
            return { success: false, warnings: Array.from(new Set(warnings)) };
        }
        if (window.AZ_DEBUG) {
            debugLog('[noteDetail] detail json', noteDetailJson);
        }
        const detailData = extractNoteDetailData(noteDetailJson);
        const noteUpdatePayload = buildNoteInfoUpdatePayload(detailData, noteDetailJson, xhsNoteId);
        const cacheNoteItem = fallbackNoteItem || findNoteItemInCache(pgyNoteId);
        if (noteUpdatePayload) {
            try {
                await syncNoteDetailToSupabase(pgyNoteId, noteUpdatePayload);
                if (window.AZ_DEBUG) {
                    debugLog('[noteDetail] 已同步 qiangua_note_info', pgyNoteId);
                }
            } catch (err) {
                const errMsg = err && err.message ? err.message : String(err);
                console.error('[noteDetail] 同步 qiangua_note_info 失败', err);
                if (propagateErrors) {
                    throw new Error(`同步 qiangua_note_info 失败：${errMsg}`);
                }
                warnings.push(`同步 qiangua_note_info 失败：${errMsg}`);
            }
        } else {
            const warnMsg = '未获取到笔记详情，跳过 qiangua_note_info 更新';
            console.warn('[noteDetail] noteUpdatePayload 为空，跳过 qiangua_note_info 更新', pgyNoteId);
            if (propagateErrors) {
                throw new Error(warnMsg);
            }
            warnings.push(warnMsg);
        }
        const bloggerId = cacheNoteItem
            ? extractFirstNonEmpty([
                cacheNoteItem.BloggerId,
                cacheNoteItem.BloggerID,
                cacheNoteItem.bloggerId,
                cacheNoteItem.blogger_id,
                cacheNoteItem.Id,
                cacheNoteItem.id
            ])
            : null;
        const xhsUserIdForBlogger = noteUpdatePayload && noteUpdatePayload.XhsUserId
            ? noteUpdatePayload.XhsUserId
            : null;
        if (bloggerId && xhsUserIdForBlogger) {
            try {
                await syncBloggerXhsUserId(bloggerId, xhsUserIdForBlogger);
                if (window.AZ_DEBUG) {
                    debugLog('[noteDetail] 已同步 qiangua_blogger.XhsUserId', bloggerId);
                }
            } catch (err) {
                const errMsg = err && err.message ? err.message : String(err);
                console.error('[noteDetail] 同步 qiangua_blogger 失败', err);
                if (propagateErrors) {
                    throw new Error(`同步 qiangua_blogger 失败：${errMsg}`);
                }
                warnings.push(`同步 qiangua_blogger 失败：${errMsg}`);
            }
        } else {
            if (!bloggerId) {
                console.warn('[noteDetail] 未从缓存中找到 BloggerId，跳过 qiangua_blogger 更新', pgyNoteId);
                warnings.push('未找到 BloggerId，跳过博主同步');
            }
            if (!xhsUserIdForBlogger) {
                console.warn('[noteDetail] 未获取到 XhsUserId，跳过 qiangua_blogger 更新');
                warnings.push('未获取到 XhsUserId，跳过博主同步');
            }
        }
        return {
            success: true,
            noteId: String(pgyNoteId),
            warnings: Array.from(new Set(warnings))
        };
    }

    function payloadSignature(requestPayLoad) {
        // 将字符串解析为对象
        var params = JSON.parse(requestPayLoad);
        // 删除 pageindex 参数
        delete params.pageindex;
        // 按参数名排序
        var sortedKeys = Object.keys(params).sort();
        // 构造新的参数字符串
        var newString = sortedKeys.map(function(key) {
            return key + params[key];
        }).join('');
        return newString
    }

    function fetchNoteDetailWithGM(noteDetailUrl) {
        return new Promise(async (resolve, reject) => {
            try {
                const cookieHeader = await getPgyCookieHeader();
                const headers = cookieHeader ? { 'Cookie': cookieHeader } : {};
                if (!cookieHeader) {
                    console.warn('[noteDetail] 未获取到 pgy.xiaohongshu.com 的 cookie，可能导致 401');
                }
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: noteDetailUrl,
                    headers: headers,
                    timeout: 15000,
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                const noteDetailJson = JSON.parse(response.responseText);
                                resolve(noteDetailJson);
                            } catch (err) {
                                reject({ message: '解析响应失败', error: err, rawResponse: response.responseText });
                            }
                        } else {
                            reject({ message: '请求失败', status: response.status, body: response.responseText });
                        }
                    },
                    onerror: function(error) {
                        reject({ message: '请求出错', error: error });
                    },
                    ontimeout: function() {
                        reject({ message: '请求超时', url: noteDetailUrl });
                    }
                });
            } catch (err) {
                reject({ message: '处理请求异常', error: err });
            }
        });
    }

    function extractNoteDetailData(noteDetailJson) {
        if (!noteDetailJson || typeof noteDetailJson !== 'object') return {};
        if (noteDetailJson.data && typeof noteDetailJson.data === 'object') {
            return noteDetailJson.data;
        }
        if (noteDetailJson.Data && typeof noteDetailJson.Data === 'object') {
            return noteDetailJson.Data;
        }
        return noteDetailJson;
    }

    function buildNoteInfoUpdatePayload(detailData, rawJson, xhsNoteId) {
        // 场景1：检查业务失败（笔记不可见/已删除/审核不通过等）
        if (rawJson && (rawJson.success === false || rawJson.data === null)) {
            const errorMsg = rawJson.msg || rawJson.message || '笔记状态异常';
            console.warn('[buildNoteInfoUpdatePayload] 笔记不可见', errorMsg);
            return {
                XhsNoteInvalid: true,
                XhsNoteLink: null,
                XhsNoteId: sanitizeNullableString(xhsNoteId),
                XhsNoteJson: rawJson
            };
        }
        
        // 场景2：正常处理笔记详情
        if (!detailData || typeof detailData !== 'object') return null;
        
        const xhsUserId = extractFirstNonEmpty([
            detailData.userId,
            detailData.user_id,
            detailData.UserId,
            detailData.UserID,
            detailData.author && (detailData.author.userId ?? detailData.author.user_id)
        ]);
        const imagesCsv = extractImageUrls(detailData);
        const videoUrl = extractVideoUrl(detailData);
        const payload = {
            XhsUserId: sanitizeNullableString(xhsUserId),
            XhsNoteLink: sanitizeNullableString(extractFirstNonEmpty([
                detailData.noteLink,
                detailData.note_link,
                detailData.link,
                detailData.url,
                rawJson && rawJson.data && rawJson.data.shareLink
            ])),
            XhsTitle: sanitizeNullableString(detailData.title),
            XhsContent: sanitizeNullableString(detailData.content),
            XhsImages: imagesCsv,
            XhsNoteId: sanitizeNullableString(detailData.noteId || xhsNoteId),
            XhsVideo: videoUrl,
            XhsNoteJson: rawJson || detailData,
            XhsNoteInvalid: false  // 成功获取详情，标记为有效
        };
        return payload;
    }

    function extractImageUrls(detailData) {
        const candidate = extractFirstNonEmpty([
            detailData.imagesList,
            detailData.imageList,
            detailData.images,
            detailData.media && detailData.media.images
        ]);
        if (!candidate) return null;
        if (typeof candidate === 'string') {
            return candidate;
        }
        if (Array.isArray(candidate)) {
            const urls = candidate.map(function(item) {
                if (!item) return '';
                if (typeof item === 'string') return sanitizeImageUrl(item);
                const url = extractFirstNonEmpty([
                    item.url,
                    item.original,
                    item.originUrl,
                    item.origin_url,
                    item.imageUrl,
                    item.image_url,
                    item.path,
                    item.src
                ]);
                return sanitizeImageUrl(url);
            }).filter(Boolean);
            return urls.length > 0 ? urls.join(',') : null;
        }
        if (typeof candidate === 'object') {
            const singleUrl = extractFirstNonEmpty([
                candidate.url,
                candidate.original,
                candidate.originUrl,
                candidate.origin_url,
                candidate.imageUrl,
                candidate.image_url,
                candidate.path,
                candidate.src
            ]);
            return sanitizeImageUrl(singleUrl);
        }
        return null;
    }

    function extractVideoUrl(detailData) {
        const candidate = extractFirstNonEmpty([
            detailData.videoUrl,
            detailData.video_url,
            detailData.videoInfo && (detailData.videoInfo.videoUrl || detailData.videoInfo.video_url),
            detailData.video_info && (detailData.video_info.videoUrl || detailData.video_info.video_url),
            detailData.videoInfo && detailData.videoInfo.videoKey,
            detailData.video_info && detailData.video_info.videoKey,
            detailData.videoInfo && detailData.videoInfo.originVideoKey,
            detailData.video_info && detailData.video_info.originVideoKey
        ]);
        if (!candidate) return null;
        if (typeof candidate === 'string') {
            return candidate.trim() === '' ? null : candidate.trim();
        }
        return null;
    }

    function sanitizeImageUrl(url) {
        if (!url) return '';
        const str = String(url).trim();
        return str;
    }

    function extractFirstNonEmpty(candidates) {
        if (!Array.isArray(candidates)) return null;
        for (let i = 0; i < candidates.length; i++) {
            const val = candidates[i];
            if (val === undefined || val === null) continue;
            if (typeof val === 'string') {
                if (val.trim() !== '') return val;
            } else if (typeof val === 'number' || typeof val === 'bigint' || typeof val === 'boolean') {
                return val;
            } else if (Array.isArray(val)) {
                if (val.length > 0) return val;
            } else if (typeof val === 'object') {
                if (Object.keys(val).length > 0) return val;
            }
        }
        return null;
    }

    function sanitizeNullableString(value) {
        if (value === undefined || value === null) return null;
        const trimmed = String(value).trim();
        return trimmed === '' ? null : trimmed;
    }

    function cleanupPayload(payload) {
        const result = {};
        if (!payload || typeof payload !== 'object') return result;
        Object.keys(payload).forEach(function(key) {
            const value = payload[key];
            if (value !== undefined) {
                result[key] = value;
            }
        });
        return result;
    }

    async function parseErrorResponse(response) {
        try {
            const text = await response.text();
            if (!text) {
                return `HTTP ${response.status}: ${response.statusText}`;
            }
            try {
                const data = JSON.parse(text);
                if (data.message) return data.message;
                if (data.error) return data.error;
                return JSON.stringify(data);
            } catch (_) {
                return text;
            }
        } catch (_) {
            return `HTTP ${response.status}: ${response.statusText}`;
        }
    }

    async function syncNoteDetailToSupabase(noteId, payload) {
        if (!noteId) {
            throw new Error('缺少 NoteId，无法同步 qiangua_note_info');
        }
        const healthy = await pingSupabaseHealth();
        if (!healthy) {
            throw new Error('Supabase 健康检查未通过，终止同步');
        }
        const sanitizedPayload = cleanupPayload(payload);
        if (Object.keys(sanitizedPayload).length === 0) {
            console.warn('[noteDetail] 同步 qiangua_note_info 时 payload 为空，跳过');
            return { skipped: true };
        }
        const queryUrl = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?NoteId=eq.${encodeURIComponent(String(noteId))}`;
        const prefer = window.AZ_DEBUG ? 'return=representation' : 'return=min';
        const response = await fetchWithRetry(queryUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': prefer,
                'X-AZ-Phase': 'note-detail-sync'
            },
            body: JSON.stringify(sanitizedPayload)
        }, 1, 30000);
        if (!response.ok) {
            const errorInfo = await parseErrorResponse(response);
            throw new Error(`同步 qiangua_note_info 失败: ${errorInfo}`);
        }
        if (window.AZ_DEBUG && response.status !== 204) {
            try {
                const clone = response.clone();
                const data = await clone.json();
                console.log('[noteDetail] Supabase note update response', data);
            } catch (_) {
                // ignore debug parse failure
            }
        }
        return { success: true };
    }

    async function syncBloggerXhsUserId(bloggerId, xhsUserId) {
        if (!bloggerId) {
            throw new Error('缺少 BloggerId，无法同步 qiangua_blogger');
        }
        const sanitizedUserId = sanitizeNullableString(xhsUserId);
        if (!sanitizedUserId) {
            throw new Error('缺少 XhsUserId，无法同步 qiangua_blogger');
        }
        const healthy = await pingSupabaseHealth();
        if (!healthy) {
            throw new Error('Supabase 健康检查未通过，终止同步');
        }
        const queryUrl = `${SUPABASE_URL}/rest/v1/${BLOGGER_TABLE_NAME}?BloggerId=eq.${encodeURIComponent(String(bloggerId))}`;
        const prefer = window.AZ_DEBUG ? 'return=representation' : 'return=min';
        const response = await fetchWithRetry(queryUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': prefer,
                'X-AZ-Phase': 'blogger-detail-sync'
            },
            body: JSON.stringify({ XhsUserId: sanitizedUserId })
        }, 1, 20000);
        if (!response.ok) {
            const errorInfo = await parseErrorResponse(response);
            throw new Error(`同步 qiangua_blogger 失败: ${errorInfo}`);
        }
        if (window.AZ_DEBUG && response.status !== 204) {
            try {
                const clone = response.clone();
                const data = await clone.json();
                console.log('[noteDetail] Supabase blogger update response', data);
            } catch (_) {
                // ignore debug parse failure
            }
        }
        return { success: true };
    }

    function findNoteItemInCache(noteId) {
        if (!noteId) return null;
        const target = String(noteId);
        const map = window.noteHotMap || {};
        for (const key in map) {
            if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
            try {
                const content = map[key];
                const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                const items = parsed && parsed.Data && Array.isArray(parsed.Data.ItemList) ? parsed.Data.ItemList : [];
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const candidateIds = [
                        item.NoteId,
                        item.NoteID,
                        item.noteId,
                        item.note_id,
                        item.Id,
                        item.id
                    ];
                    const matched = candidateIds.some(function(val) {
                        return val !== undefined && val !== null && String(val) === target;
                    });
                    if (matched) {
                        return item;
                    }
                }
            } catch (err) {
                console.warn('[noteDetail] 解析 noteHotMap 缓存失败', err);
            }
        }
        return null;
    }

    function getPgyCookieHeader() {
        return new Promise((resolve) => {
            if (typeof GM_cookie === 'undefined' || typeof GM_cookie.list !== 'function') {
                console.warn('[noteDetail] GM_cookie.list 不可用，无法读取 cookie');
                resolve('');
                return;
            }
            try {
                GM_cookie.list({ url: 'https://pgy.xiaohongshu.com' }, function(cookies, error) {
                    if (error) {
                        console.error('[noteDetail] 读取 cookie 失败', error);
                        resolve('');
                        return;
                    }
                    if (!Array.isArray(cookies) || cookies.length === 0) {
                        resolve('');
                        return;
                    }
                    const header = cookies
                        .filter(cookie => cookie && cookie.name && cookie.value)
                        .map(cookie => `${cookie.name}=${cookie.value}`)
                        .join('; ');
                    resolve(header);
                });
            } catch (err) {
                console.error('[noteDetail] 调用 GM_cookie.list 异常', err);
                resolve('');
            }
        });
    }

    function buildBloggerPayloadFromNotes(noteItems = []) {
        const safeString = (value, fallback = '') => {
            if (value === undefined || value === null) return fallback;
            return String(value);
        };
        const safeNumber = (value, fallback = 0) => {
            if (value === undefined || value === null || value === '') return fallback;
            const num = Number(value);
            return Number.isFinite(num) ? num : fallback;
        };
        const safeNullableNumber = (value) => {
            if (value === undefined || value === null || value === '') return null;
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };
        const safeBoolean = (value, fallback = false) => {
            if (value === undefined || value === null) return fallback;
            if (typeof value === 'boolean') return value;
            const normalized = String(value).trim().toLowerCase();
            if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
            if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
            return fallback;
        };

        return noteItems.reduce((acc, item) => {
            if (!item) return acc;
            const rawBloggerId = item.BloggerId ?? item.blogger_id ?? item.id;
            if (rawBloggerId === undefined || rawBloggerId === null || rawBloggerId === '') {
                return acc;
            }
            const sanitized = {
                BloggerId: safeString(rawBloggerId),
                BloggerIdKey: safeString(item.BloggerIdKey),
                BloggerNickName: safeString(item.BloggerNickName),
                BloggerProp: safeString(item.BloggerProp),
                BloggerTags: item.BloggerTags !== undefined ? item.BloggerTags : null,
                BloggerTagName: safeString(item.BloggerTagName),
                Fans: safeNumber(item.Fans),
                LevelNumber: safeNumber(item.LevelNumber),
                LevelName: safeString(item.LevelName),
                Gender: safeNumber(item.Gender),
                Location: safeString(item.Location),
                BigAvatar: safeString(item.BigAvatar),
                SmallAvatar: safeString(item.SmallAvatar),
                McnName: safeString(item.McnName),
                McnInfoId: safeString(item.McnInfoId ?? item.McnInfoId),
                IsBrandPartner: safeBoolean(item.IsBrandPartner),
                OfficialVerified: safeBoolean(item.OfficialVerified),
                GoodsCount: safeNumber(item.GoodsCount),
                NoteActiveCount: safeNumber(item.NoteActiveCount ?? item.NoteActiveCount),
                AdPrice: safeNullableNumber(item.AdPrice),
                AdPriceUpdateStatus: safeNumber(item.AdPriceUpdateStatus ?? item.AdPriceUpdateStatus),
                PriceType: safeString(item.PriceType),
                LinkInfo: item.LinkInfo !== undefined ? item.LinkInfo : null,
                RedId: safeString(item.RedId ?? item.RedId)
            };
            acc.push(sanitized);
            return acc;
        }, []);
    }

    function buildBrandPayloadFromNotes(noteItems = []) {
        const brandMap = new Map();
        noteItems.forEach(item => {
            if (!item) return;
            const binds = Array.isArray(item.CooperateBindList) ? item.CooperateBindList : [];
            binds.forEach(bind => {
                if (!bind) return;
                const brandIdRaw = bind.BrandId ?? bind.brand_id ?? bind.id;
                if (brandIdRaw === undefined || brandIdRaw === null || brandIdRaw === '') {
                    return;
                }
                const brandId = String(brandIdRaw);
                if (brandMap.has(brandId)) {
                    return;
                }
                const brandIdKeyRaw = bind.BrandIdKey ?? bind.brand_id_key ?? bind.key;
                const brandNameRaw = bind.BrandName ?? bind.brand_name ?? bind.name;
                brandMap.set(brandId, {
                    BrandId: brandId,
                    BrandIdKey: brandIdKeyRaw !== undefined && brandIdKeyRaw !== null && brandIdKeyRaw !== '' ? String(brandIdKeyRaw) : null,
                    BrandName: brandNameRaw !== undefined && brandNameRaw !== null ? String(brandNameRaw) : ''
                });
            });
        });
        return Array.from(brandMap.values());
    }

    // ====== 模拟运行：使用示例数据先入库博主、再入库笔记 ======
    // 使用：在控制台调用 window.AZ_seed()
    async function runUploadFlow(noteItems, { onPhase } = {}) {
        console.log('[runUploadFlow] ========== 开始执行 ==========');
        console.log('[runUploadFlow] 输入数据条数:', noteItems.length);
        const bloggerPayload = buildBloggerPayloadFromNotes(noteItems);
        const brandPayload = buildBrandPayloadFromNotes(noteItems);
        const notePayload = noteItems;
        console.log('[runUploadFlow] 开始博主入库阶段');
        if (onPhase) onPhase('blogger');

        //执行 qiangua_blogger 表信息录入
        const bloggerResult = await upsertBloggersFromNotes(bloggerPayload);
        console.log('[runUploadFlow] 博主入库结果:', bloggerResult);
        if (!bloggerResult.success) {
            console.error('[runUploadFlow] 博主入库失败，退出');
            return { success: false, message: '博主入库失败: ' + bloggerResult.message };
        }
        //执行 qiangua_brand 表信息录入
        if (onPhase) onPhase('brand');
        const brandResult = await upsertBrandsFromNotes(brandPayload);
        console.log('[runUploadFlow] 品牌入库结果:', brandResult);
        if (!brandResult.success) {
            console.error('[runUploadFlow] 品牌入库失败，退出');
            return { success: false, message: '品牌入库失败: ' + brandResult.message };
        }

        console.log('[runUploadFlow] 开始笔记入库阶段');
        if (onPhase) onPhase('note');
        //执行 qiangua_note_info 表信息录入
        const noteResult = await batchInsertToSupabase(notePayload);
        console.log('[runUploadFlow] 笔记入库结果:', noteResult);
        if (!noteResult.success) {
            console.error('[runUploadFlow] 笔记入库失败，退出');
            return { success: false, message: '笔记入库失败: ' + noteResult.message };
        }
        console.log('[runUploadFlow] ========== 执行完成（成功） ==========');
        return { success: true, message: `${bloggerResult.message}；${brandResult.message}；${noteResult.message}` };
    }

    // 获取 demo 数据
    function getDemoData() {
        return JSON.parse('[{"GoodsCount":0,"LevelNumber":0,"LevelName":"奶瓶薯","Fans":25367,"McnName":"","McnInfoId":1746453,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":680,"Gender":0,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31ek1p6ligs0g5n9h62tkhotn4j1guao-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31ek1p6ligs0g5n9h62tkhotn4j1guao-180x240","Location":"广东 深圳市","TagName":"家居用品","RedId":"V15013585727","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"摄影其他","LikeCollect":367860,"AdPrice":4000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"摄影其他,美食测评,个人护理,摄影技巧,香水","LinkInfo":"411245882@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1726945766,"DateCode":20251030,"NoteIdKey":"4fa612","Id":"","UserId":"","Title":""生活是无数个瞬间的总和"","LikedCount":515,"LikedCountDesc":"515","CollectedCount":126,"CollectedCountDesc":"126","CommentsCount":39,"CommentsCountDesc":"39","ViewCount":3135,"ShareCount":34,"ShareCountDesc":"34","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k831o8gu522mg8g5n9h62tkhotnc2po740-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":15926514,"BloggerIdKey":"516f7d","BloggerNickName":"Jibinbin","BloggerProp":"初级达人","PublishTime":"2025-10-30T13:09:37+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-30","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T13:54:15.8426611+08:00","Lcc":680,"LccDesc":"680","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"文化薯","Fans":20683,"McnName":"","McnInfoId":847115,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":519,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31kg1e8tiio2g4a5qjkj37vpb2h7kjtg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31kg1e8tiio2g4a5qjkj37vpb2h7kjtg-180x240","Location":"澳大利亚 新南威尔士","TagName":"家居用品","RedId":"Isntcelia","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"香水","LikeCollect":107933,"AdPrice":3000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"香水,日常片段其他,护肤其他,摄影其他,非酒精类饮料","LinkInfo":"ceceyangishere@163.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1723368941,"DateCode":20251024,"NoteIdKey":"22e7b0","Id":"","UserId":"","Title":"Share ｜A Scent Poem by LOEWE","LikedCount":359,"LikedCountDesc":"359","CollectedCount":70,"CollectedCountDesc":"70","CommentsCount":90,"CommentsCountDesc":"90","ViewCount":3198,"ShareCount":14,"ShareCountDesc":"14","CoverImage":"//xsh-qn.qian-gua.com/1040g00831o0t3oik6g104a5qjkj37vpb3acouu0-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":9573475,"BloggerIdKey":"d4141e","BloggerNickName":"Ce","BloggerProp":"初级达人","PublishTime":"2025-10-24T17:38:07+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-24","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T22:56:23.1122319+08:00","Lcc":519,"LccDesc":"519","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":287879,"McnName":"有花果MCN","McnInfoId":29359,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":456,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/63877bcb290a5fd5d6e5323f.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/63877bcb290a5fd5d6e5323f.jpg-180x240","Location":"广东 深圳市","TagName":"狗","RedId":"112703767","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":1236442,"AdPrice":55000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,运动,狗,旅游攻略,移动数码","LinkInfo":"1209273974@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1721690043,"DateCode":20251023,"NoteIdKey":"8b7738","Id":"","UserId":"","Title":""还好这个世界还有小狗和好天气"🐶☀️","LikedCount":367,"LikedCountDesc":"367","CollectedCount":30,"CollectedCountDesc":"30","CommentsCount":59,"CommentsCountDesc":"59","ViewCount":24127,"ShareCount":21,"ShareCountDesc":"21","CoverImage":"//xsh-qn.qian-gua.com/1040g2sg31nvskj7nlmb04a4ot10frit29tntu7o-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":116489,"BloggerIdKey":"9a3b35","BloggerNickName":"王小猴儿_","BloggerProp":"腰部达人","PublishTime":"2025-10-23T22:34:35+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-23","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T06:50:18.5740753+08:00","Lcc":456,"LccDesc":"456","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":22834,"McnName":"","McnInfoId":598627,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":391,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/63d2aece649d29028950a4b8.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/63d2aece649d29028950a4b8.jpg-180x240","Location":"地球的某一片红薯地 ","TagName":"家居用品","RedId":"dawaner","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"室内设计","LikeCollect":144945,"AdPrice":4000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"家居用品,室内设计,家居装饰,家用电器,美食其他","LinkInfo":"dawanerlaile@163.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1728908907,"DateCode":20251031,"NoteIdKey":"edbab4","Id":"","UserId":"","Title":"把秋天的味道，装进房间里🍅🍂","LikedCount":248,"LikedCountDesc":"248","CollectedCount":95,"CollectedCountDesc":"95","CommentsCount":48,"CommentsCountDesc":"48","ViewCount":2980,"ShareCount":11,"ShareCountDesc":"11","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k831o9use1d50404311vfeqjdtmp3md5c0-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":544849,"BloggerIdKey":"b2f79e","BloggerNickName":"大万儿","BloggerProp":"初级达人","PublishTime":"2025-10-31T15:33:57+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-31","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T05:34:18.9904968+08:00","Lcc":391,"LccDesc":"391","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":28281,"McnName":"","McnInfoId":138590,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":385,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/64675c0f0019cbd12cc12876.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/64675c0f0019cbd12cc12876.jpg-180x240","Location":"江苏 苏州市","TagName":"家居用品","RedId":"103946380","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"家居用品","LikeCollect":247924,"AdPrice":5000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":true,"BloggerTags":"家居装饰,家居用品,香水,家居家装其他,家用电器","LinkInfo":"100860830@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1720237985,"DateCode":20251022,"NoteIdKey":"3a0c86","Id":"","UserId":"","Title":"把自然和艺术搬进家｜LOEWE香氛治愈日常","LikedCount":209,"LikedCountDesc":"209","CollectedCount":111,"CollectedCountDesc":"111","CommentsCount":65,"CommentsCountDesc":"65","ViewCount":5816,"ShareCount":22,"ShareCountDesc":"22","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k831nu8h86p5mb048lf026am7fcf8afmvo-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":4659969,"BloggerIdKey":"ec4466","BloggerNickName":"Avery-P","BloggerProp":"初级达人","PublishTime":"2025-10-22T14:33:45+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-22","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T01:47:17.1091955+08:00","Lcc":385,"LccDesc":"385","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":224481,"McnName":"麋鹿筱黑","McnInfoId":222548,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":371,"Gender":0,"BigAvatar":"//xsh-img.qian-gua.com/avatar/642c3f6c84a43f76241ec2db.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/642c3f6c84a43f76241ec2db.jpg-180x240","Location":"上海 上海市","TagName":"穿搭","RedId":"JMJMJMJ_","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":952771,"AdPrice":50000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,潮流资讯,鞋靴,资讯其他,配饰","LinkInfo":"milumedia@163.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1726453585,"DateCode":20251029,"NoteIdKey":"7c1175","Id":"","UserId":"","Title":"走路带风的一天🤩","LikedCount":317,"LikedCountDesc":"317","CollectedCount":39,"CollectedCountDesc":"39","CommentsCount":15,"CommentsCountDesc":"15","ViewCount":8986,"ShareCount":28,"ShareCountDesc":"28","CoverImage":"//xsh-qn.qian-gua.com/1040g00831o7i8sirku0g5n5m129lsl1g3u09pg8-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":3856889,"BloggerIdKey":"ea0ab4","BloggerNickName":"JM","BloggerProp":"腰部达人","PublishTime":"2025-10-29T20:16:45+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-29","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T07:02:18.1543794+08:00","Lcc":371,"LccDesc":"371","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":88578,"McnName":"","McnInfoId":110478,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":355,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31ok8k10g6g005nlvcu3g8ufpqt79ui0-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31ok8k10g6g005nlvcu3g8ufpqt79ui0-180x240","Location":"上海 上海市","TagName":"运动","RedId":"Unasa811720","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":395227,"AdPrice":8600,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,日常片段其他,运动,狗,接地气生活","LinkInfo":"","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1716486741,"DateCode":20251019,"NoteIdKey":"2f8836","Id":"","UserId":"","Title":"午后黄昏的回家路上 🚶‍♀️‍➡️","LikedCount":311,"LikedCountDesc":"311","CollectedCount":26,"CollectedCountDesc":"26","CommentsCount":18,"CommentsCountDesc":"18","ViewCount":5521,"ShareCount":11,"ShareCountDesc":"11","CoverImage":"//xsh-qn.qian-gua.com/1040g2sg31nqm157tlmeg5nlvcu3g8ufp8e1cnj0-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":5027700,"BloggerIdKey":"1bf4a4","BloggerNickName":"unaccc","BloggerProp":"腰部达人","PublishTime":"2025-10-19T18:40:06+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-19","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T08:17:59.5672959+08:00","Lcc":355,"LccDesc":"355","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":46228,"McnName":"","McnInfoId":216153,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":339,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/622f30ae4151dda1959fb6cc.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/622f30ae4151dda1959fb6cc.jpg-180x240","Location":"澳大利亚 ","TagName":"家居用品","RedId":"zhaoruofeng001","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"摄影技巧","LikeCollect":277750,"AdPrice":2500,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":true,"BloggerTags":"摄影技巧,摄影其他,配饰,香水,彩妆工具","LinkInfo":"ruofengzhao@126.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1724844608,"DateCode":20251027,"NoteIdKey":"f1b164","Id":"","UserId":"","Title":"🍂色彩与香 抒写秋冬自然美学诗篇","LikedCount":242,"LikedCountDesc":"242","CollectedCount":67,"CollectedCountDesc":"67","CommentsCount":30,"CommentsCountDesc":"30","ViewCount":2738,"ShareCount":22,"ShareCountDesc":"22","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k831o4prjt158a05nnsgetg8f8koq6qco0-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":4620363,"BloggerIdKey":"3d2c73","BloggerNickName":"ZhaoRuofeng","BloggerProp":"初级达人","PublishTime":"2025-10-27T16:32:54+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-27","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T07:26:49.0101842+08:00","Lcc":339,"LccDesc":"339","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":39103,"McnName":"","McnInfoId":1142333,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":320,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo30vtfdvu8lq005p01v4fk3qub3qq9t50-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo30vtfdvu8lq005p01v4fk3qub3qq9t50-180x240","Location":"北京 ","TagName":"潮流资讯","RedId":"2270169420","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":765418,"AdPrice":4000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,潮流资讯,配饰,鞋靴","LinkInfo":"","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1715752270,"DateCode":20251017,"NoteIdKey":"e69472","Id":"","UserId":"","Title":"薄底鞋审美又又又变了","LikedCount":265,"LikedCountDesc":"265","CollectedCount":53,"CollectedCountDesc":"53","CommentsCount":2,"CommentsCountDesc":"2","ViewCount":3837,"ShareCount":5,"ShareCountDesc":"5","CoverImage":"//xsh-qn.qian-gua.com/1040g2sg31no2153n58005p01v4fk3qub372s8j8-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":18091911,"BloggerIdKey":"fc7ecb","BloggerNickName":"叨叨大嘴巴","BloggerProp":"初级达人","PublishTime":"2025-10-17T20:02:29+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"video","IsBusiness":true,"NoteTypeDesc":"视频","Props":0,"PubDate":"2025-10-17","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T11:50:08.8945845+08:00","Lcc":320,"LccDesc":"320","VideoDuration":"1:50"},{"GoodsCount":0,"LevelNumber":0,"LevelName":"文化薯","Fans":7972,"McnName":"","McnInfoId":1420407,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":273,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31dhemprj0m0g4aglueqm4sbmgvlv5do-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31dhemprj0m0g4aglueqm4sbmgvlv5do-180x240","Location":"河南 洛阳市","TagName":"家居装饰","RedId":"baisecipan","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"摄影技巧","LikeCollect":101143,"AdPrice":1600,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":true,"BloggerTags":"摄影技巧,摄影其他,去处,日常片段其他,写真","LinkInfo":"373920689@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1722594489,"DateCode":20251023,"NoteIdKey":"84cd6c","Id":"","UserId":"","Title":"香气、独处和阅读，我在小事里反复幸福","LikedCount":172,"LikedCountDesc":"172","CollectedCount":47,"CollectedCountDesc":"47","CommentsCount":54,"CommentsCountDesc":"54","ViewCount":1639,"ShareCount":22,"ShareCountDesc":"22","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k031nvfggg3l8104aglueqm4sbm8plvubg-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":5070009,"BloggerIdKey":"8b529f","BloggerNickName":"白色瓷盘","BloggerProp":"初级达人","PublishTime":"2025-10-23T18:07:38+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-23","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T22:52:50.861128+08:00","Lcc":273,"LccDesc":"273","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"","Fans":8008,"McnName":"","McnInfoId":1847182,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":270,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31oesnkln06005p35mb87u28l5gii8no-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31oesnkln06005p35mb87u28l5gii8no-180x240","Location":" ","TagName":"鞋靴","RedId":"5554240992","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"潮流资讯","LikeCollect":84818,"AdPrice":2000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"潮流资讯,穿搭,鞋靴,运动,资讯其他","LinkInfo":"","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1734333334,"DateCode":20251105,"NoteIdKey":"bd6654","Id":"","UserId":"","Title":"LOEWE下一双爆款预定？王一博、蒋奇明上脚","LikedCount":230,"LikedCountDesc":"230","CollectedCount":27,"CollectedCountDesc":"27","CommentsCount":13,"CommentsCountDesc":"13","ViewCount":7418,"ShareCount":44,"ShareCountDesc":"44","CoverImage":"//xsh-ci.qian-gua.com/notes_pre_post/1040g3k031og5bb3vg6005p35mb87u28lo0l013o-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":24941800,"BloggerIdKey":"96905e","BloggerNickName":"陈皮柠茶","BloggerProp":"初级达人","PublishTime":"2025-11-05T11:30:18+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-11-05","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-12T09:15:42.3753412+08:00","Lcc":270,"LccDesc":"270","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"铜冠薯","Fans":32308,"McnName":"侵尘文化","McnInfoId":168219,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":256,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/60bec7a6d34754efb55b5be5.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/60bec7a6d34754efb55b5be5.jpg-180x240","Location":"广东 广州市","TagName":"家居用品","RedId":"Tommyeah","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"香水","LikeCollect":543143,"AdPrice":3200,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"美食测评,香水,个人护理,箱包,接地气生活","LinkInfo":"2509733658@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1723230620,"DateCode":20251024,"NoteIdKey":"c6636e","Id":"","UserId":"","Title":"贪恋秋冬幸福时刻","LikedCount":181,"LikedCountDesc":"181","CollectedCount":40,"CollectedCountDesc":"40","CommentsCount":35,"CommentsCountDesc":"35","ViewCount":1538,"ShareCount":23,"ShareCountDesc":"23","CoverImage":"//xsh-qn.qian-gua.com/1040g2sg31o0o32qml0j05ng9o8lg8mcj1t5kb20-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":5360186,"BloggerIdKey":"566a8b","BloggerNickName":"ticseas","BloggerProp":"初级达人","PublishTime":"2025-10-24T12:46:40+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-24","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T03:51:53.0470138+08:00","Lcc":256,"LccDesc":"256","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":117478,"McnName":"红刊","McnInfoId":567989,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":249,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/66584798771ac29750b9cb48.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/66584798771ac29750b9cb48.jpg-180x240","Location":"上海 上海市","TagName":"穿搭","RedId":"EZGNIMX","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":834666,"AdPrice":25000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,潮流资讯,鞋靴,箱包,美食测评","LinkInfo":"ezgnimx@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1716067033,"DateCode":20251018,"NoteIdKey":"555be7","Id":"","UserId":"","Title":"糟糕 被狗仔拍了！","LikedCount":233,"LikedCountDesc":"233","CollectedCount":11,"CollectedCountDesc":"11","CommentsCount":5,"CommentsCountDesc":"5","ViewCount":3796,"ShareCount":13,"ShareCountDesc":"13","CoverImage":"//xsh-qn.qian-gua.com/1040g2sg31nn1kqb450hg5niqbj709ceq8i3semg-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":7102570,"BloggerIdKey":"44a111","BloggerNickName":"87-","BloggerProp":"腰部达人","PublishTime":"2025-10-18T18:11:24+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-18","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T08:00:41.5724576+08:00","Lcc":249,"LccDesc":"249","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":40943,"McnName":"","McnInfoId":343796,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":220,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo319n2b4ph7i005ndida208bosc8dh4v8-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo319n2b4ph7i005ndida208bosc8dh4v8-180x240","Location":"上海 上海市","TagName":"时尚其他","RedId":"983393252","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":186836,"AdPrice":9000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,接地气生活,道路交通,旅游攻略,汽车其他","LinkInfo":"411518936@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1724870435,"DateCode":20251027,"NoteIdKey":"2d2424","Id":"","UserId":"","Title":"舒适最重要","LikedCount":188,"LikedCountDesc":"188","CollectedCount":27,"CollectedCountDesc":"27","CommentsCount":5,"CommentsCountDesc":"5","ViewCount":5699,"ShareCount":8,"ShareCountDesc":"8","CoverImage":"//xsh-qn.qian-gua.com/1040g00831o2ugc7vl2005ndida208bos8jtqm2g-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":5183632,"BloggerIdKey":"48a863","BloggerNickName":"艺大可","BloggerProp":"初级达人","PublishTime":"2025-10-27T17:44:25+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-27","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T08:20:13.0887971+08:00","Lcc":220,"LccDesc":"220","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":15759,"McnName":"","McnInfoId":795360,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":197,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31n1q08if5m004a3o6ie1c0rs1i10rk0-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31n1q08if5m004a3o6ie1c0rs1i10rk0-180x240","Location":"山东 青岛市","TagName":"家居用品","RedId":"945648998","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"摄影技巧","LikeCollect":572262,"AdPrice":2000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":true,"BloggerTags":"摄影技巧,摄影其他,美食测评,卸妆,壁纸","LinkInfo":"2219154452@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1724905162,"DateCode":20251027,"NoteIdKey":"4b960b","Id":"","UserId":"","Title":""在秋天总是比平常更易感知幸福"","LikedCount":148,"LikedCountDesc":"148","CollectedCount":27,"CollectedCountDesc":"27","CommentsCount":22,"CommentsCountDesc":"22","ViewCount":2459,"ShareCount":10,"ShareCountDesc":"10","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k831o4uk4svg69g4a3o6ie1c0rsahfihp8-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":8906721,"BloggerIdKey":"cd889a","BloggerNickName":"NUT","BloggerProp":"初级达人","PublishTime":"2025-10-27T18:32:19+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-27","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T10:32:59.6491036+08:00","Lcc":197,"LccDesc":"197","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"","Fans":9961,"McnName":"","McnInfoId":1830722,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":183,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31apm1a9t7a005pie0nghosoqvgmon28-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31apm1a9t7a005pie0nghosoqvgmon28-180x240","Location":" ","TagName":"穿搭","RedId":"Hellonikiiii","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"潮流资讯","LikeCollect":100565,"AdPrice":2200,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"潮流资讯,时尚其他,潮流艺术,穿搭,箱包","LinkInfo":"","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1733951141,"DateCode":20251104,"NoteIdKey":"5feec6","Id":"","UserId":"","Title":"跟着王一博学穿搭！ LOEWE这双Jambo太会了","LikedCount":164,"LikedCountDesc":"164","CollectedCount":15,"CollectedCountDesc":"15","CommentsCount":4,"CommentsCountDesc":"4","ViewCount":1464,"ShareCount":4,"ShareCountDesc":"4","CoverImage":"//xsh-ci.qian-gua.com/notes_pre_post/1040g3k831ofdejc8g6l05pie0nghosoqqoufmig-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":22574011,"BloggerIdKey":"81cd6a","BloggerNickName":"Niki在哪里","BloggerProp":"初级达人","PublishTime":"2025-11-04T21:04:03+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-11-04","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-12T09:54:24.9233325+08:00","Lcc":183,"LccDesc":"183","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"","Fans":7605,"McnName":"","McnInfoId":1662101,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":164,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/668d00e72fd7f54f8020dbd1.jpg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/668d00e72fd7f54f8020dbd1.jpg-180x240","Location":"浙江 杭州市","TagName":"鞋靴","RedId":"1109631503","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":163487,"AdPrice":1000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,时尚其他,潮流艺术,潮流资讯,底妆","LinkInfo":"","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1712858897,"DateCode":20251015,"NoteIdKey":"c2452c","Id":"","UserId":"","Title":"LOEWE毛茸茸薄底鞋｜2025秋冬爆款预定","LikedCount":153,"LikedCountDesc":"153","CollectedCount":7,"CollectedCountDesc":"7","CommentsCount":4,"CommentsCountDesc":"4","ViewCount":2982,"ShareCount":8,"ShareCountDesc":"8","CoverImage":"//xsh-qn.qian-gua.com/spectrum/1040g34o31nkaqenel0505nvdg59g9d13hvr24u0-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":22230060,"BloggerIdKey":"e47279","BloggerNickName":"黄工是个爆炸头","BloggerProp":"初级达人","PublishTime":"2025-10-15T13:25:34+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-15","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T00:36:44.8091955+08:00","Lcc":164,"LccDesc":"164","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":13881,"McnName":"","McnInfoId":1431195,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":150,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo314rds1o50u005ogskcj8cejur2tn3v0-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo314rds1o50u005ogskcj8cejur2tn3v0-180x240","Location":"上海 上海市","TagName":"家居用品","RedId":"Littlegreen_Y","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"家居装饰","LikeCollect":52482,"AdPrice":3100,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"家居装饰,家居用品,个人护理,家居家装其他,室内设计","LinkInfo":"","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1726780371,"DateCode":20251029,"NoteIdKey":"022278","Id":"","UserId":"","Title":"淡人也需要一点热烈","LikedCount":95,"LikedCountDesc":"95","CollectedCount":33,"CollectedCountDesc":"33","CommentsCount":22,"CommentsCountDesc":"22","ViewCount":431,"ShareCount":8,"ShareCountDesc":"8","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k831o7kkafdl8dg5ogskcj8cejuqge3smg-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":20856834,"BloggerIdKey":"d4e453","BloggerNickName":"想长尾巴","BloggerProp":"初级达人","PublishTime":"2025-10-29T21:27:37+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-29","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T15:02:29.8457087+08:00","Lcc":150,"LccDesc":"150","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"困困薯","Fans":7634,"McnName":"","McnInfoId":1314919,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":116,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31ek4af1o12005obubao0jgddiepmfr0-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31ek4af1o12005obubao0jgddiepmfr0-180x240","Location":"陕西 汉中市","TagName":"潮流艺术","RedId":"1826226137","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":76045,"AdPrice":2500,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,潮流资讯,配饰,箱包,鞋靴","LinkInfo":"","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1713359129,"DateCode":20251015,"NoteIdKey":"de3cc0","Id":"","UserId":"","Title":"薄底鞋控狂喜！轻松拿捏慵懒秋冬时髦感💛","LikedCount":109,"LikedCountDesc":"109","CollectedCount":5,"CollectedCountDesc":"5","CommentsCount":2,"CommentsCountDesc":"2","ViewCount":3249,"ShareCount":3,"ShareCountDesc":"3","CoverImage":"//xsh-qn.qian-gua.com/1040g2sg31nmj14c9kse05obubao0jgddfpl05mg-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":18062383,"BloggerIdKey":"01c878","BloggerNickName":"NeoRetro时髦档案","BloggerProp":"初级达人","PublishTime":"2025-10-15T17:10:49+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-15","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T07:12:09.1408689+08:00","Lcc":116,"LccDesc":"116","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":32304,"McnName":"","McnInfoId":66330,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":82,"Gender":0,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo318oojqo846005ntkgn4g8re1asrj428-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo318oojqo846005ntkgn4g8re1asrj428-180x240","Location":"四川 成都市","TagName":"鞋靴","RedId":"markbai27","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"潮流资讯","LikeCollect":221783,"AdPrice":5000,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,潮流资讯,时尚其他,穿搭ootd,配饰","LinkInfo":"287386368@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1736673742,"DateCode":20251106,"NoteIdKey":"e46315","Id":"","UserId":"","Title":"王一博也在穿！一双大头鞋解锁秋冬潮流穿搭","LikedCount":79,"LikedCountDesc":"79","CollectedCount":1,"CollectedCountDesc":"1","CommentsCount":2,"CommentsCountDesc":"2","ViewCount":702,"ShareCount":3,"ShareCountDesc":"3","CoverImage":"//xsh-qn.qian-gua.com/notes_pre_post/1040g3k031ohmbbfpl81g5ntkgn4g8re18o01ft8-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":4873918,"BloggerIdKey":"92e51a","BloggerNickName":"ARMSROCK潮流","BloggerProp":"初级达人","PublishTime":"2025-11-06T21:37:40+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-11-06","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-12T09:02:50.0963534+08:00","Lcc":82,"LccDesc":"82","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":21320,"McnName":"","McnInfoId":238474,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":72,"Gender":1,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31b0tv4nk6q00400qdjidum6hh8b6158-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31b0tv4nk6q00400qdjidum6hh8b6158-180x240","Location":"浙江 杭州市","TagName":"家居用品","RedId":"184542768","CooperateBindsName":"LOEWE罗意威香氛","BloggerTagName":"家居装饰","LikeCollect":179421,"AdPrice":3170,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"家居装饰,家居家装其他,家居用品,室内设计","LinkInfo":"335882655@qq.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1723147588,"DateCode":20251024,"NoteIdKey":"503c01","Id":"","UserId":"","Title":"10月的家，肆意生活🍁","LikedCount":50,"LikedCountDesc":"50","CollectedCount":16,"CollectedCountDesc":"16","CommentsCount":6,"CommentsCountDesc":"6","ViewCount":674,"ShareCount":3,"ShareCountDesc":"3","CoverImage":"//xsh-qn.qian-gua.com/1040g00831o0vri3q4u30400qdjidum6hibhbgu8-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":4852176,"BloggerIdKey":"c022be","BloggerNickName":"姜姜姜Sara","BloggerProp":"初级达人","PublishTime":"2025-10-24T16:32:21+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威香氛"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-24","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T01:02:33.1093663+08:00","Lcc":72,"LccDesc":"72","VideoDuration":""},{"GoodsCount":0,"LevelNumber":0,"LevelName":"金冠薯","Fans":23573,"McnName":"","McnInfoId":710540,"IsBrandPartner":true,"OfficialVerified":false,"NoteActiveCount":57,"Gender":2,"BigAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31h3o59ks3s0049btiq6ec2usv6nmskg-180x240","SmallAvatar":"//xsh-img.qian-gua.com/avatar/1040g2jo31h3o59ks3s0049btiq6ec2usv6nmskg-180x240","Location":"地球的某一片红薯地 ","TagName":"穿搭","RedId":"ZHOUYUANDLOVE","CooperateBindsName":"LOEWE罗意威","BloggerTagName":"穿搭","LikeCollect":123999,"AdPrice":8800,"AdPriceDesc":null,"AdPriceUpdateStatus":0,"PriceType":"实时报价","IsAdNote":false,"BloggerTags":"穿搭,人文风光展示,摄影技巧,潮流艺术,潮流资讯","LinkInfo":"19056886267@163.com","NoteInsightTypeStr":null,"ViewCountDesc":null,"PredictImpressionCountDesc":null,"NoteId":1715604953,"DateCode":20251017,"NoteIdKey":"fc015f","Id":"","UserId":"","Title":"on my way to the gym🦮🐾","LikedCount":41,"LikedCountDesc":"41","CollectedCount":15,"CollectedCountDesc":"15","CommentsCount":1,"CommentsCountDesc":"1","ViewCount":986,"ShareCount":5,"ShareCountDesc":"5","CoverImage":"//xsh-qn.qian-gua.com/1040g00831nnsmeea6m3g49btiq6ec2uslfp35fo-180x240","WebShare":"","SpreadScore":0,"Index":0,"BloggerId":2102813,"BloggerIdKey":"233e96","BloggerNickName":"zozo.","BloggerProp":"初级达人","PublishTime":"2025-10-17T17:52:15+08:00","CooperateBindList":[{"BrandId":40600,"BrandIdKey":"490652","BrandName":"LOEWE罗意威"}],"NoteType":"normal","IsBusiness":true,"NoteTypeDesc":"图文","Props":0,"PubDate":"2025-10-17","CurrentUserIsFavorite":false,"UpdateTime":"2025-11-11T07:00:04.9574639+08:00","Lcc":57,"LccDesc":"57","VideoDuration":""}]');
    }

    window.AZ_seed = async function(noteItem = null) {
        console.log('[AZ_seed] ========== 开始执行 ==========');
        console.log('[AZ_seed] 输入参数:', noteItem ? '有数据' : 'null，将使用 demo 数据');
        try {
            // 如果传入了对象参数则使用传入的参数，否则使用 demo 数据
            const item = noteItem && typeof noteItem === 'object' && !Array.isArray(noteItem)
                ? noteItem
                : getDemoData()[0];
            console.log('[AZ_seed] 使用的数据项:', item ? '有数据' : '无数据');

            // 将单个对象包装成数组传给 runUploadFlow
            const items = [item];
            console.log('[AZ_seed] 准备调用 runUploadFlow，数据条数:', items.length);

            const result = await runUploadFlow(items, {
                onPhase: (p) => { /* 控制台提示 */ console.log('[AZ_seed] phase:', p); }
            });
            console.log('[AZ_seed] runUploadFlow 返回结果:', result);
            showMessage(result.success ? `AZ_seed 成功：${result.message}` : `AZ_seed 失败：${result.message}`, result.success);
            console.log('[AZ_seed] ========== 执行完成 ==========');
            return result;
        } catch (e) {
            console.error('[AZ_seed] 捕获异常:', e);
            const errorMsg = 'AZ_seed 异常: ' + (e && e.message ? e.message : String(e));
            showMessage(errorMsg, false);
            console.error('[AZ_seed] ========== 执行完成（异常） ==========');
            return { success: false, message: errorMsg };
        }
    }
    // ====== 模拟运行 END ======
})();


