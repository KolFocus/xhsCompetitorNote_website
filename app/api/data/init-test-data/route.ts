/**
 * 初始化测试数据接口
 * POST /api/data/init-test-data
 * 
 * 功能：接收 getNoteList 和 getSimpleNote 的 JSON 数据，自动处理数据转换和插入
 * 
 * 请求体格式：
 * {
 *   "noteListResponses": [
 *     { "Code": 200, "Msg": "Success", "Data": {...} },
 *     ...
 *   ],
 *   "noteDetailResponses": [
 *     { "Code": 200, "Msg": "Success", "Data": {...} },
 *     ...
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  transformBloggerData,
  transformBrandData,
  transformNoteData,
  transformNoteDetailData,
  extractBrandInfo,
  extractBloggerFromNoteDetail,
} from '@/lib/utils/dataTransform';

// 开发环境无需认证（通过环境变量控制）
const REQUIRE_AUTH = process.env.NODE_ENV === 'production';

interface ApiResponse {
  Code: number;
  Msg: string;
  Data: any;
}

interface RequestBody {
  noteListResponses?: ApiResponse[];
  noteDetailResponses?: ApiResponse[];
}

interface ProcessResult {
  bloggers: { inserted: number; updated: number; errors: string[] };
  brands: { inserted: number; updated: number; errors: string[] };
  notes: { inserted: number; updated: number; detailsUpdated: number; errors: string[] };
}

export async function POST(request: NextRequest) {
  try {
    // 检查认证（仅生产环境）
    if (REQUIRE_AUTH) {
      // TODO: 添加 Service Role Key 认证
      // const authHeader = request.headers.get('authorization');
      // if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
      //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      // }
    }

    // 解析请求体
    const body: RequestBody = await request.json();
    const { noteListResponses = [], noteDetailResponses = [] } = body;

    if (noteListResponses.length === 0 && noteDetailResponses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data provided' },
        { status: 400 }
      );
    }

    // 创建 Supabase 客户端
    const supabase = createServerClient();

    // 处理结果
    const result: ProcessResult = {
      bloggers: { inserted: 0, updated: 0, errors: [] },
      brands: { inserted: 0, updated: 0, errors: [] },
      notes: { inserted: 0, updated: 0, detailsUpdated: 0, errors: [] },
    };

    // ============================================
    // 步骤1: 提取并处理博主数据（去重）
    // ============================================
    const bloggerMap = new Map<string, any>();

    for (const response of noteListResponses) {
      if (response.Code !== 200 || !response.Data?.ItemList) {
        continue;
      }

      for (const item of response.Data.ItemList) {
        if (!item.BloggerId) continue;

        const bloggerData = transformBloggerData(item);
        const bloggerId = bloggerData.BloggerId;

        if (bloggerId && !bloggerMap.has(bloggerId)) {
          bloggerMap.set(bloggerId, bloggerData);
        }
      }
    }

    // 插入博主数据（ON CONFLICT DO UPDATE）
    // 先检查哪些已存在，以便统计插入和更新数量
    const existingBloggerIds = new Set<string>();
    if (bloggerMap.size > 0) {
      const bloggerIds = Array.from(bloggerMap.keys());
      const { data: existing } = await supabase
        .from('qiangua_blogger')
        .select('BloggerId')
        .in('BloggerId', bloggerIds);

      if (existing) {
        existing.forEach((b) => existingBloggerIds.add(b.BloggerId));
      }
    }

    for (const bloggerData of bloggerMap.values()) {
      try {
        const isUpdate = existingBloggerIds.has(bloggerData.BloggerId!);
        const { error } = await supabase
          .from('qiangua_blogger')
          .upsert(
            {
              ...bloggerData,
              UpdatedAt: new Date().toISOString(),
            },
            {
              onConflict: 'BloggerId',
              ignoreDuplicates: false,
            }
          );

        if (error) {
          result.bloggers.errors.push(
            `Blogger ${bloggerData.BloggerId}: ${error.message}`
          );
        } else {
          if (isUpdate) {
            result.bloggers.updated++;
          } else {
            result.bloggers.inserted++;
          }
        }
      } catch (err: any) {
        result.bloggers.errors.push(
          `Blogger ${bloggerData.BloggerId}: ${err.message || 'Unknown error'}`
        );
      }
    }

    // ============================================
    // 步骤2: 提取并处理品牌数据（去重）
    // ============================================
    const brandMap = new Map<string, any>();

    for (const response of noteListResponses) {
      if (response.Code !== 200 || !response.Data?.ItemList) {
        continue;
      }

      for (const item of response.Data.ItemList) {
        if (!item.CooperateBindList || !Array.isArray(item.CooperateBindList)) {
          continue;
        }

        for (const brand of item.CooperateBindList) {
          if (!brand.BrandId) continue;

          const brandData = transformBrandData(brand);
          const brandId = brandData.BrandId;

          if (brandId && !brandMap.has(brandId)) {
            brandMap.set(brandId, brandData);
          }
        }
      }
    }

    // 插入品牌数据（ON CONFLICT DO UPDATE）
    // 先检查哪些已存在
    const existingBrandIds = new Set<string>();
    if (brandMap.size > 0) {
      const brandIds = Array.from(brandMap.keys());
      const { data: existing } = await supabase
        .from('qiangua_brand')
        .select('BrandId')
        .in('BrandId', brandIds);

      if (existing) {
        existing.forEach((b) => existingBrandIds.add(b.BrandId));
      }
    }

    for (const brandData of brandMap.values()) {
      try {
        const isUpdate = existingBrandIds.has(brandData.BrandId!);
        const { error } = await supabase
          .from('qiangua_brand')
          .upsert(
            {
              ...brandData,
              UpdatedAt: new Date().toISOString(),
            },
            {
              onConflict: 'BrandId',
              ignoreDuplicates: false,
            }
          );

        if (error) {
          result.brands.errors.push(
            `Brand ${brandData.BrandId}: ${error.message}`
          );
        } else {
          if (isUpdate) {
            result.brands.updated++;
          } else {
            result.brands.inserted++;
          }
        }
      } catch (err: any) {
        result.brands.errors.push(
          `Brand ${brandData.BrandId}: ${err.message || 'Unknown error'}`
        );
      }
    }

    // ============================================
    // 步骤3: 处理笔记列表数据（getNoteList）
    // ============================================
    const noteMap = new Map<string, any>();

    for (const response of noteListResponses) {
      if (response.Code !== 200 || !response.Data?.ItemList) {
        continue;
      }

      for (const item of response.Data.ItemList) {
        if (!item.NoteId) continue;

        const noteData = transformNoteData(item);
        const noteId = noteData.NoteId;

        if (noteId && !noteMap.has(noteId)) {
          noteMap.set(noteId, noteData);
        }
      }
    }

    // 批量插入笔记数据（分批处理，每批 50 条）
    // 先检查哪些已存在
    const existingNoteIds = new Set<string>();
    if (noteMap.size > 0) {
      const noteIds = Array.from(noteMap.keys());
      // 分批查询（避免 IN 子句过长）
      const queryBatchSize = 100;
      for (let i = 0; i < noteIds.length; i += queryBatchSize) {
        const batch = noteIds.slice(i, i + queryBatchSize);
        const { data: existing } = await supabase
          .from('qiangua_note_info')
          .select('NoteId')
          .in('NoteId', batch);

        if (existing) {
          existing.forEach((n) => existingNoteIds.add(n.NoteId));
        }
      }
    }

    const noteArray = Array.from(noteMap.values());
    const batchSize = 50;

    for (let i = 0; i < noteArray.length; i += batchSize) {
      const batch = noteArray.slice(i, i + batchSize);

      try {
        const { error } = await supabase
          .from('qiangua_note_info')
          .upsert(
            batch.map((note) => ({
              ...note,
              UpdatedAt: new Date().toISOString(),
            })),
            {
              onConflict: 'NoteId',
              ignoreDuplicates: false,
            }
          );

        if (error) {
          result.notes.errors.push(
            `Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`
          );
        } else {
          // 统计新插入和更新的数量
          for (const note of batch) {
            if (existingNoteIds.has(note.NoteId)) {
              result.notes.updated++;
            } else {
              result.notes.inserted++;
            }
          }
        }
      } catch (err: any) {
        result.notes.errors.push(
          `Batch ${Math.floor(i / batchSize) + 1}: ${err.message || 'Unknown error'}`
        );
      }
    }

    // ============================================
    // 步骤4: 更新笔记详情（getSimpleNote）
    // ============================================
    for (const response of noteDetailResponses) {
      if (response.Code !== 200 || !response.Data) {
        continue;
      }

      const detailData = transformNoteDetailData(response.Data);
      const noteId = detailData.NoteId;

      if (!noteId) {
        result.notes.errors.push('Note detail missing NoteId');
        continue;
      }

      try {
        // 更新笔记详情（Content 和 XhsNoteUrl）
        const updateData: any = {
          Content: detailData.Content,
          XhsNoteUrl: detailData.XhsNoteUrl,
          UpdatedAt: new Date().toISOString(),
        };

        // 如果包含博主信息，也更新冗余字段
        if (detailData.BloggerNickName) {
          updateData.BloggerNickName = detailData.BloggerNickName;
        }
        if (detailData.SmallAvatar) {
          updateData.SmallAvatar = detailData.SmallAvatar;
        }

        const { error } = await supabase
          .from('qiangua_note_info')
          .update(updateData)
          .eq('NoteId', noteId);

        if (error) {
          result.notes.errors.push(
            `Note detail ${noteId}: ${error.message}`
          );
        } else {
          result.notes.detailsUpdated++;
        }

        // 同时更新博主信息（如果包含）
        const bloggerData = extractBloggerFromNoteDetail(response.Data);
        if (bloggerData && bloggerData.BloggerId) {
          await supabase
            .from('qiangua_blogger')
            .upsert(
              {
                ...bloggerData,
                UpdatedAt: new Date().toISOString(),
              },
              {
                onConflict: 'BloggerId',
                ignoreDuplicates: false,
              }
            );
        }
      } catch (err: any) {
        result.notes.errors.push(
          `Note detail ${noteId}: ${err.message || 'Unknown error'}`
        );
      }
    }

    // 返回处理结果
    const hasErrors =
      result.bloggers.errors.length > 0 ||
      result.brands.errors.length > 0 ||
      result.notes.errors.length > 0;

    return NextResponse.json({
      success: !hasErrors,
      data: {
        bloggers: {
          inserted: result.bloggers.inserted,
          updated: result.bloggers.updated,
          total: bloggerMap.size,
        },
        brands: {
          inserted: result.brands.inserted,
          updated: result.brands.updated,
          total: brandMap.size,
        },
        notes: {
          inserted: result.notes.inserted,
          updated: result.notes.updated,
          detailsUpdated: result.notes.detailsUpdated,
          total: noteMap.size,
        },
      },
      errors: {
        bloggers: result.bloggers.errors,
        brands: result.brands.errors,
        notes: result.notes.errors,
      },
    });
  } catch (error: any) {
    console.error('Error initializing test data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

