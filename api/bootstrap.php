<?php
declare(strict_types=1);

const SNIPPETS_DIR = __DIR__ . '/../snippets';
const TTL_DAYS = 7;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;
const MAX_CODE_BYTES = 512 * 1024;
const ID_LENGTH = 10;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ensure_snippets_dir(): void
{
    if (!is_dir(SNIPPETS_DIR) && !mkdir(SNIPPETS_DIR, 0755, true) && !is_dir(SNIPPETS_DIR)) {
        json_response(['success' => false, 'error' => 'Failed to initialize snippet storage'], 500);
    }
}

function cleanup_expired_snippets(): void
{
    ensure_snippets_dir();
    foreach (glob(SNIPPETS_DIR . '/*.json') ?: [] as $file) {
        $raw = @file_get_contents($file);
        if ($raw === false) {
            continue;
        }
        $data = json_decode($raw, true);
        $expiresAt = is_array($data) && isset($data['expiresAt']) ? (int) $data['expiresAt'] : ((int) @filemtime($file) + TTL_SECONDS);
        if ($expiresAt <= time()) {
            @unlink($file);
        }
    }
}

function generate_id(): string
{
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $charsLen = strlen($chars) - 1;
    $id = '';
    for ($i = 0; $i < ID_LENGTH; $i++) {
        $id .= $chars[random_int(0, $charsLen)];
    }
    return $id;
}

function validate_id(string $id): string
{
    if ($id === '' || !preg_match('/^[A-Za-z0-9]{6,32}$/', $id)) {
        json_response(['success' => false, 'error' => 'Invalid snippet ID'], 400);
    }
    return $id;
}

function read_request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        json_response(['success' => false, 'error' => 'Request body is empty'], 400);
    }
    if (strlen($raw) > MAX_CODE_BYTES) {
        json_response(['success' => false, 'error' => 'Snippet is too large'], 413);
    }
    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_response(['success' => false, 'error' => 'Invalid JSON'], 400);
    }
    if (!is_array($data)) {
        json_response(['success' => false, 'error' => 'Invalid JSON payload'], 400);
    }
    return $data;
}

function snippet_path(string $id): string
{
    return SNIPPETS_DIR . '/' . $id . '.json';
}
