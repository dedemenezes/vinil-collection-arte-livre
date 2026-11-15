const PAGE_SIZE = 50;

function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesQuery(haystack, needle) {
  if (!needle) return true;
  return normalize(haystack).includes(normalize(needle));
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function discogsReleaseUrl(id) {
  return id ? `https://www.discogs.com/release/${id}` : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatNumber(n) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function fillSelect(select, options, { blankLabel = "Todas", blankValue = "" } = {}) {
  select.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = blankValue;
  blank.textContent = blankLabel;
  select.appendChild(blank);
  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt.value ?? opt;
    el.textContent = opt.label ?? opt;
    select.appendChild(el);
  }
}

function createPager({ page, totalPages, onChange }) {
  return {
    render(container) {
      container.innerHTML = `
        <div class="pager-info">Página ${page} de ${Math.max(totalPages, 1)}</div>
        <div class="pager-btns">
          <button type="button" class="btn btn-ghost" data-dir="-1" ${page <= 1 ? "disabled" : ""}>Anterior</button>
          <button type="button" class="btn btn-ghost" data-dir="1" ${page >= totalPages ? "disabled" : ""}>Próxima</button>
        </div>
      `;
      container.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          const next = page + Number(btn.dataset.dir);
          if (next >= 1 && next <= totalPages) onChange(next);
        });
      });
    },
  };
}

function showError(container, err) {
  container.innerHTML = `<div class="empty">Não foi possível carregar os dados.<br><span class="mono">${escapeHtml(err.message)}</span></div>`;
}
