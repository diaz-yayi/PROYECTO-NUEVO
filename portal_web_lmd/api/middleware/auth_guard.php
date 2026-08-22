<?php
/**
 * Middleware Guardián de Autenticación y Control de Roles (RBAC)
 * Valida JWT y permisos por rol antes de procesar la solicitud
 */
require_once __DIR__ . '/../helpers/jwt_helper.php';

function requireAuth(): array {
    header('Content-Type: application/json; charset=utf-8');

    $token = JWTHelper::getToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'No autorizado. Se requiere sesión iniciada.'
        ]);
        exit;
    }

    $userData = JWTHelper::verifyToken($token);
    if (!$userData) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Sesión expirada o token inválido. Por favor, inicia sesión nuevamente.'
        ]);
        exit;
    }

    // Protección CSRF: solo aplica cuando la sesión viaja por cookie (el
    // vector CSRF depende de que el navegador adjunte credenciales solo
    // automáticamente; un consumidor que use la cabecera Authorization
    // ya la adjunta de forma explícita y no está expuesto a ese vector).
    $sesionViaCookie = !empty($_COOKIE[JWTHelper::COOKIE_NAME]);
    if ($sesionViaCookie && $_SERVER['REQUEST_METHOD'] === 'POST' && !JWTHelper::verificarCsrf($userData)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Token de seguridad (CSRF) inválido o ausente. Recarga la página e inténtalo de nuevo.'
        ]);
        exit;
    }

    return $userData;
}

function requireRole(array $allowedRoles): array {
    $user = requireAuth();
    $userRole = $user['rol'] ?? 'consultor';

    if (!in_array($userRole, $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Acceso denegado. Tu nivel de acceso no tiene permisos para esta acción.'
        ]);
        exit;
    }

    return $user;
}
