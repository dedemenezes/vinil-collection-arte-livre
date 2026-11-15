(() => {
  const state = {
    tracks: [],
    filtered: [],
    page: 1,
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
  };

  function applyFilters() {
    const q = els.q.value;
    const album = els.album.value;
    const bpmMin = els.bpmMin.value ? Number(els.bpmMin.value) : null;
    const bpmMax = els.bpmMax.value ? Number(els.bpmMax.value) : null;
    const key = els.key.value;
    const camelot = els.camelot.value;
    const onlyKnown = els.onlyKnown.checked;

    state.filtered = state.tracks.filter((t) => {
      if (onlyKnown && (t.bpm == null || !t.key)) return false;
      if (key && t.key !== key) return false;
      if (camelot && t.camelot !== camelot) return false;
      if (bpmMin != null && (t.bpm == null || t.bpm < bpmMin)) return false;
      if (bpmMax != null && (t.bpm == null || t.bpm > bpmMax)) return false;
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
    state.page = 1;
    render();
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
      return;
    }

    els.tbody.innerHTML = slice
      .map((t) => {
        const url = discogsReleaseUrl(t.rid);
        const album = url
          ? `<a class="discogs-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(t.album)}</a>`
          : escapeHtml(t.album);
        const bpm = t.bpm != null ? `<span class="badge badge-accent">${t.bpm}</span>` : `<span class="muted">—</span>`;
        const key = t.key ? `<span class="badge">${escapeHtml(t.key)}</span>` : `<span class="muted">—</span>`;
        const camelot = t.camelot ? `<span class="mono">${escapeHtml(t.camelot)}</span>` : `<span class="muted">—</span>`;
        return `
          <tr>
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

    createPager({
      page: state.page,
      totalPages,
      onChange: (p) => {
        state.page = p;
        render();
        window.scrollTo({ top: els.filters.offsetTop - 70, behavior: "smooth" });
      },
    }).render(els.pager);
  }

  async function init() {
    try {
      const [tracks, meta] = await Promise.all([
        loadJSON("data/tracks.json"),
        loadJSON("data/meta.json"),
      ]);
      state.tracks = tracks;

      fillSelect(els.key, meta.keys, { blankLabel: "Todas as notas" });
      fillSelect(els.camelot, meta.camelots, { blankLabel: "Todos Camelot" });

      const withBpm = tracks.filter((t) => t.bpm != null).length;
      const withKey = tracks.filter((t) => t.key).length;
      els.stats.innerHTML = `
        <span><strong>${formatNumber(meta.track_count)}</strong> faixas</span>
        <span><strong>${formatNumber(withBpm)}</strong> com BPM</span>
        <span><strong>${formatNumber(withKey)}</strong> com nota</span>
      `;

      els.loading.hidden = true;
      els.filters.hidden = false;
      document.getElementById("results").hidden = false;

      const onFilter = debounce(applyFilters, 180);
      ["q", "album", "bpmMin", "bpmMax"].forEach((id) => {
        els[id].addEventListener("input", onFilter);
      });
      els.key.addEventListener("change", applyFilters);
      els.camelot.addEventListener("change", applyFilters);
      els.onlyKnown.addEventListener("change", applyFilters);
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

      applyFilters();
    } catch (err) {
      showError(els.loading, err);
    }
  }

  init();
})();
