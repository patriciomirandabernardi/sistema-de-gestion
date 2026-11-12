import sys
sys.path.insert(0, '.')

from database import engine, Base, SessionLocal
import models
from seguridad import get_password_hash
from migracion_usuarios import credenciales_iniciales

# Recrear todas las tablas (limpia la base de datos)
print("Recreando tablas de la base de datos...")
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("Tablas recreadas exitosamente.")
print()

# Crear sesión
db = SessionLocal()

# Datos del personal
personal = [
    {"nombre": "Patricio Miranda Bernardi", "legajo": "862", "rol": "admin"},
    {"nombre": "Miguel Francipane", "legajo": "1", "rol": "gerencia"},
    {"nombre": "Jeronimo Rodriguez", "legajo": "250", "rol": "supervisor"},
    {"nombre": "Nicolas Ricucci", "legajo": "511", "rol": "supervisor"},
    {"nombre": "Gustavo Bertoldi", "legajo": "537", "rol": "supervisor"},
    {"nombre": "Ruben Barbaro", "legajo": "540", "rol": "supervisor"},
    {"nombre": "Eduardo Ynieri", "legajo": "559", "rol": "supervisor"},
    {"nombre": "Christian Roskopf", "legajo": "686", "rol": "supervisor"},
]

# Usuario y contraseña según la regla de migracion_usuarios.credenciales_iniciales
print("Cargando usuarios...")
for persona in personal:
    username, password = credenciales_iniciales(persona["rol"], persona["legajo"])
    usuario = models.Usuario(
        legajo=persona["legajo"],
        username=username,
        nombre_completo=persona["nombre"],
        password_hash=get_password_hash(password or f"imcayper{persona['legajo']}"),
        rol=persona["rol"]
    )
    db.add(usuario)
    print(f"  - {persona['nombre']} (usuario: {username}) - {persona['rol']}")

db.commit()
print()
print("Todos los usuarios cargados exitosamente.")
