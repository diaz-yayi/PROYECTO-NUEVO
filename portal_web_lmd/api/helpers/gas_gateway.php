<?php
/**
 * Pasarela Segura Server-to-Server hacia Google Apps Script (GAS)
 * Inyecta el TOKEN_SECRETO y maneja con precisión el ciclo POST -> 302 -> GET de Google
 */
require_once __DIR__ . '/../../config.php';

class GASGateway {
    
    public static function callGAS(array $payload, string $method = 'POST'): array {
        // Inyectar token secreto del servidor
        $payload['key'] = GAS_SECRET_TOKEN;
        $payload['token'] = GAS_SECRET_TOKEN;

        $url = GAS_WEBAPP_URL;

        if (strtoupper($method) === 'GET') {
            $url .= '?' . http_build_query($payload);
            return self::_ejecutarGet($url);
        }

        // Caso POST: Google Apps Script siempre responde con 302 Found apuntando a script.googleusercontent.com
        return self::_ejecutarPostConRedirect($url, $payload);
    }

    private static function _ejecutarGet(string $url): array {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        curl_close($ch);

        return self::_procesarRespuesta($response, $curlError);
    }

    private static function _ejecutarPostConRedirect(string $url, array $payload): array {
        $jsonData = json_encode($payload);

        // Paso 1: Enviar POST a la WebApp de Google sin auto-redirección para capturar el Location
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $jsonData,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Content-Length: ' . strlen($jsonData)
            ],
            CURLOPT_HEADER => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false, // Capturar el 302 explícitamente
            CURLOPT_TIMEOUT => 60,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $redirectUrl = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        if ($response === false || !empty($curlError)) {
            error_log("[GAS GATEWAY POST ERROR] cURL Error: " . $curlError);
            return [
                'success' => false,
                'ok' => false,
                'error' => 'Fallo de conexión al enviar datos a Google Sheets: ' . $curlError
            ];
        }

        // Si Google devolvió un 302/301, extraer la URL de destino y hacer GET limpio
        if ($httpCode === 302 || $httpCode === 301 || !empty($redirectUrl)) {
            if (empty($redirectUrl)) {
                $headerText = substr($response, 0, $headerSize);
                if (preg_match('/Location:\s*([^\r\n]+)/i', $headerText, $matches)) {
                    $redirectUrl = trim($matches[1]);
                }
            }

            if (!empty($redirectUrl)) {
                return self::_ejecutarGet($redirectUrl);
            }
        }

        // Si respondió con 200 directamente
        $body = substr($response, $headerSize);
        return self::_procesarRespuesta($body, '');
    }

    private static function _procesarRespuesta($response, string $curlError): array {
        if ($response === false || !empty($curlError)) {
            error_log("[GAS GATEWAY ERROR] cURL Error: " . $curlError);
            return [
                'success' => false,
                'ok' => false,
                'error' => 'Fallo de conexión segura con Google Sheets: ' . $curlError
            ];
        }

        $cleanText = trim((string)$response);
        // Quitar BOM UTF-8 si viniera
        $cleanText = preg_replace('/^[\xEF\xBB\xBF\xFE\xFF]+/', '', $cleanText);

        $decoded = json_decode($cleanText, true);
        if ($decoded === null) {
            error_log("[GAS GATEWAY RAW RESPONSE] " . substr($cleanText, 0, 500));
            return [
                'success' => false,
                'ok' => false,
                'error' => 'Respuesta no válida del motor de Google Apps Script.',
                'raw' => substr($cleanText, 0, 500)
            ];
        }

        return $decoded;
    }
}
