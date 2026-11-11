# Demo de tesis: Help Desk para Acabados Automotrices

## Análisis del documento base

El PDF del repositorio describe un prototipo web de mesa de ayuda para gestionar incidencias y solicitudes de soporte técnico de TI en Acabados Automotrices, S.A.S. El problema principal identificado es la ausencia de un registro formal, sin número de ticket, sin responsable, sin prioridad ni cierre documentado. El sistema propuesto incluye roles de solicitante, técnico, supervisor y administrador, y se apoya en FastAPI, PostgreSQL y HTML/CSS/JavaScript.

## Objetivo del demo

Desarrollar una demostración funcional que represente el prototipo de help desk para uso académico, con:

- registro de tickets,
- priorización,
- asignación de responsables,
- actualización de estado,
- historial de cambios,
- cierre con solución,
- panel de resumen por roles.

## Estructura

- `main.py`: backend FastAPI con base de datos SQLite para una demostración portable.
- `templates/index.html`: interfaz web principal.
- `static/css/style.css`: estilos del dashboard.
- `static/js/app.js`: lógica de la interfaz y consumo del backend.

## Usuarios de prueba

- `admin` / `admin123`
- `cliente` / `cliente123`
- `sup1` / `sup123`
- `tec1` / `tec123`
- `tec2` / `tec123`
- `user1` / `user123`
- `user2` / `user123`

Inicia sesión desde la pantalla de acceso con una de estas cuentas. La sesión se mantiene en una cookie durante un máximo de 8 horas y se invalida al cerrar sesión o reiniciar el servidor.

## Cómo ejecutar

1. Abrir una terminal en esta carpeta.
2. Instalar dependencias:

```bash
python -m pip install -r requirements.txt
```

3. Ejecutar la aplicación:

```bash
python main.py
```

4. Abrir en el navegador:

```text
http://127.0.0.1:8000/
```

## Alcance académico

Este demo cumple con el propósito de una presentación universitaria: permite mostrar el flujo del sistema, la lógica funcional y la propuesta de interfaz de una plataforma de mesa de ayuda, sin requerir una infraestructura compleja de producción.
