<?php
/**
 * PLANTILLA de secretos locales — este archivo SÍ se versiona en git.
 *
 * Copia este archivo como "config.secrets.php" (sin ".example") y rellena
 * los valores reales. "config.secrets.php" está excluido en .gitignore y
 * bloqueado por .htaccess — nunca debe subirse al repositorio ni ser
 * accesible por navegador.
 *
 * Este mecanismo existe porque SERED (hosting compartido) no ofrece un
 * panel nativo de variables de entorno para aplicaciones PHP: config.php
 * primero intenta leer cada valor con getenv() (por si algún día sí hay
 * variables de entorno reales, p. ej. en Docker), y si no existe, cae en
 * los valores que devuelva este archivo.
 */

return [
    'DB_HOST'                => 'localhost',
    'DB_NAME'                => '',
    'DB_USER'                => '',
    'DB_PASS'                => '',
    'DB_PORT'                => '3306',

    'JWT_SECRET_KEY'         => '',
    'JWT_EXPIRATION_SECONDS' => '172800',

    'GAS_WEBAPP_URL'         => '',
    'GAS_SECRET_TOKEN'       => '',
];
