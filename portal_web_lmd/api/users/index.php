<?php
/**
 * API Endpoint: GET /api/users/index.php
 * Lista de usuarios y roles del sistema (Exclusivo Administradores)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../helpers/cors.php';
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../helpers/db.php';
require_once __DIR__ . '/../middleware/auth_guard.php';

// Validar que el usuario tenga rol de Administrador
$adminUser = requireRole(['admin']);

$pdo = DB::getConnection();
if (!$pdo) {
    error_log("[USERS INDEX ERROR] No se pudo obtener conexión PDO a MySQL.");
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'No se pudo conectar con la base de datos. Inténtalo de nuevo en unos minutos.'
    ]);
    exit;
}

try {
    $stmt = $pdo->query("SELECT id, email, nombre, rol, estado, ultimo_acceso, creado_en FROM usuarios_sistema WHERE eliminado_en IS NULL ORDER BY creado_en DESC");
    $users = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
} catch (Exception $e) {
    error_log("[USERS INDEX ERROR] " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al consultar usuarios.'
    ]);
}
