// approve-suggestion: a moderator approves a pending suggestion and this
// function turns it into a GitHub pull request editing data/courses/<stem>.json
// (for a new resource), or into a GitHub issue (broken link / correction,
// which need human judgement rather than a mechanical file edit).
//
// Secrets (supabase secrets set ...): GITHUB_TOKEN, GITHUB_REPO ("owner/repo").
// The caller's JWT is verified and their moderator role re-checked here, on
// the server; the client-side check in moderate.js is cosmetic only.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const GH_API = "https://api.github.com";

async function gh(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(GH_API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} -> ${res.status}: ${json.message || "error"}`);
  }
  return json;
}

// UTF-8-safe base64 (atob/btoa alone mangle non-ASCII).
function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
function b64decode(s: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "POST only" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ghToken = Deno.env.get("GITHUB_TOKEN");
  const ghRepo = Deno.env.get("GITHUB_REPO");
  if (!ghToken || !ghRepo) return reply(500, { error: "GITHUB_TOKEN / GITHUB_REPO secrets not set" });

  // 1. who is calling, and are they a moderator?
  const auth = req.headers.get("Authorization") || "";
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(
    auth.replace(/^Bearer\s+/i, ""),
  );
  if (userErr || !userData?.user) return reply(401, { error: "not signed in" });
  const uid = userData.user.id;

  const { data: profile } = await admin.from("profiles").select("role").eq("id", uid).single();
  if (!profile || (profile.role !== "moderator" && profile.role !== "admin")) {
    return reply(403, { error: "moderators only" });
  }

  // 2. load the pending suggestion
  let suggestionId = "";
  try {
    suggestionId = (await req.json()).id || "";
  } catch { /* fall through */ }
  if (!suggestionId) return reply(400, { error: "body must be {\"id\": \"<suggestion uuid>\"}" });

  const { data: sug } = await admin.from("suggestions").select("*").eq("id", suggestionId).single();
  if (!sug) return reply(404, { error: "suggestion not found" });
  if (sug.status !== "pending") return reply(409, { error: `already ${sug.status}` });

  const stem = String(sug.course_code || "").toLowerCase();
  if (!/^[a-z0-9]+$/.test(stem)) return reply(400, { error: "bad course code" });
  const payload = sug.payload || {};
  let resultUrl = "";

  try {
    if (sug.kind === "new_resource") {
      // 3. read the course JSON with its blob SHA, so a concurrent edit makes
      //    the commit fail instead of silently overwriting it.
      const path = `data/courses/${stem}.json`;
      const file = await gh(ghToken, "GET", `/repos/${ghRepo}/contents/${path}?ref=main`);
      const course = JSON.parse(b64decode(file.content));

      const resource: Record<string, string> = {
        label: String(payload.label || "").slice(0, 200),
        url: String(payload.url || "").slice(0, 2000),
        group: String(payload.group || "Notes").slice(0, 100),
        added: new Date().toISOString().slice(0, 10),
      };
      if (!/^https?:\/\//.test(resource.url) || !resource.label) {
        return reply(400, { error: "suggestion payload needs a label and an http(s) url" });
      }
      if (payload.desc) resource.desc = String(payload.desc).slice(0, 500);
      if (payload.by) resource.by = String(payload.by).slice(0, 100);
      course.resources = course.resources || [];
      if (course.resources.some((r: { url?: string }) => r.url === resource.url)) {
        return reply(409, { error: "that url is already in the course resources" });
      }
      course.resources.push(resource);

      // 4. branch from main, commit with the SHA guard, open the PR
      const main = await gh(ghToken, "GET", `/repos/${ghRepo}/git/ref/heads/main`);
      const branch = `suggestion/${suggestionId.slice(0, 8)}`;
      await gh(ghToken, "POST", `/repos/${ghRepo}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: main.object.sha,
      });
      await gh(ghToken, "PUT", `/repos/${ghRepo}/contents/${path}`, {
        message: `Add resource to ${sug.course_code}: ${resource.label}`,
        content: b64encode(JSON.stringify(course, null, 1) + "\n"),
        sha: file.sha, // concurrent edit -> 409, nothing lost
        branch,
      });
      const pr = await gh(ghToken, "POST", `/repos/${ghRepo}/pulls`, {
        title: `Add resource to ${sug.course_code}: ${resource.label}`,
        head: branch,
        base: "main",
        body: `Approved community suggestion \`${suggestionId}\`.\n\n` +
          `- **Label:** ${resource.label}\n- **URL:** ${resource.url}\n` +
          `- **Group:** ${resource.group}\n\n` +
          `Regenerate the page with \`python tools/generate.py ${stem}\` before merging.`,
      });
      resultUrl = pr.html_url;
    } else {
      // broken_link / correction: a human has to decide, so open an issue.
      const title = sug.kind === "broken_link"
        ? `Broken link in ${sug.course_code}: ${payload.label || payload.url || ""}`
        : `Correction for ${sug.course_code}`;
      const issue = await gh(ghToken, "POST", `/repos/${ghRepo}/issues`, {
        title: title.slice(0, 200),
        body: `From the suggestion queue (\`${suggestionId}\`).\n\n` +
          "```json\n" + JSON.stringify(payload, null, 2) + "\n```",
        labels: ["community-suggestion"],
      });
      resultUrl = issue.html_url;
    }
  } catch (e) {
    return reply(502, { error: String(e instanceof Error ? e.message : e) });
  }

  // 5. mark it approved
  await admin.from("suggestions").update({
    status: "approved",
    reviewer_id: uid,
    pr_url: resultUrl,
  }).eq("id", suggestionId);

  return reply(200, { ok: true, url: resultUrl });
});
