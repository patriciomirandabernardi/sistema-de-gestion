from pydantic import BaseModel, Field, field_validator, AfterValidator
from datetime import datetime
from typing import Optional, List, Literal, Annotated

# Categorías de gasto oficiales de IMCAYPER: con ellas se carga la tabla 'categorias' al arrancar.
# Después la fuente del listado es la tabla (el admin puede crear/editar/eliminar desde la app).
CATEGORIAS_INICIALES = (
    "Rodamientos y Retenes",
    "Gases y Soldadura",
    "Discos y Abrasivos",
    "Aceites y Lubricantes",
    "Solventes y Químicos",
    "EPP y Seguridad",
    "Consumibles y Limpieza",
    "Imprenta y Librería",
    "Planta Rosario (General)",
    "Taller Metalúrgico",
    "Camiones",
    "Planta San Luis",
)

# Plantel oficial de máquinas de IMCAYPER (mantener sincronizado con frontend/src/constants.js)
MAQUINAS_FLOTA = {
    "CC1 / SLITTER": "Línea de corte longitudinal de bobinas a flejes (rollos).",
    "CT1": "Conformadora de tubos (Ø 41.28 a 76.20 mm).",
    "CT2": "Conformadora de tubos (Ø 21.30 a 60.30 mm).",
    "W6": "Conformadora de tubos (Ø 48.30 a 60.30 esp. grueso / Ø 73.00 a 152.40 fino y grueso).",
    "Probadora Hidráulica": "Banco de prueba hidrostática de caños.",
    "Biseladora Chica": "Proceso de biselado de extremos (línea chica).",
    "Biseladora Grande": "Proceso de biselado de extremos (línea grande).",
    "Cuadradora": "Conformado de caño redondo a cuadrado/rectangular.",
    "Cubas": "Sistema de refrigeración de rolos y lubricación.",
    "Puentes Grúa": "Equipos de izaje y movimiento de cargas.",
    "Taller / Uso General": "Mantenimiento general de planta o banco de taller.",
}
DESTINO_EPP = "EPP / Uso Operario"
DESCRIPCION_EPP = "Entregas de EPP, guantes y ropa a operarios (detalle en Planilla Física de EPP)."
ESTADO_OC_EMITIDA = "OC_Emitida" # Pedido aprobado que ya fue incluido en una Orden de Compra
ESTADOS_EN_CAMINO = ["Aprobado", ESTADO_OC_EMITIDA] # Comprometidos con el proveedor, pendientes de recibir

TIPO_COMPRA_COTIZACION = "cotizacion"
TIPO_COMPRA_ABASTECIMIENTO = "abastecimiento_critico"
NOTA_ABASTECIMIENTO_CRITICO = "Ingreso por Abastecimiento Crítico (Excepción Pre-Aprobada por Gerencia)"
TIPO_COMPRA_GERENCIA = "compra_gerencia"
NOTA_COMPRA_GERENCIA = "Ingreso por Compra Directa de Gerencia (Excepción)"
# Motivo del ingreso directo -> nota de auditoría inmutable que queda en el pedido
NOTAS_COMPRA_DIRECTA = {
    TIPO_COMPRA_ABASTECIMIENTO: NOTA_ABASTECIMIENTO_CRITICO,
    TIPO_COMPRA_GERENCIA: NOTA_COMPRA_GERENCIA,
}
MotivoCompraDirecta = Literal["abastecimiento_critico", "compra_gerencia"]

# IVA: los precios con proveedores son NETOS y la alícuota se guarda aparte
# (mantener sincronizado con frontend/src/constants.js -> ALICUOTAS_IVA)
ALICUOTAS_IVA = (0.0, 10.5, 21.0, 27.0)
IVA_POR_DEFECTO = 21.0

def _validar_alicuota(v: float) -> float:
    if float(v) not in ALICUOTAS_IVA:
        raise ValueError("alícuota de IVA no válida (0, 10.5, 21 o 27)")
    return float(v)

AlicuotaIva = Annotated[float, AfterValidator(_validar_alicuota)]

def con_iva(neto: float, alicuota: float) -> float:
    """Monto con IVA, redondeado a 2 decimales."""
    return round(neto * (1 + alicuota / 100), 2)

