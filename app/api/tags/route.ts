import { NextRequest, NextResponse } from 'next/server';

import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
} from '@/lib/constants/tagging';
import { createServerClient } from '@/lib/supabase/server';
import type { TagDTO } from '@/lib/types';

const normalizeName = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const mapTag = (tag: any): TagDTO => ({
  tagId: tag.TagId,
  tagSetId: tag.TagSetId,
  tagName: tag.TagName,
  userId: tag.UserId,
  createdAt: tag.CreatedAt,
  updatedAt: tag.UpdatedAt,
});

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
    const tagSetId = typeof body.tagSetId === 'string' ? body.tagSetId : '';
    const tagName = normalizeName(body.tagName);

    if (!tagSetId) {
      return NextResponse.json(
        { success: false, error: '标签系列ID不能为空' },
        { status: 400 },
      );
    }

    try {
      validateTagName(tagName);
    } catch (validationError: any) {
      return NextResponse.json(
        { success: false, error: validationError.message },
        { status: 400 },
      );
    }

    const { data: tagSet, error: tagSetError } = await supabase
      .from('qiangua_tag_set')
      .select('TagSetId, type, UserId')
      .eq('TagSetId', tagSetId)
      .single();

    if (tagSetError || !tagSet) {
      return NextResponse.json(
        { success: false, error: '标签系列不存在或无权访问' },
        { status: 404 },
      );
    }

    if (tagSet.type !== 'custom') {
      return NextResponse.json(
        { success: false, error: '系统标签系列不可新增标签' },
        { status: 403 },
      );
    }

    if (tagSet.UserId !== user.id) {
      return NextResponse.json(
        { success: false, error: '无权操作该标签系列' },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from('qiangua_tag')
      .insert({
        TagSetId: tagSetId,
        TagName: tagName,
        UserId: user.id,
      })
      .select('TagId, TagSetId, TagName, UserId, CreatedAt, UpdatedAt')
      .single();

    if (error || !data) {
      console.error('Error creating tag:', error);
      const message =
        error?.code === '23505'
          ? '同系列下标签名称重复'
          : error?.message || '创建标签失败';
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: mapTag(data),
    });
  } catch (error: any) {
    console.error('Error in tags POST API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

