# baldio-feed

POC: página HTML estática que lista os projectos do Baldio a partir do feed público `https://baldio.eu/baldio.json` (schema `baldio/1.0`, com `Access-Control-Allow-Origin: *`).

- `index.html` + `assets/app.js` — `fetch` directo ao feed; pesquisa por nome/localidade e filtro por tipo. Funciona no GitHub Pages.
- `proxy.php` — alternativa no servidor (curl + cache de 1 h em `cache/`). Só onde houver PHP (cPanel/Hetzner); usar com `index.html?source=proxy.php`.

## Correr localmente

```bash
php -S localhost:8096
```

## GitHub Pages

Criar o repo no GitHub, fazer push do `master` e, em Settings → Pages, escolher "Deploy from a branch" → `master` / `(root)`.
