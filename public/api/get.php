<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

ensure_snippets_dir();
cleanup_expired_snippets();

$id = validate_id((string) ($_GET['id'] ?? ''));
$path = snippet_path($id);

if (!file_exists($path)) {
    json_response(['success' => false, 'error' => 'Snippet not found or expired'], 404);
}

$raw = file_get_contents($path);
if ($raw === false) {
    json_response(['success' => false, 'error' => 'Failed to read snippet'], 500);
}

try {
    $snippet = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    @unlink($path);
    json_response(['success' => false, 'error' => 'Snippet is corrupted'], 500);
}

$expiresAt = isset($snippet['expiresAt']) ? (int) $snippet['expiresAt'] : ((int) @filemtime($path) + TTL_SECONDS);
if ($expiresAt <= time()) {
    @unlink($path);
    json_response(['success' => false, 'error' => 'Snippet has expired'], 404);
}

$remainingDays = (int) ceil(($expiresAt - time()) / 86400);

json_response([
    'success' => true,
    'id' => $id,
    'tsCode' => is_string($snippet['tsCode'] ?? null) ? $snippet['tsCode'] : '',
    'jsCode' => is_string($snippet['jsCode'] ?? null) ? $snippet['jsCode'] : '',
    'packages' => is_array($snippet['packages'] ?? null) ? $snippet['packages'] : [],
    'ttlDays' => TTL_DAYS,
    'expiresAt' => $expiresAt,
    'remainingDays' => max(0, $remainingDays),
]);
