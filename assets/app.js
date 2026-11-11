// Projectos do Baldio num mapa, com duas opções:
//   local — SVG da Península (TopoJSON e projecção do mapas-pt), sem tiles nem pedidos a terceiros
//   osm   — Leaflet com tiles do OpenStreetMap
// Feed: directo (baldio.eu envia CORS *) ou pelo proxy PHP com ?source=proxy.php. Mapa inicial: ?map=osm
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const FEED_URL = params.get('source') || 'https://baldio.eu/baldio.json';

  const $ = id => document.getElementById(id);
  const els = {
    search: $('search'), type: $('type'), list: $('list'), count: $('count'),
    status: $('status'), updated: $('updated'),
  };

  let projects = [];
  let visible = [];
  let activeId = null;

  // nomes e cores dos tipos como no baldio.eu (o feed só traz o slug; /api/v1/mapa tem os nomes mas não envia CORS)
  const TYPES = {
    'alimentacao-economia-local': ['Alimentação / Economia local', '#6B8B3C'],
    'associacao-acao-territorial': ['Associação / Ação territorial', '#3C6B5C'],
    'bem-estar-terapias': ['Bem-estar / Terapias', '#6B8B7A'],
    'bioconstrucao-habitacao': ['Bioconstrução / Habitação', '#9B7B52'],
    'comunicacao-tecnologia': ['Comunicação / Tecnologia', '#3C5C6B'],
    'comunidade-ecoaldeia': ['Comunidade / Ecoaldeia', '#2D6B4F'],
    'cultura-eventos': ['Cultura / Eventos', '#7A3C3C'],
    'educacao-aprendizagem': ['Educação / Aprendizagem', '#8B6B2D'],
    'floresta-regeneracao': ['Floresta / Regeneração', '#1A5C30'],
    'investigacao-consultoria': ['Investigação / Consultoria', '#5C3C6B'],
    'quinta': ['Quinta', '#7A5C3C'],
    'quinta-agroecologia': ['Quinta / Agroecologia', '#5E8B3A'],
    'turismo-experiencias': ['Turismo / Experiências', '#8B5C3C'],
  };
  const ACTIVE_COLOR = '#d9480f';
  // tipo desconhecido: "novo-tipo" → "Novo tipo"
  const typeLabel = slug => TYPES[slug]?.[0] || (slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '));
  const typeColor = slug => TYPES[slug]?.[1] || '#2D4C36';
  const normalize = text => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const label = p => `${p.name} · ${p.location || '—'}`;

  // ---------- mapa local (SVG) ----------
  // cada vista expõe: show(), render(), focus(project)

  const localView = (() => {
    // mesmo layout do mapas-pt: a Península à direita, as ilhas em caixa à esquerda
    const W = 1000, H = 760;
    const LAYOUT = [
      { name: 'main', extent: [[250, 10], [990, 750]] },
      { name: 'acores', extent: [[12, 12], [236, 150]] },
      { name: 'madeira', extent: [[60, 170], [190, 290]] },
      { name: 'canarias', extent: [[12, 610], [340, 748]] },
    ];
    const INSET_PAD = 8;
    const PIN_R = 6;

    const tooltip = $('tooltip');
    const svg = d3.select('#map').attr('viewBox', `0 0 ${W} ${H}`);
    const root = svg.append('g');
    const gInsets = root.append('g');
    const gLand = root.append('g');
    const gRegions = root.append('g');
    const gPins = root.append('g');
    let proj;
    let k = 1;

    const zoom = d3.zoom().scaleExtent([1, 80]).translateExtent([[0, 0], [W, H]]).on('zoom', e => {
      k = e.transform.k;
      root.attr('transform', e.transform);
      gPins.selectAll('circle').attr('r', PIN_R / k);
    });
    svg.call(zoom).on('dblclick.zoom', null);

    $('zoom-in').addEventListener('click', () => svg.transition().call(zoom.scaleBy, 2));
    $('zoom-out').addEventListener('click', () => svg.transition().call(zoom.scaleBy, .5));
    $('zoom-reset').addEventListener('click', () => svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity));

    function showTooltip(event, project) {
      const [x, y] = d3.pointer(event, tooltip.parentNode);
      tooltip.textContent = label(project);
      tooltip.style.left = `${x + 12}px`;
      tooltip.style.top = `${y + 12}px`;
      tooltip.hidden = false;
    }

    return {
      // projecta os projectos para coordenadas do SVG (p.xy)
      init(topo) {
        const level1 = topojson.feature(topo, topo.objects.level1).features;
        const level2 = topojson.feature(topo, topo.objects.level2).features;
        proj = window.iberiaProjection(level1, LAYOUT);

        gInsets.selectAll('rect')
          .data(proj.insets)
          .join('rect')
          .attr('class', 'inset-frame')
          .attr('x', f => f.extent[0][0] - INSET_PAD)
          .attr('y', f => f.extent[0][1] - INSET_PAD)
          .attr('width', f => f.extent[1][0] - f.extent[0][0] + 2 * INSET_PAD)
          .attr('height', f => f.extent[1][1] - f.extent[0][1] + 2 * INSET_PAD);
        gLand.selectAll('path').data(level2).join('path').attr('class', 'land').attr('d', proj.path);
        gRegions.selectAll('path').data(level1).join('path').attr('class', 'region').attr('d', proj.path);

        projects.forEach(p => { p.xy = p.latLng ? proj.project([p.latLng[1], p.latLng[0]]) : null; });
      },
      render() {
        gPins.selectAll('circle')
          .data(visible.filter(p => p.xy), p => p.id)
          .join('circle')
          .attr('class', p => `pin${p.id === activeId ? ' active' : ''}`)
          .attr('cx', p => p.xy[0])
          .attr('cy', p => p.xy[1])
          .attr('r', PIN_R / k)
          .attr('fill', p => (p.id === activeId ? ACTIVE_COLOR : typeColor(p.type)))
          .on('mouseenter mousemove', (e, p) => showTooltip(e, p))
          .on('mouseleave', () => { tooltip.hidden = true; })
          .on('click', (e, p) => setActive(p.id, { scrollList: true }));
        gPins.selectAll('circle.active').raise();
      },
      focus(project) {
        if (!project.xy) return;
        const [x, y] = project.xy;
        svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(8).translate(-x, -y));
      },
      show() {},
    };
  })();

  // ---------- OpenStreetMap (Leaflet) ----------

  const osmView = (() => {
    const style = p => (p.id === activeId
      ? { radius: 8, color: '#fff', weight: 2, fillColor: ACTIVE_COLOR, fillOpacity: 1 }
      : { radius: 6, color: '#fff', weight: 1.5, fillColor: typeColor(p.type), fillOpacity: .9 });
    let map, layer;
    const markers = new Map();

    function init() {
      map = L.map('osm', { scrollWheelZoom: true }).setView([39.6, -8], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
    }

    return {
      // o Leaflet só arranca quando a vista é mostrada pela primeira vez (precisa do contentor visível)
      show() {
        if (map) map.invalidateSize();
        else init();
      },
      render() {
        if (!map) return;
        layer.clearLayers();
        markers.clear();
        visible.filter(p => p.latLng).forEach(p => {
          const marker = L.circleMarker(p.latLng, style(p))
            .bindTooltip(escapeHtml(label(p)))
            .on('click', () => setActive(p.id, { scrollList: true }))
            .addTo(layer);
          markers.set(p.id, marker);
        });
        markers.get(activeId)?.bringToFront();
      },
      focus(project) {
        if (map && project.latLng) map.flyTo(project.latLng, Math.max(map.getZoom(), 12), { duration: .6 });
      },
    };
  })();

  const views = { local: localView, osm: osmView };
  let view = views[params.get('map')] || localView;

  function setView(name) {
    view = views[name];
    $('local').hidden = name !== 'local';
    $('credits-local').hidden = name !== 'local';
    $('osm').hidden = name !== 'osm';
    $('credits-osm').hidden = name !== 'osm';
    view.show();
    view.render();
    const url = new URL(location.href);
    url.searchParams.set('map', name);
    history.replaceState(null, '', url);
  }

  // ---------- lista ----------

  function fillTypes() {
    const counts = d3.rollup(projects, v => v.length, p => p.type);
    [...counts.keys()].sort().forEach(type => {
      els.type.add(new Option(`${typeLabel(type)} (${counts.get(type)})`, type));
    });
  }

  function renderList() {
    const withoutCoords = visible.filter(p => !p.latLng).length;
    els.count.textContent = `${visible.length} de ${projects.length} projectos`
      + (withoutCoords ? ` · ${withoutCoords} sem localização no mapa` : '');
    els.list.innerHTML = visible.map(p => `
      <div class="list-group-item${p.id === activeId ? ' active' : ''}" data-id="${p.id}" role="button">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="small text-secondary">${escapeHtml(p.location || '—')} · ${escapeHtml(typeLabel(p.type))}</div>
        ${p.id === activeId ? `<a class="small" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Ver no Baldio →</a>` : ''}
      </div>`).join('');
  }

  function applyFilters() {
    const query = normalize(els.search.value);
    const type = els.type.value;
    visible = projects.filter(p =>
      (!type || p.type === type) &&
      (!query || normalize(`${p.name} ${p.location}`).includes(query))
    );
    if (!visible.some(p => p.id === activeId)) activeId = null;
    renderList();
    view.render();
  }

  function setActive(id, { scrollList = false, focusMap = false } = {}) {
    activeId = id;
    renderList();
    view.render();
    const project = projects.find(p => p.id === id);
    if (focusMap && project) view.focus(project);
    if (scrollList) els.list.querySelector('.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---------- arranque ----------

  els.search.addEventListener('input', applyFilters);
  els.type.addEventListener('change', applyFilters);
  els.list.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const item = e.target.closest('[data-id]');
    if (item) setActive(Number(item.dataset.id), { focusMap: true });
  });
  document.querySelectorAll('[name="map-kind"]').forEach(input => {
    input.checked = views[input.value] === view;
    input.addEventListener('change', () => setView(input.value));
  });

  Promise.all([d3.json('data/base.topo.json'), d3.json(FEED_URL)])
    .then(([topo, feed]) => {
      projects = (feed.projectos || [])
        .map((p, id) => {
          const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
          return { ...p, id, latLng: Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
      localView.init(topo);
      els.updated.textContent = feed.updated ? `· actualizado a ${feed.updated}` : '';
      els.status.remove();
      fillTypes();
      visible = projects;
      setView(view === osmView ? 'osm' : 'local');
      applyFilters();
    })
    .catch(error => {
      els.status.className = 'alert alert-danger';
      els.status.textContent = `Não foi possível carregar o mapa ou o feed (${error.message}).`;
    });
})();
