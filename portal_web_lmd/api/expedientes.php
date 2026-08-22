<?php
/**
 * API Endpoint: /api/expedientes.php
 * Operaciones CRUD y consulta de Expedientes LMD + Dashboard KPIs
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/helpers/cors.php';
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

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
    // 1. Petición unificada ultra-rápida (Bootstrap Completo en 1 solo viaje de red)
    $resBootstrap = GASGateway::callGAS(['accion' => 'obtener_bootstrap_sistema'], 'GET');

    if (isset($resBootstrap['ok']) && $resBootstrap['ok']) {
        echo json_encode([
            'success' => true,
            'ok' => true,
            'expedientes' => $resBootstrap['expedientes'] ?? [],
            'consulados' => $resBootstrap['consulados'] ?? [],
            'dashboardKPIs' => $resBootstrap['dashboardKPIs'] ?? [],
            'configSistema' => $resBootstrap['configSistema'] ?? [],
            'citas' => $resBootstrap['citas'] ?? [],
            'verificacionesHabana' => $resBootstrap['verificacionesHabana'] ?? [],
            'verificacionesRCC' => $resBootstrap['verificacionesRCC'] ?? [],
            'modoPrueba' => $resBootstrap['modoPrueba'] ?? true
        ]);
        exit;
    }

    // Fallback de contingencia (llamadas individuales si el bootstrap antiguo estuviera en despliegue previo)
    $resExp = GASGateway::callGAS(['accion' => 'obtener_todos_expedientes'], 'GET');
    $resKPIs = GASGateway::callGAS(['accion' => 'obtener_dashboard_kpis'], 'GET');
    $resCfg = GASGateway::callGAS(['accion' => 'obtener_configuracion_sistema'], 'GET');

    $esModoPrueba = true;
    if (isset($resCfg['config']['MODO_PRUEBA'])) {
        $val = $resCfg['config']['MODO_PRUEBA'];
        $esModoPrueba = ($val === true || $val === 'true' || $val === 1 || $val === '1');
    } elseif (isset($resKPIs['modoPrueba'])) {
        $val = $resKPIs['modoPrueba'];
        $esModoPrueba = ($val === true || $val === 'true' || $val === 1 || $val === '1');
    }

    echo json_encode([
        'success' => true,
        'ok' => true,
        'expedientes' => $resExp['expedientes'] ?? [],
        'dashboardKPIs' => $resKPIs ?? [],
        'configSistema' => $resCfg['config'] ?? [],
        'modoPrueba' => $esModoPrueba
    ]);
    exit;
}

if ($method === 'POST') {
    if (!in_array($userData['rol'] ?? '', ['admin', 'operador'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado. Tu nivel de acceso no tiene permisos para esta acción.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $accion = $input['accion'] ?? 'guardar_expediente_general';
    $datos = $input['datos'] ?? $input;

    $payload = [
        'accion' => 'guardar_expediente_general',
        'datos' => $datos,
        'identificador' => $datos['identificador'] ?? '',
        'nombre' => $datos['nombre'] ?? '',
        'apellidos' => $datos['apellidos'] ?? '',
        'consulado' => $datos['consulado'] ?? '',
        'noExpediente' => $datos['noExpediente'] ?? '',
        'estado' => $datos['estado'] ?? '',
        'detalle' => $datos['detalle'] ?? '',
        'observaciones' => $datos['observaciones'] ?? '',
        'correoCreado' => $datos['correoCreado'] ?? '',
        'email' => $datos['email'] ?? '',
        'usuarioEditor' => $userData['email'] ?? 'admin'
    ];

    $result = GASGateway::callGAS($payload, 'POST');
    
    echo json_encode($result);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
