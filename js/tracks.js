(() => {
  const state = {
    baseTracks: [],
    tracks: [],
    overrides: {},
    filtered: [],
    page: 1,
    canEdit: false,
    editMode: false,
    pending: {},
    saving: false,
  };

  const els = {
    loading: document.getElementById("loading"),
    filters: document.getElementById("filters"),
    q: document.getElementById("q"),
    album: document.getElementById("album"),
    bpmMin: document.getElementById("bpm-min"),
    bpmMax: document.getElementById("bpm-max"),
    key: document.getElementById("key"),
    camelot: document.getElementById("camelot"),
    onlyKnown: document.getElementById("only-known"),
    clear: document.getElementById("clear"),
    resultMeta: document.getElementById("result-meta"),
    tbody: document.getElementById("tbody"),
    pager: document.getElementById("pager"),
    stats: document.getElementById("stats"),
    editBar: document.getElementById("edit-bar"),
    toggleEditBtn: document.getElementById("toggle-edit-mode"),
    saveBtn: document.getElementById("save-edits"),
    discardBtn: document.getElementById("discard-edits"),
    editStatus: document.getElementById("edit-status"),
  };

  function isEditing() {
    return state.canEdit && state.editMode;
  }

  function trackKey(t) {
    return window.ArteLivreAuth.trackKey(t);
  }

  function mergeTracks() {
    state.tracks = state.baseTracks.map((t) => {
      const key = trackKey(t);
      const over = state.overrides[key];
      if (!over) return { ...t, _key: key, _overridden: false };
      return {
        ...t,
        _key: key,
        _overridden: true,
        bpm: "bpm" in over ? over.bpm : t.bpm,
        key: "key" in over ? over.key : t.key,
        camelot: "camelot" in over ? over.camelot : t.camelot,
      };
    });
  }

  function pendingCount() {
    return Object.keys(state.pending).length;
  }

  function updateEditBar() {
    const n = pendingCount();
    if (!state.canEdit) {
      els.editBar.hidden = true;
      return;
    }
    els.editBar.hidden = false;
    els.toggleEditBtn.textContent = state.editMode ? "Sair da edição" : "Ativar edição";
    els.saveBtn.hidden = !state.editMode;
    els.discardBtn.hidden = !state.editMode;
    els.saveBtn.disabled = n === 0 || state.saving;
    els.discardBtn.disabled = n === 0 || state.saving;
    els.toggleEditBtn.disabled = state.saving;

    if (!state.editMode) {
      els.editStatus.textContent = n
        ? `${n} alteração${n === 1 ? "" : "ões"} não salva${n === 1 ? "" : "s"} — ative a edição para continuar`
        : "Somente leitura. Ative a edição para mudar BPM, nota ou Camelot.";
      return;
    }

    els.editStatus.textContent = state.saving
      ? "Salvando no GitHub…"
      : n
        ? `${n} alteração${n === 1 ? "" : "ões"} pendente${n === 1 ? "" : "s"}`
        : "Modo edição ativo — altere os campos na tabela";
  }

  function applyFilters({ resetPage = true } = {}) {
    const q = els.q.value;
    const album = els.album.value;
    const bpmMin = els.bpmMin.value ? Number(els.bpmMin.value) : null;
    const bpmMax = els.bpmMax.value ? Number(els.bpmMax.value) : null;
    const key = els.key.value;
    const camelot = els.camelot.value;
    const onlyKnown = els.onlyKnown.checked;

    state.filtered = state.tracks.filter((t) => {
      const live = { ...t, ...(state.pending[t._key] || {}) };
      if (onlyKnown && (live.bpm == null || !live.key)) return false;
      if (key && live.key !== key) return false;
      if (camelot && live.camelot !== camelot) return false;
      if (bpmMin != null && (live.bpm == null || live.bpm < bpmMin)) return false;
      if (bpmMax != null && (live.bpm == null || live.bpm > bpmMax)) return false;
      if (album && !includesQuery(t.album, album) && !includesQuery(t.album_artist, album)) {
        return false;
      }
      if (!q) return true;
      return (
        includesQuery(t.title, q) ||
        includesQuery(t.artist, q) ||
        includesQuery(t.album, q)
      );
    });
    if (resetPage) state.page = 1;
    render();
  }

  function displayTrack(t) {
    return { ...t, ...(state.pending[t._key] || {}) };
  }

  function render() {
    const total = state.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = state.filtered.slice(start, start + PAGE_SIZE);

    els.resultMeta.textContent = `${formatNumber(total)} faixa${total === 1 ? "" : "s"} encontrada${total === 1 ? "" : "s"}`;

    if (!slice.length) {
      els.tbody.innerHTML = "";
      els.pager.innerHTML = `<div class="empty">Nenhuma faixa com esses filtros.</div>`;
      updateEditBar();
      return;
    }

    els.tbody.innerHTML = slice
      .map((raw) => {
        const t = displayTrack(raw);
        const url = discogsReleaseUrl(t.rid);
        const album = url
          ? `<a class="discogs-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(t.album)}</a>`
          : escapeHtml(t.album);
        const dirty = Boolean(state.pending[t._key]);
        const mark = dirty || t._overridden ? " row-edited" : "";

        if (isEditing()) {
          return `
            <tr class="${mark}" data-key="${escapeHtml(t._key)}">
              <td class="mono muted">${escapeHtml(t.pos || "—")}</td>
              <td>${escapeHtml(t.title)}</td>
              <td>${escapeHtml(t.artist)}</td>
              <td>${album}<div class="muted" style="font-size:0.78rem">${escapeHtml(t.album_artist || "")}</div></td>
              <td><input class="cell-input" data-field="bpm" type="number" step="0.1" min="0" max="300" value="${t.bpm ?? ""}" /></td>
              <td><input class="cell-input" data-field="key" type="text" value="${escapeHtml(t.key || "")}" placeholder="A minor" /></td>
              <td><input class="cell-input cell-input-sm" data-field="camelot" type="text" value="${escapeHtml(t.camelot || "")}" placeholder="8A" /></td>
              <td class="mono muted">${escapeHtml(t.year || "—")}</td>
            </tr>
          `;
        }

        const bpm = t.bpm != null ? `<span class="badge badge-accent">${t.bpm}</span>` : `<span class="muted">—</span>`;
        const key = t.key ? `<span class="badge">${escapeHtml(t.key)}</span>` : `<span class="muted">—</span>`;
        const camelot = t.camelot ? `<span class="mono">${escapeHtml(t.camelot)}</span>` : `<span class="muted">—</span>`;
        return `
          <tr class="${mark}">
            <td class="mono muted">${escapeHtml(t.pos || "—")}</td>
            <td>${escapeHtml(t.title)}</td>
            <td>${escapeHtml(t.artist)}</td>
            <td>${album}<div class="muted" style="font-size:0.78rem">${escapeHtml(t.album_artist || "")}</div></td>
            <td>${bpm}</td>
            <td>${key}</td>
            <td>${camelot}</td>
            <td class="mono muted">${escapeHtml(t.year || "—")}</td>
          </tr>
        `;
      })
      .join("");

    if (isEditing()) {
      els.tbody.querySelectorAll(".cell-input").forEach((input) => {
        input.addEventListener("change", onCellEdit);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") input.blur();
        });
      });
    }

    createPager({
      page: state.page,
      totalPages,
      onChange: (p) => {
        state.page = p;
        render();
        window.scrollTo({ top: els.filters.offsetTop - 70, behavior: "smooth" });
      },
    }).render(els.pager);

    updateEditBar();
  }

  function onCellEdit(e) {
    const input = e.target;
    const row = input.closest("tr");
    const key = row.dataset.key;
    const field = input.dataset.field;
    const base = state.tracks.find((t) => t._key === key);
    if (!base) return;

    let value = input.value.trim();
    if (field === "bpm") {
      value = value === "" ? null : Number(value);
      if (value != null && !Number.isFinite(value)) return;
    }

    const current = displayTrack(base);
    const original = { bpm: base.bpm, key: base.key, camelot: base.camelot };
    const next = { ...current, [field]: value };

    const patch = {};
    ["bpm", "key", "camelot"].forEach((f) => {
      if (next[f] !== original[f]) patch[f] = next[f];
    });

    if (Object.keys(patch).length) state.pending[key] = patch;
    else delete state.pending[key];

    row.classList.toggle("row-edited", Boolean(state.pending[key]) || base._overridden);
    updateEditBar();
  }

  async function saveEdits() {
    if (!pendingCount() || state.saving) return;
    state.saving = true;
    updateEditBar();
    try {
      const data = await window.ArteLivreAuth.saveOverrides(
        state.pending,
        `Edit ${pendingCount()} track(s) via Arte Livre`
      );
      state.overrides = data.overrides || { ...state.overrides, ...state.pending };
      state.pending = {};
      mergeTracks();
      applyFilters({ resetPage: false });
      els.editStatus.textContent = "Salvo. O Pages atualiza em ~1 min.";
    } catch (err) {
      els.editStatus.textContent = `Erro ao salvar: ${err.message}`;
    } finally {
      state.saving = false;
      updateEditBar();
    }
  }

  function discardEdits() {
    state.pending = {};
    render();
  }

  function toggleEditMode() {
    if (state.editMode && pendingCount()) {
      const ok = window.confirm("Há alterações não salvas. Sair da edição e descartá-las?");
      if (!ok) return;
      state.pending = {};
    }
    state.editMode = !state.editMode;
    render();
  }

  async function init() {
    try {
      window.ArteLivreAuth.mountHeaderControls(document.getElementById("auth-controls"));
      window.ArteLivreAuth.onChange((auth) => {
        const next = Boolean(auth.authenticated);
        if (next !== state.canEdit) {
          state.canEdit = next;
          if (!next) {
            state.pending = {};
            state.editMode = false;
          }
          render();
        } else {
          updateEditBar();
        }
      });

      const [tracks, meta, overrides] = await Promise.all([
        loadJSON("data/tracks.json"),
        loadJSON("data/meta.json"),
        loadJSON("data/track_overrides.json").catch(() => ({})),
      ]);
      state.baseTracks = tracks;
      state.overrides = overrides || {};
      mergeTracks();

      fillSelect(els.key, meta.keys, { blankLabel: "Todas as notas" });
      fillSelect(els.camelot, meta.camelots, { blankLabel: "Todos Camelot" });

      const withBpm = state.tracks.filter((t) => t.bpm != null).length;
      const withKey = state.tracks.filter((t) => t.key).length;
      els.stats.innerHTML = `
        <span><strong>${formatNumber(meta.track_count)}</strong> faixas</span>
        <span><strong>${formatNumber(withBpm)}</strong> com BPM</span>
        <span><strong>${formatNumber(withKey)}</strong> com nota</span>
      `;

      els.loading.hidden = true;
      els.filters.hidden = false;
      document.getElementById("results").hidden = false;

      const onFilter = debounce(() => applyFilters(), 180);
      ["q", "album", "bpmMin", "bpmMax"].forEach((id) => {
        els[id].addEventListener("input", onFilter);
      });
      els.key.addEventListener("change", () => applyFilters());
      els.camelot.addEventListener("change", () => applyFilters());
      els.onlyKnown.addEventListener("change", () => applyFilters());
      els.clear.addEventListener("click", () => {
        els.q.value = "";
        els.album.value = "";
        els.bpmMin.value = "";
        els.bpmMax.value = "";
        els.key.value = "";
        els.camelot.value = "";
        els.onlyKnown.checked = false;
        applyFilters();
      });
      els.toggleEditBtn.addEventListener("click", toggleEditMode);
      els.saveBtn.addEventListener("click", saveEdits);
      els.discardBtn.addEventListener("click", discardEdits);

      applyFilters();
    } catch (err) {
      showError(els.loading, err);
    }
  }

  init();
})();
