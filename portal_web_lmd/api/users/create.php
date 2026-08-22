<?php
/**
 * API Endpoint: POST /api/users/create.php
 * Creación de nuevo usuario con contraseña cifrada en Bcrypt (Exclusivo Administradores)
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
$email = strtolower(trim($input['email'] ?? ''));
$nombre = trim($input['nombre'] ?? '');
$password = trim($input['password'] ?? '');
$rol = trim($input['rol'] ?? 'operador');
$estado = trim($input['estado'] ?? 'activo');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Se requiere un correo electrónico válido.']);
    exit;
}

if (empty($nombre)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'El nombre es requerido.']);
    exit;
}

if (empty($password) || strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres.']);
    exit;
}

$rolesPermitidos = ['admin', 'operador', 'consultor'];
if (!in_array($rol, $rolesPermitidos, true)) {
    $rol = 'operador';
}

$pdo = DB::getConnection();
if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Base de datos no disponible.']);
    exit;
}

try {
    // Verificar si el correo ya existe
    $stmtCheck = $pdo->prepare("SELECT id FROM usuarios_sistema WHERE email = :e LIMIT 1");
    $stmtCheck->execute([':e' => $email]);
    if ($stmtCheck->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Ya existe un usuario registrado con este correo.']);
        exit;
    }

    // Hashear contraseña con Bcrypt coste 12
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmtInsert = $pdo->prepare("
        INSERT INTO usuarios_sistema (email, nombre, password_hash, rol, estado)
        VALUES (:e, :n, :p, :r, :s)
    ");
    $stmtInsert->execute([
        ':e' => $email,
        ':n' => $nombre,
        ':p' => $passwordHash,
        ':r' => $rol,
        ':s' => $estado
    ]);

    $nuevoId = $pdo->lastInsertId();

    // Log de seguridad
    $stmtLog = $pdo->prepare("INSERT INTO logs_seguridad (usuario_id, email, evento, ip_origen, detalles) VALUES (:uid, :em, 'USUARIO_CREADO', :ip, :det)");
    $stmtLog->execute([
        ':uid' => $adminUser['id'] ?? null,
        ':em' => $adminUser['email'] ?? 'admin',
        ':ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ':det' => "Usuario creado: $email ($nombre) con rol $rol"
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Usuario creado exitosamente.',
        'user' => [
            'id' => $nuevoId,
            'email' => $email,
            'nombre' => $nombre,
            'rol' => $rol,
            'estado' => $estado
        ]
    ]);
} catch (Exception $e) {
    error_log("[USERS CREATE ERROR] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al crear usuario.']);
}
