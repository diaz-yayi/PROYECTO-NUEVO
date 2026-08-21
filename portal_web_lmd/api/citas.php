<?php
/**
 * API Endpoint: /api/citas.php
 * Radar de Citas y Actualización de Credenciales Consulares
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/middleware/auth_guard.php';
require_once __DIR__ . '/helpers/gas_gateway.php';

// Validar JWT
$userData = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $consulado = $_GET['consulado'] ?? '';
    $result = GASGateway::callGAS([
        'accion' => 'obtener_citas_candidatos',
        'consulado' => $consulado
    ], 'GET');
    echo json_encode($result);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $datos = $input['datos'] ?? $input;

    $payload = [
        'accion' => 'guardar_credenciales_citas',
        'datos' => $datos,
        'identificador' => $datos['identificador'] ?? '',
        'nombreCompleto' => $datos['nombreCompleto'] ?? '',
        'consulado' => $datos['consulado'] ?? '',
        'urgencia' => $datos['urgencia'] ?? '',
        'preferencia' => $datos['preferencia'] ?? '',
        'usuarioConsular' => $datos['usuarioConsular'] ?? '',
        'passwordConsular' => $datos['passwordConsular'] ?? '',
        'fechaCita' => $datos['fechaCita'] ?? '',
        'usuarioEditor' => $userData['email'] ?? 'admin'
    ];

    $result = GASGateway::callGAS($payload, 'POST');
    echo json_encode($result);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
