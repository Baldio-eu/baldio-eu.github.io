# Integrações do Baldio

Site estático (GitHub Pages, `https://baldio-eu.github.io`) com exemplos de integração com o [baldio.eu](https://baldio.eu): cada página tem uma demonstração e código real para copiar.

| Página | O quê | Dados |
|--------|-------|-------|
| `index.html` | destaque da app no topo: instala a app daqui mesmo (`manifest.json` da raiz aponta para `app/` e regista o `app/sw.js`, como no openquadro) + catálogo das integrações e fontes de dados | — |
| `mapa.html` | projectos num mapa, com lista e filtros; mapa local (SVG, sem APIs) ou OpenStreetMap (`?map=osm`) | `baldio.json` |
| `projectos.html` | cartões com capa; código em JS (feed) e PHP com curl (API) | `baldio.json` (`image`, `type_name`) |
| `adicionar.html` | formulário que gera o PHP com curl para `POST /api/v1/adicionar`; não envia nada | — |
| `app/` | **spike** — app instalável (PWA, como o openquadro) que funciona offline: lista ou mapa (botão no fundo) e a página completa de cada projecto | `app/data/projectos.json` |

## Fontes de dados

- `https://baldio.eu/baldio.json` — todos os projectos publicados, com CORS aberto (dá para ler no browser). Desde o commit `719ef4b` do Baldio traz `image` (capa: banner, senão logo; `-480` antes da extensão dá a versão pequena) e `type_name`.
- `https://baldio.eu/api/v1/…` — API completa ([documentação](https://baldio.eu/api)), sem CORS: só do servidor.
- `?source=` em qualquer página com dados troca o feed (ex.: `proxy.php`, a alternativa PHP com curl e cache de 1 h, só onde houver PHP).

- `https://baldio-eu.github.io/app/data/projectos.json` — a página completa de cada projecto (corpo, galeria, contactos, etiquetas, ofertas/procuras), com CORS aberto (GitHub Pages). Gerado pelo cron abaixo; `thumb` e `logo_thumb` são capas `-480` guardadas neste repo, relativas ao JSON.

O mapa local usa `data/base.topo.json` e `assets/projection.js`, copiados do `~/git/mapas-pt` (CAOP 2024.1 da DGT e IGN).

## App (`app/`)

PWA sem build: `index.html` + `manifest.json` + `sw.js` + `assets/`, d3 e topojson em `app/vendor/` (nada vem de CDNs). Depois da primeira visita com rede abre sem rede: o service worker guarda a casca e o mapa base, a app guarda os dados e as capas, e a galeria fica guardada à medida que é vista. No telemóvel instala-se com "Adicionar ao ecrã principal".

- A app instalada vem sem dados: na primeira abertura pede `data/projectos.json` e guarda-o no aparelho; daí em diante lê sempre essa cópia, até se carregar no botão ⟳ (em cima, ao lado da pesquisa), que o pede outra vez.
- `#/p/{slug}` abre a página de um projecto (o "voltar" do telemóvel fecha-a); a vista lista/mapa fica guardada no aparelho.
- Mudar um ficheiro da casca exige subir `SHELL` em `app/sw.js` e o `?v=` desse ficheiro (no `sw.js` e no `app/index.html`); nas outras páginas, subir o `?v=` do CSS/JS alterado.

**Dados — cron.** `.github/workflows/app-data.yml` corre de 6 em 6 horas (e à mão em Actions → "Dados da app" → Run workflow): `php scripts/build-app-data.php` lê `GET /api/v1/projectos`, descarrega as capas e os logótipos que faltam para `app/data/img/`, apaga os que deixaram de ser usados e só faz commit se alguma coisa mudou. Correr à mão:

```bash
php scripts/build-app-data.php
```

## Correr localmente

```bash
php -S localhost:8096
```

Cada push para o `master` publica no GitHub Pages em 1–2 minutos.
