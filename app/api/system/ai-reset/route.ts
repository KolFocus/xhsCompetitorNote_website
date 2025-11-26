import { NextRequest, NextResponse } from 'next/server';

import { log } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 重置AI分析状态
 * 支持两种模式：
 * 1. 批量重置：传入 status 参数（如：'分析中'、'分析失败'）
 * 2. 单条重置：传入 noteId 参数
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { status, noteId } = body;

    const supabase = getServiceSupabaseClient();

    // 模式1：单条笔记重置
    if (noteId) {
      const { data, error } = await supabase
        .from('qiangua_note_info')
        .update({
          AiStatus: '待分析',
          AiErr: null,
          AiErrType: null,
        })
        .eq('NoteId', noteId)
        .in('AiStatus', ['分析中', '分析失败'])
        .select('NoteId');

      if (error) {
        throw new Error(`重置状态失败: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: '笔记不存在或状态不允许重置',
          },
          { status: 400 },
        );
      }

      log.info('AI状态单条重置', {
        noteId,
      });

      return NextResponse.json({
        success: true,
        data: {
          resetCount: 1,
          message: '重置成功',
        },
      });
    }

    // 模式2：批量重置
    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少状态参数或笔记ID',
        },
        { status: 400 },
      );
    }

    // 只允许重置"分析中"和"分析失败"状态
    if (status !== '分析中' && status !== '分析失败') {
      return NextResponse.json(
        {
          success: false,
          error: '只能重置"分析中"或"分析失败"状态',
        },
        { status: 400 },
      );
    }

    // 执行批量重置
    const { data, error } = await supabase
      .from('qiangua_note_info')
      .update({
        AiStatus: '待分析',
        AiErr: null,
        AiErrType: null,
      })
      .eq('AiStatus', status)
      .select('NoteId');

    if (error) {
      throw new Error(`重置状态失败: ${error.message}`);
    }

    const resetCount = data?.length || 0;

    log.info('AI状态批量重置', {
      originalStatus: status,
      resetCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        resetCount,
        message: `成功重置 ${resetCount} 条笔记`,
      },
    });
  } catch (error: any) {
    log.error('重置AI状态失败', {}, error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '重置状态失败',
      },
      { status: 500 },
    );
  }
}

