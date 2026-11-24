# supabase/ — the optional server side

The site works fully without this: everything stays in the visitor's browser.
Signing in adds cross-device sync (watched lectures, My Term, saved marks) and
the resource-suggestion queue. One Supabase project powers all of it.

## One-time setup

1. Create a project at https://supabase.com (free tier is fine).
2. **Auth → Providers → Google**: enable it with a Google OAuth client
   (any Google account may sign in; IITM student addresses get a "verified"
   badge automatically). Add the site URL
   (`https://iitmbsc-student-projects.github.io/the-companion/`) and
   `http://localhost:8000` to **Auth → URL Configuration → Redirect URLs**.
3. Apply the schema: `supabase db push`, or paste
   `migrations/0001_init.sql` into the SQL editor.
4. Put the project URL and the **anon public** key into `assets/config.js`.
   Only those two values ever reach the browser.
5. Deploy the Edge Function and its secrets (needed for approving
   suggestions into pull requests):

   ```
   supabase functions deploy approve-suggestion
   supabase secrets set GITHUB_TOKEN=<a fine-grained token with contents+PR write on the repo>
   supabase secrets set GITHUB_REPO=iitmbsc-student-projects/the-companion
   ```

6. Make yourself admin (SQL editor, after your first sign-in):

   ```sql
   update public.profiles set role = 'admin' where id = '<your auth uid>';
   ```

Moderators are promoted the same way with `role = 'moderator'`.

## What lives where

```
migrations/0001_init.sql            tables, RLS policies, triggers
migrations/0002_degree_plans.sql    private degree-planner row (grades, track, transfers)
functions/approve-suggestion/       moderator "approve" → GitHub pull request
```

The service-role key and the GitHub token exist only as function secrets;
they are never in this repo or in the browser.
