<?php
/**
 * Endpoint de Verificación de Sesión JWT (GET /api/auth/verify.php)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../helpers/cors.php';
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth_guard.php';

$userData = requireAuth();

echo json_encode([
    'success' => true,
    'user' => $userData
]);
