import { NextRequest, NextResponse } from 'next/server';

import {
  TAGGING_BULK_CHUNK_SIZE,
  TAGGING_BULK_NOTE_LIMIT,
} from '@/lib/constants/tagging';
import { createServerClient } from '@/lib/supabase/server';
import type { BulkTaggingResult } from '@/lib/types';

import { fetchTagSetWithTags } from '../_shared';

const normalizeId = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const chunk = <T,>(source: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < source.length; i += size) {
    result.push(source.slice(i, i + size));
  }
  return result;
};

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
    const noteIds = Array.isArray(body.noteIds)
      ? body.noteIds
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : [];
    const tagSetId = normalizeId(body.tagSetId);
    const tagIds = Array.isArray(body.tagIds)
      ? body.tagIds
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : [];

    if (noteIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'noteIds 不能为空' },
        { status: 400 },
      );
    }

    if (noteIds.length > TAGGING_BULK_NOTE_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `单次最多处理 ${TAGGING_BULK_NOTE_LIMIT} 条笔记`,
        },
        { status: 400 },
      );
    }

    if (!tagSetId) {
      return NextResponse.json(
        { success: false, error: 'tagSetId 不能为空' },
        { status: 400 },
      );
    }

    if (tagIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'tagIds 不能为空' },
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
    const uniqueNoteIds: string[] = Array.from(new Set(noteIds));
    const uniqueTagIds: string[] = Array.from(new Set(tagIds));

    for (const tagId of uniqueTagIds) {
      if (!tagLookup.has(tagId)) {
        return NextResponse.json(
          { success: false, error: `标签 ${tagId} 不属于该标签系列` },
          { status: 400 },
        );
      }
    }

    let succeedCount = 0;
    const failed: BulkTaggingResult['failed'] = [];

    // 分片处理，降低单次 payload 压力
    for (const chunkedNoteIds of chunk(uniqueNoteIds, TAGGING_BULK_CHUNK_SIZE)) {
      const insertPayload = chunkedNoteIds.flatMap((noteId) =>
        uniqueTagIds.map((tagId) => ({
          NoteId: noteId,
          TagId: tagId,
          UserId: user.id,
        })),
      );

      const { error: upsertError } = await supabase
        .from('qiangua_note_tag')
        .upsert(insertPayload, { onConflict: 'NoteId,TagId' });

      if (upsertError) {
        console.error('Bulk tagging error:', upsertError);
        chunkedNoteIds.forEach((noteId) => {
          failed.push({
            noteId,
            reason: upsertError.message || '批量打标失败',
          });
        });
      } else {
        succeedCount += chunkedNoteIds.length;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        succeedCount,
        failed,
      },
    });
  } catch (error: any) {
    console.error('Error in note tagging bulk POST API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const noteIds = Array.isArray(body.noteIds)
      ? body.noteIds
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : [];
    const tagSetId = normalizeId(body.tagSetId);

    if (noteIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'noteIds 不能为空' },
        { status: 400 },
      );
    }

    if (noteIds.length > TAGGING_BULK_NOTE_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `单次最多处理 ${TAGGING_BULK_NOTE_LIMIT} 条笔记`,
        },
        { status: 400 },
      );
    }

    if (!tagSetId) {
      return NextResponse.json(
        { success: false, error: 'tagSetId 不能为空' },
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

    const tagIdsWithinSet = tags.map((tag) => tag.TagId);
    if (tagIdsWithinSet.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          succeedCount: noteIds.length,
          failed: [],
        },
      });
    }

    const uniqueNoteIds = Array.from(new Set(noteIds));

    const { error: deleteError } = await supabase
      .from('qiangua_note_tag')
      .delete()
      .eq('UserId', user.id)
      .in('NoteId', uniqueNoteIds)
      .in('TagId', tagIdsWithinSet);

    if (deleteError) {
      console.error('Bulk clear tag error:', deleteError);
      return NextResponse.json(
        {
          success: false,
          error: deleteError.message || '批量清除失败',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        succeedCount: uniqueNoteIds.length,
        failed: [],
      },
    });
  } catch (error: any) {
    console.error('Error in note tagging bulk DELETE API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

