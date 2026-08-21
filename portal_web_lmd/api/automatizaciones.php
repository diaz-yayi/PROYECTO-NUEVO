<?php
/**
 * API Endpoint: /api/automatizaciones.php
 * Disparador protegido para Vencimientos, Envíos Masivos, Sincronizador de Citas y Verificador La Habana
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/middleware/auth_guard.php';
require_once __DIR__ . '/helpers/gas_gateway.php';

// Validar JWT y rol (admin y operador)
$userData = requireRole(['admin', 'operador']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$accionFrontend = $input['accion'] ?? '';
$payloadExtra = $input['payload'] ?? $input['datos'] ?? [];

$mapAcciones = [
    'ejecutarVencimientos' => 'ejecutar_verificar_vencimientos',
    'ejecutarEnviosMasivos' => 'ejecutar_envio_notificaciones',
    'sincronizarCitas' => 'ejecutar_sincronizar_citas',
    'ejecutarVerificadorHabana' => 'verificar_un_expediente_habana',
    'conmutarModoPrueba' => 'conmutar_modo_prueba'
];

$accionGAS = $mapAcciones[$accionFrontend] ?? $accionFrontend;

if (!$accionGAS) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Acción de automatización no especificada.']);
    exit;
}

$payloadGAS = array_merge([
    'accion' => $accionGAS,
    'usuarioEjecutor' => $userData['email'] ?? 'admin'
], is_array($payloadExtra) ? $payloadExtra : []);

$result = GASGateway::callGAS($payloadGAS, 'POST');
echo json_encode($result);
