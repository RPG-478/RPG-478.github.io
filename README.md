<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NU-oQbqcQlupUd2X7BEaj1TAE4uhxP96

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set Supabase env vars in [.env.local](.env.local):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Run the app:
   `npm run dev`

## Supabase Setup (Auth + Edge Function)

1. Create a Supabase project and enable Google OAuth in Auth settings.
2. Run the SQL in [supabase/sql/init.sql](supabase/sql/init.sql).
3. Deploy the Edge Function in [supabase/functions/generate-diagram/index.ts](supabase/functions/generate-diagram/index.ts).
4. Set Edge Function secrets:
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## GitHub Pages (Build Env)

Set GitHub Actions secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
