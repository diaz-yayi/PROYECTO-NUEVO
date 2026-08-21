# 🗺️ SPEC-ROADMAP: Registro de Ideas Futuras y Ampliaciones del Sistema

---

## 📌 1. Notificaciones Multi-Canal (WhatsApp & Telegram)
* **Objetivo:** Permitir el envío de avisos de estado de expediente no solo por correo electrónico, sino vía WhatsApp Business API / Telegram Bot.
* **Requerimiento:** Almacenar número telefónico en formato internacional (`+53...`, `+1...`, `+34...`) con opt-in de suscripción.

---

## 📌 2. Radar de Citas Consulares Multi-Sede Automatizado
* **Objetivo:** Extender los robots de escaneo automático de turnos consulares para otras sedes de alto volumen (Miami, Houston, Buenos Aires, CDMX).
* **Requerimiento:** Adaptadores modulares de scraping por consulado manteniendo la estructura de `CREDENCIALES_LMD`.

---

## 📌 3. Portal de Auto-Consulta para Clientes
* **Objetivo:** Interfaz pública ligera donde el cliente final ingresa su `ID` o `NoExpediente` con un PIN seguro y consulta en tiempo real su estado consular sin contactar al operador.

---

## 📌 4. Analítica Predictiva y Estimación de Tiempos de Resolución
* **Objetivo:** Algoritmo que calcule la media ponderada de días que tarda cada consulado en resolver expedientes por tipo de anexo (Anexo 1, 2, 3, 4) y proyecte la fecha estimada de resolución favorable.
