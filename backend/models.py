from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, func
from sqlalchemy.orm import relationship
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    legajo = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True) # Usuario de login (Gerencia: "Miguel"; resto: su legajo)
    nombre_completo = Column(String)
    password_hash = Column(String) # bcrypt vía passlib
    rol = Column(String) # admin, gerencia, supervisor
    activo = Column(Boolean, nullable=False, default=True) # Baja lógica: conserva la trazabilidad de sus pedidos/OC

    pedidos = relationship("PedidoCompra", back_populates="supervisor")

class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False, index=True) # Categoría de gasto que puede elegirse en los insumos

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    descripcion = Column(String, nullable=True)
    categoria = Column(String, nullable=True)
    categoria_gasto = Column(String, nullable=False, default="Consumibles y Limpieza") # Nombre de una fila de la tabla categorias
    ubicacion_uso = Column(String, nullable=True)
    proveedor_habitual = Column(String, nullable=True)
    es_critico = Column(Boolean, default=False)
    stock_actual = Column(Integer, default=0)
    stock_minimo = Column(Integer, default=0)
    ultimo_precio_unitario = Column(Float, nullable=False, default=0.0) # Precio NETO de referencia (sin IVA)
    alicuota_iva = Column(Float, nullable=False, default=21.0) # IVA de su última compra; costo real = neto * (1 + alicuota/100)
    ultimo_proveedor = Column(String, nullable=True)
    fecha_ultima_compra = Column(DateTime, nullable=True)

    movimientos = relationship("Movimiento", back_populates="item")
    pedidos = relationship("PedidoCompra", back_populates="item")

class Movimiento(Base):
    __tablename__ = "movimientos"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"))
    tipo_movimiento = Column(String)
    cantidad = Column(Integer)
    fecha = Column(DateTime, default=func.now())

    # Trazabilidad de salidas
    tipo_destino = Column(String, nullable=True) # "maquina" u "operario"
    maquina = Column(String, nullable=True) # Máquina de la flota oficial o "EPP / Uso Operario"
    parte_maquina = Column(String, nullable=True)
    retirado_por = Column(String, nullable=True) # Supervisor o "Operario de Planta"
    nota_control = Column(String, nullable=True)
    precio_unitario_momento = Column(Float, nullable=False, default=0.0) # Valoriza el consumo: cantidad * precio

    item = relationship("Item", back_populates="movimientos")

class PedidoCompra(Base):
    __tablename__ = "pedidos_compra"

    id = Column(Integer, primary_key=True, index=True)
    insumo_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    insumo_nuevo_nombre = Column(String, nullable=True)
    codigo_solicitud = Column(String, nullable=True, index=True) # Vincula los ítems pedidos juntos (SOL-AAAAMMDD-NNN); NULL en pedidos previos
    cantidad_solicitada = Column(Integer)
    cantidad_aprobada = Column(Integer, nullable=True)
    precio_unitario_final = Column(Float, nullable=True) # Precio UNITARIO NETO (sin IVA)
    alicuota_iva = Column(Float, nullable=False, default=21.0) # % de IVA; gasto real = cantidad_aprobada * precio_unitario_final * (1 + alicuota_iva/100)
    proveedor_final = Column(String, nullable=True)
    fecha_aprobacion = Column(DateTime, nullable=True)
    fecha_recepcion = Column(DateTime, nullable=True)
    tipo_compra = Column(String, nullable=False, default="cotizacion") # "cotizacion" (flujo de 3 niveles), "abastecimiento_critico" o "compra_gerencia"
    numero_comprobante = Column(String, nullable=True) # Remito / factura (compras directas)
    orden_compra_id = Column(Integer, ForeignKey("ordenes_compra.id"), nullable=True)
    archivo_factura = Column(String, nullable=True) # Nombre del archivo en uploads/facturas (compras sin OC)
    criticidad = Column(String, default="Normal") # Alta, Normal, Baja
    observaciones = Column(String, nullable=True)
    estado = Column(String, default="Pendiente_Cotizacion") # Pendiente_Cotizacion, Pendiente_Aprobacion, Aprobado, OC_Emitida, Rechazado, Postergado, Recibido
    supervisor_id = Column(Integer, ForeignKey("usuarios.id"))
    fecha_creacion = Column(DateTime, default=func.now())
    fecha_actualizacion = Column(DateTime, default=func.now(), onupdate=func.now())

    supervisor = relationship("Usuario", back_populates="pedidos")
    item = relationship("Item", back_populates="pedidos")
    cotizaciones = relationship("Cotizacion", back_populates="pedido", cascade="all, delete-orphan")
    orden_compra = relationship("OrdenCompra", back_populates="pedidos")

class OrdenCompra(Base):
    __tablename__ = "ordenes_compra"

    id = Column(Integer, primary_key=True, index=True)
    numero_oc = Column(String, unique=True, index=True) # Correlativo: OC-0001, OC-0002...
    proveedor = Column(String, nullable=False)
    fecha_emision = Column(DateTime, nullable=False)
    estado = Column(String, nullable=False, default="Emitida") # Emitida, Recibida
    emitida_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    archivo_factura = Column(String, nullable=True) # Factura del proveedor (una por OC)
    alicuota_iva = Column(Float, nullable=True) # IVA con el que se emitió (para reimprimir igual); NULL en OC previas

    pedidos = relationship("PedidoCompra", back_populates="orden_compra")
    emitida_por = relationship("Usuario")

class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos_compra.id"))
    proveedor_nombre = Column(String)
    precio_unitario = Column(Float)
    elegida_por_aprobador = Column(Boolean, default=False)

    pedido = relationship("PedidoCompra", back_populates="cotizaciones")

class ServicioExterno(Base):
    __tablename__ = "servicios_externos"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, nullable=False) # "Reparación General" o "Afilado de Sierra"
    descripcion = Column(String, nullable=False) # Qué se envió (ej. "Hidrolavadora", "Sierra 500")
    proveedor_destino = Column(String, nullable=False)
    fecha_envio = Column(DateTime, nullable=False, default=func.now())
    estado = Column(String, nullable=False, default="Enviado", index=True) # Enviado, Devuelto
    fecha_retorno = Column(DateTime, nullable=True)

class StockSierra(Base):
    __tablename__ = "stock_sierras"

    id = Column(Integer, primary_key=True, index=True)
    diametro = Column(Integer, unique=True, nullable=False) # mm
    cantidad_disponible = Column(Integer, nullable=False, default=0)

    