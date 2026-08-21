<?php
/**
 * API Endpoint: /api/configuracion.php
 * Lectura y guardado de parámetros del despacho en Google Workspace
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/helpers/cors.php';
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/middleware/auth_guard.php';
require_once __DIR__ . '/helpers/gas_gateway.php';

// Validar JWT y rol (exclusivo admin)
$userData = requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $result = GASGateway::callGAS([
        'accion' => 'obtener_configuracion_sistema'
    ], 'GET');
    echo json_encode($result);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $datosConfig = $input['config'] ?? $input['datos'] ?? $input;

    $result = GASGateway::callGAS([
        'accion' => 'guardar_configuracion_sistema',
        'config' => $datosConfig,
        'usuarioEditor' => $userData['email'] ?? 'admin'
    ], 'POST');
    
    echo json_encode($result);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
