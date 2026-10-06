-- Schul-PIP social backend for Supabase: courses, groups, chat, results, file storage.
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query -> paste -> Run).
-- Safe to run again: everything is "if not exists" / "or replace".

create extension if not exists pgcrypto;

-- Profiles ------------------------------------------------------------------------------------------------------

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null default 'Unbenannt',
    created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_user();

-- Groups: a course (kind = 'course') or a work group inside a course (kind = 'group', parent_id = the course) ------

create table if not exists public.groups (
    id uuid primary key default gen_random_uuid(),
    parent_id uuid references public.groups (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 80),
    kind text not null check (kind in ('course', 'group')),
    join_code text not null unique,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    check ((kind = 'course' and parent_id is null) or (kind = 'group' and parent_id is not null))
);

create table if not exists public.members (
    group_id uuid not null references public.groups (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    role text not null default 'member' check (role in ('owner', 'member')),
    joined_at timestamptz not null default now(),
    primary key (group_id, user_id)
);
create index if not exists members_user_idx on public.members (user_id);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.groups (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    body text not null default '' check (char_length(body) <= 4000),
    attachment_path text,
    attachment_name text,
    created_at timestamptz not null default now(),
    check (char_length(trim(body)) > 0 or attachment_path is not null)
);
create index if not exists messages_group_idx on public.messages (group_id, created_at);

-- Results a group keeps: files with a title (worksheets, solutions, notes as PDF).
create table if not exists public.results (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.groups (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    title text not null check (char_length(trim(title)) between 1 and 120),
    path text not null,
    file_name text not null,
    created_at timestamptz not null default now()
);
create index if not exists results_group_idx on public.results (group_id, created_at);

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.messages (id) on delete cascade,
    reporter uuid not null references public.profiles (id) on delete cascade,
    reason text not null default '',
    created_at timestamptz not null default now()
);

-- Helpers -------------------------------------------------------------------------------------------------------

create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.members where group_id = g and user_id = auth.uid());
$$;

create or replace function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.members a join public.members b on a.group_id = b.group_id
        where a.user_id = auth.uid() and b.user_id = other
    );
$$;

-- Codes without 0/O/1/I so they can be read aloud.
create or replace function public.new_join_code() returns text
language plpgsql volatile as $$
declare
    alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code text;
    i int;
begin
    loop
        code := '';
        for i in 1..6 loop
            code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
        end loop;
        exit when not exists (select 1 from public.groups where join_code = code);
    end loop;
    return code;
end;
$$;

-- Actions that change membership go through functions, so nobody can add themselves to a group by hand -------------

create or replace function public.create_group(p_name text, p_kind text, p_parent uuid default null)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
    result public.groups;
begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if p_kind = 'group' and (p_parent is null or not public.is_member(p_parent)) then
        raise exception 'Gruppen kannst du nur in einem Kurs anlegen, in dem du Mitglied bist.';
    end if;
    insert into public.groups (parent_id, name, kind, join_code, created_by)
    values (case when p_kind = 'group' then p_parent else null end, trim(p_name), p_kind, public.new_join_code(), auth.uid())
    returning * into result;
    insert into public.members (group_id, user_id, role) values (result.id, auth.uid(), 'owner');
    return result;
end;
$$;

create or replace function public.join_group(p_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
    target public.groups;
begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    select * into target from public.groups where join_code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
    if not found then raise exception 'Diesen Code gibt es nicht.'; end if;
    -- A work group can only be joined by members of its course.
    if target.parent_id is not null and not public.is_member(target.parent_id) then
        raise exception 'Tritt zuerst dem Kurs bei.';
    end if;
    insert into public.members (group_id, user_id) values (target.id, auth.uid()) on conflict do nothing;
    return target;
end;
$$;

create or replace function public.join_subgroup(p_group uuid)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
    target public.groups;
begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    select * into target from public.groups where id = p_group and parent_id is not null;
    if not found or not public.is_member(target.parent_id) then raise exception 'Diese Gruppe ist nicht verfügbar.'; end if;
    insert into public.members (group_id, user_id) values (target.id, auth.uid()) on conflict do nothing;
    return target;
end;
$$;

create or replace function public.leave_group(p_group uuid) returns void
language sql security definer set search_path = public as $$
    delete from public.members where group_id = p_group and user_id = auth.uid();
$$;

-- Row level security --------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.messages enable row level security;
alter table public.results enable row level security;
alter table public.reports enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
    using (id = auth.uid() or public.shares_group(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid());

-- A group is visible to its members, and a work group also to the members of its course (to join it).
drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated
    using (public.is_member(id) or (parent_id is not null and public.is_member(parent_id)));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated
    using (public.is_member(group_id));

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
    using (public.is_member(group_id));
drop policy if exists messages_write on public.messages;
create policy messages_write on public.messages for insert to authenticated
    with check (public.is_member(group_id) and user_id = auth.uid());
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
    using (user_id = auth.uid());

drop policy if exists results_read on public.results;
create policy results_read on public.results for select to authenticated
    using (public.is_member(group_id));
drop policy if exists results_write on public.results;
create policy results_write on public.results for insert to authenticated
    with check (public.is_member(group_id) and user_id = auth.uid());
drop policy if exists results_delete on public.results;
create policy results_delete on public.results for delete to authenticated
    using (user_id = auth.uid());

drop policy if exists reports_write on public.reports;
create policy reports_write on public.reports for insert to authenticated
    with check (reporter = auth.uid());

-- Files: one private bucket, one folder per group (the first path segment is the group's id) ---------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 20971520)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

drop policy if exists files_read on storage.objects;
create policy files_read on storage.objects for select to authenticated
    using (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists files_write on storage.objects;
create policy files_write on storage.objects for insert to authenticated
    with check (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));

-- API access ----------------------------------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select on public.profiles, public.groups, public.members, public.messages, public.results to authenticated;
grant insert, delete on public.messages, public.results to authenticated;
grant insert on public.reports to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant execute on function public.create_group(text, text, uuid) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.join_subgroup(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
