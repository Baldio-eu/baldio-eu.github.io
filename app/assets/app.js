// App do Baldio (PWA): lista e mapa dos projectos e a página completa de cada um, mesmo sem rede.
// Dados: data/projectos.json, publicado pelo cron do GitHub (scripts/build-app-data.php); a app
// pede-o na primeira vez, guarda-o no aparelho e só o pede outra vez no botão de actualizar.
// Mapa: SVG local da Península (TopoJSON e projecção do mapas-pt), sem tiles nem APIs.
// Outro feed com o mesmo formato: ?source=URL
//
// Endereços: #/ é a lista ou o mapa (a vista fica guardada no aparelho); #/p/{slug} é a página
// de um projecto, para o botão "voltar" do telemóvel fechar a página.
(() => {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  }

  const params = new URLSearchParams(location.search);
  const DATA_URL = new URL(params.get('source') || 'data/projectos.json', location.href).href;
  const TOPO_URL = '../data/base.topo.json';
  const IMG_CACHE = 'baldio-app-img';
  const DATA_CACHE = 'baldio-app-data';
  const MODE_KEY = 'baldio_app_mode';

  const $ = id => document.getElementById(id);

  // cores dos tipos como no baldio.eu (o feed traz o nome, não a cor)
  const TYPE_COLORS = {
    'alimentacao-economia-local': '#6B8B3C',
    'associacao-acao-territorial': '#3C6B5C',
    'bem-estar-terapias': '#6B8B7A',
    'bioconstrucao-habitacao': '#9B7B52',
    'comunicacao-tecnologia': '#3C5C6B',
    'comunidade-ecoaldeia': '#2D6B4F',
    'cultura-eventos': '#7A3C3C',
    'educacao-aprendizagem': '#8B6B2D',
    'floresta-regeneracao': '#1A5C30',
    'investigacao-consultoria': '#5C3C6B',
    'quinta': '#7A5C3C',
    'quinta-agroecologia': '#5E8B3A',
    'turismo-experiencias': '#8B5C3C',
  };
  const ACTIVE_COLOR = '#d9480f';
  const COUNTRIES = { PT: 'Portugal', ES: 'Espanha' };

  const typeColor = slug => TYPE_COLORS[slug] || '#2D4C36';
  const normalize = text => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const local = path => (path ? new URL(path, DATA_URL).href : '');
  // versão pequena gerada pelo baldio.eu: …/foto.jpg → …/foto-480.jpg
  const small = url => url.replace(/\.jpg$/i, '-480.jpg');
  const place = p => [p.location_label, p.distrito && p.distrito !== p.location_label ? p.distrito : '', COUNTRIES[p.pais] || '']
    .filter(Boolean).join(', ');
  const readMode = () => { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } };
  const saveMode = m => { try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* sem armazenamento */ } };

  let projects = [];
  let bySlug = new Map();
  let types = {};
  let visible = [];
  let updated = '';
  let typeFilter = '';
  let mode = readMode() === 'mapa' ? 'mapa' : 'lista';
  let detailFromApp = false;

  // ---------- filtros ----------

  function applyFilters() {
    const q = normalize($('search').value.trim());
    visible = projects.filter(p => (!typeFilter || p.type === typeFilter) && (!q || p.search.includes(q)));
    renderList();
    mapView.render();
  }

  function renderTypes() {
    const counts = {};
    projects.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    const chip = (slug, label, n) => `
      <button type="button" class="chip${slug === typeFilter ? ' on' : ''}" data-type="${escapeHtml(slug)}">
        ${slug ? `<i style="background:${typeColor(slug)}"></i>` : ''}${escapeHtml(label)} <span>${n}</span>
      </button>`;
    $('types').innerHTML = chip('', 'Todos', projects.length) + Object.keys(types)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
      .map(slug => chip(slug, types[slug], counts[slug] || 0)).join('');
  }

  $('types').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    typeFilter = btn.dataset.type;
    $('types').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === btn));
    applyFilters();
  });
  $('search').addEventListener('input', applyFilters);

  // ---------- lista ----------

  function cover(p, cls) {
    return p.thumb
      ? `<img class="${cls}" src="${escapeHtml(local(p.thumb))}" alt="" loading="lazy">`
      : `<span class="${cls} no-img" style="background:${typeColor(p.type)}">${escapeHtml(p.name.charAt(0))}</span>`;
  }

  function renderList() {
    const total = projects.length;
    const date = updated ? new Date(updated).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    $('meta').innerHTML = `${visible.length === total ? `${total} projectos` : `${visible.length} de ${total} projectos`}`
      + (date ? ` · dados de ${escapeHtml(date)}` : '')
      + (navigator.onLine ? '' : ' · <b>sem rede</b>');
    $('list').innerHTML = visible.length ? visible.map(p => `
      <a class="card" href="#/p/${encodeURIComponent(p.slug)}">
        ${cover(p, 'card-img')}
        <span class="card-body">
          <span class="card-name">${escapeHtml(p.name)}</span>
          <span class="card-type"><i style="background:${typeColor(p.type)}"></i>${escapeHtml(p.type_name)}</span>
          <span class="card-place">${escapeHtml(place(p) || '—')}</span>
        </span>
      </a>`).join('') : '<p class="empty">Nenhum projecto com estes filtros.</p>';
  }

  // ---------- mapa local (SVG) ----------

  const mapView = (() => {
    // ao alto (telemóvel) a Península em cima e as ilhas numa fila por baixo; ao largo, o layout do mapas-pt
    const LAYOUTS = {
      portrait: {
        W: 600, H: 700,
        frames: [
          { name: 'main', extent: [[10, 10], [590, 530]] },
          { name: 'acores', extent: [[14, 570], [214, 686]] },
          { name: 'madeira', extent: [[244, 580], [330, 676]] },
          { name: 'canarias', extent: [[366, 584], [586, 682]] },
        ],
      },
      landscape: {
        W: 1000, H: 760,
        frames: [
          { name: 'main', extent: [[250, 10], [990, 750]] },
          { name: 'acores', extent: [[12, 12], [236, 150]] },
          { name: 'madeira', extent: [[60, 170], [190, 290]] },
          { name: 'canarias', extent: [[12, 610], [340, 748]] },
        ],
      },
    };
    const INSET_PAD = 8;
    const PIN_R = 7;

    const svg = d3.select('#map');
    const root = svg.append('g');
    const gInsets = root.append('g');
    const gLand = root.append('g');
    const gRegions = root.append('g');
    const gPins = root.append('g');
    let layout;
    let proj;
    let zoom;
    let k = 1;
    let activeSlug = null;
    let ready = null;

    async function init() {
      const topo = await fetch(TOPO_URL).then(r => r.json());
      const box = $('view-map').getBoundingClientRect();
      layout = LAYOUTS[box.height > box.width ? 'portrait' : 'landscape'];
      const { W, H } = layout;
      svg.attr('viewBox', `0 0 ${W} ${H}`);

      const level1 = topojson.feature(topo, topo.objects.level1).features;
      const level2 = topojson.feature(topo, topo.objects.level2).features;
      proj = window.iberiaProjection(level1, layout.frames);

      gInsets.selectAll('rect').data(proj.insets).join('rect')
        .attr('class', 'inset-frame')
        .attr('x', f => f.extent[0][0] - INSET_PAD)
        .attr('y', f => f.extent[0][1] - INSET_PAD)
        .attr('width', f => f.extent[1][0] - f.extent[0][0] + 2 * INSET_PAD)
        .attr('height', f => f.extent[1][1] - f.extent[0][1] + 2 * INSET_PAD);
      gLand.selectAll('path').data(level2).join('path').attr('class', 'land').attr('d', proj.path);
      gRegions.selectAll('path').data(level1).join('path').attr('class', 'region').attr('d', proj.path);

      reproject();

      zoom = d3.zoom().scaleExtent([1, 80]).translateExtent([[0, 0], [W, H]]).on('zoom', (e) => {
        k = e.transform.k;
        root.attr('transform', e.transform);
        gPins.selectAll('.hit').attr('r', (PIN_R * 2) / k);
        gPins.selectAll('.pin').attr('r', p => (p.slug === activeSlug ? PIN_R * 1.4 : PIN_R) / k);
      });
      svg.call(zoom).on('dblclick.zoom', null).call(zoom.transform, pinsView());
      svg.on('click', (e) => { if (!e.target.closest('.pin-g')) select(null); });

      $('zoom-in').addEventListener('click', () => svg.transition().call(zoom.scaleBy, 2));
      $('zoom-out').addEventListener('click', () => svg.transition().call(zoom.scaleBy, 0.5));
      $('zoom-reset').addEventListener('click', () => svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity));
    }

    // vista inicial: enquadra os pinos da Península (quase todos em Portugal); ⟲ mostra tudo, ilhas incluídas
    function pinsView() {
      const { W, H } = layout;
      const [[ex0, ey0], [ex1, ey1]] = layout.frames[0].extent;
      const pts = projects.map(p => p.xy).filter(xy => xy && xy[0] >= ex0 && xy[0] <= ex1 && xy[1] >= ey0 && xy[1] <= ey1);
      if (!pts.length) return d3.zoomIdentity;
      const PAD = 30;
      const [x0, x1] = d3.extent(pts, xy => xy[0]);
      const [y0, y1] = d3.extent(pts, xy => xy[1]);
      const s = Math.max(1, Math.min(8, W / (x1 - x0 + 2 * PAD), H / (y1 - y0 + 2 * PAD)));
      return d3.zoomIdentity.translate(W / 2, H / 2).scale(s).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    }

    // coordenadas no SVG (p.xy); outra vez depois de actualizar os dados
    function reproject() {
      if (!proj) return;
      projects.forEach((p) => {
        p.xy = (p.location_lat !== null && p.location_lng !== null) ? proj.project([p.location_lng, p.location_lat]) : null;
      });
    }

    function render() {
      if (!layout) return;
      const onMap = visible.filter(p => p.xy);
      $('map-count').textContent = `${onMap.length} no mapa`;
      gPins.selectAll('.pin-g')
        .data(onMap, p => p.slug)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'pin-g');
          g.append('circle').attr('class', 'hit');
          g.append('circle').attr('class', 'pin');
          g.on('click', (e, p) => { e.stopPropagation(); select(p); });
          return g;
        })
        .each(function placePin(p) {
          const active = p.slug === activeSlug;
          const g = d3.select(this).classed('active', active);
          g.select('.hit').attr('cx', p.xy[0]).attr('cy', p.xy[1]).attr('r', (PIN_R * 2) / k);
          g.select('.pin').attr('cx', p.xy[0]).attr('cy', p.xy[1]).attr('r', (active ? PIN_R * 1.4 : PIN_R) / k)
            .attr('fill', active ? ACTIVE_COLOR : typeColor(p.type));
        });
      gPins.selectAll('.pin-g.active').raise();
      if (activeSlug && !onMap.some(p => p.slug === activeSlug)) select(null);
    }

    // pré-visualização em baixo; tocar nela abre a página do projecto
    function select(p) {
      activeSlug = p ? p.slug : null;
      const preview = $('preview');
      if (p) {
        preview.href = `#/p/${encodeURIComponent(p.slug)}`;
        preview.innerHTML = `${cover(p, 'preview-img')}
          <span class="card-body">
            <span class="card-name">${escapeHtml(p.name)}</span>
            <span class="card-type"><i style="background:${typeColor(p.type)}"></i>${escapeHtml(p.type_name)}</span>
            <span class="card-place">${escapeHtml(place(p) || '—')}</span>
          </span>
          <span class="chevron" aria-hidden="true">›</span>`;
      }
      preview.hidden = !p;
      render();
    }

    return {
      async show() {
        ready = ready || init();
        await ready;
        render();
      },
      render,
      reproject,
      async focus(p) {
        await this.show();
        if (!p.xy) return;
        select(p);
        const { W, H } = layout;
        const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(8).translate(-p.xy[0], -p.xy[1]);
        svg.transition().duration(700).call(zoom.transform, t);
      },
    };
  })();

  // ---------- vista (lista | mapa) ----------

  function setMode(m) {
    mode = m;
    saveMode(m);
    $('view-list').hidden = m !== 'lista';
    $('view-map').hidden = m !== 'mapa';
    document.querySelectorAll('.switch [data-mode]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.mode === m));
    });
    if (m === 'mapa' && projects.length) mapView.show();
  }

  document.querySelector('.switch').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  // ---------- página do projecto ----------

  // o corpo vem limpo do baldio.eu (Html::clean); aqui só se deixa passar texto, listas e ligações
  const BODY_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'A', 'H2', 'H3', 'H4', 'BLOCKQUOTE']);
  function safeBody(html) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const walk = (node) => {
      [...node.children].forEach((el) => {
        walk(el);
        if (!BODY_TAGS.has(el.tagName)) {
          el.replaceWith(...el.childNodes);
          return;
        }
        const href = el.tagName === 'A' ? el.getAttribute('href') || '' : '';
        [...el.attributes].forEach(a => el.removeAttribute(a.name));
        if (/^(https?:|mailto:)/i.test(href)) {
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener');
        }
      });
    };
    const root = doc.body.firstElementChild;
    walk(root);
    return root.innerHTML;
  }

  const withScheme = url => (/^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`);
  const handleUrl = (value, base) => (/^https?:\/\/|^www\./i.test(value) ? withScheme(value) : base + value.replace(/^@/, ''));

  function contacts(p) {
    const links = [];
    const add = (href, label, text) => links.push(
      `<a class="contact" href="${escapeHtml(href)}" target="_blank" rel="noopener"><b>${escapeHtml(label)}</b><span>${escapeHtml(text)}</span></a>`
    );
    if (p.website) add(withScheme(p.website), 'Site', p.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''));
    if (p.email) add(`mailto:${p.email}`, 'Email', p.email);
    if (p.phone) add(`tel:${p.phone.replace(/[^\d+]/g, '')}`, 'Telefone', p.phone);
    if (p.whatsapp) {
      const digits = p.whatsapp.replace(/\D/g, '');
      const href = /^https?:/i.test(p.whatsapp) ? p.whatsapp : `https://wa.me/${digits.length === 9 ? `351${digits}` : digits}`;
      add(href, 'WhatsApp', p.whatsapp);
    }
    if (p.instagram) add(handleUrl(p.instagram, 'https://instagram.com/'), 'Instagram', p.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, ''));
    if (p.facebook) add(handleUrl(p.facebook, 'https://facebook.com/'), 'Facebook', p.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//i, '').replace(/\/$/, ''));
    if (p.outro) {
      // há quem ponha aqui um segundo telefone
      const phone = /^[\d\s+().-]{6,}$/.test(p.outro);
      add(phone ? `tel:${p.outro.replace(/[^\d+]/g, '')}` : withScheme(p.outro), p.outro_label || (phone ? 'Telefone' : 'Outro'), p.outro.replace(/^https?:\/\/(www\.)?/i, ''));
    }
    return links.join('');
  }

  function renderDetail(p) {
    const hero = p.thumb
      ? `<img class="hero" src="${escapeHtml(local(p.thumb))}" alt="">`
      : `<div class="hero no-img" style="background:${typeColor(p.type)}"></div>`;
    const logo = p.logo_thumb ? `<img class="detail-logo" src="${escapeHtml(local(p.logo_thumb))}" alt="">` : '';
    const chips = [
      `<span class="tag type"><i style="background:${typeColor(p.type)}"></i>${escapeHtml(p.type_name)}</span>`,
      p.stage ? `<span class="tag">${escapeHtml(p.stage.charAt(0).toUpperCase() + p.stage.slice(1))}</span>` : '',
      p.verified ? '<span class="tag verified">Verificado</span>' : '',
    ].join('');
    const gallery = p.gallery.length ? `
      <h2>Galeria</h2>
      <div class="gallery">${p.gallery.map(src => `<img src="${escapeHtml(small(src))}" alt="" loading="lazy" onerror="this.remove()">`).join('')}</div>` : '';
    const market = [['Oferece', p.market_offers], ['Procura', p.market_needs]]
      .filter(([, text]) => text)
      .map(([label, text]) => `<h2>${label}</h2><p class="pre">${escapeHtml(text)}</p>`).join('');
    const contactLinks = contacts(p);
    const changed = p.updated_at ? new Date(p.updated_at.replace(' ', 'T')).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    $('detail').innerHTML = `
      <header class="detail-bar">
        <button type="button" class="back" data-action="back" aria-label="Voltar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="detail-bar-title">${escapeHtml(p.name)}</span>
      </header>
      ${hero}
      <div class="detail-body">
        ${logo}
        <h1>${escapeHtml(p.name)}</h1>
        <div class="tags">${chips}</div>
        <p class="place">${escapeHtml(place(p))}${p.morada && p.morada !== p.location_label ? ` · ${escapeHtml(p.morada)}` : ''}</p>
        ${p.location_lat !== null && p.location_lng !== null ? '<button type="button" class="btn" data-action="map">Ver no mapa</button>' : ''}
        ${p.description ? `<p class="lead">${escapeHtml(p.description)}</p>` : ''}
        ${p.body ? `<div class="prose">${safeBody(p.body)}</div>` : ''}
        ${market}
        ${p.tags.length ? `<h2>Etiquetas</h2><div class="tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${gallery}
        ${contactLinks ? `<h2>Contactos</h2><div class="contacts">${contactLinks}</div>` : ''}
        ${p.owner_name ? `<p class="small">Responsável: ${escapeHtml(p.owner_name)}</p>` : ''}
        <p class="small">
          <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Abrir no baldio.eu</a>
          ${changed ? ` · actualizado a ${escapeHtml(changed)}` : ''}
        </p>
      </div>`;
  }

  function openDetail(p, fromApp) {
    detailFromApp = fromApp;
    renderDetail(p);
    $('detail').hidden = false;
    $('detail').scrollTop = 0;
    document.title = `${p.name} · Baldio`;
  }

  function closeDetail() {
    $('detail').hidden = true;
    document.title = 'Baldio';
  }

  // fecha a página: "voltar" do histórico se veio da app, senão (ligação directa) troca o endereço
  function leaveDetail() {
    if (detailFromApp) {
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      closeDetail();
    }
  }

  $('detail').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') leaveDetail();
    if (action === 'map') {
      const p = bySlug.get(decodeURIComponent(location.hash.slice('#/p/'.length)));
      leaveDetail();
      setMode('mapa');
      if (p) mapView.focus(p);
    }
  });

  function route(fromApp) {
    const m = location.hash.match(/^#\/p\/(.+)$/);
    const p = m && bySlug.get(decodeURIComponent(m[1]));
    if (p) openDetail(p, fromApp);
    else closeDetail();
  }
  window.addEventListener('hashchange', () => route(true));

  // ---------- offline ----------

  // guarda capas e logótipos na cache das imagens, para a lista e as páginas abrirem sem rede
  async function warmImages() {
    if (!('caches' in window) || !navigator.onLine) return;
    try {
      const cache = await caches.open(IMG_CACHE);
      const urls = projects.flatMap(p => [p.thumb, p.logo_thumb]).filter(Boolean).map(local);
      for (const url of urls) {
        if (!(await cache.match(url))) await cache.add(url).catch(() => {});
      }
    } catch (e) { /* sem Cache API (ex.: janela privada) */ }
  }

  window.addEventListener('online', renderList);
  window.addEventListener('offline', renderList);

  // ---------- arranque ----------

  // os dados ficam guardados no aparelho; reload: true pede-os outra vez à rede (botão de actualizar).
  // É a app que os guarda, e não o service worker: na primeira visita ele ainda não controla a página.
  async function fetchData(reload) {
    let cache = null;
    try { cache = await caches.open(DATA_CACHE); } catch (e) { /* sem Cache API: vai sempre à rede */ }
    if (cache && !reload) {
      const cached = await cache.match(DATA_URL);
      if (cached) return cached.json();
    }
    const r = await fetch(DATA_URL, { cache: 'reload' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (cache) await cache.put(DATA_URL, r.clone());
    return r.json();
  }

  function useData(data) {
    updated = data.updated || '';
    types = data.tipos || {};
    projects = (data.projectos || []).map(p => ({
      ...p,
      gallery: p.gallery || [],
      tags: p.tags || [],
      search: normalize([p.name, p.location_label, p.distrito, p.morada, p.type_name, ...(p.tags || [])].join(' ')),
    }));
    projects.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    bySlug = new Map(projects.map(p => [p.slug, p]));
    if (typeFilter && !types[typeFilter]) typeFilter = '';
    mapView.reproject();
  }

  async function load() {
    try {
      useData(await fetchData(false));
    } catch (e) {
      $('meta').textContent = 'Não foi possível carregar os projectos. Abre a app uma vez com rede para os guardar.';
      return;
    }
    renderTypes();
    setMode(mode);
    applyFilters();
    route(false);
    setTimeout(warmImages, 1500);
  }

  $('refresh').addEventListener('click', async () => {
    const btn = $('refresh');
    if (btn.classList.contains('busy')) return;
    if (!navigator.onLine) {
      toast('Sem rede — continuas a ver os dados guardados.');
      return;
    }
    btn.classList.add('busy');
    try {
      const before = updated;
      const first = !projects.length;
      useData(await fetchData(true));
      renderTypes();
      if (first) { setMode(mode); route(false); }
      applyFilters();
      toast(updated === before ? 'Já tinhas os dados mais recentes.' : 'Projectos actualizados.');
      setTimeout(warmImages, 500);
    } catch (e) {
      toast('Não foi possível actualizar. Tenta outra vez com rede.');
    } finally {
      btn.classList.remove('busy');
    }
  });

  let toastTimer;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  load();
})();
