# Besa Studio

Phase 6 foundation for a Balkan-first AI app builder focused on Kosovo and Albania.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Localized `sq` and `en` route structure
- Supabase-first persistence adapter with local development fallback

## Included in Phase 6

- Public landing page
- Auth pages
- Workspace list
- Real workspace creation flow
- Real project creation flow with prompt and structured wizard modes
- Workspace shell backed by the storage adapter
- Project builder shell with Plan, Visual, Code, and Preview tabs
- Plan Mode review route with stored revisions and review state inside the builder
- Visual Builder V1 with persisted pages, sections, and theme tokens
- Initial visual scaffold generation from the current approved or latest plan revision
- Section selection, ordering, visibility toggles, and theme token persistence
- Preview V1 rendered from the persisted visual state, pages, sections, and theme tokens
- Desktop, tablet, and mobile preview modes with project page switching
- Dark/light theme
- Local fallback seed data when Supabase is not configured

## Run locally

```bash
cd "/Users/elly/Documents/New project"
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Supabase setup

Create `.env.local` from `.env.example` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Then apply the SQL in:

- [20260310_phase2_foundation.sql](/Users/elly/Documents/New project/supabase/migrations/20260310_phase2_foundation.sql)
- [20260310_phase3_plan_mode.sql](/Users/elly/Documents/New project/supabase/migrations/20260310_phase3_plan_mode.sql)
- [20260310_phase5_visual_builder.sql](/Users/elly/Documents/New project/supabase/migrations/20260310_phase5_visual_builder.sql)

## Demo routes

- `/sq`
- `/en`
- `/sq/login`
- `/sq/signup`
- `/sq/app/workspaces`
- `/sq/app/workspaces/new`
- `/sq/app/workspaces/besa-studio`
- `/sq/app/workspaces/besa-studio/projects/new`
- `/sq/app/workspaces/besa-studio/projects/denta-plus-tirana`
- `/sq/app/workspaces/besa-studio/projects/denta-plus-tirana/plan`
- `/sq/app/workspaces/besa-studio/projects/denta-plus-tirana/visual`
- `/sq/app/workspaces/besa-studio/projects/denta-plus-tirana/code`
- `/sq/app/workspaces/besa-studio/projects/denta-plus-tirana/preview`

## Notes

- AI generation is not built yet.
- The planner output is still mocked behind a replaceable planner service.
- Preview renders the persisted visual model and remains read-only in this phase.
- Code is still a structured shell, not a real editor.
- Billing is not built yet.
- Deployment publishing is not built yet.
- Admin is not built yet.
- The older `index.html`, `styles.css`, and `script.js` files are legacy prototype assets and are not part of the new Next.js app.
