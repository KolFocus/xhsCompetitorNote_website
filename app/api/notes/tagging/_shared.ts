import type { PostgrestError } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import type { TagDTO } from '@/lib/types';

export type ServerSupabaseClient = ReturnType<typeof createServerClient>;

export type RawTag = {
  TagId: string;
  TagSetId: string;
  TagName: string;
  UserId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export type RawTagSet = {
  TagSetId: string;
  TagSetName: string;
  Description: string | null;
  type: 'system' | 'custom';
  UserId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export const TAG_COLUMNS =
  'TagId, TagSetId, TagName, UserId, CreatedAt, UpdatedAt';

export const mapTag = (tag: RawTag): TagDTO => ({
  tagId: tag.TagId,
  tagSetId: tag.TagSetId,
  tagName: tag.TagName,
  userId: tag.UserId,
  createdAt: tag.CreatedAt,
  updatedAt: tag.UpdatedAt,
});

export const fetchTagSetWithTags = async (
  supabase: ServerSupabaseClient,
  tagSetId: string,
): Promise<
  | {
      tagSet: RawTagSet;
      tags: RawTag[];
      error: null;
    }
  | { tagSet: null; tags: null; error: PostgrestError | Error }
> => {
  const { data: tagSet, error: tagSetError } = await supabase
    .from('qiangua_tag_set')
    .select(
      'TagSetId, TagSetName, Description, type, UserId, CreatedAt, UpdatedAt',
    )
    .eq('TagSetId', tagSetId)
    .single();

  if (tagSetError || !tagSet) {
    return {
      tagSet: null,
      tags: null,
      error:
        tagSetError ||
        Object.assign(new Error('标签系列不存在或无权访问'), {
          code: 'TAG_SET_NOT_FOUND',
        }),
    };
  }

  const { data: tags, error: tagsError } = await supabase
    .from('qiangua_tag')
    .select(TAG_COLUMNS)
    .eq('TagSetId', tagSetId)
    .order('TagName', { ascending: true });

  if (tagsError || !tags) {
    return {
      tagSet: null,
      tags: null,
      error:
        tagsError ||
        Object.assign(new Error('获取标签失败'), {
          code: 'TAG_FETCH_FAILED',
        }),
    };
  }

  return { tagSet, tags, error: null };
};

