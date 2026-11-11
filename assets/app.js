// Feed source: direct (GitHub Pages, baldio.eu sends CORS *) or the PHP proxy when served by PHP.
// Override with ?source=proxy.php
const FEED_URL = new URLSearchParams(location.search).get('source') || 'https://baldio.eu/baldio.json';

const els = {
  search: document.getElementById('search'),
  type: document.getElementById('type'),
  list: document.getElementById('list'),
  count: document.getElementById('count'),
  status: document.getElementById('status'),
  updated: document.getElementById('updated'),
};

let projects = [];

// "quinta-agroecologia" → "Quinta agroecologia"
const typeLabel = slug => {
  const text = slug.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const normalize = text => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function fillTypes() {
  const counts = {};
  projects.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
  Object.keys(counts).sort().forEach(type => {
    els.type.add(new Option(`${typeLabel(type)} (${counts[type]})`, type));
  });
}

function render() {
  const query = normalize(els.search.value);
  const type = els.type.value;
  const visible = projects.filter(p =>
    (!type || p.type === type) &&
    (!query || normalize(`${p.name} ${p.location}`).includes(query))
  );

  els.count.textContent = `${visible.length} de ${projects.length}`;
  els.list.innerHTML = visible.map(p => `
    <div class="col-sm-6 col-lg-4">
      <div class="card project-card h-100 shadow-sm">
        <a class="card-body" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
          <h2 class="card-title mb-1">${escapeHtml(p.name)}</h2>
          <div class="small text-secondary">${escapeHtml(p.location || '—')}</div>
          <span class="badge text-bg-light mt-2">${escapeHtml(typeLabel(p.type))}</span>
        </a>
      </div>
    </div>`).join('');
}

async function load() {
  try {
    const response = await fetch(FEED_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const feed = await response.json();

    projects = (feed.projectos || []).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    els.updated.textContent = feed.updated ? `· actualizado a ${feed.updated}` : '';
    els.status.remove();
    fillTypes();
    render();
  } catch (error) {
    els.status.className = 'alert alert-danger';
    els.status.textContent = `Não foi possível ler o feed (${error.message}).`;
  }
}

els.search.addEventListener('input', render);
els.type.addEventListener('change', render);
load();
