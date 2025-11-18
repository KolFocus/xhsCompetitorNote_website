import { NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import type { NoteTaggingResult } from '@/lib/types';

import { fetchTagSetWithTags, mapTag } from '../../tagging/_shared';

export async function GET(
  request: NextRequest,
  { params }: { params: { noteId: string } },
) {
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

    const noteId = params.noteId;

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: 'noteId 不能为空' },
        { status: 400 },
      );
    }

    const tagSetId = request.nextUrl.searchParams.get('tagSetId');

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

    const { data: relations, error: relationsError } = await supabase
      .from('qiangua_note_tag')
      .select('TagId')
      .eq('NoteId', noteId);

    if (relationsError) {
      console.error('Error fetching note tags:', relationsError);
      return NextResponse.json(
        {
          success: false,
          error: relationsError.message || '查询笔记标签失败',
        },
        { status: 500 },
      );
    }

    const assignedTagIds = new Set((relations || []).map((row) => row.TagId));
    const assignedTags = tags
      .filter((tag) => assignedTagIds.has(tag.TagId))
      .map(mapTag);

    const payload: NoteTaggingResult = {
      noteId,
      tagSetId,
      tags: assignedTags,
    };

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error: any) {
    console.error('Error in get note tags API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

