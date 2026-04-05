-- Player poems: one AI-generated poem per player, regenerated when match count changes.
create table if not exists player_poems (
  player_id uuid primary key references players(id) on delete cascade,
  poem text not null,
  matches_at_generation int not null default 0,
  created_at timestamptz not null default now()
);
