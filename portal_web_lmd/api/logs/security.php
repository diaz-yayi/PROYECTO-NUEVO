<?php
/**
 * API Endpoint: GET /api/logs/security.php
 * Bitácora de Auditoría y Seguridad en MySQL (Exclusivo Administradores)
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
    error_log("[SECURITY LOGS ERROR] No se pudo obtener conexión PDO a MySQL.");
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'No se pudo conectar con la base de datos. Inténtalo de nuevo en unos minutos.'
    ]);
    exit;
}

try {
    // 1. Asegurar que la tabla exista en MySQL
    $pdo->exec("CREATE TABLE IF NOT EXISTS `logs_seguridad` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `usuario_id` INT NULL,
        `email` VARCHAR(191) NULL,
        `evento` VARCHAR(100) NOT NULL,
        `detalles` TEXT NULL,
        `ip_origen` VARCHAR(45) NOT NULL,
        `user_agent` VARCHAR(255) NULL,
        `fecha_hora` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_log_usuario` (`usuario_id`),
        INDEX `idx_log_evento` (`evento`),
        INDEX `idx_log_fecha` (`fecha_hora`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $limite = isset($_GET['limit']) ? min(500, max(10, intval($_GET['limit']))) : 200;
    
    $query = "SELECT l.id, l.usuario_id, COALESCE(u.nombre, 'Sistema / Externo') AS nombre, 
                     l.email, l.evento, l.ip_origen, l.user_agent, l.detalles,
                     COALESCE(l.fecha_hora, NOW()) AS creado_en
              FROM logs_seguridad l
              LEFT JOIN usuarios_sistema u ON l.usuario_id = u.id
              ORDER BY l.id DESC
              LIMIT :limite";
              
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'logs' => $logs ?: [],
        'total' => count($logs ?: [])
    ]);
} catch (Exception $e) {
    error_log("[SECURITY LOGS ERROR] " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al consultar la bitácora de seguridad.'
    ]);
}
