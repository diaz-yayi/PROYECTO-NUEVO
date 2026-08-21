<?php
/**
 * Implementación de JWT (JSON Web Token) HMAC-SHA256 Nativa en PHP
 * No requiere Composer ni extensiones externas en cPanel
 */
require_once __DIR__ . '/../../config.php';

class JWTHelper {
    
    private static function base64UrlEncode(string $data): string {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    private static function base64UrlDecode(string $data): string {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $padlen = 4 - $remainder;
            $data .= str_repeat('=', $padlen);
        }
        return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
    }

    /**
     * Generar un token JWT firmado
     */
    public static function generateToken(array $payload): string {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        
        $payload['iat'] = time();
        $payload['exp'] = time() + JWT_EXPIRATION_SECONDS;
        $payloadJson = json_encode($payload);

        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payloadJson);

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET_KEY, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    /**
     * Verificar y decodificar un token JWT
     */
    public static function verifyToken(string $jwt): ?array {
        $tokenParts = explode('.', $jwt);
        if (count($tokenParts) !== 3) {
            return null;
        }

        list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $tokenParts;

        // Comprobar firma criptográfica
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET_KEY, true);
        $expectedSignature = self::base64UrlEncode($signature);

        if (!hash_equals($expectedSignature, $base64UrlSignature)) {
            return null; // Firma inválida o alterada
        }

        $payload = json_decode(self::base64UrlDecode($base64UrlPayload), true);
        if (!$payload || !isset($payload['exp'])) {
            return null;
        }

        // Comprobar expiración
        if ($payload['exp'] < time()) {
            return null; // Token expirado
        }

        return $payload;
    }

    const COOKIE_NAME = 'lmd_jwt_token';

    /**
     * Detecta si la petición actual llega por HTTPS (necesario para no
     * marcar la cookie como Secure en desarrollo local por HTTP).
     */
    private static function esHttps(): bool {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    }

    /**
     * Fija el JWT como cookie httpOnly — invisible para JavaScript,
     * el navegador la envía solo automáticamente en cada petición.
     */
    public static function setTokenCookie(string $token): void {
        setcookie(self::COOKIE_NAME, $token, [
            'expires' => time() + JWT_EXPIRATION_SECONDS,
            'path' => '/',
            'secure' => self::esHttps(),
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
    }

    /**
     * Borra la cookie de sesión (logout).
     */
    public static function clearTokenCookie(): void {
        setcookie(self::COOKIE_NAME, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => self::esHttps(),
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
    }

    /**
     * Obtiene el token: prioriza la cookie httpOnly; conserva la lectura
     * de la cabecera Authorization como respaldo (p. ej. para futuros
     * consumidores de la API que no sean el propio navegador).
     */
    public static function getToken(): ?string {
        if (!empty($_COOKIE[self::COOKIE_NAME])) {
            return $_COOKIE[self::COOKIE_NAME];
        }
        return self::getBearerToken();
    }

    /**
     * Extraer token de la cabecera Authorization (Bearer <token>)
     */
    public static function getBearerToken(): ?string {
        $headers = null;
        if (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER["Authorization"]);
        } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }

        if (!empty($headers)) {
            if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
                return $matches[1];
            }
        }
        return null;
    }
}
