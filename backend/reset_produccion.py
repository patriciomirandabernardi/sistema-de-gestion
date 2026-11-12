"""Limpieza transaccional para el pase a producción.

Borra TODOS los datos de prueba (pedidos, cotizaciones, órdenes de compra,
movimientos de stock y las facturas adjuntadas) y conserva intactos:

  - items       (catálogo de insumos, con su stock y precios)
  - usuarios    (cuentas y claves)
  - categorias  (categorías de gasto)

Uso:
    python reset_produccion.py            -> usa panol.db junto a este script
    python reset_produccion.py otra.db    -> usa la base indicada

ATENCIÓN: es destructivo. Pide escribir "SI" antes de borrar.
"""
import os
import shutil
import sqlite3
import sys
from datetime import datetime

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "panol.db")
CARPETA_FACTURAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "facturas")

# Orden seguro por claves foráneas: primero lo que referencia a pedidos/OC
TABLAS_A_VACIAR = [
    ("cotizaciones",      "Cotizaciones cargadas por Compras"),
    ("pedidos_compra",    "Pedidos (solicitudes, aprobaciones, ingresos directos)"),
    ("ordenes_compra",    "Órdenes de compra emitidas"),
    ("movimientos",       "Movimientos de stock (ingresos y retiros)"),
    ("solicitudes_compra","Solicitudes de la versión anterior del sistema"),
]


def contar(conn, tabla):
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {tabla}").fetchone()[0]
    except sqlite3.OperationalError:
        return None  # La tabla no existe en esta base


def main():
    if not os.path.isfile(DB_PATH):
        print(f"No se encontró la base de datos: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    facturas = [f for f in os.listdir(CARPETA_FACTURAS) if os.path.isfile(os.path.join(CARPETA_FACTURAS, f))] \
        if os.path.isdir(CARPETA_FACTURAS) else []

    print("=" * 64)
    print("LIMPIEZA TRANSACCIONAL - PASE A PRODUCCIÓN")
    print(f"Base de datos: {DB_PATH}")
    print("=" * 64)
    print("\nSe VACIARÁN estas tablas:")
    for tabla, descripcion in TABLAS_A_VACIAR:
        n = contar(conn, tabla)
        print(f"  - {tabla:<20} {descripcion} ({'no existe' if n is None else f'{n} registros'})")
    print(f"  - uploads/facturas       Archivos de facturas adjuntadas ({len(facturas)} archivos)")
    print("\nSe PRESERVARÁN intactas: items (catálogo), usuarios, categorias.")
    print("(No hay tabla de proveedores: el proveedor es un dato dentro de cada pedido.)\n")

    confirmacion = input('Para confirmar el borrado escribí SI y presioná Enter: ').strip().upper()
    if confirmacion != "SI":
        print("Cancelado. No se tocó nada.")
        conn.close()
        sys.exit(0)

    backup = f"{DB_PATH[:-3]}.backup-reset-{datetime.now():%Y%m%d-%H%M%S}.db"
    conn.close()
    shutil.copy2(DB_PATH, backup)
    print(f"\nBackup de seguridad creado: {backup}")

    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            for tabla, _ in TABLAS_A_VACIAR:
                if contar(conn, tabla) is not None:
                    conn.execute(f"DELETE FROM {tabla}")
            # Reinicia los correlativos: el próximo pedido y la próxima OC arrancan desde 1.
            # sqlite_sequence solo existe si alguna tabla usa AUTOINCREMENT; si no está, no hay nada que reiniciar.
            try:
                conn.execute("DELETE FROM sqlite_sequence WHERE name IN "
                             "('pedidos_compra','ordenes_compra','cotizaciones','movimientos','solicitudes_compra')")
            except sqlite3.OperationalError:
                pass
        for f in facturas:
            os.remove(os.path.join(CARPETA_FACTURAS, f))
    except Exception as e:
        print(f"\nERROR durante el borrado: {e}")
        print(f"La base NO quedó modificada. Podés restaurarla desde: {backup}")
        sys.exit(1)
    finally:
        conn.close()

    print("\nListo. La base quedó sin datos de prueba:")
    conn = sqlite3.connect(DB_PATH)
    for tabla, _ in TABLAS_A_VACIAR:
        n = contar(conn, tabla)
        if n is not None:
            print(f"  {tabla}: {n} registros")
    print(f"  facturas: {len(os.listdir(CARPETA_FACTURAS)) if os.path.isdir(CARPETA_FACTURAS) else 0} archivos")
    for tabla in ("items", "usuarios", "categorias"):
        print(f"  {tabla}: {contar(conn, tabla)} registros (preservados)")
    conn.close()


if __name__ == "__main__":
    main()
