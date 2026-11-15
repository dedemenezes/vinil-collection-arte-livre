(() => {
  const AUTH_URL = window.ARTE_LIVRE_AUTH_URL;
  const listeners = new Set();

  const state = {
    ready: false,
    authenticated: false,
    login: null,
  };

  function notify() {
    listeners.forEach((fn) => fn({ ...state }));
  }

  async function refresh() {
    try {
      const res = await fetch(`${AUTH_URL}/me`, { credentials: "include" });
      const data = await res.json();
      state.authenticated = Boolean(data.authenticated);
      state.login = data.login || null;
    } catch {
      state.authenticated = false;
      state.login = null;
    } finally {
      state.ready = true;
      notify();
    }
  }

  function login() {
    const returnTo = window.location.href;
    window.location.href = `${AUTH_URL}/login?return_to=${encodeURIComponent(returnTo)}`;
  }

  async function logout() {
    await fetch(`${AUTH_URL}/logout`, { method: "POST", credentials: "include" });
    state.authenticated = false;
    state.login = null;
    notify();
  }

  async function saveOverrides(updates, message) {
    const res = await fetch(`${AUTH_URL}/overrides`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `save_failed_${res.status}`);
    }
    return data;
  }

  function onChange(fn) {
    listeners.add(fn);
    if (state.ready) fn({ ...state });
    return () => listeners.delete(fn);
  }

  function mountHeaderControls(container) {
    if (!container) return;
    const render = (s) => {
      if (!s.ready) {
        container.innerHTML = `<span class="auth-status muted">…</span>`;
        return;
      }
      if (s.authenticated) {
        container.innerHTML = `
          <span class="auth-status">@${escapeHtml(s.login)}</span>
          <button type="button" class="btn btn-ghost auth-btn" data-action="logout">Sair</button>
        `;
      } else {
        container.innerHTML = `
          <button type="button" class="btn auth-btn" data-action="login">Entrar com GitHub</button>
        `;
      }
      container.querySelector("[data-action='login']")?.addEventListener("click", login);
      container.querySelector("[data-action='logout']")?.addEventListener("click", () => {
        logout();
      });
    };
    onChange(render);
  }

  window.ArteLivreAuth = {
    refresh,
    login,
    logout,
    saveOverrides,
    onChange,
    mountHeaderControls,
    getState: () => ({ ...state }),
    trackKey(track) {
      return `${track.rid}::${track.pos || ""}`;
    },
  };

  refresh();
})();
