<?php
// Server-side alternative to the direct fetch: reads baldio.json with curl and caches it.
// Does NOT run on GitHub Pages (static only) — for cPanel/Hetzner. Use index.html?source=proxy.php

const FEED_URL = 'https://baldio.eu/baldio.json';
const CACHE_FILE = __DIR__ . '/cache/baldio.json';
const CACHE_TTL = 3600;

header('Content-Type: application/json; charset=utf-8');

if (is_file(CACHE_FILE) && time() - filemtime(CACHE_FILE) < CACHE_TTL) {
    readfile(CACHE_FILE);
    exit;
}

$curl = curl_init(FEED_URL);
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_USERAGENT => 'baldio-feed-poc',
]);
$body = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($body === false || $status !== 200 || json_decode($body) === null) {
    // Stale cache beats an error
    if (is_file(CACHE_FILE)) {
        readfile(CACHE_FILE);
        exit;
    }
    http_response_code(502);
    echo json_encode(['error' => 'feed indisponível']);
    exit;
}

@mkdir(dirname(CACHE_FILE), 0775, true);
file_put_contents(CACHE_FILE, $body);
echo $body;