RETIRADO_POR_OPERARIO = "Operario de Planta"
NOTA_CONTROL_EPP = "Control en Planilla Física de EPP"

# --- USUARIOS Y LOGIN ---
class UsuarioBase(BaseModel):
    legajo: str
    nombre_completo: str
    rol: str

RolUsuario = Literal["supervisor", "gerencia", "admin"]
LARGO_MINIMO_PASSWORD = 8

class UsuarioCreate(BaseModel):
    username: str = Field(min_length=1, max_length=50) # Usuario de login; también queda como legajo
    password: str = Field(min_length=LARGO_MINIMO_PASSWORD, max_length=72) # bcrypt usa hasta 72 bytes
    rol: RolUsuario
    nombre_completo: Optional[str] = Field(default=None, max_length=100) # Se muestra en pedidos y retiros

class ResetPassword(BaseModel):
    password: str = Field(min_length=LARGO_MINIMO_PASSWORD, max_length=72)

class UsuarioResponse(UsuarioBase):
    id: int
    username: Optional[str] = None
    class Config:
        from_attributes = True

class UsuarioAdminResponse(BaseModel): # Nunca incluye password_hash
    id: int
    username: Optional[str] = None
    legajo: str
    nombre_completo: Optional[str] = None
    rol: str
    activo: bool
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# --- CATEGORÍAS DE GASTO ---
class CategoriaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)

class CategoriaUpdate(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)

class CategoriaResponse(BaseModel):
    id: int
    nombre: str
    insumos: int = 0 # Insumos del catálogo que la usan (no se puede eliminar si tiene)
    class Config:
        from_attributes = True

# --- SERVICIOS EXTERNOS Y SIERRAS (solo admin) ---
TipoServicioExterno = Literal["Reparación General", "Afilado de Sierra"]
ESTADO_SERVICIO_ENVIADO = "Enviado"
ESTADO_SERVICIO_DEVUELTO = "Devuelto"
DIAMETROS_SIERRAS = (600, 550, 500, 450, 400, 350) # mm; carga inicial de stock_sierras

