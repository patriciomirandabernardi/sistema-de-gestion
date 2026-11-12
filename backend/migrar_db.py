import os
import shutil
import sqlite3
import sys
from datetime import datetime

# Uso: python migrar_db.py [ruta_a_la_base]  (por defecto, panol.db junto a este script)
DB_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "panol.db")

COLUMNAS_NUEVAS = [
    ("items", "categoria_gasto", "VARCHAR NOT NULL DEFAULT 'Consumibles y Limpieza'"),
    ("items", "ubicacion_uso", "VARCHAR"),
    ("pedidos_compra", "precio_unitario_final", "FLOAT"),
    ("pedidos_compra", "proveedor_final", "VARCHAR"),
    ("pedidos_compra", "fecha_aprobacion", "DATETIME"),
    ("pedidos_compra", "fecha_recepcion", "DATETIME"),
    ("items", "ultimo_precio_unitario", "FLOAT NOT NULL DEFAULT 0.0"),
    ("items", "ultimo_proveedor", "VARCHAR"),
    ("items", "fecha_ultima_compra", "DATETIME"),
    ("movimientos", "tipo_destino", "VARCHAR"),
    ("movimientos", "maquina", "VARCHAR"),
    ("movimientos", "parte_maquina", "VARCHAR"),
    ("movimientos", "retirado_por", "VARCHAR"),
    ("movimientos", "nota_control", "VARCHAR"),
    ("movimientos", "precio_unitario_momento", "FLOAT NOT NULL DEFAULT 0.0"),
    ("pedidos_compra", "tipo_compra", "VARCHAR NOT NULL DEFAULT 'cotizacion'"),
    ("pedidos_compra", "numero_comprobante", "VARCHAR"),
    ("pedidos_compra", "orden_compra_id", "INTEGER REFERENCES ordenes_compra(id)"),
    ("pedidos_compra", "archivo_factura", "VARCHAR"),
    ("pedidos_compra", "codigo_solicitud", "VARCHAR"),
    ("pedidos_compra", "alicuota_iva", "FLOAT NOT NULL DEFAULT 21.0"),
    ("ordenes_compra", "alicuota_iva", "FLOAT"),
    ("items", "alicuota_iva", "FLOAT NOT NULL DEFAULT 21.0"),
]

# Categorías genéricas anteriores -> categorías oficiales de IMCAYPER
EQUIVALENCIAS_CATEGORIAS = {
    "EPP e Indumentaria": "EPP y Seguridad",
    "Repuestos": "Planta Rosario (General)",
    "Insumos Generales": "Consumibles y Limpieza",
    "Librería": "Imprenta y Librería",
    "Herramientas": "Taller Metalúrgico",
    "Servicios": "Planta Rosario (General)",
}

# Memoria de precios: toma la última recepción de cada insumo (solo si todavía no tiene precio cargado)
BACKFILL_ULTIMO_PRECIO = """
WITH ultima AS (
    SELECT insumo_id, precio_unitario_final, proveedor_final, fecha_recepcion,
           ROW_NUMBER() OVER (PARTITION BY insumo_id ORDER BY fecha_recepcion DESC, id DESC) AS n
    FROM pedidos_compra
    WHERE estado = 'Recibido' AND insumo_id IS NOT NULL AND precio_unitario_final IS NOT NULL
)
UPDATE items SET
    ultimo_precio_unitario = (SELECT precio_unitario_final FROM ultima WHERE ultima.insumo_id = items.id AND n = 1),
    ultimo_proveedor = (SELECT proveedor_final FROM ultima WHERE ultima.insumo_id = items.id AND n = 1),
    fecha_ultima_compra = (SELECT fecha_recepcion FROM ultima WHERE ultima.insumo_id = items.id AND n = 1)
WHERE (ultimo_precio_unitario IS NULL OR ultimo_precio_unitario = 0)
  AND id IN (SELECT insumo_id FROM ultima WHERE n = 1)
"""

# Completa precio/proveedor/fecha de pedidos aprobados antes de que existieran estos campos,
# tomando la cotización que eligió el aprobador
BACKFILL = """
UPDATE pedidos_compra SET
    precio_unitario_final = COALESCE(precio_unitario_final, (SELECT c.precio_unitario FROM cotizaciones c WHERE c.pedido_id = pedidos_compra.id AND c.elegida_por_aprobador = 1)),
    proveedor_final = COALESCE(proveedor_final, (SELECT c.proveedor_nombre FROM cotizaciones c WHERE c.pedido_id = pedidos_compra.id AND c.elegida_por_aprobador = 1)),
    fecha_aprobacion = COALESCE(fecha_aprobacion, fecha_actualizacion)
WHERE estado IN ('Aprobado', 'Recibido')
  AND (precio_unitario_final IS NULL OR proveedor_final IS NULL OR fecha_aprobacion IS NULL)
"""

backup = f"{DB_PATH[:-3]}.backup-{datetime.now():%Y%m%d-%H%M%S}.db"
shutil.copy2(DB_PATH, backup)
print(f"Backup creado: {backup}")

# Tablas nuevas (ej. ordenes_compra): las crea SQLAlchemy a partir de models.py, sin tocar las existentes
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqlalchemy import create_engine, inspect  # noqa: E402
import models  # noqa: E402

motor = create_engine(f"sqlite:///{DB_PATH}")
tablas_previas = set(inspect(motor).get_table_names())
models.Base.metadata.create_all(bind=motor)
for tabla in sorted(set(inspect(motor).get_table_names()) - tablas_previas):
    print(f"  + tabla {tabla} creada")
motor.dispose()

conn = sqlite3.connect(DB_PATH)
for tabla, columna, definicion in COLUMNAS_NUEVAS:
    existentes = [fila[1] for fila in conn.execute(f"PRAGMA table_info({tabla})")]
    if columna in existentes:
        print(f"  = {tabla}.{columna} ya existe")
    else:
        conn.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}")
        print(f"  + {tabla}.{columna} agregada")
filas = conn.execute(BACKFILL).rowcount
print(f"  Pedidos aprobados/recibidos completados con precio y proveedor: {filas}")
cambios_previos = conn.total_changes
conn.execute(BACKFILL_ULTIMO_PRECIO)
print(f"  Insumos completados con su ultimo precio de compra: {conn.total_changes - cambios_previos}")
for vieja, nueva in EQUIVALENCIAS_CATEGORIAS.items():
    filas = conn.execute("UPDATE items SET categoria_gasto = ? WHERE categoria_gasto = ?", (nueva, vieja)).rowcount
    if filas:
        print(f"  Categoria '{vieja}' -> '{nueva}': {filas} insumo(s)")
conn.commit()
conn.close()
print("Migracion completada.")
