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
    // El esquema (incluida logs_seguridad) lo crea db/schema.sql al
    // aprovisionar la base de datos — no hace falta re-crearlo aquí en
    // cada petición.
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
