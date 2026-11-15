(() => {
  const state = {
    albums: [],
    filtered: [],
    page: 1,
  };

  const els = {
    loading: document.getElementById("loading"),
    filters: document.getElementById("filters"),
    q: document.getElementById("q"),
    year: document.getElementById("year"),
    format: document.getElementById("format"),
    label: document.getElementById("label"),
    clear: document.getElementById("clear"),
    resultMeta: document.getElementById("result-meta"),
    tbody: document.getElementById("tbody"),
    pager: document.getElementById("pager"),
    stats: document.getElementById("stats"),
  };

  function applyFilters() {
    const q = els.q.value;
    const year = els.year.value;
    const format = els.format.value;
    const label = els.label.value;

    state.filtered = state.albums.filter((a) => {
      if (year && a.year !== year) return false;
      if (format && a.format !== format) return false;
      if (label && !includesQuery(a.label, label)) return false;
      if (!q) return true;
      return (
        includesQuery(a.artist, q) ||
        includesQuery(a.title, q) ||
        includesQuery(a.label, q) ||
        includesQuery(a.catalog, q)
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

    els.resultMeta.textContent = `${formatNumber(total)} álbum${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`;

    if (!slice.length) {
      els.tbody.innerHTML = "";
      document.getElementById("table-wrap").classList.add("is-empty");
      els.pager.innerHTML = `<div class="empty">Nenhum álbum com esses filtros.</div>`;
      return;
    }

    document.getElementById("table-wrap").classList.remove("is-empty");
    els.tbody.innerHTML = slice
      .map((a) => {
        const url = discogsReleaseUrl(a.id);
        const title = url
          ? `<a class="discogs-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a>`
          : escapeHtml(a.title);
        return `
          <tr>
            <td>${escapeHtml(a.artist)}</td>
            <td>${title}</td>
            <td class="mono">${escapeHtml(a.year || "—")}</td>
            <td>${escapeHtml(a.label || "—")}</td>
            <td><span class="badge">${escapeHtml(a.format || "—")}</span></td>
            <td class="mono muted">${escapeHtml(a.catalog || "—")}</td>
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
      const [albums, meta] = await Promise.all([
        loadJSON("data/albums.json"),
        loadJSON("data/meta.json"),
      ]);
      state.albums = albums;

      const years = [...new Set(albums.map((a) => a.year).filter(Boolean))].sort();
      fillSelect(els.year, years, { blankLabel: "Todos os anos" });
      fillSelect(els.format, meta.formats, { blankLabel: "Todos os formatos" });

      els.stats.innerHTML = `
        <span><strong>${formatNumber(meta.album_count)}</strong> álbuns</span>
        <span><strong>${formatNumber(meta.track_count)}</strong> faixas no acervo</span>
      `;

      els.loading.hidden = true;
      els.filters.hidden = false;
      document.getElementById("results").hidden = false;

      const onFilter = debounce(applyFilters, 180);
      els.q.addEventListener("input", onFilter);
      els.label.addEventListener("input", onFilter);
      els.year.addEventListener("change", applyFilters);
      els.format.addEventListener("change", applyFilters);
      els.clear.addEventListener("click", () => {
        els.q.value = "";
        els.label.value = "";
        els.year.value = "";
        els.format.value = "";
        applyFilters();
      });

      applyFilters();
    } catch (err) {
      showError(els.loading, err);
    }
  }

  init();
})();
