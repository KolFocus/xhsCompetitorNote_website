import { NextRequest, NextResponse } from 'next/server';

import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
  TAG_SET_NAME_MAX_LENGTH,
  TAG_SET_NAME_MIN_LENGTH,
} from '@/lib/constants/tagging';
import { createServerClient } from '@/lib/supabase/server';
import type { TagDTO, TagSetDTO } from '@/lib/types';

type RawTag = {
  TagId: string;
  TagSetId: string;
  TagName: string;
  UserId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
};

type RawTagSet = {
  TagSetId: string;
  TagSetName: string;
  Description: string | null;
  type: 'system' | 'custom';
  UserId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  tags?: RawTag[];
};

const parseBoolean = (value: string | null, defaultValue: boolean): boolean => {
  if (value == null) {
    return defaultValue;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return defaultValue;
};

const mapTag = (tag: RawTag): TagDTO => ({
  tagId: tag.TagId,
  tagSetId: tag.TagSetId,
  tagName: tag.TagName,
  userId: tag.UserId,
  createdAt: tag.CreatedAt,
  updatedAt: tag.UpdatedAt,
});

const mapTagSet = (tagSet: RawTagSet): TagSetDTO => ({
  tagSetId: tagSet.TagSetId,
  tagSetName: tagSet.TagSetName,
  description: tagSet.Description,
  type: tagSet.type,
  userId: tagSet.UserId,
  createdAt: tagSet.CreatedAt,
  updatedAt: tagSet.UpdatedAt,
  tags: tagSet.tags ? tagSet.tags.map(mapTag) : undefined,
});

const normalizeName = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const validateName = (
  name: string,
  min: number,
  max: number,
  fieldLabel: string,
) => {
  if (!name) {
    throw new Error(`${fieldLabel}不能为空`);
  }
  if (name.length < min || name.length > max) {
    throw new Error(`${fieldLabel}长度需在${min}~${max}个字符之间`);
  }
};

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const includeSystem = parseBoolean(
      searchParams.get('includeSystem'),
      true,
    );
    const withTags = parseBoolean(searchParams.get('withTags'), false);

    const selectClause = withTags
      ? 'TagSetId, TagSetName, Description, type, UserId, CreatedAt, UpdatedAt, tags:qiangua_tag(TagId, TagSetId, TagName, UserId, CreatedAt, UpdatedAt)'
      : 'TagSetId, TagSetName, Description, type, UserId, CreatedAt, UpdatedAt';

    let query = supabase
      .from('qiangua_tag_set')
      .select(selectClause)
      .order('type', { ascending: true })
      .order('UpdatedAt', { ascending: false });

    if (!includeSystem) {
      query = query.eq('type', 'custom');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tag sets:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    const items = ((data || []) as unknown as RawTagSet[]).map(mapTagSet);

    return NextResponse.json({
      success: true,
      data: {
        items,
      },
    });
  } catch (error: any) {
    console.error('Error in tag sets GET API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

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
    const tagSetName = normalizeName(body.tagSetName);
    const description =
      typeof body.description === 'string'
        ? body.description.trim() || null
        : null;
    const tagsInput = Array.isArray(body.tags) ? body.tags : [];

    try {
      validateName(
        tagSetName,
        TAG_SET_NAME_MIN_LENGTH,
        TAG_SET_NAME_MAX_LENGTH,
        '标签系列名称',
      );
    } catch (validationError: any) {
      return NextResponse.json(
        { success: false, error: validationError.message },
        { status: 400 },
      );
    }

    const normalizedTagNames = tagsInput
      .map((item: unknown) => normalizeName(item))
      .filter((name: string) => name.length > 0);

    for (const tagName of normalizedTagNames) {
      validateName(
        tagName,
        TAG_NAME_MIN_LENGTH,
        TAG_NAME_MAX_LENGTH,
        '标签名称',
      );
    }

    const deduplicatedTagNames = Array.from(new Set(normalizedTagNames));

    const { data: insertedTagSet, error: insertError } = await supabase
      .from('qiangua_tag_set')
      .insert({
        TagSetName: tagSetName,
        Description: description,
        type: 'custom',
        UserId: user.id,
      })
      .select('TagSetId, TagSetName, Description, type, UserId, CreatedAt, UpdatedAt')
      .single();

    if (insertError || !insertedTagSet) {
      console.error('Error creating tag set:', insertError);
      const message =
        insertError?.code === '23505'
          ? '标签系列名称已存在'
          : insertError?.message || '创建标签系列失败';
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 },
      );
    }

    let createdTags: RawTag[] = [];

    if (deduplicatedTagNames.length > 0) {
      const { data: insertedTags, error: tagsError } = await supabase
        .from('qiangua_tag')
        .insert(
          deduplicatedTagNames.map((tagName) => ({
            TagSetId: insertedTagSet.TagSetId,
            TagName: tagName,
            UserId: user.id,
          })),
        )
        .select('TagId, TagSetId, TagName, UserId, CreatedAt, UpdatedAt');

      if (tagsError) {
        console.error('Error creating tags for tag set:', tagsError);
        return NextResponse.json(
          {
            success: false,
            error:
              tagsError.code === '23505'
                ? '标签名称重复，请调整后重试'
                : tagsError.message || '创建标签失败',
          },
          { status: 400 },
        );
      }

      createdTags = insertedTags || [];
    }

    const responsePayload: TagSetDTO = {
      ...mapTagSet({ ...insertedTagSet, tags: createdTags }),
    };

    return NextResponse.json({
      success: true,
      data: responsePayload,
    });
  } catch (error: any) {
    console.error('Error in tag sets POST API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

