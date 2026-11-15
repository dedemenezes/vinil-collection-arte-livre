const COOKIE = "al_session";
const LOCAL_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), env, origin);
    }

    try {
      if (url.pathname === "/login" && request.method === "GET") {
        return handleLogin(url, env);
      }
      if (url.pathname === "/callback" && request.method === "GET") {
        return handleCallback(url, env);
      }
      if (url.pathname === "/me" && request.method === "GET") {
        return cors(await handleMe(request, env), env, origin);
      }
      if (url.pathname === "/logout" && request.method === "POST") {
        return cors(handleLogout(env, origin), env, origin);
      }
      if (url.pathname === "/overrides" && request.method === "POST") {
        return cors(await handleSaveOverrides(request, env), env, origin);
      }
      return cors(json({ error: "not_found" }, 404), env, origin);
    } catch (err) {
      return cors(json({ error: "server_error", message: String(err.message || err) }, 500), env, origin);
    }
  },
};

function allowedOrigins(env) {
  return new Set([env.SITE_ORIGIN, ...LOCAL_ORIGINS]);
}

function cors(response, env, origin) {
  const headers = new Headers(response.headers);
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, { status: response.status, headers });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function handleLogin(url, env) {
  assertConfigured(env);
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"), env);
  const state = btoa(JSON.stringify({ returnTo, n: crypto.randomUUID() }));
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  gh.searchParams.set("redirect_uri", callbackUrl(url));
  gh.searchParams.set("scope", "repo read:user");
  gh.searchParams.set("state", state);
  return Response.redirect(gh.toString(), 302);
}

async function handleCallback(url, env) {
  assertConfigured(env);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) return json({ error: "missing_code" }, 400);

  let returnTo = `${env.SITE_ORIGIN}/vinil-collection-arte-livre/tracks.html`;
  try {
    const state = JSON.parse(atob(stateRaw));
    returnTo = sanitizeReturnTo(state.returnTo, env);
  } catch {
    /* keep default */
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(url),
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return json({ error: "token_exchange_failed", details: tokenData }, 400);
  }

  const user = await githubJson("https://api.github.com/user", tokenData.access_token);
  if (user.login !== env.ALLOWED_LOGIN) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Acesso negado</title>
       <body style="font-family:sans-serif;padding:2rem">
       <h1>Acesso negado</h1>
       <p>Só <strong>${env.ALLOWED_LOGIN}</strong> pode editar. Você entrou como <strong>${escapeHtml(user.login)}</strong>.</p>
       <p><a href="${returnTo}">Voltar</a></p>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const session = await seal(
    { token: tokenData.access_token, login: user.login, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 },
    env.SESSION_SECRET
  );

  const headers = new Headers({ Location: returnTo });
  headers.append(
    "Set-Cookie",
    `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${7 * 24 * 60 * 60}`
  );
  return new Response(null, { status: 302, headers });
}

async function handleMe(request, env) {
  const session = await readSession(request, env);
  if (!session) return json({ authenticated: false });
  return json({ authenticated: true, login: session.login });
}

function handleLogout(env, origin) {
  const headers = {
    "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`,
  };
  return json({ ok: true }, 200, headers);
}

async function handleSaveOverrides(request, env) {
  assertConfigured(env);
  const session = await readSession(request, env);
  if (!session) return json({ error: "unauthorized" }, 401);
  if (session.login !== env.ALLOWED_LOGIN) return json({ error: "forbidden" }, 403);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.updates || typeof body.updates !== "object") {
    return json({ error: "invalid_body" }, 400);
  }

  const path = env.OVERRIDES_PATH;
  const { content, sha } = await getRepoFile(env, session.token, path);
  let current = {};
  if (content) {
    try {
      current = JSON.parse(content);
    } catch {
      current = {};
    }
  }

  const now = new Date().toISOString();
  let changed = 0;
  for (const [key, patch] of Object.entries(body.updates)) {
    if (!key || typeof patch !== "object") continue;
    const next = { ...(current[key] || {}), ...normalizePatch(patch), updated_at: now, updated_by: session.login };
    current[key] = next;
    changed += 1;
  }

  if (!changed) return json({ error: "no_updates" }, 400);

  const message = body.message || `Update ${changed} track override(s)`;
  await putRepoFile(env, session.token, path, JSON.stringify(current, null, 2) + "\n", sha, message);

  return json({ ok: true, changed, overrides: current });
}

function normalizePatch(patch) {
  const out = {};
  if ("bpm" in patch) {
    if (patch.bpm === null || patch.bpm === "") out.bpm = null;
    else {
      const n = Number(patch.bpm);
      out.bpm = Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
    }
  }
  if ("key" in patch) out.key = String(patch.key || "").trim();
  if ("camelot" in patch) out.camelot = String(patch.camelot || "").trim();
  return out;
}

async function getRepoFile(env, token, path) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: githubHeaders(token),
  });
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`get_file_failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return { content, sha: data.sha };
}

async function putRepoFile(env, token, path, content, sha, message) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: env.GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`put_file_failed: ${res.status} ${text}`);
  }
  return res.json();
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "arte-livre-auth",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubJson(url, token) {
  const res = await fetch(url, { headers: githubHeaders(token) });
  if (!res.ok) throw new Error(`github_api_${res.status}`);
  return res.json();
}

function callbackUrl(url) {
  return `${url.origin}/callback`;
}

function sanitizeReturnTo(value, env) {
  const fallback = `${env.SITE_ORIGIN}/vinil-collection-arte-livre/tracks.html`;
  if (!value) return fallback;
  try {
    const u = new URL(value);
    if (u.origin === env.SITE_ORIGIN) return u.toString();
    if (LOCAL_ORIGINS.includes(u.origin)) return u.toString();
  } catch {
    /* ignore */
  }
  return fallback;
}

function assertConfigured(env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET) {
    throw new Error("Worker secrets missing (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET)");
  }
}

async function readSession(request, env) {
  const cookie = parseCookie(request.headers.get("Cookie") || "")[COOKIE];
  if (!cookie || !env.SESSION_SECRET) return null;
  try {
    const data = await unseal(cookie, env.SESSION_SECRET);
    if (!data || !data.token || !data.login) return null;
    if (data.exp && Date.now() > data.exp) return null;
    if (data.login !== env.ALLOWED_LOGIN) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookie(header) {
  return Object.fromEntries(
    header
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=");
        return i === -1 ? [p, ""] : [p.slice(0, i), p.slice(i + 1)];
      })
  );
}

async function seal(payload, secret) {
  const key = await hmacKey(secret);
  const body = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const sig = await sign(key, body);
  return `${body}.${sig}`;
}

async function unseal(token, secret) {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("bad_token");
  const key = await hmacKey(secret);
  const expected = await sign(key, body);
  if (expected !== sig) throw new Error("bad_sig");
  return JSON.parse(decodeURIComponent(escape(atob(body))));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(key, body) {
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
