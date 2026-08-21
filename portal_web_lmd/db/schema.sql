-- =============================================================================
-- BASE DE DATOS: PORTAL DE ACCESO — CENTRO DE MANDO (EM)
-- Esquema de Autenticación, Roles RBAC y Registro de Auditoría
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `lmd_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lmd_db`;

-- 1. Tabla de Usuarios del Sistema con Roles RBAC
CREATE TABLE IF NOT EXISTS `usuarios_sistema` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(191) NOT NULL UNIQUE,
    `nombre` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `rol` ENUM('admin', 'operador', 'consultor') NOT NULL DEFAULT 'operador',
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `intentos_fallidos` INT DEFAULT 0,
    `bloqueado_hasta` DATETIME NULL,
    `ultimo_acceso` DATETIME NULL,
    `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `actualizado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_usuario_email` (`email`),
    INDEX `idx_usuario_rol` (`rol`),
    INDEX `idx_usuario_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Auditoría y Bitácora de Seguridad
CREATE TABLE IF NOT EXISTS `logs_seguridad` (
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
    INDEX `idx_log_fecha` (`fecha_hora`),
    CONSTRAINT `fk_logs_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Inserción de Usuario Administrador Inicial
-- Hash Bcrypt (coste 12) de una contraseña EXCLUSIVA de desarrollo local
-- ("Pruebalocal2026*"), distinta de la contraseña real de producción (SERED).
INSERT INTO `usuarios_sistema` (`email`, `nombre`, `password_hash`, `rol`, `estado`)
VALUES (
    'admin@estelamarina.com',
    'Administrador EM',
    '$2y$12$ZpcRB/En/kPd4NjzcaL6p.8rjOsq1IekfFUAgXhSakVf1UHnKbtVS',
    'admin',
    'activo'
)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `rol` = VALUES(`rol`), `estado` = VALUES(`estado`);