def _texto_no_vacio(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("no puede estar vacío")
    return v

TextoObligatorio = Annotated[str, Field(max_length=120), AfterValidator(_texto_no_vacio)]

class ServicioExternoCreate(BaseModel):
    tipo: TipoServicioExterno
    descripcion: TextoObligatorio
    proveedor_destino: TextoObligatorio
    fecha_envio: Optional[datetime] = None # Por defecto, ahora

class ServicioExternoUpdate(BaseModel): # Corrección de un envío cargado mal
    tipo: Optional[TipoServicioExterno] = None
    descripcion: Optional[TextoObligatorio] = None
    proveedor_destino: Optional[TextoObligatorio] = None
    fecha_envio: Optional[datetime] = None

class ServicioExternoResponse(BaseModel):
    id: int
    tipo: str
    descripcion: str
    proveedor_destino: str
    fecha_envio: datetime
    estado: str
    fecha_retorno: Optional[datetime] = None
    class Config:
        from_attributes = True

class StockSierraUpdate(BaseModel):
    cantidad_disponible: int = Field(ge=0, le=100000)

class StockSierraResponse(BaseModel):
    id: int
    diametro: int
    cantidad_disponible: int
    class Config:
        from_attributes = True

# --- ITEMS Y MOVIMIENTOS ---
class ItemBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    categoria_gasto: str # Se valida contra la tabla categorias en el endpoint
    ubicacion_uso: Optional[str] = None
    proveedor_habitual: Optional[str] = None
    es_critico: bool = False
    stock_actual: int = 0
    stock_minimo: int = 0
    ultimo_precio_unitario: float = Field(default=0.0, ge=0) # NETO (sin IVA)
    alicuota_iva: AlicuotaIva = IVA_POR_DEFECTO # IVA del precio de referencia

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    categoria_gasto: Optional[str] = None
    ubicacion_uso: Optional[str] = None
    proveedor_habitual: Optional[str] = None
    es_critico: Optional[bool] = None
    stock_actual: Optional[int] = Field(default=None, ge=0) # Recuento manual (ej. inventario inicial)
    stock_minimo: Optional[int] = Field(default=None, ge=0)
    ultimo_precio_unitario: Optional[float] = Field(default=None, ge=0)
    alicuota_iva: Optional[AlicuotaIva] = None

class DescontarStock(BaseModel):
    cantidad: int
    tipo_destino: Literal["maquina", "operario"]
    maquina: Optional[str] = None # Obligatoria si tipo_destino == "maquina"
    parte_maquina: Optional[str] = None
    retirado_por: Optional[str] = None # Supervisor; obligatorio si tipo_destino == "maquina"

class SalidaDetalle(BaseModel):
    movimiento_id: int
    fecha: Optional[datetime] = None
    insumo: Optional[str] = None
    categoria_gasto: Optional[str] = None
    cantidad: int
    precio_unitario: float
    total: float
    tipo_destino: Optional[str] = None
    maquina: str
    parte_maquina: Optional[str] = None
    retirado_por: Optional[str] = None
    nota_control: Optional[str] = None

class ConsumoMaquina(BaseModel):
    maquina: str
    descripcion: Optional[str] = None
    retiros: int
    unidades: int
    total: float
    porcentaje: float

class ReporteSalidas(BaseModel):
    total: float
    total_unidades: int
    por_maquina: List[ConsumoMaquina]
    detalle: List[SalidaDetalle]

class ItemResponse(ItemBase):
    id: int
    ultimo_proveedor: Optional[str] = None
    fecha_ultima_compra: Optional[datetime] = None
    class Config:
        from_attributes = True

class StockAlerta(BaseModel):
    id: int
    nombre: str
    stock_actual: int
    stock_minimo: int
    deficit: int
    es_critico: bool
    class Config:
        from_attributes = True

# --- PEDIDOS DE COMPRA ---
class PedidoCompraBase(BaseModel):
    insumo_id: Optional[int] = None
    insumo_nuevo_nombre: Optional[str] = None
    cantidad_solicitada: int
    criticidad: str = "Normal" # Alta, Normal, Baja
    observaciones: Optional[str] = None

class PedidoCompraCreate(PedidoCompraBase):
    pass

MAX_ITEMS_SOLICITUD = 30

class ItemSolicitud(BaseModel): # Una fila del pedido en lote del supervisor
    insumo_id: Optional[int] = None # Del catálogo...
    insumo_nuevo_nombre: Optional[str] = Field(default=None, max_length=150) # ...o un insumo que todavía no existe
    cantidad_solicitada: int = Field(gt=0)
    criticidad: Literal["Alta", "Normal", "Baja"] = "Normal"
    observaciones: Optional[str] = Field(default=None, max_length=500) # Justificación

class SolicitudCreate(BaseModel):
    items: List[ItemSolicitud] = Field(min_length=1, max_length=MAX_ITEMS_SOLICITUD)

class CotizacionCreate(BaseModel):
    proveedor_nombre: str
    precio_unitario: float # Precio por UNIDAD (no el total del pedido)

class CotizacionResponse(BaseModel):
    id: int
    proveedor_nombre: str
    precio_unitario: float
    elegida_por_aprobador: bool
    class Config:
        from_attributes = True

class AprobacionPedido(BaseModel):
    cotizacion_id: Optional[int] = None # Obligatorio solo si estado == "Aprobado"
    cantidad_aprobada: Optional[int] = None
    estado: Literal["Aprobado", "Rechazado", "Postergado"]

class RecepcionPedido(BaseModel):
    precio_unitario: Optional[float] = Field(default=None, ge=0) # NETO según factura; si no viene se mantiene el aprobado
    alicuota_iva: Optional[AlicuotaIva] = None # Si no viene se mantiene la del pedido (la de la OC)
    categoria_gasto: Optional[str] = None # Obligatorio si el pedido era de un insumo nuevo; se valida contra la tabla categorias
    ubicacion_uso: Optional[str] = None

class ItemCompraDirecta(BaseModel): # Un renglón del remito/factura
    insumo_id: int
    cantidad: float = Field(gt=0)
    precio_unitario: float = Field(gt=0) # Precio por UNIDAD NETO (sin IVA)
    alicuota_iva: AlicuotaIva

    @field_validator("cantidad")
    @classmethod
    def unidades_enteras(cls, v: float) -> float:
        if not float(v).is_integer():
            raise ValueError("la cantidad debe ser un número entero de unidades")
        return v

class CompraDirectaResponse(BaseModel):
    pedidos: List["PedidoCompraResponse"]
    total: float # Total final de la factura (neto + IVA)
    tiene_factura: bool

class EmitirOrdenCompra(BaseModel):
    pedido_ids: List[int] # Pedidos aprobados del mismo proveedor
    alicuota_iva: AlicuotaIva = IVA_POR_DEFECTO # Se guarda en la OC y en cada pedido

class GastoDetalle(BaseModel):
    pedido_id: int
    tipo_compra: str = TIPO_COMPRA_COTIZACION
    numero_comprobante: Optional[str] = None
    observaciones: Optional[str] = None
    cantidad_solicitada: Optional[int] = None
    numero_oc: Optional[str] = None
    tiene_factura: bool = False
    fecha: Optional[datetime] = None
    insumo: Optional[str] = None
    categoria_gasto: str
    proveedor: Optional[str] = None
    cantidad: int
    precio_unitario: float # Neto
    alicuota_iva: float = IVA_POR_DEFECTO
    subtotal_neto: float = 0.0
    iva: float = 0.0
    total: float # Gasto real = subtotal_neto + iva
    estado: str

class GastoCategoria(BaseModel):
    categoria: str
    total: float
    porcentaje: float
    cantidad_compras: int

class ReporteGastos(BaseModel):
    anio: Optional[int] = None
    mes: Optional[int] = None
    categoria: Optional[str] = None
    total: float # Gasto real con IVA
    total_neto: float = 0.0
    total_iva: float = 0.0
    por_categoria: List[GastoCategoria]
    detalle: List[GastoDetalle]

class PedidoCompraResponse(PedidoCompraBase):
    id: int
    codigo_solicitud: Optional[str] = None
    cantidad_aprobada: Optional[int] = None
    precio_unitario_final: Optional[float] = None # Neto
    alicuota_iva: float = IVA_POR_DEFECTO
    precio_unitario_oc: Optional[float] = None # Neto pactado en la OC (cotización aprobada): no cambia al recibir
    proveedor_final: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    fecha_recepcion: Optional[datetime] = None
    tipo_compra: str = TIPO_COMPRA_COTIZACION
    numero_comprobante: Optional[str] = None
    orden_compra_id: Optional[int] = None
    numero_oc: Optional[str] = None
    tiene_factura: bool = False
    estado: str
    supervisor_id: int
    supervisor_nombre: Optional[str] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    insumo_nombre: Optional[str] = None
    categoria_gasto: Optional[str] = None
    ubicacion_uso: Optional[str] = None
    ultimo_precio_unitario: Optional[float] = None # Neto
    ultima_alicuota_iva: Optional[float] = None # IVA de la última compra del insumo
    ultimo_proveedor: Optional[str] = None
    fecha_ultima_compra: Optional[datetime] = None
    cotizaciones: List[CotizacionResponse] = []
    mejor_cotizacion: Optional[CotizacionResponse] = None
    class Config:
        from_attributes = True

class OrdenCompraResponse(BaseModel):
    id: int
    numero_oc: str
    proveedor: str
    fecha_emision: datetime
    estado: str
    emitida_por_nombre: Optional[str] = None
    tiene_factura: bool = False
    alicuota_iva: float = IVA_POR_DEFECTO # La guardada al emitir (las OC previas toman la de sus pedidos)
    total: float # Neto, a precios de la OC
    total_iva: float = 0.0
    total_final: float = 0.0
    pedidos: List[PedidoCompraResponse]

# Reactivar un pedido Postergado: a dónde vuelve en el flujo
# (Pendiente_Aprobacion si vuelve a Gerencia con sus cotizaciones; Pendiente_Cotizacion si hay que recotizar)
class ReactivacionPedido(BaseModel):
    destino: Literal["aprobacion", "cotizacion"]

class SolicitudResponse(BaseModel):
    codigo_solicitud: str
    pedidos: List[PedidoCompraResponse]

CompraDirectaResponse.model_rebuild() # Resuelve la referencia adelantada a PedidoCompraResponse