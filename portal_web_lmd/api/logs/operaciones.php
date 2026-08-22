<?php
/**
 * API Endpoint: GET /api/logs/operaciones.php
 * Bitácora de Operaciones de Robots y Procesos en Google Sheets (Exclusivo Administradores)
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
require_once __DIR__ . '/../helpers/gas_gateway.php';

// Validar que el usuario tenga rol de Administrador
$adminUser = requireRole(['admin']);

$result = GASGateway::callGAS([
    'accion' => 'obtener_logs_sistema'
], 'GET');

echo json_encode($result);
