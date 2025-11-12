import { NextRequest, NextResponse } from 'next/server';

import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
} from '@/lib/constants/tagging';
import { createServerClient } from '@/lib/supabase/server';
import type { TagDTO } from '@/lib/types';

const normalizeName = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const validateTagName = (name: string) => {
  if (!name) {
    throw new Error('标签名称不能为空');
  }
  if (name.length < TAG_NAME_MIN_LENGTH || name.length > TAG_NAME_MAX_LENGTH) {
    throw new Error(
      `标签名称长度需在${TAG_NAME_MIN_LENGTH}~${TAG_NAME_MAX_LENGTH}个字符之间`,
    );
  }
};

const mapTag = (tag: any): TagDTO => ({
  tagId: tag.TagId,
  tagSetId: tag.TagSetId,
  tagName: tag.TagName,
  userId: tag.UserId,
  createdAt: tag.CreatedAt,
  updatedAt: tag.UpdatedAt,
});

const fetchTagWithOwnership = async (
  supabase: ReturnType<typeof createServerClient>,
  tagId: string,
) => {
  const { data: tag, error: tagError } = await supabase
    .from('qiangua_tag')
    .select('TagId, TagSetId, TagName, UserId, CreatedAt, UpdatedAt')
    .eq('TagId', tagId)
    .single();

  if (tagError || !tag) {
    return { error: tagError || new Error('标签不存在或无权访问'), tag: null };
  }

  const { data: tagSet, error: tagSetError } = await supabase
    .from('qiangua_tag_set')
    .select('TagSetId, type, UserId')
    .eq('TagSetId', tag.TagSetId)
    .single();

  if (tagSetError || !tagSet) {
    return { error: tagSetError || new Error('标签系列不存在或无权访问'), tag: null };
  }

  return { tag, tagSet };
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tagId: string } },
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

    const tagId = params.tagId;
    const body = await request.json();
    const tagName = normalizeName(body.tagName);

    try {
      validateTagName(tagName);
    } catch (validationError: any) {
      return NextResponse.json(
        { success: false, error: validationError.message },
        { status: 400 },
      );
    }

    const { tag, tagSet, error: fetchError } = await fetchTagWithOwnership(
      supabase,
      tagId,
    );

    if (fetchError || !tag || !tagSet) {
      const status =
        fetchError?.message === '标签不存在或无权访问' ? 404 : 400;
      return NextResponse.json(
        { success: false, error: fetchError?.message || '标签不存在或无权访问' },
        { status },
      );
    }

    if (tagSet.type !== 'custom') {
      return NextResponse.json(
        { success: false, error: '系统标签不可编辑' },
        { status: 403 },
      );
    }

    if (tagSet.UserId !== user.id) {
      return NextResponse.json(
        { success: false, error: '无权编辑此标签' },
        { status: 403 },
      );
    }

    const { data: updated, error } = await supabase
      .from('qiangua_tag')
      .update({
        TagName: tagName,
        UserId: user.id,
      })
      .eq('TagId', tagId)
      .select('TagId, TagSetId, TagName, UserId, CreatedAt, UpdatedAt')
      .single();

    if (error || !updated) {
      console.error('Error updating tag:', error);
      const message =
        error?.code === '23505'
          ? '同系列下标签名称重复'
          : error?.message || '更新标签失败';
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: mapTag(updated),
    });
  } catch (error: any) {
    console.error('Error in tag PATCH API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { tagId: string } },
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

    const tagId = params.tagId;
    const { tag, tagSet, error: fetchError } = await fetchTagWithOwnership(
      supabase,
      tagId,
    );

    if (fetchError || !tag || !tagSet) {
      const status =
        fetchError?.message === '标签不存在或无权访问' ? 404 : 400;
      return NextResponse.json(
        { success: false, error: fetchError?.message || '标签不存在或无权访问' },
        { status },
      );
    }

    if (tagSet.type !== 'custom') {
      return NextResponse.json(
        { success: false, error: '系统标签不可删除' },
        { status: 403 },
      );
    }

    if (tagSet.UserId !== user.id) {
      return NextResponse.json(
        { success: false, error: '无权删除此标签' },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from('qiangua_tag')
      .delete()
      .eq('TagId', tagId)
      .select('TagId')
      .single();

    if (error || !data) {
      console.error('Error deleting tag:', error);
      const status = error?.code === 'PGRST116' ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          error:
            status === 404 ? '标签不存在或无权访问' : error?.message || '删除标签失败',
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tagId: data.TagId,
        deleted: true,
      },
    });
  } catch (error: any) {
    console.error('Error in tag DELETE API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

