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
    'http://localhost:6080',
];

$origenSolicitante = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origenSolicitante, $origenesPermitidos, true)) {
    header('Access-Control-Allow-Origin: ' . $origenSolicitante);
    header('Access-Control-Allow-Credentials: true');
}
