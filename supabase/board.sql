-- Schul-PIP Tafelbild: the class builds one lesson result together. Run AFTER schema.sql, once, in the Supabase SQL editor.
-- Safe to run again.

-- A moderator (the teacher, or whoever started the group) may accept proposals, start polls and close the board.
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('owner', 'mod', 'member'));

create or replace function public.is_mod(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.members
        where group_id = g and user_id = auth.uid() and role in ('owner', 'mod')
    );
$$;

create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
    if p_role not in ('mod', 'member') then raise exception 'Unbekannte Rolle.'; end if;
    if not exists (select 1 from public.members where group_id = p_group and user_id = auth.uid() and role = 'owner') then
        raise exception 'Nur der Gründer vergibt Rollen.';
    end if;
    update public.members set role = p_role where group_id = p_group and user_id = p_user and role <> 'owner';
end;
$$;

-- Tables --------------------------------------------------------------------------------------------------------------

create table if not exists public.boards (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.groups (id) on delete cascade,
    title text not null check (char_length(trim(title)) between 1 and 120),
    topic text not null default '' check (char_length(topic) <= 200),
    template text not null default 'general' check (template in ('general', 'math', 'chemistry', 'history', 'biology')),
    lesson_date date not null default current_date,
    status text not null default 'open' check (status in ('open', 'locked', 'final')),
    created_by uuid not null references public.profiles (id),
    finalized_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists boards_group_idx on public.boards (group_id, lesson_date desc);

create table if not exists public.board_blocks (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards (id) on delete cascade,
    kind text not null check (char_length(kind) between 1 and 30),
    title text not null default '' check (char_length(title) <= 120),
    body text not null default '' check (char_length(body) <= 4000),
    attachment_path text,
    status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
    position double precision not null default 0,
    author uuid not null references public.profiles (id),
    -- A correction proposes a replacement for an accepted block; accepting it retires the old one.
    replaces_block uuid references public.board_blocks (id) on delete set null,
    rev integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (char_length(trim(title)) > 0 or char_length(trim(body)) > 0 or attachment_path is not null)
);
create index if not exists board_blocks_idx on public.board_blocks (board_id, status, position);

create table if not exists public.board_versions (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards (id) on delete cascade,
    label text not null,
    content jsonb not null,
    created_by uuid references public.profiles (id),
    created_at timestamptz not null default now()
);
create index if not exists board_versions_idx on public.board_versions (board_id, created_at);

create table if not exists public.polls (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards (id) on delete cascade,
    question text not null check (char_length(trim(question)) between 1 and 200),
    status text not null default 'open' check (status in ('open', 'closed')),
    winner uuid references public.board_blocks (id) on delete set null,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    closed_at timestamptz
);
create index if not exists polls_board_idx on public.polls (board_id, created_at);

create table if not exists public.poll_options (
    poll_id uuid not null references public.polls (id) on delete cascade,
    block_id uuid not null references public.board_blocks (id) on delete cascade,
    primary key (poll_id, block_id)
);

create table if not exists public.poll_votes (
    poll_id uuid not null references public.polls (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    block_id uuid not null references public.board_blocks (id) on delete cascade,
    primary key (poll_id, user_id)
);

-- Helpers -------------------------------------------------------------------------------------------------------------

create or replace function public.board_group(b uuid) returns uuid
language sql stable security definer set search_path = public as $$
    select group_id from public.boards where id = b;
$$;

create or replace function public.board_is_open(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.boards where id = b and status = 'open');
$$;

-- Saves the accepted blocks as a version, so nothing a student does can be lost for good.
create or replace function public.snapshot_board(p_board uuid, p_label text) returns void
language plpgsql security definer set search_path = public as $$
begin
    insert into public.board_versions (board_id, label, content, created_by)
    select p_board, p_label,
           coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'title', title, 'body', body, 'attachment_path', attachment_path,
               'position', position, 'author', author
           ) order by position), '[]'::jsonb),
           auth.uid()
    from public.board_blocks where board_id = p_board and status = 'accepted';
end;
$$;

-- Moderator actions ---------------------------------------------------------------------------------------------------

