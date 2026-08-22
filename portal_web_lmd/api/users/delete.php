<?php
/**
 * API Endpoint: POST /api/users/delete.php
 * Eliminación de usuario del sistema (Exclusivo Administradores)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../helpers/cors.php';
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$userId = (int)($input['id'] ?? 0);

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID de usuario inválido.']);
    exit;
}

// Prevenir que el admin se elimine a sí mismo
if ($userId === (int)($adminUser['id'] ?? 0)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No puedes eliminar tu propia cuenta de administrador.']);
    exit;
}

$pdo = DB::getConnection();
if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Base de datos no disponible.']);
    exit;
}

try {
    $stmtDel = $pdo->prepare("DELETE FROM usuarios_sistema WHERE id = :id");
    $stmtDel->execute([':id' => $userId]);

    // Log de auditoría
    $stmtLog = $pdo->prepare("INSERT INTO logs_seguridad (usuario_id, email, evento, ip_origen, detalles) VALUES (:uid, :em, 'USUARIO_ELIMINADO', :ip, :det)");
    $stmtLog->execute([
        ':uid' => $adminUser['id'] ?? null,
        ':em' => $adminUser['email'] ?? 'admin',
        ':ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ':det' => "Usuario ID $userId eliminado por " . ($adminUser['email'] ?? 'admin')
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Usuario eliminado correctamente del sistema.'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al eliminar usuario: ' . $e->getMessage()]);
}
