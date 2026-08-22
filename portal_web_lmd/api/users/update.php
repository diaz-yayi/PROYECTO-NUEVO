<?php
/**
 * API Endpoint: POST /api/users/update.php
 * Actualización de datos, rol, estado y contraseña de usuarios
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
$email = strtolower(trim($input['email'] ?? ''));
$nombre = trim($input['nombre'] ?? '');
$password = trim($input['password'] ?? '');
$rol = trim($input['rol'] ?? '');
$estado = trim($input['estado'] ?? '');

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID de usuario inválido.']);
    exit;
}

$pdo = DB::getConnection();
if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Base de datos no disponible.']);
    exit;
}

try {
    $stmtCheck = $pdo->prepare("SELECT id, email, rol, estado FROM usuarios_sistema WHERE id = :id LIMIT 1");
    $stmtCheck->execute([':id' => $userId]);
    $existing = $stmtCheck->fetch();

    if (!$existing) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado.']);
        exit;
    }

    $updates = [];
    $params = [':id' => $userId];

    if (!empty($nombre)) {
        $updates[] = "`nombre` = :n";
        $params[':n'] = $nombre;
    }

    if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        // Verificar duplicados
        $stmtDup = $pdo->prepare("SELECT id FROM usuarios_sistema WHERE email = :e AND id != :id LIMIT 1");
        $stmtDup->execute([':e' => $email, ':id' => $userId]);
        if ($stmtDup->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'El correo electrónico ya está en uso por otro usuario.']);
            exit;
        }
        $updates[] = "`email` = :e";
        $params[':e'] = $email;
    }

    if (!empty($rol) && in_array($rol, ['admin', 'operador', 'consultor'], true)) {
        $updates[] = "`rol` = :r";
        $params[':r'] = $rol;
    }

    if (!empty($estado) && in_array($estado, ['activo', 'inactivo'], true)) {
        $updates[] = "`estado` = :s";
        $params[':s'] = $estado;
    }

    if (!empty($password) && strlen($password) >= 8) {
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $updates[] = "`password_hash` = :p";
        $params[':p'] = $passwordHash;
    }

    if (empty($updates)) {
        echo json_encode(['success' => true, 'message' => 'Sin cambios detectados.']);
        exit;
    }

    $sql = "UPDATE usuarios_sistema SET " . implode(', ', $updates) . " WHERE id = :id";
    $stmtUp = $pdo->prepare($sql);
    $stmtUp->execute($params);

    // Log de auditoría
    $stmtLog = $pdo->prepare("INSERT INTO logs_seguridad (usuario_id, email, evento, ip_origen, detalles) VALUES (:uid, :em, 'USUARIO_ACTUALIZADO', :ip, :det)");
    $stmtLog->execute([
        ':uid' => $adminUser['id'] ?? null,
        ':em' => $adminUser['email'] ?? 'admin',
        ':ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ':det' => "Usuario ID $userId actualizado por " . ($adminUser['email'] ?? 'admin')
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Usuario actualizado correctamente.'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al actualizar usuario: ' . $e->getMessage()]);
}
