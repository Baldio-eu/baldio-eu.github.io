// Demonstração da lista de projectos com capa, lida em directo do baldio.json (campos image e type_name)
(() => {
  'use strict';

  const FEED_URL = new URLSearchParams(location.search).get('source') || 'https://baldio.eu/baldio.json';
  const demo = document.getElementById('demo');
  const typeSelect = document.getElementById('type');
  const count = document.getElementById('count');
  let projects = [];

  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  // versão pequena gerada pelo upload do Baldio: foto.jpg → foto-480.jpg
  const thumb = url => url.replace(/(\.\w+)$/, '-480$1');

  function render() {
    const type = typeSelect.value;
    const visible = projects.filter(p => !type || p.type === type);
    count.textContent = `${visible.length} projectos · ${visible.filter(p => p.image).length} com capa`;
    demo.innerHTML = visible.map(p => `
      <div class="col-sm-6 col-lg-3">
        <div class="card project-tile h-100">
          <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
            ${p.image
              ? `<img class="card-img-top project-cover" loading="lazy" alt="" src="${escapeHtml(thumb(p.image))}" data-full="${escapeHtml(p.image)}">`
              : `<div class="project-cover-empty"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 40V22" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M24 27c-6 0-9-4-9-9 6 0 9 4 9 9zM24 24c0-6 4-10 9-10 0 6-4 10-9 10z" fill="#fff"/></svg></div>`}
            <div class="card-body">
              <h2 class="h6 mb-1">${escapeHtml(p.name)}</h2>
              <div class="small text-secondary">${escapeHtml(p.location || '—')}</div>
              <span class="badge text-bg-light mt-2">${escapeHtml(p.type_name || p.type)}</span>
            </div>
          </a>
        </div>
      </div>`).join('');
  }

  // sem versão -480 (uploads antigos, logos) → imagem original
  demo.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.dataset.full && img.src !== img.dataset.full) img.src = img.dataset.full;
  }, true);
  typeSelect.addEventListener('change', render);

  fetch(FEED_URL)
    .then(response => response.json())
    .then(feed => {
      // com capa primeiro, depois por nome
      projects = feed.projectos.sort((a, b) => (!a.image - !b.image) || a.name.localeCompare(b.name, 'pt'));
      const types = new Map(projects.map(p => [p.type, p.type_name || p.type]));
      [...types].sort((a, b) => a[1].localeCompare(b[1], 'pt')).forEach(([slug, name]) => typeSelect.add(new Option(name, slug)));
      render();
    })
    .catch(error => { demo.innerHTML = `<div class="alert alert-danger">Não foi possível ler os dados (${escapeHtml(error.message)}).</div>`; });
})();
