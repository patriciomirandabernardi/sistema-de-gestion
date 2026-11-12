"""Columnas nuevas que se agregan solas al arrancar el backend (idempotente, no modifica datos existentes).
SQLite no agrega columnas con create_all sobre tablas existentes, por eso se hace con ALTER TABLE."""
import shutil
from datetime import datetime

from sqlalchemy import inspect, text

# (tabla, columna, definición SQL, índice o None)
COLUMNAS_NUEVAS = [
    ("pedidos_compra", "codigo_solicitud", "VARCHAR", "ix_pedidos_compra_codigo_solicitud"), # Pedidos previos quedan en NULL
    # Precio neto y alícuota por separado: los pedidos previos (todos con precio neto) toman el 21% general
    ("pedidos_compra", "alicuota_iva", "FLOAT NOT NULL DEFAULT 21.0", None),
    ("ordenes_compra", "alicuota_iva", "FLOAT", None), # IVA con el que se emitió la OC; NULL en las OC previas
    # ultimo_precio_unitario del insumo pasa a ser NETO: el costo real con IVA se calcula con esta alícuota
    ("items", "alicuota_iva", "FLOAT NOT NULL DEFAULT 21.0", None),
]

def asegurar_columnas(engine):
    inspector = inspect(engine)
    faltantes = [c for c in COLUMNAS_NUEVAS if c[1] not in [col["name"] for col in inspector.get_columns(c[0])]]
    if not faltantes:
        return

    if engine.url.get_backend_name() == "sqlite" and engine.url.database:
        backup = f"{engine.url.database[:-3]}.backup-{datetime.now():%Y%m%d-%H%M%S}.db"
        shutil.copy2(engine.url.database, backup)
        print(f"[migraciones] Backup creado: {backup}")

    for tabla, columna, definicion, indice in faltantes:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}"))
            if indice:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {indice} ON {tabla} ({columna})"))
        print(f"[migraciones] Columna {tabla}.{columna} agregada")

# Las categorías de gasto dejan de estar fijas en el código: la tabla 'categorias' es la fuente del listado.
# Se carga con las oficiales y además adopta cualquier categoría que ya esté en uso por algún insumo.
def asegurar_categorias(engine, categorias_iniciales):
    with engine.begin() as conn:
        existentes = {r[0] for r in conn.execute(text("SELECT nombre FROM categorias"))}
        en_uso = {r[0] for r in conn.execute(text("SELECT DISTINCT categoria_gasto FROM items WHERE categoria_gasto IS NOT NULL AND categoria_gasto != ''"))}
        faltantes = [n for n in categorias_iniciales if n not in existentes] \
            + sorted(en_uso - existentes - set(categorias_iniciales))
        for nombre in faltantes:
            conn.execute(text("INSERT INTO categorias (nombre) VALUES (:n)"), {"n": nombre})
    if faltantes:
        print(f"[migraciones] Categorías cargadas: {len(faltantes)}")

# Stock de sierras: si la tabla está vacía se carga con los diámetros estándar en 0 (el admin carga el relevamiento)
def asegurar_sierras(engine, diametros):
    with engine.begin() as conn:
        if conn.execute(text("SELECT COUNT(*) FROM stock_sierras")).scalar():
            return
        for diametro in diametros:
            conn.execute(text("INSERT INTO stock_sierras (diametro, cantidad_disponible) VALUES (:d, 0)"), {"d": diametro})
    print(f"[migraciones] Stock de sierras inicializado: {len(diametros)} diámetros")
