-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create scripts table (New top-level entity)
create table if not exists public.scripts (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create files table
-- Note: 'files' now belongs to a 'script' (project), not directly to a user.
-- Access control will check if the user owns the script.
create table if not exists public.files (
  id uuid default uuid_generate_v4() primary key,
  script_id uuid references public.scripts(id) on delete cascade not null,
  path text not null,
  name text not null, -- derived from path usually, but kept for convenience
  type text not null check (type in ('file', 'folder')),
  mime_type text, -- e.g. 'text/markdown', 'application/javascript'
  content text,
  pending_content text, -- Draft content for review
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(script_id, path)
);

-- Create conversations table
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  script_id uuid references public.scripts(id) on delete cascade not null,
  title text not null,
  last_agent_mode text default 'script', -- 'script' or 'game'
  status text default 'active' check (status in ('active', 'archived')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create messages table
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb, -- For storing extra flags, file_id references, etc.
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.scripts enable row level security;
alter table public.files enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Policies for scripts
create policy "Users can view their own scripts" on public.scripts for select using ( auth.uid()::text = user_id );
create policy "Users can insert their own scripts" on public.scripts for insert with check ( auth.uid()::text = user_id );
create policy "Users can update their own scripts" on public.scripts for update using ( auth.uid()::text = user_id );
create policy "Users can delete their own scripts" on public.scripts for delete using ( auth.uid()::text = user_id );

-- Policies for files (RLS checks based on Script ownership)
-- Ideally we would do a join check, but for simplicity/performance in this dev phase, 
-- we imply security via the script modification policies. 
-- However, correct RLS requires `exists`.
create policy "Users can view files of their scripts" on public.files for select using ( 
  exists (select 1 from public.scripts where id = files.script_id and (user_id = auth.uid()::text)) 
);
create policy "Users can insert files to their scripts" on public.files for insert with check (
  exists (select 1 from public.scripts where id = script_id and (user_id = auth.uid()::text))
);
create policy "Users can update files of their scripts" on public.files for update using (
  exists (select 1 from public.scripts where id = files.script_id and (user_id = auth.uid()::text))
);
create policy "Users can delete files of their scripts" on public.files for delete using (
  exists (select 1 from public.scripts where id = files.script_id and (user_id = auth.uid()::text))
);

-- Policies for conversations
create policy "Users can view conversations of their scripts" on public.conversations for select using (
  exists (select 1 from public.scripts where id = conversations.script_id and (user_id = auth.uid()::text))
);
create policy "Users can insert conversations to their scripts" on public.conversations for insert with check (
  exists (select 1 from public.scripts where id = script_id and (user_id = auth.uid()::text))
);
create policy "Users can update conversations of their scripts" on public.conversations for update using (
  exists (select 1 from public.scripts where id = conversations.script_id and (user_id = auth.uid()::text))
);
create policy "Users can delete conversations of their scripts" on public.conversations for delete using (
  exists (select 1 from public.scripts where id = conversations.script_id and (user_id = auth.uid()::text))
);

-- Policies for messages
create policy "Users can view messages of their conversations" on public.messages for select using (
  exists (
    select 1 from public.conversations c 
    join public.scripts s on s.id = c.script_id
    where c.id = messages.conversation_id and (s.user_id = auth.uid()::text)
  )
);
create policy "Users can insert messages to their conversations" on public.messages for insert with check (
   exists (
    select 1 from public.conversations c 
    join public.scripts s on s.id = c.script_id
    where c.id = conversation_id and (s.user_id = auth.uid()::text)
  )
);

-- Enable Realtime
alter publication supabase_realtime add table public.scripts;
alter publication supabase_realtime add table public.files;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
