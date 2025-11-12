-- Supabase schema 默认 public
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new."UpdatedAt" := now();
  return new;
end;
$$ language plpgsql;

create or replace function public.normalize_tag_set_name()
returns trigger as $$
begin
  new."TagSetName" := nullif(btrim(new."TagSetName"), '');
  return new;
end;
$$ language plpgsql;

create or replace function public.normalize_tag_name()
returns trigger as $$
begin
  new."TagName" := nullif(btrim(new."TagName"), '');
  return new;
end;
$$ language plpgsql;

create table public.qiangua_tag_set (
  "TagSetId" uuid not null default gen_random_uuid(),
  "TagSetName" text not null,
  "Description" text null,
  type text not null default 'custom'::text,
  "UserId" uuid null,
  "CreatedAt" timestamp with time zone not null default now(),
  "UpdatedAt" timestamp with time zone not null default now(),
  constraint qiangua_tag_set_pkey primary key ("TagSetId"),
  constraint chk_tag_set_name_length check (
    char_length(btrim("TagSetName")) >= 4
    and char_length(btrim("TagSetName")) <= 20
  ),
  constraint chk_tag_set_owner_scope check (
    (type = 'system'::text and "UserId" is null)
    or (type = 'custom'::text and "UserId" is not null)
  ),
  constraint chk_tag_set_type check (
    type = any (array['system'::text, 'custom'::text])
  )
);

create table public.qiangua_tag (
  "TagId" uuid not null default gen_random_uuid(),
  "TagSetId" uuid not null,
  "TagName" text not null,
  "UserId" uuid null,
  "CreatedAt" timestamp with time zone not null default now(),
  "UpdatedAt" timestamp with time zone not null default now(),
  constraint qiangua_tag_pkey primary key ("TagId"),
  constraint qiangua_tag_TagSetId_fkey foreign key ("TagSetId") references public.qiangua_tag_set ("TagSetId") on delete cascade,
  constraint chk_tag_name_length check (
    char_length(btrim("TagName")) >= 4
    and char_length(btrim("TagName")) <= 20
  )
);

create table public.qiangua_note_tag (
  "NoteId" character varying not null,
  "TagId" uuid not null,
  "UserId" uuid not null,
  "CreatedAt" timestamp with time zone not null default now(),
  "UpdatedAt" timestamp with time zone not null default now(),
  constraint pk_qiangua_note_tag primary key ("NoteId", "TagId"),
  constraint qiangua_note_tag_NoteId_fkey foreign key ("NoteId") references public.qiangua_note_info ("NoteId") on delete cascade,
  constraint qiangua_note_tag_TagId_fkey foreign key ("TagId") references public.qiangua_tag ("TagId") on delete cascade
);

create unique index if not exists uq_tag_set_system_name
  on public.qiangua_tag_set using btree (lower("TagSetName"))
  where type = 'system'::text
  tablespace pg_default;

create unique index if not exists uq_tag_set_user_name
  on public.qiangua_tag_set using btree ("UserId", lower("TagSetName"))
  where type = 'custom'::text
  tablespace pg_default;

create unique index if not exists uq_tag_name_per_set
  on public.qiangua_tag using btree ("TagSetId", lower("TagName"))
  tablespace pg_default;

create index if not exists idx_tag_by_user
  on public.qiangua_tag using btree ("UserId")
  tablespace pg_default;

create index if not exists idx_note_tag_tagid
  on public.qiangua_note_tag using btree ("TagId")
  tablespace pg_default;

create index if not exists idx_note_tag_user
  on public.qiangua_note_tag using btree ("UserId")
  tablespace pg_default;

create trigger trg_normalize_tag_set_name
before insert or update on public.qiangua_tag_set
for each row
execute function public.normalize_tag_set_name();

create trigger trg_normalize_tag_name
before insert or update on public.qiangua_tag
for each row
execute function public.normalize_tag_name();

create trigger trg_set_qiangua_tag_set_updated_at
before update on public.qiangua_tag_set
for each row
execute function public.set_updated_at();

create trigger trg_set_qiangua_tag_updated_at
before update on public.qiangua_tag
for each row
execute function public.set_updated_at();

create trigger trg_set_qiangua_note_tag_updated_at
before update on public.qiangua_note_tag
for each row
execute function public.set_updated_at();

