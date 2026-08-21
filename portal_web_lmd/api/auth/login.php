<?php
/**
 * Endpoint de Autenticación Segura (POST /api/auth/login.php)
 * Valida credenciales contra MySQL (Bcrypt) y emite token JWT con Roles RBAC
 * Portal de acceso — Centro de mando (EM)
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../helpers/db.php';
require_once __DIR__ . '/../helpers/jwt_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Use POST.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = strtolower(trim($input['email'] ?? $input['usuario'] ?? ''));
$password = trim($input['password'] ?? '');

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email y contraseña son requeridos.']);
    exit;
}

$pdo = DB::getConnection();
$userValid = false;
$userData = null;

if ($pdo) {
    try {
        $stmt = $pdo->prepare("SELECT id, email, nombre, password_hash, rol, estado, intentos_fallidos, bloqueado_hasta FROM usuarios_sistema WHERE email = :e LIMIT 1");
        $stmt->execute([':e' => $email]);
        $row = $stmt->fetch();

        if ($row) {
            // Verificar si la cuenta está bloqueada temporalmente
            if (!empty($row['bloqueado_hasta']) && strtotime($row['bloqueado_hasta']) > time()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta en unos minutos.']);
                exit;
            }

            $pwdMatch = password_verify($password, $row['password_hash']);

            if ($row['estado'] === 'activo' && $pwdMatch) {
                $userValid = true;
                $userData = [
                    'id' => $row['id'],
                    'email' => $row['email'],
                    'nombre' => $row['nombre'],
                    'rol' => $row['rol']
                ];

                // Actualizar hash Bcrypt si es necesario, resetear intentos fallidos y marcar acceso
                $nuevoHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $update = $pdo->prepare("UPDATE usuarios_sistema SET password_hash = :ph, intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id = :id");
                $update->execute([':ph' => $nuevoHash, ':id' => $row['id']]);

                // Registrar log de auditoría
                $log = $pdo->prepare("INSERT INTO logs_seguridad (usuario_id, email, evento, ip_origen, user_agent, detalles) VALUES (:uid, :em, 'LOGIN_EXITOSO', :ip, :ua, 'Inicio de sesión con éxito')");
                $log->execute([
                    ':uid' => $row['id'],
                    ':em' => $email,
                    ':ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                    ':ua' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255)
                ]);
            } else {
                // Incrementar intentos fallidos
                $intentos = ($row['intentos_fallidos'] ?? 0) + 1;
                $bloqueo = null;
                if ($intentos >= 5) {
                    $bloqueo = date('Y-m-d H:i:s', time() + (15 * 60)); // Bloqueo por 15 min
                }
                $update = $pdo->prepare("UPDATE usuarios_sistema SET intentos_fallidos = :inf, bloqueado_hasta = :bl WHERE id = :id");
                $update->execute([':inf' => $intentos, ':bl' => $bloqueo, ':id' => $row['id']]);

                // Registrar log
                $log = $pdo->prepare("INSERT INTO logs_seguridad (usuario_id, email, evento, ip_origen, user_agent, detalles) VALUES (:uid, :em, 'LOGIN_FALLIDO', :ip, :ua, 'Contraseña incorrecta')");
                $log->execute([
                    ':uid' => $row['id'],
                    ':em' => $email,
                    ':ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                    ':ua' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255)
                ]);
            }
        }
    } catch (Exception $e) {
        error_log("[LOGIN ERROR] " . $e->getMessage());
    }
}

if (!$userValid) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Credenciales inválidas. Verifica tu correo electrónico y contraseña.'
    ]);
    exit;
}

// Generar Token JWT firmado con rol y perfil
$token = JWTHelper::generateToken($userData);

echo json_encode([
    'success' => true,
    'token' => $token,
    'user' => $userData,
    'expiresIn' => JWT_EXPIRATION_SECONDS
]);
