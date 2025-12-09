import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const pickAliases = (row: any): string[] => {
  const aliases: string[] = [];
  const raw = row.AiRelatedProducts || row.airelatedproducts || '';
  if (raw && String(raw).trim()) {
    String(raw)
      .split(/[,，;；]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .forEach((s) => aliases.push(s.slice(0, 200)));
  }
  if (aliases.length === 0) {
    const title = row.Title || row.title || '';
    if (title && String(title).trim()) {
      aliases.push(String(title).trim().slice(0, 200));
    }
  }
  return aliases;
};

const chunk = <T,>(arr: T[], size: number) => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
};

export async function GET(req: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const brandIdKey = searchParams.get('brandIdKey') || '6eb6a5';
    const brandName = searchParams.get('brandName') || 'Prada普拉达';
    // 默认覆盖更新；仅当明确指定 overwrite=false/0 时关闭
    const overwriteParam = searchParams.get('overwrite');
    const overwrite = !(overwriteParam === 'false' || overwriteParam === '0');

    if (!brandIdKey || !brandName) {
      return NextResponse.json(
        { success: false, error: 'brandIdKey 与 brandName 均不能为空' },
        { status: 400 },
      );
    }

    // 获取笔记
    const { data: notes, error: fetchErr } = await supabase
      .from('qiangua_note_info')
      .select(
        'NoteId, Title, BrandId, BrandIdKey, BrandName, AiRelatedProducts, CreatedAt, PublishTime, XhsNoteId, XhsNoteLink, CoverImage',
      )
      .eq('BrandIdKey', brandIdKey)
      .eq('BrandName', brandName);

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }

    if (!notes || notes.length === 0) {
      return NextResponse.json({ success: true, data: { inserted: 0, skipped: 0 } });
    }

    // 处理覆盖：按品牌删除旧数据
    let deleted = 0;
    let existingKeys = new Set<string>();
    if (overwrite) {
      const brandIds = Array.from(
        new Set(
          notes
            .map((n: any) => n.BrandId || n.BrandIdKey || brandIdKey)
            .filter((v) => !!v),
        ),
      );
      let delQuery = supabase
        .from('qiangua_note_product_candidate')
        .delete()
        .eq('BrandName', brandName);
      if (brandIds.length === 1) {
        delQuery = delQuery.eq('BrandId', brandIds[0]);
      } else if (brandIds.length > 1) {
        delQuery = delQuery.in('BrandId', brandIds);
      }
      const { error: delErr } = await delQuery;
      if (delErr) throw new Error(delErr.message);
    } else {
      // 读取已存在的候选，避免重复（NoteId + ProductAliasName 维度）
      const { data: existing, error: existingErr } = await supabase
        .from('qiangua_note_product_candidate')
        .select('NoteId, ProductAliasName')
        .eq('BrandName', brandName);

      if (existingErr) {
        throw new Error(existingErr.message);
      }

      existingKeys = new Set(
        (existing || []).map(
          (row) => `${row.NoteId}__${String(row.ProductAliasName || '').trim().toLowerCase()}`,
        ),
      );
    }

    // 生成待插入数据，跳过无 alias 的，并去重
    const values = notes.flatMap((n: any) => {
      const aliases = pickAliases(n);
      if (!aliases.length) return [];
      const bId = n.BrandId || n.BrandIdKey || brandIdKey;
      return aliases
        .map((alias) => {
          const key = `${n.NoteId}__${alias.trim().toLowerCase()}`;
          if (existingKeys.has(key)) return null;
          existingKeys.add(key);
          return {
            Id: crypto.randomUUID(),
            NoteId: n.NoteId,
            ProductAliasName: alias,
            BrandId: bId,
            BrandName: n.BrandName || brandName,
            XhsNoteId: n.XhsNoteId || null,
            XhsNoteLink: n.XhsNoteLink || null,
            NoteTitle: n.Title || null,
            CoverImage: n.CoverImage || null,
          };
        })
        .filter(Boolean) as any[];
    });

    if (!values.length) {
      return NextResponse.json({ success: true, data: { inserted: 0, skipped: notes.length } });
    }

    // 分批插入（已在内存去重）
    const chunks = chunk(values, 500);
    let inserted = 0;
    for (const c of chunks) {
      const { error } = await supabase
        .from('qiangua_note_product_candidate')
        .insert(c);
      if (error) throw new Error(error.message);
      inserted += c.length; // 实际插入条数 Supabase 不返回 rowCount，这里按尝试数计
    }

    return NextResponse.json({
      success: true,
      data: {
        inserted,
        skipped: notes.length - values.length,
        totalSource: notes.length,
        attempted: values.length,
        overwrite,
      },
    });
  } catch (err: any) {
    console.error('[backfill-note-product-candidates][GET] error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}

