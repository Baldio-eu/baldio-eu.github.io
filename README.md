# Integrações do Baldio

Site estático (GitHub Pages, `https://baldio-eu.github.io`) com exemplos de integração com o [baldio.eu](https://baldio.eu): cada página tem uma demonstração e código real para copiar.

| Página | O quê | Dados |
|--------|-------|-------|
| `index.html` | catálogo das integrações e fontes de dados | — |
| `mapa.html` | projectos num mapa, com lista e filtros; mapa local (SVG, sem APIs) ou OpenStreetMap (`?map=osm`) | `baldio.json` |
| `projectos.html` | cartões com capa; código em JS (feed) e PHP com curl (API) | `baldio.json` (`image`, `type_name`) |
| `adicionar.html` | formulário que gera o PHP com curl para `POST /api/v1/adicionar`; não envia nada | — |

## Fontes de dados

- `https://baldio.eu/baldio.json` — todos os projectos publicados, com CORS aberto (dá para ler no browser). Desde o commit `719ef4b` do Baldio traz `image` (capa: banner, senão logo; `-480` antes da extensão dá a versão pequena) e `type_name`.
- `https://baldio.eu/api/v1/…` — API completa ([documentação](https://baldio.eu/api)), sem CORS: só do servidor.
- `?source=` em qualquer página com dados troca o feed (ex.: `proxy.php`, a alternativa PHP com curl e cache de 1 h, só onde houver PHP).

O mapa local usa `data/base.topo.json` e `assets/projection.js`, copiados do `~/git/mapas-pt` (CAOP 2024.1 da DGT e IGN).

## Correr localmente

```bash
php -S localhost:8096
```

Cada push para o `master` publica no GitHub Pages em 1–2 minutos.
