-- AUTH_OTPS: If you choose to handle OTPs manually with Nodemailer
create table public.auth_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

-- PROFILES: Store onboarding and preference data
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  interests text[] default '{}',
  agent_mode text check (agent_mode in ('aggressive', 'supportive', 'professional', 'balanced')) default 'balanced',
  has_onboarded boolean default false,
  updated_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Automatically create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- EVENTS: Store calendar and schedule data
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  location text,
  start_date timestamptz not null,
  end_date timestamptz,
  all_day boolean default false,
  color text default '#e0e7ff',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS for Events
alter table public.events enable row level security;

create policy "Users can modify their own events" on public.events
  for all using (auth.uid() = user_id);
