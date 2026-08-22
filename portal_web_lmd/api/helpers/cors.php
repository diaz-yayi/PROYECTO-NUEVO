<?php
/**
 * Cabecera CORS restringida a orígenes conocidos.
 * Sustituye "Access-Control-Allow-Origin: *" — con autenticación por
 * cookie httpOnly, un origen comodín combinado con credenciales es un
 * riesgo real (aunque los navegadores bloquean la combinación literal
 * "*" + credentials, cualquier reflejo ingenuo del origen sin lista
 * blanca reabriría el mismo problema).
 */
$origenesPermitidos = [
    'https://app.lmd2022.com',
];

// El origen de desarrollo local solo se admite cuando la petición en sí
// llega por HTTP (nunca en producción, que siempre es HTTPS) — así este
// mismo archivo desplegado sirve para ambos entornos sin dejar un origen
// de desarrollo expuesto de forma permanente en producción.
$esHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
if (!$esHttps) {
    $origenesPermitidos[] = 'http://localhost:6080';
}

$origenSolicitante = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origenSolicitante, $origenesPermitidos, true)) {
    header('Access-Control-Allow-Origin: ' . $origenSolicitante);
    header('Access-Control-Allow-Credentials: true');
}
