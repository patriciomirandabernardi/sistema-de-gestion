"""Pre-carga la Lista Oficial de Insumos Críticos de Mantenimiento de IMCAYPER.

Idempotente: si un insumo ya existe (mismo nombre, sin distinguir mayúsculas) no se toca,
así se conservan el stock y los precios que Patricio haya ajustado.

Uso: python seed_insumos_criticos.py [ruta_a_la_base]  (por defecto, panol.db junto a este script)
"""
import os
import shutil
import sqlite3
import sys
from datetime import datetime

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "panol.db")

STOCK_MINIMO_INICIAL = 5
AVISO_ZKL = "⚠️ ATENCIÓN: SIEMPRE COMPRAR MARCA ZKL (MÁS BARATA)"

# (categoría, nombre, ubicación / uso, descripción)
INSUMOS_CRITICOS = [
    ("Gases y Soldadura", "Gas Arcal 1 (Argón)", "Soldadura", None),
    ("Gases y Soldadura", "Gas Arcal 5 (Atal)", "Soldadura", None),
    ("Gases y Soldadura", "Gas Oxígeno", "Corte y Soldadura", None),
    ("Gases y Soldadura", "Gas Acetileno", "Corte y Soldadura", None),

    ("Rodamientos y Retenes", "Rodamiento 6307 2RS", "Puentes CT1 / CT2", AVISO_ZKL),
    ("Rodamientos y Retenes", "Rodamiento 6308 2RS", "Cabezas de tubo y soldadores CT1 / CT2", AVISO_ZKL),
    ("Rodamientos y Retenes", "Rodamiento 6310 2RS", "Puentes y cabezas de tubo W6", AVISO_ZKL),
    ("Rodamientos y Retenes", "Rodamiento 30210 2RS", "Parantes CT1 / CT2", AVISO_ZKL),
    ("Rodamientos y Retenes", "Rodamiento 30215 2RS", "Hilera de rodillos cónicos (Taller Metalúrgica)", AVISO_ZKL),

    ("Aceites y Lubricantes", "Aceite Omala S2 460", "Cajas de engranajes", None),
    ("Aceites y Lubricantes", "Aceite Tellus S2 M68", "Sistema hidráulico", None),
    ("Aceites y Lubricantes", "Aceite Soluble para Emulsión", "Cubas de refrigeración y lubricación", None),

    ("Solventes y Químicos", "Líquido Dieléctrico", "Mantenimiento eléctrico / Planta Rosario", None),
    ("Solventes y Químicos", "Desengrasante Industrial", "Limpieza de piezas y máquinas", None),
    ("Solventes y Químicos", "Antiincrustante", "Cubas y circuito de agua", None),
    ("Solventes y Químicos", "Alguicida", "Cubas y circuito de agua", None),
    ("Solventes y Químicos", "Agua Desmineralizada", "Cubas y procesos de planta", None),

    ("Discos y Abrasivos", 'Disco de Corte 9"', "Amoladoras grandes (Planta / Taller)", None),
    ("Discos y Abrasivos", 'Disco de Corte 7"', "Amoladoras medianas (Planta / Taller)", None),
    ("Discos y Abrasivos", 'Disco de Corte 4.5" (4")', "Amoladoras chicas (Planta / Taller)", None),
    ("Discos y Abrasivos", 'Disco de Desbaste 9"', "Amoladoras grandes (Planta / Taller)", None),
    ("Discos y Abrasivos", 'Disco de Desbaste 7"', "Amoladoras medianas (Planta / Taller)", None),
    ("Discos y Abrasivos", 'Disco de Desbaste 4.5" (4")', "Amoladoras chicas (Planta / Taller)", None),
    ("Discos y Abrasivos", 'Disco Flap 4.5" (4")', "Terminación y pulido (Planta / Taller)", None),

    ("EPP y Seguridad", "Guantes de Descarne de Cuero", "Uso Operario de Planta", None),
    ("EPP y Seguridad", "Guantes de Nitrilo Negros", "Uso Operario / Mantenimiento", None),
    ("EPP y Seguridad", "Guantes de Nitrilo Azules", "Uso Operario / Planta", None),
    ("EPP y Seguridad", "Guantes de Soldador Rojos", "Soldadores", None),
    ("EPP y Seguridad", "Tapones Auditivos", "Protección auditiva de planta", None),

    ("Consumibles y Limpieza", "Trapos para Limpieza", "Uso general en máquinas y taller", None),
    ("Consumibles y Limpieza", "Silicona Común (Naranja)", "Sellado general Mantenimiento", None),
    ("Consumibles y Limpieza", "Silicona Roja (Alta Temperatura)", "Sellado alta temperatura", None),
    ("Consumibles y Limpieza", "Pintura en Aerosol Blanco", "Identificación y marcación", None),
    ("Consumibles y Limpieza", "Pintura en Aerosol Amarillo", "Identificación y marcación", None),
    ("Consumibles y Limpieza", "Pintura en Aerosol Verde", "Identificación y marcación", None),
    ("Consumibles y Limpieza", "Uniones de Cadenas Grandes", "Transmisiones de máquinas", None),
    ("Consumibles y Limpieza", "Uniones de Cadenas Medianas", "Transmisiones de máquinas", None),
    ("Consumibles y Limpieza", "Uniones de Cadenas Chicas", "Transmisiones de máquinas", None),
    ("Consumibles y Limpieza", "Hebillas Metálicas (Zunchado)", "Atado y empaque", None),
]

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    backup = f"{DB_PATH[:-3]}.backup-{datetime.now():%Y%m%d-%H%M%S}.db"
    shutil.copy2(DB_PATH, backup)
    print(f"Backup creado: {backup}")

    conn = sqlite3.connect(DB_PATH)
    existentes = {fila[0].strip().lower() for fila in conn.execute("SELECT nombre FROM items WHERE nombre IS NOT NULL")}
    agregados = 0
    for categoria, nombre, ubicacion, descripcion in INSUMOS_CRITICOS:
        if nombre.lower() in existentes:
            print(f"  = {nombre} (ya existe, no se modifica)")
            continue
        conn.execute(
            """INSERT INTO items (nombre, descripcion, categoria_gasto, ubicacion_uso, es_critico,
                                  stock_actual, stock_minimo, ultimo_precio_unitario)
               VALUES (?, ?, ?, ?, 1, 0, ?, 0.0)""",
            (nombre, descripcion, categoria, ubicacion, STOCK_MINIMO_INICIAL)
        )
        agregados += 1
        print(f"  + {nombre} [{categoria}]")
    conn.commit()
    conn.close()
    print(f"Listo: {agregados} insumos agregados, {len(INSUMOS_CRITICOS) - agregados} ya existian. Total en la lista oficial: {len(INSUMOS_CRITICOS)}.")
