<?php
/**
 * Configuración Segura del Servidor (Sered / cPanel y Docker Local)
 * Portal de acceso — Centro de mando (EM)
 */

// Evitar acceso directo
if (basename($_SERVER['PHP_SELF']) === basename(__FILE__)) {
    header('HTTP/1.0 403 Forbidden');
    exit('Acceso denegado.');
}

// ─────────────────────────────────────────────
// 0. CARGA DE SECRETOS LOCALES (fuera de git)
// Ver config.secrets.example.php para la plantilla.
// Prioridad de lectura: variable de entorno real > config.secrets.php > fallback.
// ─────────────────────────────────────────────
$secretosLocalesPath = __DIR__ . '/config.secrets.php';
$secretosLocales = file_exists($secretosLocalesPath) ? require $secretosLocalesPath : [];

function env_or_secret($key, array $secretos, $fallback = null) {
    $env = getenv($key);
    if ($env !== false && $env !== '') {
        return $env;
    }
    if (isset($secretos[$key]) && $secretos[$key] !== '') {
        return $secretos[$key];
    }
    return $fallback;
}

// ─────────────────────────────────────────────
// 1. CONFIGURACIÓN DE BASE DE DATOS (MYSQL)
// ─────────────────────────────────────────────
define('DB_HOST', env_or_secret('DB_HOST', $secretosLocales, 'localhost'));
define('DB_NAME', env_or_secret('DB_NAME', $secretosLocales, null));
define('DB_USER', env_or_secret('DB_USER', $secretosLocales, null));
define('DB_PASS', env_or_secret('DB_PASS', $secretosLocales, null));
define('DB_PORT', env_or_secret('DB_PORT', $secretosLocales, '3306'));
define('DB_CHARSET', 'utf8mb4');

// ─────────────────────────────────────────────
// 2. SEGURIDAD Y JWT (JSON WEB TOKENS)
// ─────────────────────────────────────────────
define('JWT_SECRET_KEY', env_or_secret('JWT_SECRET_KEY', $secretosLocales, null));
// Tiempo de expiración estricto del token (48 horas = 172800 segundos)
define('JWT_EXPIRATION_SECONDS', (int) env_or_secret('JWT_EXPIRATION_SECONDS', $secretosLocales, 172800));

// ─────────────────────────────────────────────
// 3. ENLACE BLINDADO HACIA GOOGLE APPS SCRIPT (GAS)
// El navegador NUNCA ve esta URL ni este token secreto
// ─────────────────────────────────────────────
define('GAS_WEBAPP_URL', env_or_secret('GAS_WEBAPP_URL', $secretosLocales, null));
define('GAS_SECRET_TOKEN', env_or_secret('GAS_SECRET_TOKEN', $secretosLocales, null));

// ─────────────────────────────────────────────
// 3b. FALLO SEGURO: si falta algún secreto crítico, detener aquí con un
// error genérico (nunca exponer cuál falta al cliente) en vez de dejar
// que el resto de la app siga con constantes nulas (JWT firmado con
// clave nula, conexión a BD sin contraseña, etc.).
// ─────────────────────────────────────────────
$secretosCriticos = [
    'DB_NAME' => DB_NAME,
    'DB_USER' => DB_USER,
    'DB_PASS' => DB_PASS,
    'JWT_SECRET_KEY' => JWT_SECRET_KEY,
    'GAS_WEBAPP_URL' => GAS_WEBAPP_URL,
    'GAS_SECRET_TOKEN' => GAS_SECRET_TOKEN,
];
foreach ($secretosCriticos as $nombre => $valor) {
    if ($valor === null || $valor === '') {
        error_log("[CONFIG ERROR] Falta el secreto requerido: {$nombre}. Define una variable de entorno o config.secrets.php.");
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Error de configuración del servidor.']);
        exit;
    }
}
unset($secretosCriticos, $nombre, $valor);

// ─────────────────────────────────────────────
// 4. CABECERAS Y ZONA HORARIA
// ─────────────────────────────────────────────
date_default_timezone_set('Europe/Madrid');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/security_error.log');
