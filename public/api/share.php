<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

ensure_snippets_dir();
cleanup_expired_snippets();

$data = read_request_json();

if (!isset($data['tsCode']) || !is_string($data['tsCode'])) {
    json_response(['success' => false, 'error' => 'Missing tsCode'], 400);
}

$tsCode = $data['tsCode'];
$jsCode = isset($data['jsCode']) && is_string($data['jsCode']) ? $data['jsCode'] : '';
$packages = isset($data['packages']) && is_array($data['packages']) ? $data['packages'] : [];

if (strlen($tsCode) > MAX_CODE_BYTES || strlen($jsCode) > MAX_CODE_BYTES) {
    json_response(['success' => false, 'error' => 'Snippet is too large'], 413);
}

$id = '';
$path = '';
for ($attempt = 0; $attempt < 10; $attempt++) {
    $id = generate_id();
    $path = snippet_path($id);
    if (!file_exists($path)) {
        break;
    }
}

if ($id === '' || $path === '' || file_exists($path)) {
    json_response(['success' => false, 'error' => 'Failed to create share link'], 500);
}

$createdAt = time();
$expiresAt = $createdAt + TTL_SECONDS;

$snippet = [
    'version' => 1,
    'createdAt' => $createdAt,
    'expiresAt' => $expiresAt,
    'ttlDays' => TTL_DAYS,
    'tsCode' => $tsCode,
    'jsCode' => $jsCode,
    'packages' => $packages,
];

$json = json_encode($snippet, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false || file_put_contents($path, $json, LOCK_EX) === false) {
    json_response(['success' => false, 'error' => 'Failed to persist share link'], 500);
}

json_response([
    'success' => true,
    'id' => $id,
    'ttlDays' => TTL_DAYS,
    'expires' => TTL_DAYS,
    'expiresAt' => $expiresAt,
    'message' => 'Link copied. It will expire in 7 days.',
]);
