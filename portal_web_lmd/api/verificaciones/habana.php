<?php
/**
 * API Endpoint: GET /api/verificaciones/habana.php
 * Bitácora de Verificaciones Consulares de La Habana (cgelahabana.es)
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth_guard.php';
require_once __DIR__ . '/../helpers/gas_gateway.php';

// Validar que el usuario esté autenticado (admin o consultor)
$user = requireRole(['admin', 'consultor']);

$result = GASGateway::callGAS([
    'accion' => 'obtener_verificacion_habana'
], 'GET');

echo json_encode($result);
