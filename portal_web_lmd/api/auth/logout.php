<?php
/**
 * Endpoint de Cierre de Sesión (POST /api/auth/logout.php)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../helpers/cors.php';
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../helpers/jwt_helper.php';
JWTHelper::clearTokenCookie();

echo json_encode([
    'success' => true,
    'message' => 'Sesión cerrada correctamente.'
]);
