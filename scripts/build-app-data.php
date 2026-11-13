<?php
// Gera os dados da app (app/data/projectos.json): a página completa de cada projecto publicado
// no Baldio, lida de GET /api/v1/projectos. A API não envia CORS, por isso isto corre do lado do
// servidor — no cron do GitHub Actions (.github/workflows/app-data.yml) ou à mão:
//
//   php scripts/build-app-data.php
//
// Capas e logótipos ficam em app/data/img (versão -480) para a app abrir offline; a galeria fica
// com os URLs do baldio.eu e entra na cache da app à medida que é vista.
// Só escreve quando alguma coisa muda, para o cron não fazer commits vazios.

const API_URL = 'https://baldio.eu/api/v1/projectos';
const SITE_URL = 'https://baldio.eu';
const DATA_DIR = __DIR__ . '/../app/data';
const IMG_DIR = DATA_DIR . '/img';
const OUT_FILE = DATA_DIR . '/projectos.json';
const JSON_FLAGS = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

function fetchUrl(string $url): ?string
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'baldio-app-data (+https://baldio-eu.github.io/app/)',
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    return ($body === false || $status !== 200) ? null : $body;
}

function absolute(string $src): string
{
    return str_starts_with($src, '/') ? SITE_URL . $src : $src;
}

// /uploads/2026/11/11_174640_350879ba.jpg → img/2026-11-11_174640_350879ba-480.jpg, descarregada se ainda
// não existir. Só .jpg: é o único formato para o qual o baldio.eu gera a versão -480.
function localThumb(string $src): ?string
{
    if (!preg_match('#^/uploads/(\d{4}/\d{2}/[A-Za-z0-9_\-]+)\.jpg$#', $src, $m)) return null;
    $name = str_replace('/', '-', $m[1]) . '-480.jpg';
    $file = IMG_DIR . '/' . $name;
    if (!is_file($file)) {
        $body = fetchUrl(SITE_URL . '/uploads/' . $m[1] . '-480.jpg');
        if ($body === null) return null; // fica sem capa local; a próxima corrida tenta outra vez
        file_put_contents($file, $body);
    }
    return 'img/' . $name;
}

$items = json_decode(fetchUrl(API_URL) ?? '', true);
if (!is_array($items) || !$items) {
    // lista vazia é avaria, não "todos os projectos saíram" — não apagar os dados que já lá estão
    fwrite(STDERR, "API do Baldio indisponível ou vazia — nada foi alterado\n");
    exit(1);
}

if (!is_dir(IMG_DIR)) mkdir(IMG_DIR, 0775, true);

$projectos = [];
$tipos = [];
foreach ($items as $p) {
    $cover = $p['banner'] ?: $p['logo'];
    $p['url'] = absolute($p['url']);
    $p['thumb'] = $cover ? localThumb($cover) : null;
    $p['logo_thumb'] = ($p['banner'] && $p['logo']) ? localThumb($p['logo']) : null;
    $p['logo'] = $p['logo'] ? absolute($p['logo']) : '';
    $p['banner'] = $p['banner'] ? absolute($p['banner']) : '';
    $p['gallery'] = array_map('absolute', $p['gallery'] ?? []);
    $tipos[$p['type']] = $p['type_name'] ?: $p['type'];
    $projectos[] = $p;
}
ksort($tipos);

$old = is_file(OUT_FILE) ? json_decode(file_get_contents(OUT_FILE), true) : null;
if ($old && json_encode($old['projectos'] ?? null, JSON_FLAGS) === json_encode($projectos, JSON_FLAGS)) {
    echo 'Sem alterações (' . count($projectos) . " projectos)\n";
    exit(0);
}

$feed = [
    'schema' => 'baldio-app/1.0',
    'source' => API_URL,
    'updated' => gmdate('c'),
    'count' => count($projectos),
    'tipos' => $tipos,
    'projectos' => $projectos,
];
$tmp = OUT_FILE . '.tmp';
file_put_contents($tmp, json_encode($feed, JSON_FLAGS) . "\n");
rename($tmp, OUT_FILE);

// imagens de projectos que saíram ou mudaram de capa
$used = array_flip(array_filter(array_merge(array_column($projectos, 'thumb'), array_column($projectos, 'logo_thumb'))));
$removed = 0;
foreach (glob(IMG_DIR . '/*.jpg') as $file) {
    if (!isset($used['img/' . basename($file)])) {
        unlink($file);
        $removed++;
    }
}

echo 'Actualizado: ' . count($projectos) . ' projectos, ' . count($used) . " imagens locais ($removed removidas)\n";
