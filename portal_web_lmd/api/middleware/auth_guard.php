<?php
/**
 * Middleware Guardián de Autenticación y Control de Roles (RBAC)
 * Valida JWT y permisos por rol antes de procesar la solicitud
 */
require_once __DIR__ . '/../helpers/jwt_helper.php';

function requireAuth(): array {
    header('Content-Type: application/json; charset=utf-8');

    $token = JWTHelper::getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'No autorizado. Se requiere token de sesión Bearer.'
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
