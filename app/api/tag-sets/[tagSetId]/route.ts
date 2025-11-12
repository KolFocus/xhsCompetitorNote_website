import { NextRequest, NextResponse } from 'next/server';

import {
  TAG_SET_NAME_MAX_LENGTH,
  TAG_SET_NAME_MIN_LENGTH,
} from '@/lib/constants/tagging';
import { createServerClient } from '@/lib/supabase/server';
import type { TagSetDTO } from '@/lib/types';

const normalizeName = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const validateName = (name: string) => {
  if (!name) {
    throw new Error('标签系列名称不能为空');
  }
  if (
    name.length < TAG_SET_NAME_MIN_LENGTH ||
    name.length > TAG_SET_NAME_MAX_LENGTH
  ) {
    throw new Error(
      `标签系列名称长度需在${TAG_SET_NAME_MIN_LENGTH}~${TAG_SET_NAME_MAX_LENGTH}个字符之间`,
    );
  }
};

const mapTagSet = (tagSet: any): TagSetDTO => ({
  tagSetId: tagSet.TagSetId,
  tagSetName: tagSet.TagSetName,
  description: tagSet.Description,
  type: tagSet.type,
  userId: tagSet.UserId,
  createdAt: tagSet.CreatedAt,
  updatedAt: tagSet.UpdatedAt,
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tagSetId: string } },
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

    const tagSetId = params.tagSetId;
    const body = await request.json();

    const tagSetName =
      body.tagSetName !== undefined ? normalizeName(body.tagSetName) : undefined;
    const description =
      body.description !== undefined
        ? (normalizeName(body.description) || null)
        : undefined;

    if (tagSetName === undefined && description === undefined) {
      return NextResponse.json(
        { success: false, error: '未提供需要更新的字段' },
        { status: 400 },
      );
    }

    if (tagSetName !== undefined) {
      try {
        validateName(tagSetName);
      } catch (validationError: any) {
        return NextResponse.json(
          { success: false, error: validationError.message },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, any> = {};
    if (tagSetName !== undefined) {
      updates.TagSetName = tagSetName;
    }
    if (description !== undefined) {
      updates.Description = description;
    }

    const { data: updated, error } = await supabase
      .from('qiangua_tag_set')
      .update(updates)
      .eq('TagSetId', tagSetId)
      .select('TagSetId, TagSetName, Description, type, UserId, CreatedAt, UpdatedAt')
      .single();

    if (error || !updated) {
      console.error('Error updating tag set:', error);
      const message =
        error?.code === '23505'
          ? '标签系列名称已存在'
          : error?.message || '更新标签系列失败';
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: mapTagSet(updated),
    });
  } catch (error: any) {
    console.error('Error in tag set PATCH API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { tagSetId: string } },
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

    const tagSetId = params.tagSetId;

    const { data, error } = await supabase
      .from('qiangua_tag_set')
      .delete()
      .eq('TagSetId', tagSetId)
      .select('TagSetId')
      .single();

    if (error || !data) {
      console.error('Error deleting tag set:', error);
      const status = error?.code === 'PGRST116' ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          error:
            status === 404 ? '标签系列不存在或无权访问' : error?.message || '删除失败',
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tagSetId: data.TagSetId,
        deleted: true,
      },
    });
  } catch (error: any) {
    console.error('Error in tag set DELETE API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

