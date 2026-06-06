# Availability Matcher

A small React app that helps four people find a shared meeting time during the week.

## How it works

Each member enters a daily start and end time for Monday through Sunday. The app computes any day where all four schedules overlap and shows the available meeting window.

## Realtime collaboration

The app can sync schedules through Supabase so multiple people can edit the same board at the same time.

Set these environment variables before running the app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Create this table in Supabase:

```sql
create table if not exists public.team_schedules (
	id text primary key,
	people jsonb not null,
	updated_at timestamptz not null default now()
);

alter table public.team_schedules enable row level security;

create policy "allow shared schedule access"
on public.team_schedules
for all
using (true)
with check (true);
```

## Scripts

- `npm run dev` - start the local dev server
- `npm run build` - type-check and build the app
- `npm run preview` - preview the production build
- `npm run deploy` - publish the built app to GitHub Pages

## Notes

- Enter times in 24-hour format.
- A meeting slot appears only when all four members have valid overlapping availability for the same day.
- Without Supabase env vars, the app falls back to local-only editing.