create or replace function public.create_board(p_group uuid, p_title text, p_topic text, p_template text)
returns public.boards language plpgsql security definer set search_path = public as $$
declare
    result public.boards;
begin
    if not public.is_mod(p_group) then raise exception 'Nur Moderatoren starten eine Ergebnissicherung.'; end if;
    insert into public.boards (group_id, title, topic, template, created_by)
    values (p_group, trim(p_title), coalesce(p_topic, ''), coalesce(p_template, 'general'), auth.uid())
    returning * into result;
    return result;
end;
$$;

create or replace function public.accept_block(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
    b public.board_blocks;
    g uuid;
    next_position double precision;
    old_position double precision;
begin
    select * into b from public.board_blocks where id = p_block;
    if not found then raise exception 'Diesen Beitrag gibt es nicht.'; end if;
    g := public.board_group(b.board_id);
    if not public.is_mod(g) then raise exception 'Nur Moderatoren übernehmen Beiträge.'; end if;
    if not public.board_is_open(b.board_id) then raise exception 'Das Tafelbild ist gesperrt.'; end if;
    select coalesce(max(position), 0) + 1 into next_position
        from public.board_blocks where board_id = b.board_id and status = 'accepted';
    -- Only a block of the same board can be replaced.
    if b.replaces_block is not null then
        select position into old_position from public.board_blocks where id = b.replaces_block and board_id = b.board_id;
        update public.board_blocks set status = 'rejected', updated_at = now()
            where id = b.replaces_block and board_id = b.board_id;
        next_position := coalesce(old_position, next_position);
    end if;
    update public.board_blocks set status = 'accepted', position = next_position, rev = rev + 1, updated_at = now()
        where id = p_block;
    perform public.snapshot_board(b.board_id, 'Übernommen: ' || left(coalesce(nullif(trim(b.title), ''), b.kind), 60));
end;
$$;

create or replace function public.reject_block(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
    b public.board_blocks;
begin
    select * into b from public.board_blocks where id = p_block;
    if not found then raise exception 'Diesen Beitrag gibt es nicht.'; end if;
    if not public.is_mod(public.board_group(b.board_id)) then raise exception 'Nur Moderatoren lehnen Beiträge ab.'; end if;
    if not public.board_is_open(b.board_id) then raise exception 'Das Tafelbild ist gesperrt.'; end if;
    update public.board_blocks set status = 'rejected', rev = rev + 1, updated_at = now() where id = p_block;
    if b.status = 'accepted' then
        perform public.snapshot_board(b.board_id, 'Entfernt: ' || left(coalesce(nullif(trim(b.title), ''), b.kind), 60));
    end if;
end;
$$;

-- Moderators edit any block; the author edits their own proposal while it is open. p_rev is the revision the editor saw:
-- if somebody else changed the block meanwhile, nothing is overwritten.
create or replace function public.edit_block(p_block uuid, p_title text, p_body text, p_rev integer)
returns public.board_blocks language plpgsql security definer set search_path = public as $$
declare
    b public.board_blocks;
    result public.board_blocks;
begin
    select * into b from public.board_blocks where id = p_block;
    if not found then raise exception 'Diesen Beitrag gibt es nicht.'; end if;
    if not public.board_is_open(b.board_id) then raise exception 'Das Tafelbild ist gesperrt.'; end if;
    if not (public.is_mod(public.board_group(b.board_id)) or (b.author = auth.uid() and b.status = 'proposed')) then
        raise exception 'Das darfst du nicht ändern. Schlag stattdessen eine Korrektur vor.';
    end if;
    if b.rev <> p_rev then raise exception 'Jemand hat den Beitrag gerade geändert. Lade neu und versuch es noch einmal.'; end if;
    update public.board_blocks
        set title = left(coalesce(p_title, ''), 120), body = left(coalesce(p_body, ''), 4000), rev = rev + 1, updated_at = now()
        where id = p_block returning * into result;
    if b.status = 'accepted' then
        perform public.snapshot_board(b.board_id, 'Geändert: ' || left(coalesce(nullif(trim(result.title), ''), result.kind), 60));
    end if;
    return result;
end;
$$;

create or replace function public.withdraw_block(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
    delete from public.board_blocks
        where id = p_block and author = auth.uid() and status = 'proposed' and public.board_is_open(board_id);
end;
$$;

create or replace function public.set_board_status(p_board uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
    if p_status not in ('open', 'locked') then raise exception 'Unbekannter Status.'; end if;
    if not public.is_mod(public.board_group(p_board)) then raise exception 'Nur Moderatoren sperren das Tafelbild.'; end if;
    update public.boards set status = p_status where id = p_board and status <> 'final';
end;
$$;

create or replace function public.finalize_board(p_board uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_mod(public.board_group(p_board)) then raise exception 'Nur Moderatoren schließen die Sicherung ab.'; end if;
    perform public.snapshot_board(p_board, 'FINAL');
    update public.polls set status = 'closed', closed_at = now() where board_id = p_board and status = 'open';
    update public.boards set status = 'final', finalized_at = now() where id = p_board and status <> 'final';
end;
$$;

-- Putting an older version back: the accepted blocks are replaced by the saved ones (rejected and open proposals stay).
create or replace function public.restore_board_version(p_version uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
    v public.board_versions;
    item jsonb;
begin
    select * into v from public.board_versions where id = p_version;
    if not found then raise exception 'Diese Version gibt es nicht.'; end if;
    if not public.is_mod(public.board_group(v.board_id)) then raise exception 'Nur Moderatoren stellen Versionen wieder her.'; end if;
    if not public.board_is_open(v.board_id) then raise exception 'Das Tafelbild ist gesperrt.'; end if;
    perform public.snapshot_board(v.board_id, 'Vor Wiederherstellung');
    update public.board_blocks set status = 'rejected', rev = rev + 1, updated_at = now()
        where board_id = v.board_id and status = 'accepted';
    for item in select * from jsonb_array_elements(v.content) loop
        insert into public.board_blocks (board_id, kind, title, body, attachment_path, status, position, author)
        values (v.board_id, item ->> 'kind', coalesce(item ->> 'title', ''), coalesce(item ->> 'body', ''),
                item ->> 'attachment_path', 'accepted', (item ->> 'position')::double precision, (item ->> 'author')::uuid);
    end loop;
end;
$$;

-- Polls: the moderator puts several proposals up, everybody votes once, closing accepts the winner -------------------

create or replace function public.start_poll(p_board uuid, p_question text, p_blocks uuid[]) returns public.polls
language plpgsql security definer set search_path = public as $$
declare
    result public.polls;
    block uuid;
begin
    if not public.is_mod(public.board_group(p_board)) then raise exception 'Nur Moderatoren starten Abstimmungen.'; end if;
    if not public.board_is_open(p_board) then raise exception 'Das Tafelbild ist gesperrt.'; end if;
    if coalesce(array_length(p_blocks, 1), 0) < 2 then raise exception 'Eine Abstimmung braucht mindestens zwei Beiträge.'; end if;
    insert into public.polls (board_id, question, created_by) values (p_board, trim(p_question), auth.uid())
        returning * into result;
    foreach block in array p_blocks loop
        insert into public.poll_options (poll_id, block_id)
            select result.id, id from public.board_blocks where id = block and board_id = p_board and status = 'proposed';
    end loop;
    return result;
end;
$$;

create or replace function public.vote(p_poll uuid, p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
    p public.polls;
begin
    select * into p from public.polls where id = p_poll;
    if not found or p.status <> 'open' then raise exception 'Diese Abstimmung ist beendet.'; end if;
    if not public.is_member(public.board_group(p.board_id)) then raise exception 'Du gehörst nicht zu dieser Gruppe.'; end if;
    if not exists (select 1 from public.poll_options where poll_id = p_poll and block_id = p_block) then
        raise exception 'Diese Antwort steht nicht zur Wahl.';
    end if;
    insert into public.poll_votes (poll_id, user_id, block_id) values (p_poll, auth.uid(), p_block)
        on conflict (poll_id, user_id) do update set block_id = excluded.block_id;
end;
$$;

-- Counts only; who voted for what stays secret.
create or replace function public.poll_counts(p_board uuid) returns table (poll_id uuid, block_id uuid, votes bigint)
language sql stable security definer set search_path = public as $$
    select o.poll_id, o.block_id, count(v.user_id)
    from public.polls p
    join public.poll_options o on o.poll_id = p.id
    left join public.poll_votes v on v.poll_id = o.poll_id and v.block_id = o.block_id
    where p.board_id = p_board and public.is_member(public.board_group(p_board))
    group by o.poll_id, o.block_id;
$$;

create or replace function public.my_votes(p_board uuid) returns table (poll_id uuid, block_id uuid)
language sql stable security definer set search_path = public as $$
    select v.poll_id, v.block_id
    from public.poll_votes v join public.polls p on p.id = v.poll_id
    where p.board_id = p_board and v.user_id = auth.uid();
$$;

create or replace function public.close_poll(p_poll uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
    p public.polls;
    top uuid;
begin
    select * into p from public.polls where id = p_poll;
    if not found or p.status <> 'open' then raise exception 'Diese Abstimmung ist schon beendet.'; end if;
    if not public.is_mod(public.board_group(p.board_id)) then raise exception 'Nur Moderatoren beenden Abstimmungen.'; end if;
    select o.block_id into top
    from public.poll_options o
    left join public.poll_votes v on v.poll_id = o.poll_id and v.block_id = o.block_id
    join public.board_blocks b on b.id = o.block_id
    where o.poll_id = p_poll
    group by o.block_id, b.created_at
    order by count(v.user_id) desc, b.created_at asc
    limit 1;
    update public.polls set status = 'closed', winner = top, closed_at = now() where id = p_poll;
    if top is not null then
        perform public.accept_block(top);
        update public.board_blocks set status = 'rejected', rev = rev + 1, updated_at = now()
            where status = 'proposed' and id in (select block_id from public.poll_options where poll_id = p_poll) and id <> top;
    end if;
end;
$$;

-- Row level security --------------------------------------------------------------------------------------------------

alter table public.boards enable row level security;
alter table public.board_blocks enable row level security;
alter table public.board_versions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards for select to authenticated using (public.is_member(group_id));

drop policy if exists blocks_read on public.board_blocks;
create policy blocks_read on public.board_blocks for select to authenticated
    using (public.is_member(public.board_group(board_id)));
-- Everybody in the group proposes; only proposals, only as themselves, only while the board is open.
drop policy if exists blocks_propose on public.board_blocks;
create policy blocks_propose on public.board_blocks for insert to authenticated
    with check (
        author = auth.uid() and status = 'proposed' and rev = 1
        and public.is_member(public.board_group(board_id)) and public.board_is_open(board_id)
    );

drop policy if exists versions_read on public.board_versions;
create policy versions_read on public.board_versions for select to authenticated
    using (public.is_member(public.board_group(board_id)));

drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select to authenticated
    using (public.is_member(public.board_group(board_id)));

drop policy if exists poll_options_read on public.poll_options;
create policy poll_options_read on public.poll_options for select to authenticated
    using (exists (select 1 from public.polls p where p.id = poll_options.poll_id and public.is_member(public.board_group(p.board_id))));

-- Files of a board live in the group's folder of the same bucket, so the storage policies already cover them.

grant select on public.boards, public.board_blocks, public.board_versions, public.polls, public.poll_options to authenticated;
grant insert on public.board_blocks to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.create_board(uuid, text, text, text) to authenticated;
grant execute on function public.accept_block(uuid) to authenticated;
grant execute on function public.reject_block(uuid) to authenticated;
grant execute on function public.edit_block(uuid, text, text, integer) to authenticated;
grant execute on function public.withdraw_block(uuid) to authenticated;
grant execute on function public.set_board_status(uuid, text) to authenticated;
grant execute on function public.finalize_board(uuid) to authenticated;
grant execute on function public.restore_board_version(uuid) to authenticated;
grant execute on function public.start_poll(uuid, text, uuid[]) to authenticated;
grant execute on function public.vote(uuid, uuid) to authenticated;
grant execute on function public.poll_counts(uuid) to authenticated;
grant execute on function public.my_votes(uuid) to authenticated;
grant execute on function public.close_poll(uuid) to authenticated;
