# baldio-feed

POC: página HTML estática que lista os projectos do Baldio a partir do feed público `https://baldio.eu/baldio.json` (schema `baldio/1.0`, com `Access-Control-Allow-Origin: *`).

- `index.html` + `assets/app.js` — `fetch` directo ao feed; mapa + lista com pesquisa por nome/localidade e filtro por tipo. Funciona no GitHub Pages. Dois mapas à escolha (`?map=local` ou `?map=osm`):
  - **Local** — SVG da Península com caixas para Açores/Madeira/Canárias, copiado do `~/git/mapas-pt` (`data/base.topo.json`, `assets/projection.js`); nada de tiles nem pedidos a terceiros.
  - **OpenStreetMap** — Leaflet com tiles de tile.openstreetmap.org.
- Nomes e cores dos tipos fixos no `app.js` (iguais aos do baldio.eu), porque o feed só traz o slug.
- `proxy.php` — alternativa no servidor (curl + cache de 1 h em `cache/`). Só onde houver PHP (cPanel/Hetzner); usar com `index.html?source=proxy.php`.

## Correr localmente

```bash
php -S localhost:8096
```

## GitHub Pages

Criar o repo no GitHub, fazer push do `master` e, em Settings → Pages, escolher "Deploy from a branch" → `master` / `(root)`.
