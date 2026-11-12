"""Migración al login con usuario y contraseña. Se ejecuta al arrancar el backend y es idempotente:
solo toca a los usuarios que todavía no tienen `username`, así una clave cambiada después no se pisa."""
import shutil
from datetime import datetime

from sqlalchemy import inspect, text

from seguridad import get_password_hash

USUARIO_GERENCIA = ("Miguel", "imcayper")
USUARIO_ADMIN = ("862", "adminimcayper862")

def credenciales_iniciales(rol: str, legajo: str):
    """Regla acordada con Gerencia. Devuelve (username, password) o (username, None) si se conserva la clave actual."""
    if rol == "gerencia":
        return USUARIO_GERENCIA
    if rol == "admin" and legajo == USUARIO_ADMIN[0]:
        return USUARIO_ADMIN
    if rol == "supervisor":
        return legajo, f"imcayper{legajo}"
    return legajo, None

def migrar_usuarios(engine):
    columnas = [c["name"] for c in inspect(engine).get_columns("usuarios")]
    if "activo" not in columnas: # Baja lógica (ABM de usuarios): todos los existentes quedan activos
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1"))
        print("[migracion_usuarios] Columna usuarios.activo agregada")

    falta_columna = "username" not in columnas
    if not falta_columna:
        with engine.connect() as conn:
            if not conn.execute(text("SELECT 1 FROM usuarios WHERE username IS NULL LIMIT 1")).first():
                return

    if engine.url.get_backend_name() == "sqlite" and engine.url.database:
        backup = f"{engine.url.database[:-3]}.backup-{datetime.now():%Y%m%d-%H%M%S}.db"
        shutil.copy2(engine.url.database, backup)
        print(f"[migracion_usuarios] Backup creado: {backup}")

    with engine.begin() as conn:
        if falta_columna:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN username VARCHAR"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_username ON usuarios (username)"))

        pendientes = conn.execute(text("SELECT id, legajo, rol FROM usuarios WHERE username IS NULL ORDER BY id")).all()
        for id_, legajo, rol in pendientes:
            username, password = credenciales_iniciales(rol, legajo)
            if password:
                conn.execute(text("UPDATE usuarios SET username = :u, password_hash = :p WHERE id = :id"),
                             {"u": username, "p": get_password_hash(password), "id": id_})
            else:
                conn.execute(text("UPDATE usuarios SET username = :u WHERE id = :id"), {"u": username, "id": id_})
            print(f"[migracion_usuarios] {rol} legajo {legajo} -> usuario '{username}'")
