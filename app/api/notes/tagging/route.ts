import { NextRequest, NextResponse } from 'next/server';

import { TAGGING_BULK_NOTE_LIMIT } from '@/lib/constants/tagging';
import { createServerClient } from '@/lib/supabase/server';
import type { NoteTaggingResult } from '@/lib/types';

import { fetchTagSetWithTags, mapTag } from './_shared';

const normalizeId = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const noteId = normalizeId(body.noteId);
    const tagSetId = normalizeId(body.tagSetId);
    const tagIds = Array.isArray(body.tagIds)
      ? body.tagIds
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : [];

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: 'noteId 不能为空' },
        { status: 400 },
      );
    }

    if (!tagSetId) {
      return NextResponse.json(
        { success: false, error: 'tagSetId 不能为空' },
        { status: 400 },
      );
    }

    if (tagIds.length > TAGGING_BULK_NOTE_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `单次最多选择 ${TAGGING_BULK_NOTE_LIMIT} 个标签`,
        },
        { status: 400 },
      );
    }

    const { tagSet, tags, error: tagSetError } = await fetchTagSetWithTags(
      supabase,
      tagSetId,
    );

    if (tagSetError || !tagSet || !tags) {
      const status =
        (tagSetError as any)?.code === 'TAG_SET_NOT_FOUND' ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          error:
            tagSetError?.message || '标签系列不存在或无权访问当前标签系列',
        },
        { status },
      );
    }

    const tagLookup = new Map(tags.map((tag) => [tag.TagId, tag]));
    const uniqueTagIds: string[] = Array.from(new Set(tagIds));

    for (const tagId of uniqueTagIds) {
      if (!tagLookup.has(tagId)) {
        return NextResponse.json(
          { success: false, error: `标签 ${tagId} 不属于该标签系列` },
          { status: 400 },
        );
      }
    }

    // 删除当前笔记在该系列下的所有关联（包括所有用户的标签）
    const tagIdsWithinSet = Array.from(tagLookup.keys());
    if (tagIdsWithinSet.length > 0) {
      const { error: deleteError } = await supabase
        .from('qiangua_note_tag')
        .delete()
        .eq('NoteId', noteId)
        .in('TagId', tagIdsWithinSet);

      if (deleteError) {
        console.error('Error clearing note tags:', deleteError);
        return NextResponse.json(
          {
            success: false,
            error: deleteError.message || '清空现有标签失败',
          },
          { status: 500 },
        );
      }
    }

    if (uniqueTagIds.length > 0) {
      const insertPayload = uniqueTagIds.map((tagId) => ({
        NoteId: noteId,
        TagId: tagId,
        UserId: user.id,
      }));

      const { error: insertError } = await supabase
        .from('qiangua_note_tag')
        .upsert(insertPayload, {
          onConflict: 'NoteId,TagId',
        });

      if (insertError) {
        console.error('Error assigning note tags:', insertError);
        const message =
          insertError.code === '23505'
            ? '存在重复标签，请刷新后重试'
            : insertError.message || '保存笔记标签失败';
        return NextResponse.json(
          { success: false, error: message },
          { status: 400 },
        );
      }
    }

    const assigned: NoteTaggingResult = {
      noteId,
      tagSetId,
      tags: uniqueTagIds.map((id) => mapTag(tagLookup.get(id)!)),
    };

    return NextResponse.json({
      success: true,
      data: assigned,
    });
  } catch (error: any) {
    console.error('Error in note tagging POST API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

