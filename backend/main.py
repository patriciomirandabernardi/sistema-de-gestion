from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from pydantic import TypeAdapter, ValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
import mimetypes
import os
import threading
import unicodedata
import uuid
from jose import JWTError, jwt

from database import engine, Base, SessionLocal
import models
import schemas
from seguridad import get_password_hash, verify_password
from migracion_usuarios import migrar_usuarios
from migraciones import asegurar_columnas, asegurar_categorias, asegurar_sierras

Base.metadata.create_all(bind=engine)
asegurar_columnas(engine)
migrar_usuarios(engine)
asegurar_categorias(engine, schemas.CATEGORIAS_INICIALES)
asegurar_sierras(engine, schemas.DIAMETROS_SIERRAS)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- SEGURIDAD (JWT) ---
SECRET_KEY = "imcalker_secreto_super_seguro_cambiar_en_produccion"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="No autorizado")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        legajo: str = payload.get("sub")
        if legajo is None: raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.Usuario).filter(models.Usuario.legajo == legajo).first()
    if user is None or not user.activo: raise credentials_exception # Una baja corta también las sesiones abiertas
    return user

def require_admin(current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Permiso denegado: se requiere rol administrador")
    return current_user

# --- USUARIOS Y LOGIN ---
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # El usuario no distingue mayúsculas ("Miguel" = "miguel"); la contraseña sí
    username = form_data.username.strip().lower()
    user = db.query(models.Usuario).filter(func.lower(models.Usuario.username) == username).first()
    if not user or not user.activo or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    access_token = create_access_token(data={"sub": user.legajo, "rol": user.rol, "username": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- GESTIÓN DE USUARIOS (ABM, solo admin) ---

def buscar_usuario(db: Session, id: int) -> models.Usuario:
    usuario = db.query(models.Usuario).filter(models.Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario

@app.get("/usuarios/", response_model=List[schemas.UsuarioAdminResponse])
def listar_usuarios(db: Session = Depends(get_db), admin: models.Usuario = Depends(require_admin)):
    return db.query(models.Usuario).order_by(models.Usuario.activo.desc(), models.Usuario.id).all()

@app.post("/usuarios/", response_model=schemas.UsuarioAdminResponse)
def create_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db), admin: models.Usuario = Depends(require_admin)):
    username = usuario.username.strip()
    if not username or any(c.isspace() for c in username):
        raise HTTPException(status_code=400, detail="El usuario no puede estar vacío ni contener espacios")
    # El usuario también es el legajo (identifica la sesión): no puede repetirse en ninguno de los dos, ni con usuarios dados de baja
    repetido = db.query(models.Usuario).filter(
        (func.lower(models.Usuario.username) == username.lower()) | (func.lower(models.Usuario.legajo) == username.lower())
    ).first()
    if repetido:
        estado = "" if repetido.activo else " (dado de baja)"
        raise HTTPException(status_code=400, detail=f"El usuario o legajo '{username}' ya existe{estado}")
    nuevo_usuario = models.Usuario(
        legajo=username,
        username=username,
        nombre_completo=(usuario.nombre_completo or "").strip() or username,
        password_hash=get_password_hash(usuario.password),
        rol=usuario.rol,
        activo=True
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

@app.put("/usuarios/{id}/reset-password")
def reset_password(id: int, datos: schemas.ResetPassword, db: Session = Depends(get_db), admin: models.Usuario = Depends(require_admin)):
    usuario = buscar_usuario(db, id)
    if not usuario.activo:
        raise HTTPException(status_code=400, detail="El usuario está dado de baja")
    usuario.password_hash = get_password_hash(datos.password)
    db.commit()
    return {"mensaje": f"Clave de '{usuario.username}' blanqueada"}

@app.delete("/usuarios/{id}")
def delete_usuario(id: int, db: Session = Depends(get_db), admin: models.Usuario = Depends(require_admin)):
    usuario = buscar_usuario(db, id)
    if usuario.id == admin.id:
        raise HTTPException(status_code=400, detail="No podés darte de baja a vos mismo")
    if not usuario.activo:
        raise HTTPException(status_code=400, detail="El usuario ya está dado de baja")

    # Con historial (pedidos, compras directas u OC a su nombre) se hace baja lógica para no romper la trazabilidad;
    # sin historial se elimina físicamente
    tiene_historial = (
        db.query(models.PedidoCompra.id).filter(models.PedidoCompra.supervisor_id == id).first()
        or db.query(models.OrdenCompra.id).filter(models.OrdenCompra.emitida_por_id == id).first()
    )
    if tiene_historial:
        usuario.activo = False
        accion, mensaje = "baja", f"'{usuario.username}' dado de baja: ya no puede ingresar y su historial se conserva"
    else:
        db.delete(usuario)
        accion, mensaje = "eliminado", f"'{usuario.username}' eliminado (no tenía historial)"
    db.commit()
    return {"mensaje": mensaje, "accion": accion}

@app.get("/usuarios/me", response_model=schemas.UsuarioResponse)
def read_users_me(current_user: models.Usuario = Depends(get_current_user)):
    return current_user

@app.get("/usuarios/supervisores", response_model=List[schemas.UsuarioResponse])
def get_supervisores(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Permiso denegado")
    return db.query(models.Usuario).filter(
        models.Usuario.rol == "supervisor", models.Usuario.activo.is_(True)
    ).order_by(models.Usuario.nombre_completo).all()

# --- PEDIDOS DE COMPRA (Workflow 3 niveles) ---

def precio_unitario_oc(pedido: models.PedidoCompra) -> Optional[float]:
    """Neto pactado con el proveedor (cotización elegida por Gerencia). No cambia aunque la factura venga distinta al recibir."""
    elegida = next((c for c in pedido.cotizaciones if c.elegida_por_aprobador), None)
    return elegida.precio_unitario if elegida else pedido.precio_unitario_final

def serializar_pedido(pedido: models.PedidoCompra, incluir_cotizaciones: bool = True):
    cotizaciones = list(pedido.cotizaciones) if incluir_cotizaciones else []
    return {
        **{c.name: getattr(pedido, c.name) for c in pedido.__table__.columns},
        "precio_unitario_oc": precio_unitario_oc(pedido),
        "supervisor_nombre": pedido.supervisor.nombre_completo if pedido.supervisor else "Desconocido",
        "insumo_nombre": pedido.item.nombre if pedido.item else pedido.insumo_nuevo_nombre,
        "categoria_gasto": pedido.item.categoria_gasto if pedido.item else None,
        "ubicacion_uso": pedido.item.ubicacion_uso if pedido.item else None,
        "ultimo_precio_unitario": pedido.item.ultimo_precio_unitario if pedido.item else None,
        "ultima_alicuota_iva": pedido.item.alicuota_iva if pedido.item else None,
        "ultimo_proveedor": pedido.item.ultimo_proveedor if pedido.item else None,
        "fecha_ultima_compra": pedido.item.fecha_ultima_compra if pedido.item else None,
        "numero_oc": pedido.orden_compra.numero_oc if pedido.orden_compra else None,
        "tiene_factura": archivo_factura_de(pedido) is not None,
        "cotizaciones": cotizaciones,
        "mejor_cotizacion": min(cotizaciones, key=lambda c: c.precio_unitario) if cotizaciones else None
    }

def archivo_factura_de(pedido: models.PedidoCompra) -> Optional[str]:
    """La factura vive en la OC (una factura del proveedor por OC) o, en compras sin OC, en el propio pedido."""
    if pedido.orden_compra and pedido.orden_compra.archivo_factura:
        return pedido.orden_compra.archivo_factura
    return pedido.archivo_factura

# 1. Supervisor crea pedidos. Varios ítems pedidos juntos forman una solicitud: cada uno se cotiza y aprueba
# por separado, pero todos comparten el mismo codigo_solicitud (SOL-AAAAMMDD-NNN) para rastrear de qué lote vinieron.
_candado_solicitud = threading.Lock() # Dos solicitudes simultáneas no pueden tomar el mismo correlativo

def generar_codigo_solicitud(db: Session) -> str:
    prefijo = f"SOL-{datetime.now():%Y%m%d}-"
    usados = db.query(models.PedidoCompra.codigo_solicitud).filter(
        models.PedidoCompra.codigo_solicitud.like(f"{prefijo}%")).distinct().all()
    siguiente = max((int(c.rsplit("-", 1)[1]) for (c,) in usados if c.rsplit("-", 1)[1].isdigit()), default=0) + 1
    return f"{prefijo}{siguiente:03d}"

def crear_solicitud(db: Session, supervisor: models.Usuario, items: List[schemas.ItemSolicitud]):
    if supervisor.rol != "supervisor":
        raise HTTPException(status_code=403, detail="Solo supervisores pueden crear pedidos")

    # Validación completa antes de grabar: o entra toda la solicitud o no entra nada
    ids = [i.insumo_id for i in items if i.insumo_id is not None]
    existentes = {i for (i,) in db.query(models.Item.id).filter(models.Item.id.in_(ids)).all()} if ids else set()
    vistos = set()
    for n, item in enumerate(items, start=1):
        if item.insumo_id is not None:
            if item.insumo_id not in existentes:
                raise HTTPException(status_code=400, detail=f"Ítem {n}: el insumo seleccionado no existe")
            clave = ("id", item.insumo_id)
        else:
            nombre = (item.insumo_nuevo_nombre or "").strip()
            if not nombre:
                raise HTTPException(status_code=400, detail=f"Ítem {n}: seleccione un insumo del catálogo o indique el nombre de uno nuevo")
            clave = ("nuevo", nombre.lower())
        if clave in vistos:
            raise HTTPException(status_code=400, detail=f"Ítem {n}: el insumo está repetido en la solicitud; sume las cantidades en una sola fila")
        vistos.add(clave)

    with _candado_solicitud:
        codigo = generar_codigo_solicitud(db)
        pedidos = [models.PedidoCompra(
            insumo_id=item.insumo_id,
            insumo_nuevo_nombre=None if item.insumo_id else item.insumo_nuevo_nombre.strip(),
            cantidad_solicitada=item.cantidad_solicitada,
            criticidad=item.criticidad,
            observaciones=(item.observaciones or "").strip() or None,
            estado="Pendiente_Cotizacion",
            supervisor_id=supervisor.id,
            codigo_solicitud=codigo
        ) for item in items]
        db.add_all(pedidos)
        db.commit()
    for p in pedidos:
        db.refresh(p)
    return codigo, pedidos

@app.post("/pedidos/bulk", response_model=schemas.SolicitudResponse)
def create_pedidos_lote(solicitud: schemas.SolicitudCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    codigo, pedidos = crear_solicitud(db, current_user, solicitud.items)
    return {"codigo_solicitud": codigo, "pedidos": [serializar_pedido(p, incluir_cotizaciones=False) for p in pedidos]}

# Alta de un solo ítem (compatibilidad): queda como una solicitud de un ítem
@app.post("/pedidos/", response_model=schemas.PedidoCompraResponse)
def create_pedido(pedido: schemas.PedidoCompraCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    try:
        item = schemas.ItemSolicitud.model_validate(pedido.model_dump())
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=[err["msg"] for err in e.errors()])
    _, pedidos = crear_solicitud(db, current_user, [item])
    return serializar_pedido(pedidos[0], incluir_cotizaciones=False)

# 2. Admin (Patricio) ve pedidos pendientes de cotización
@app.get("/pedidos/pendientes-cotizacion", response_model=List[schemas.PedidoCompraResponse])
def get_pedidos_pendientes_cotizacion(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede ver pedidos pendientes de cotización")

    pedidos = db.query(models.PedidoCompra).filter(
        models.PedidoCompra.estado == "Pendiente_Cotizacion"
    ).order_by(models.PedidoCompra.fecha_creacion.desc()).all()

    return [serializar_pedido(p) for p in pedidos]

# 3. Admin (Patricio) agrega cotizaciones y cambia estado
@app.post("/pedidos/{id}/cotizaciones")
def agregar_cotizaciones(id: int, cotizaciones: List[schemas.CotizacionCreate], db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede agregar cotizaciones")

    pedido = db.query(models.PedidoCompra).filter(models.PedidoCompra.id == id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if not 1 <= len(cotizaciones) <= 3:
        raise HTTPException(status_code=400, detail="Debe cargar entre 1 y 3 cotizaciones")
    if any(c.precio_unitario <= 0 or not c.proveedor_nombre.strip() for c in cotizaciones):
        raise HTTPException(status_code=400, detail="Cada cotización necesita proveedor y un precio unitario mayor a cero")

    # Eliminar cotizaciones existentes
    db.query(models.Cotizacion).filter(models.Cotizacion.pedido_id == id).delete()

    # Agregar nuevas cotizaciones
    for cot in cotizaciones:
        db_cot = models.Cotizacion(
            pedido_id=id,
            proveedor_nombre=cot.proveedor_nombre,
            precio_unitario=cot.precio_unitario
        )
        db.add(db_cot)

    pedido.estado = "Pendiente_Aprobacion"
    db.commit()
    return {"mensaje": "Cotizaciones agregadas y pedido enviado a aprobación"}

# 4. Aprobador (Miguel) ve pedidos pendientes de aprobación
@app.get("/pedidos/pendientes-aprobacion", response_model=List[schemas.PedidoCompraResponse])
def get_pedidos_pendientes_aprobacion(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Solo gerencia puede ver pedidos pendientes de aprobación")

    pedidos = db.query(models.PedidoCompra).filter(
        models.PedidoCompra.estado == "Pendiente_Aprobacion"
    ).order_by(models.PedidoCompra.fecha_creacion.desc()).all()

    return [serializar_pedido(p) for p in pedidos]

# 5. Aprobador (Miguel) aprueba/rechaza/posterga
@app.put("/pedidos/{id}/aprobar")
def aprobar_pedido(id: int, aprobacion: schemas.AprobacionPedido, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Solo gerencia puede aprobar pedidos")

    pedido = db.query(models.PedidoCompra).filter(models.PedidoCompra.id == id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if pedido.estado not in ["Pendiente_Aprobacion", "Postergado"]:
        raise HTTPException(status_code=400, detail=f"El pedido está en estado {pedido.estado} y no puede decidirse")

    if aprobacion.estado == "Aprobado":
        cotizacion = db.query(models.Cotizacion).filter(models.Cotizacion.id == aprobacion.cotizacion_id).first()
        if not cotizacion or cotizacion.pedido_id != id:
            raise HTTPException(status_code=400, detail="Para aprobar debe elegir una cotización válida del pedido")
        cantidad = aprobacion.cantidad_aprobada or pedido.cantidad_solicitada
        if cantidad <= 0:
            raise HTTPException(status_code=400, detail="La cantidad aprobada debe ser mayor a cero")

        db.query(models.Cotizacion).filter(models.Cotizacion.pedido_id == id).update({"elegida_por_aprobador": False})
        cotizacion.elegida_por_aprobador = True

        # El precio de la cotización es UNITARIO: gasto real = cantidad_aprobada * precio_unitario_final
        pedido.cantidad_aprobada = cantidad
        pedido.precio_unitario_final = cotizacion.precio_unitario
        pedido.proveedor_final = cotizacion.proveedor_nombre
        pedido.fecha_aprobacion = datetime.now()

    pedido.estado = aprobacion.estado
    db.commit()
    return {"mensaje": f"Pedido {aprobacion.estado.lower()}"}

# Un pedido Postergado puede volver al flujo: a Gerencia (conserva las cotizaciones cargadas)
# o de nuevo a cotización en Compras, si los precios quedaron viejos.
@app.put("/pedidos/{id}/reactivar")
def reactivar_pedido(id: int, datos: schemas.ReactivacionPedido, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Solo admin y gerencia pueden reactivar pedidos")

    pedido = db.query(models.PedidoCompra).filter(models.PedidoCompra.id == id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if pedido.estado != "Postergado":
        raise HTTPException(status_code=400, detail=f"Solo se pueden reactivar pedidos postergados (está en {pedido.estado})")

    if datos.destino == "aprobacion":
        if not pedido.cotizaciones:
            raise HTTPException(status_code=400, detail="El pedido no tiene cotizaciones: envíelo a cotización")
        pedido.estado = "Pendiente_Aprobacion"
        mensaje = "Pedido reactivado: vuelve a aprobación de Gerencia con sus cotizaciones"
    else:
        pedido.estado = "Pendiente_Cotizacion"
        mensaje = "Pedido reactivado: vuelve a cotización en Compras"
    db.commit()
    return {"mensaje": mensaje}

# 6. Admin (Patricio) marca como recibido, confirma el precio final y suma al stock
@app.put("/pedidos/{id}/recibir")
def recibir_pedido(id: int, datos: Optional[schemas.RecepcionPedido] = None, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede marcar pedidos como recibidos")

    pedido = db.query(models.PedidoCompra).filter(models.PedidoCompra.id == id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if pedido.estado not in schemas.ESTADOS_EN_CAMINO:
        raise HTTPException(status_code=400, detail="Solo se pueden recibir pedidos aprobados o con OC emitida")

    datos = datos or schemas.RecepcionPedido()

    # La factura real puede diferir de lo aprobado: se guarda el neto y la alícuota por separado
    if datos.precio_unitario is not None:
        pedido.precio_unitario_final = datos.precio_unitario
    if datos.alicuota_iva is not None:
        pedido.alicuota_iva = datos.alicuota_iva

    # Insumo nuevo: se da de alta en el catálogo para que el gasto quede categorizado
    item = pedido.item
    if item is None:
        nombre = (pedido.insumo_nuevo_nombre or "").strip()
        item = db.query(models.Item).filter(func.lower(models.Item.nombre) == nombre.lower()).first()
        if item is None:
            if not datos.categoria_gasto:
                raise HTTPException(status_code=400, detail="Es un insumo nuevo: indique la categoría de gasto para darlo de alta en el catálogo")
            categoria = buscar_categoria_por_nombre(db, datos.categoria_gasto)
            item = models.Item(nombre=nombre, categoria_gasto=categoria.nombre, ubicacion_uso=datos.ubicacion_uso or None, stock_actual=0, stock_minimo=0)
            db.add(item)
            db.flush()
        pedido.insumo_id = item.id

    pedido.estado = "Recibido"
    pedido.fecha_recepcion = datetime.now()
    registrar_ingreso(db, item, pedido)

    # La OC se cierra sola cuando llegó todo lo que incluía
    oc = pedido.orden_compra
    if oc and all(p.estado == "Recibido" for p in oc.pedidos):
        oc.estado = "Recibida"
    db.commit()
    return {"mensaje": "Pedido recibido y stock actualizado", "insumo_id": item.id, "stock_actual": item.stock_actual}

def registrar_ingreso(db: Session, item: models.Item, pedido: models.PedidoCompra):
    """Suma al stock lo recibido, deja el movimiento de ingreso y actualiza la memoria de precios del insumo."""
    cantidad = pedido.cantidad_aprobada or pedido.cantidad_solicitada
    item.stock_actual += cantidad
    db.add(models.Movimiento(item_id=item.id, tipo_movimiento="ingreso", cantidad=cantidad, fecha=pedido.fecha_recepcion))

    # Memoria de precios: el insumo recuerda el precio NETO de su última compra y su IVA,
    # como los pedidos. El costo real con IVA se calcula al valorizar stock y consumos.
    if pedido.precio_unitario_final is not None:
        item.ultimo_precio_unitario = pedido.precio_unitario_final
        item.alicuota_iva = pedido.alicuota_iva
        item.ultimo_proveedor = pedido.proveedor_final
        item.fecha_ultima_compra = pedido.fecha_recepcion

# Compra directa: reposición pre-aprobada por Gerencia (gases, trapos, EPP) o mercadería que Gerencia compró por su cuenta.
# Un remito/factura puede traer varios insumos: cada uno queda como un pedido ya recibido, y todos comparten
# comprobante, proveedor, motivo, nota de auditoría, quién lo cargó y el archivo adjunto.
# Se recibe como multipart (FormData): `items` es un JSON con precios unitarios FINALES (IVA incluido).
ITEMS_COMPRA_DIRECTA = TypeAdapter(List[schemas.ItemCompraDirecta])
MAX_ITEMS_COMPRA_DIRECTA = 50

@app.post("/compras-directas/", response_model=schemas.CompraDirectaResponse)
async def crear_compra_directa(
    items: str = Form(...),
    proveedor: str = Form(...),
    motivo: schemas.MotivoCompraDirecta = Form(...),
    numero_comprobante: Optional[str] = Form(None),
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede registrar ingresos directos")
    proveedor = proveedor.strip()
    if not proveedor:
        raise HTTPException(status_code=400, detail="Indique el proveedor")

    try:
        lineas = ITEMS_COMPRA_DIRECTA.validate_json(items)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=[f"Insumo {err['loc'][0] + 1}: {err['msg']}" if err["loc"] and isinstance(err["loc"][0], int)
                                                     else err["msg"] for err in e.errors()])
    if not 1 <= len(lineas) <= MAX_ITEMS_COMPRA_DIRECTA:
        raise HTTPException(status_code=400, detail=f"Cargue entre 1 y {MAX_ITEMS_COMPRA_DIRECTA} insumos")
    ids = [l.insumo_id for l in lineas]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Hay insumos repetidos: sume las cantidades en una sola fila")
    catalogo = {i.id: i for i in db.query(models.Item).filter(models.Item.id.in_(ids)).all()}
    faltantes = [str(i) for i in ids if i not in catalogo]
    if faltantes:
        raise HTTPException(status_code=404, detail=f"Insumo(s) no encontrado(s): {', '.join(faltantes)}")

    # El archivo se valida antes de tocar la base: si es inválido no se registra nada
    factura = await leer_factura(archivo) if archivo and archivo.filename else None

    ahora = datetime.now()
    pedidos = []
    for linea in lineas:
        cantidad = int(linea.cantidad)
        pedido = models.PedidoCompra(
            insumo_id=linea.insumo_id,
            cantidad_solicitada=cantidad,
            cantidad_aprobada=cantidad,
            precio_unitario_final=linea.precio_unitario, # Neto
            alicuota_iva=linea.alicuota_iva,
            proveedor_final=proveedor,
            numero_comprobante=(numero_comprobante or "").strip() or None,
            criticidad="Normal",
            observaciones=schemas.NOTAS_COMPRA_DIRECTA[motivo], # Nota inmutable según el motivo
            tipo_compra=motivo,
            estado="Recibido",
            supervisor_id=current_user.id, # Quién registró el ingreso
            fecha_aprobacion=ahora,
            fecha_recepcion=ahora
        )
        db.add(pedido)
        registrar_ingreso(db, catalogo[linea.insumo_id], pedido)
        pedidos.append(pedido)
    db.flush()

    ruta_factura = None
    if factura:
        referencia = f"PED-{pedidos[0].id:04d}" + (f"-{pedidos[-1].id:04d}" if len(pedidos) > 1 else "")
        nombre = guardar_factura(referencia, *factura)
        ruta_factura = CARPETA_FACTURAS / nombre
        for p in pedidos:
            p.archivo_factura = nombre # El mismo comprobante respalda todos los renglones
    try:
        db.commit()
    except Exception:
        db.rollback()
        if ruta_factura:
            ruta_factura.unlink(missing_ok=True) # No dejar archivos huérfanos
        raise
    for p in pedidos:
        db.refresh(p)
    return {
        "pedidos": [serializar_pedido(p) for p in pedidos],
        "total": round(sum(schemas.con_iva(p.cantidad_aprobada * p.precio_unitario_final, p.alicuota_iva) for p in pedidos), 2),
        "tiene_factura": factura is not None
    }

# 7. Get pedidos aprobados (sin OC y con OC emitida: mercadería comprometida pendiente de recibir)
@app.get("/pedidos/aprobados", response_model=List[schemas.PedidoCompraResponse])
def get_pedidos_aprobados(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede ver pedidos aprobados")

    pedidos = db.query(models.PedidoCompra).filter(
        models.PedidoCompra.estado.in_(schemas.ESTADOS_EN_CAMINO)
    ).order_by(models.PedidoCompra.fecha_creacion.desc()).all()

    return [serializar_pedido(p) for p in pedidos]

# --- ÓRDENES DE COMPRA ---

def serializar_oc(oc: models.OrdenCompra):
    # El documento se rearma con lo pactado al emitir (precio de la cotización e IVA de la OC), no con lo recibido después
    pedidos = sorted(oc.pedidos, key=lambda p: p.id)
    alicuota = oc.alicuota_iva if oc.alicuota_iva is not None else (pedidos[0].alicuota_iva if pedidos else schemas.IVA_POR_DEFECTO)
    neto = round(sum(round((p.cantidad_aprobada or p.cantidad_solicitada) * (precio_unitario_oc(p) or 0), 2) for p in pedidos), 2)
    total_final = schemas.con_iva(neto, alicuota)
    return {
        "id": oc.id,
        "numero_oc": oc.numero_oc,
        "proveedor": oc.proveedor,
        "fecha_emision": oc.fecha_emision,
        "estado": oc.estado,
        "emitida_por_nombre": oc.emitida_por.nombre_completo if oc.emitida_por else None,
        "tiene_factura": oc.archivo_factura is not None,
        "alicuota_iva": alicuota,
        "total": neto,
        "total_iva": round(total_final - neto, 2),
        "total_final": total_final,
        "pedidos": [serializar_pedido(p, incluir_cotizaciones=False) for p in pedidos]
    }

@app.post("/ordenes-compra/", response_model=schemas.OrdenCompraResponse)
def emitir_orden_compra(datos: schemas.EmitirOrdenCompra, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede emitir órdenes de compra")
    ids = set(datos.pedido_ids)
    if not ids:
        raise HTTPException(status_code=400, detail="Seleccione al menos un pedido")

    pedidos = db.query(models.PedidoCompra).filter(models.PedidoCompra.id.in_(ids)).all()
    if len(pedidos) != len(ids):
        raise HTTPException(status_code=404, detail="Alguno de los pedidos seleccionados no existe")
    if any(p.estado != "Aprobado" or p.orden_compra_id for p in pedidos):
        raise HTTPException(status_code=400, detail="Solo se pueden incluir pedidos aprobados que todavía no tengan OC")
    proveedores = {p.proveedor_final for p in pedidos}
    if len(proveedores) != 1 or None in proveedores:
        raise HTTPException(status_code=400, detail="Todos los pedidos de una OC deben ser del mismo proveedor")

    oc = models.OrdenCompra(numero_oc=None, proveedor=proveedores.pop(), fecha_emision=datetime.now(),
                            estado="Emitida", emitida_por_id=current_user.id, alicuota_iva=datos.alicuota_iva)
    db.add(oc)
    db.flush()
    oc.numero_oc = f"OC-{oc.id:04d}" # Correlativo: el id nunca se reutiliza porque las OC no se borran
    for p in pedidos:
        p.orden_compra_id = oc.id
        p.estado = schemas.ESTADO_OC_EMITIDA
        p.alicuota_iva = datos.alicuota_iva # IVA previsto; se puede corregir al recibir según la factura
    db.commit()
    db.refresh(oc)
    return serializar_oc(oc)

@app.get("/ordenes-compra/", response_model=List[schemas.OrdenCompraResponse])
def get_ordenes_compra(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Permiso denegado")
    ordenes = db.query(models.OrdenCompra).order_by(models.OrdenCompra.id.desc()).all()
    return [serializar_oc(oc) for oc in ordenes]

# --- FACTURAS DIGITALES ---
# Los archivos se guardan en backend/uploads/facturas con un nombre generado por el sistema (nunca el del usuario)
# y solo se sirven por un endpoint autenticado: la base guarda únicamente el nombre del archivo.

CARPETA_FACTURAS = Path(os.environ.get("IMCAYPER_CARPETA_FACTURAS") or Path(__file__).resolve().parent / "uploads" / "facturas").resolve()
TAMANIO_MAXIMO_FACTURA = 10 * 1024 * 1024 # 10 MB
FIRMAS_PERMITIDAS = { # extensión -> bytes iniciales del archivo real
    ".pdf": [b"%PDF"],
    ".jpg": [b"\xff\xd8\xff"], ".jpeg": [b"\xff\xd8\xff"],
    ".png": [b"\x89PNG"],
    ".webp": [b"RIFF"],
}

@app.post("/pedidos/{id}/factura")
async def subir_factura(id: int, archivo: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede adjuntar facturas")
    pedido = db.query(models.PedidoCompra).filter(models.PedidoCompra.id == id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if pedido.estado != "Recibido":
        raise HTTPException(status_code=400, detail="La factura se adjunta al recibir la mercadería")

    destino = pedido.orden_compra or pedido
    if destino.archivo_factura:
        raise HTTPException(status_code=400, detail="Esta compra ya tiene una factura adjunta y no se puede reemplazar")

    extension, contenido = await leer_factura(archivo)
    referencia = pedido.orden_compra.numero_oc if pedido.orden_compra else f"PED-{pedido.id:04d}"
    destino.archivo_factura = guardar_factura(referencia, extension, contenido)
    db.commit()
    return {"mensaje": "Factura adjuntada", "archivo": destino.archivo_factura}

async def leer_factura(archivo: UploadFile):
    """Valida formato, tamaño y contenido real del archivo. Devuelve (extensión, bytes)."""
    extension = Path(archivo.filename or "").suffix.lower()
    if extension not in FIRMAS_PERMITIDAS:
        raise HTTPException(status_code=400, detail="Formato no permitido. Suba un PDF o una imagen (JPG, PNG, WEBP)")
    contenido = await archivo.read(TAMANIO_MAXIMO_FACTURA + 1)
    if len(contenido) > TAMANIO_MAXIMO_FACTURA:
        raise HTTPException(status_code=400, detail="El archivo supera los 10 MB")
    if not any(contenido.startswith(firma) for firma in FIRMAS_PERMITIDAS[extension]):
        raise HTTPException(status_code=400, detail="El contenido del archivo no coincide con su extensión")
    return extension, contenido

def guardar_factura(referencia: str, extension: str, contenido: bytes) -> str:
    nombre = f"{referencia}_{datetime.now():%Y%m%d-%H%M%S}_{uuid.uuid4().hex[:8]}{extension}"
    CARPETA_FACTURAS.mkdir(parents=True, exist_ok=True)
    (CARPETA_FACTURAS / nombre).write_bytes(contenido)
    return nombre

@app.get("/pedidos/{id}/factura")
def ver_factura(id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Permiso denegado")
    pedido = db.query(models.PedidoCompra).filter(models.PedidoCompra.id == id).first()
    nombre = archivo_factura_de(pedido) if pedido else None
    if not nombre:
        raise HTTPException(status_code=404, detail="Esta compra no tiene factura adjunta")
    ruta = (CARPETA_FACTURAS / Path(nombre).name).resolve()
    if ruta.parent != CARPETA_FACTURAS or not ruta.is_file():
        raise HTTPException(status_code=404, detail="El archivo de la factura no se encuentra en el servidor")
    return FileResponse(ruta, media_type=mimetypes.guess_type(ruta.name)[0] or "application/octet-stream",
                        headers={"Content-Disposition": f'inline; filename="{ruta.name}"'})

# 8. Get historial de pedidos (estados finales)
@app.get("/pedidos/historial", response_model=List[schemas.PedidoCompraResponse])
def get_historial_pedidos(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Solo admin y gerencia pueden ver historial")

    pedidos = db.query(models.PedidoCompra).filter(
        models.PedidoCompra.estado.in_(["Recibido", "Rechazado", "Postergado"])
    ).order_by(models.PedidoCompra.fecha_creacion.desc()).all()

    return [serializar_pedido(p) for p in pedidos]

# 9. Get pedidos del supervisor actual
@app.get("/pedidos/mis-pedidos", response_model=List[schemas.PedidoCompraResponse])
def get_mis_pedidos(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "supervisor":
        raise HTTPException(status_code=403, detail="Solo supervisores pueden ver sus pedidos")

    pedidos = db.query(models.PedidoCompra).filter(
        models.PedidoCompra.supervisor_id == current_user.id
    ).order_by(models.PedidoCompra.fecha_creacion.desc()).all()

    return [serializar_pedido(p, incluir_cotizaciones=False) for p in pedidos]

# --- CATEGORÍAS DE GASTO (ABM, solo admin escribe) ---

def buscar_categoria_por_nombre(db: Session, nombre: str) -> models.Categoria:
    """Devuelve la categoría con ese nombre (sin distinguir mayúsculas) o 400 si no existe."""
    categoria = db.query(models.Categoria).filter(func.lower(models.Categoria.nombre) == (nombre or "").strip().lower()).first()
    if not categoria:
        raise HTTPException(status_code=400, detail=f"La categoría '{nombre}' no existe. Créela desde Configuración de Categorías.")
    return categoria

@app.get("/categorias/", response_model=List[schemas.CategoriaResponse])
def listar_categorias(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    categorias = db.query(models.Categoria).order_by(models.Categoria.nombre).all()
    usos = dict(db.query(models.Item.categoria_gasto, func.count()).group_by(models.Item.categoria_gasto).all())
    return [{"id": c.id, "nombre": c.nombre, "insumos": usos.get(c.nombre, 0)} for c in categorias]

@app.post("/categorias/", response_model=schemas.CategoriaResponse)
def create_categoria(datos: schemas.CategoriaCreate, db: Session = Depends(get_db), admin: models.Usuario = Depends(require_admin)):
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if db.query(models.Categoria).filter(func.lower(models.Categoria.nombre) == nombre.lower()).first():
        raise HTTPException(status_code=400, detail=f"La categoría '{nombre}' ya existe")
    categoria = models.Categoria(nombre=nombre)
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return {"id": categoria.id, "nombre": categoria.nombre, "insumos": 0}

@app.put("/categorias/{id}", response_model=schemas.CategoriaResponse)
def update_categoria(id: int, datos: schemas.CategoriaUpdate, db: Session = Depends(get_db), admin: models.Usuario = Depends(require_admin)):
    categoria = db.query(models.Categoria).filter(models.Categoria.id == id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    duplicada = db.query(models.Categoria).filter(func.lower(models.Categoria.nombre) == nombre.lower(), models.Categoria.id != id).first()
    if duplicada:
        raise HTTPException(status_code=400, detail=f"La categoría '{nombre}' ya existe")

    # Renombrar actualiza los insumos que la usan, para que sigan apareciendo en los reportes
    insumos = db.query(models.Item).filter(models.Item.categoria_gasto == categoria.nombre).all()
    for item in insumos:
        item.categoria_gasto = nombre
    categoria.nombre = nombre
    db.commit()
    return {"id": categoria.id, "nombre": nombre, "insumos": len(insumos)}

@app.delete("/categorias/{id}")
def delete_categoria(id: int, db: Session = Depends(get_db), admin: models.Usuario = Depends(require_admin)):
    categoria = db.query(models.Categoria).filter(models.Categoria.id == id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    en_uso = db.query(models.Item.id).filter(models.Item.categoria_gasto == categoria.nombre).count()
    if en_uso:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: {en_uso} insumo(s) la usan. Reasígneles otra categoría primero.")
    nombre = categoria.nombre
    db.delete(categoria)
    db.commit()
    return {"mensaje": f"Categoría '{nombre}' eliminada"}

# --- INSUMOS / CATALOGO ---

@app.get("/insumos/", response_model=List[schemas.ItemResponse])
def get_insumos(db: Session = Depends(get_db)):
    return db.query(models.Item).order_by(models.Item.nombre).all()

@app.post("/insumos/", response_model=schemas.ItemResponse)
def create_insumo(item: schemas.ItemCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Permiso denegado")
    categoria = buscar_categoria_por_nombre(db, item.categoria_gasto)
    db_item = models.Item(**{**item.dict(), "categoria_gasto": categoria.nombre})
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/insumos/{id}", response_model=schemas.ItemResponse)
def update_insumo(id: int, item: schemas.ItemUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Permiso denegado")
    db_item = db.query(models.Item).filter(models.Item.id == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    cambios = item.dict(exclude_unset=True)
    if "categoria_gasto" in cambios:
        cambios["categoria_gasto"] = buscar_categoria_por_nombre(db, cambios["categoria_gasto"]).nombre
    for key, value in cambios.items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/insumos/{id}")
def delete_insumo(id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Permiso denegado")
    db_item = db.query(models.Item).filter(models.Item.id == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    # Integridad referencial: un insumo con compras o retiros no se borra para no romper el historial ni los reportes
    tiene_pedidos = db.query(models.PedidoCompra.id).filter(models.PedidoCompra.insumo_id == id).first()
    tiene_movimientos = db.query(models.Movimiento.id).filter(models.Movimiento.item_id == id).first()
    if tiene_pedidos or tiene_movimientos:
        raise HTTPException(status_code=400, detail="No se puede eliminar este insumo porque ya tiene compras o retiros registrados en el historial")

    nombre = db_item.nombre
    db.delete(db_item)
    db.commit()
    return {"mensaje": f"Insumo '{nombre}' eliminado"}

@app.put("/insumos/{id}/descontar")
def descontar_stock(id: int, body: schemas.DescontarStock, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Permiso denegado")
    db_item = db.query(models.Item).filter(models.Item.id == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    if body.cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a cero")
    if body.cantidad > db_item.stock_actual:
        raise HTTPException(status_code=400, detail=f"Stock insuficiente. Disponible: {db_item.stock_actual}")

    if body.tipo_destino == "maquina":
        if body.maquina not in schemas.MAQUINAS_FLOTA:
            raise HTTPException(status_code=400, detail="Seleccione una máquina de la flota oficial")
        retirado_por = (body.retirado_por or "").strip()
        es_supervisor = db.query(models.Usuario).filter(
            models.Usuario.rol == "supervisor", models.Usuario.nombre_completo == retirado_por, models.Usuario.activo.is_(True)
        ).first()
        if not es_supervisor:
            raise HTTPException(status_code=400, detail="Indique el supervisor que retira el insumo")
        destino = {"maquina": body.maquina, "parte_maquina": (body.parte_maquina or "").strip() or None,
                   "retirado_por": retirado_por, "nota_control": None}
    else:
        # Entrega a operario: sin nombres, el detalle nominal queda en la planilla física de EPP
        destino = {"maquina": schemas.DESTINO_EPP, "parte_maquina": None,
                   "retirado_por": schemas.RETIRADO_POR_OPERARIO, "nota_control": schemas.NOTA_CONTROL_EPP}

    db_item.stock_actual -= body.cantidad
    db.add(models.Movimiento(
        item_id=db_item.id,
        tipo_movimiento="salida",
        cantidad=body.cantidad,
        fecha=datetime.now(),
        tipo_destino=body.tipo_destino,
        # El consumo se valúa al costo real de la última compra (neto + IVA)
        precio_unitario_momento=schemas.con_iva(db_item.ultimo_precio_unitario or 0.0, db_item.alicuota_iva),
        **destino
    ))
    db.commit()
    db.refresh(db_item)
    return {"mensaje": "Stock descontado", "stock_actual": db_item.stock_actual}

# --- ITEMS (compatibilidad) ---

@app.get("/items/", response_model=List[schemas.ItemResponse])
def get_items(db: Session = Depends(get_db)):
    return db.query(models.Item).all()

@app.post("/items/", response_model=schemas.ItemResponse)
def create_item(item: schemas.ItemCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Permiso denegado")
    categoria = buscar_categoria_por_nombre(db, item.categoria_gasto)
    db_item = models.Item(**{**item.dict(), "categoria_gasto": categoria.nombre})
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# --- STOCK ---

@app.get("/stock/alertas", response_model=List[schemas.StockAlerta])
def get_stock_alertas(db: Session = Depends(get_db)):
    items = db.query(models.Item).filter(
        models.Item.stock_actual <= models.Item.stock_minimo
    ).all()

    resultado = []
    for item in items:
        deficit = item.stock_minimo - item.stock_actual
        resultado.append({
            **item.__dict__,
            "deficit": deficit
        })
    return resultado

# --- CONTROL DE GASTOS ---

SIN_CATEGORIA = "Sin categoría"

def validar_periodo(anio: Optional[int], mes: Optional[int]):
    if mes and not anio:
        raise HTTPException(status_code=400, detail="Para filtrar por mes debe indicar también el año")

def en_periodo(fecha: Optional[datetime], anio: Optional[int], mes: Optional[int]) -> bool:
    if anio and (not fecha or fecha.year != anio):
        return False
    return not mes or fecha.month == mes

def normalizar(texto: Optional[str]) -> str:
    sin_acentos = unicodedata.normalize("NFD", texto or "").encode("ascii", "ignore").decode()
    return sin_acentos.lower()

@app.get("/gastos/reporte", response_model=schemas.ReporteGastos)
def get_reporte_gastos(
    anio: Optional[int] = None,
    mes: Optional[int] = Query(default=None, ge=1, le=12),
    categoria: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Solo gerencia y admin pueden ver el control de gastos")
    validar_periodo(anio, mes)

    # Un gasto se imputa al mes en que se aprobó la compra
    pedidos = db.query(models.PedidoCompra).filter(
        models.PedidoCompra.estado.in_(schemas.ESTADOS_EN_CAMINO + ["Recibido"]),
        models.PedidoCompra.precio_unitario_final.isnot(None)
    ).order_by(models.PedidoCompra.fecha_aprobacion.desc()).all()

    detalle = []
    for p in pedidos:
        fecha = p.fecha_aprobacion or p.fecha_actualizacion
        if not en_periodo(fecha, anio, mes):
            continue
        cat = p.item.categoria_gasto if p.item else SIN_CATEGORIA
        if categoria and cat != categoria:
            continue
        cantidad = p.cantidad_aprobada or p.cantidad_solicitada
        # Gasto real (lo que se paga) = (precio neto × cantidad) × (1 + alícuota / 100)
        subtotal_neto = round(cantidad * p.precio_unitario_final, 2)
        total_fila = schemas.con_iva(subtotal_neto, p.alicuota_iva)
        detalle.append({
            "pedido_id": p.id,
            "tipo_compra": p.tipo_compra or schemas.TIPO_COMPRA_COTIZACION,
            "numero_comprobante": p.numero_comprobante,
            "cantidad_solicitada": p.cantidad_solicitada,
            "numero_oc": p.orden_compra.numero_oc if p.orden_compra else None,
            "tiene_factura": archivo_factura_de(p) is not None,
            "observaciones": p.observaciones,
            "fecha": fecha,
            "insumo": p.item.nombre if p.item else p.insumo_nuevo_nombre,
            "categoria_gasto": cat,
            "proveedor": p.proveedor_final,
            "cantidad": cantidad,
            "precio_unitario": p.precio_unitario_final,
            "alicuota_iva": p.alicuota_iva,
            "subtotal_neto": subtotal_neto,
            "iva": round(total_fila - subtotal_neto, 2),
            "total": total_fila,
            "estado": p.estado
        })

    total = round(sum(d["total"] for d in detalle), 2)
    total_neto = round(sum(d["subtotal_neto"] for d in detalle), 2)
    # El resumen recorre las categorías de la tabla más cualquier nombre que aparezca en los gastos
    # (cubre insumos nuevos sin categoría y datos anteriores al gestor de categorías)
    categorias = [categoria] if categoria else [c.nombre for c in db.query(models.Categoria).order_by(models.Categoria.nombre)]
    for cat in sorted({d["categoria_gasto"] for d in detalle} - set(categorias)):
        categorias.append(cat)

    por_categoria = []
    for cat in categorias:
        filas = [d for d in detalle if d["categoria_gasto"] == cat]
        subtotal = round(sum(d["total"] for d in filas), 2)
        por_categoria.append({
            "categoria": cat,
            "total": subtotal,
            "porcentaje": round(subtotal * 100 / total, 1) if total else 0.0,
            "cantidad_compras": len(filas)
        })
    por_categoria.sort(key=lambda c: c["total"], reverse=True)

    return {"anio": anio, "mes": mes, "categoria": categoria, "total": total, "total_neto": total_neto,
            "total_iva": round(total - total_neto, 2), "por_categoria": por_categoria, "detalle": detalle}

# --- TRAZABILIDAD DE SALIDAS ---

SIN_DESTINO = "Sin destino registrado" # Salidas anteriores a la trazabilidad

@app.get("/movimientos/salidas", response_model=schemas.ReporteSalidas)
def get_salidas(
    anio: Optional[int] = None,
    mes: Optional[int] = Query(default=None, ge=1, le=12),
    tipo_destino: Optional[str] = None,
    maquina: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if current_user.rol not in ["admin", "gerencia"]:
        raise HTTPException(status_code=403, detail="Solo gerencia y admin pueden ver la trazabilidad de salidas")
    validar_periodo(anio, mes)

    movimientos = db.query(models.Movimiento).filter(
        models.Movimiento.tipo_movimiento == "salida"
    ).order_by(models.Movimiento.fecha.desc(), models.Movimiento.id.desc()).all()

    palabras = normalizar(q).split()
    detalle = []
    for m in movimientos:
        destino = m.maquina or SIN_DESTINO
        if not en_periodo(m.fecha, anio, mes):
            continue
        if tipo_destino and m.tipo_destino != tipo_destino:
            continue
        if maquina and destino != maquina:
            continue
        insumo = m.item.nombre if m.item else None
        if palabras:
            texto = normalizar(" ".join(filter(None, [insumo, m.item.descripcion if m.item else None, destino, m.parte_maquina, m.retirado_por])))
            if not all(p in texto for p in palabras):
                continue
        precio = m.precio_unitario_momento or 0.0
        detalle.append({
            "movimiento_id": m.id,
            "fecha": m.fecha,
            "insumo": insumo,
            "categoria_gasto": m.item.categoria_gasto if m.item else None,
            "cantidad": m.cantidad,
            "precio_unitario": precio,
            "total": round(m.cantidad * precio, 2),
            "tipo_destino": m.tipo_destino,
            "maquina": destino,
            "parte_maquina": m.parte_maquina,
            "retirado_por": m.retirado_por,
            "nota_control": m.nota_control
        })

    if maquina:
        destinos = [maquina]
    elif tipo_destino == "operario":
        destinos = [schemas.DESTINO_EPP]
    else:
        destinos = list(schemas.MAQUINAS_FLOTA) + ([] if tipo_destino == "maquina" else [schemas.DESTINO_EPP])
        if not tipo_destino and any(d["maquina"] == SIN_DESTINO for d in detalle):
            destinos.append(SIN_DESTINO)

    descripciones = {**schemas.MAQUINAS_FLOTA, schemas.DESTINO_EPP: schemas.DESCRIPCION_EPP,
                     SIN_DESTINO: "Retiros registrados antes de la trazabilidad por máquina."}
    total = round(sum(d["total"] for d in detalle), 2)
    por_maquina = []
    for destino in destinos:
        filas = [d for d in detalle if d["maquina"] == destino]
        subtotal = round(sum(d["total"] for d in filas), 2)
        por_maquina.append({
            "maquina": destino,
            "descripcion": descripciones.get(destino),
            "retiros": len(filas),
            "unidades": sum(d["cantidad"] for d in filas),
            "total": subtotal,
            "porcentaje": round(subtotal * 100 / total, 1) if total else 0.0
        })
    por_maquina.sort(key=lambda c: (c["total"], c["unidades"]), reverse=True)

    return {"total": total, "total_unidades": sum(d["cantidad"] for d in detalle), "por_maquina": por_maquina, "detalle": detalle}

# --- SERVICIOS EXTERNOS (reparaciones / afilado) Y STOCK DE SIERRAS: todo el módulo es solo admin ---

servicios_router = APIRouter(prefix="/servicios-externos", tags=["Servicios Externos"], dependencies=[Depends(require_admin)])

def buscar_servicio(db: Session, id: int) -> models.ServicioExterno:
    servicio = db.query(models.ServicioExterno).filter(models.ServicioExterno.id == id).first()
    if not servicio:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    return servicio

@servicios_router.get("/", response_model=List[schemas.ServicioExternoResponse])
def listar_servicios(estado: Optional[str] = Query(None, description="Enviado | Devuelto; vacío = todos"), db: Session = Depends(get_db)):
    query = db.query(models.ServicioExterno)
    if estado:
        query = query.filter(models.ServicioExterno.estado == estado)
    return query.order_by(models.ServicioExterno.fecha_envio.desc(), models.ServicioExterno.id.desc()).all()

@servicios_router.get("/{id}", response_model=schemas.ServicioExternoResponse)
def obtener_servicio(id: int, db: Session = Depends(get_db)):
    return buscar_servicio(db, id)

@servicios_router.post("/", response_model=schemas.ServicioExternoResponse)
def registrar_envio(datos: schemas.ServicioExternoCreate, db: Session = Depends(get_db)):
    servicio = models.ServicioExterno(
        tipo=datos.tipo, descripcion=datos.descripcion, proveedor_destino=datos.proveedor_destino,
        fecha_envio=datos.fecha_envio or datetime.now(), estado=schemas.ESTADO_SERVICIO_ENVIADO
    )
    db.add(servicio)
    db.commit()
    db.refresh(servicio)
    return servicio

@servicios_router.put("/{id}", response_model=schemas.ServicioExternoResponse)
def actualizar_servicio(id: int, datos: schemas.ServicioExternoUpdate, db: Session = Depends(get_db)):
    servicio = buscar_servicio(db, id)
    for campo, valor in datos.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(servicio, campo, valor)
    db.commit()
    db.refresh(servicio)
    return servicio

@servicios_router.put("/{id}/devolver", response_model=schemas.ServicioExternoResponse)
def marcar_devuelto(id: int, db: Session = Depends(get_db)):
    servicio = buscar_servicio(db, id)
    if servicio.estado == schemas.ESTADO_SERVICIO_DEVUELTO:
        raise HTTPException(status_code=400, detail="El envío ya figura como devuelto")
    servicio.estado = schemas.ESTADO_SERVICIO_DEVUELTO
    servicio.fecha_retorno = datetime.now()
    db.commit()
    db.refresh(servicio)
    return servicio

@servicios_router.delete("/{id}")
def eliminar_servicio(id: int, db: Session = Depends(get_db)):
    servicio = buscar_servicio(db, id)
    db.delete(servicio)
    db.commit()
    return {"mensaje": f"Envío '{servicio.descripcion}' eliminado"}

sierras_router = APIRouter(prefix="/sierras", tags=["Sierras"], dependencies=[Depends(require_admin)])

@sierras_router.get("/", response_model=List[schemas.StockSierraResponse])
def listar_sierras(db: Session = Depends(get_db)):
    return db.query(models.StockSierra).order_by(models.StockSierra.diametro.desc()).all()

@sierras_router.put("/{diametro}", response_model=schemas.StockSierraResponse)
def actualizar_stock_sierra(diametro: int, datos: schemas.StockSierraUpdate, db: Session = Depends(get_db)):
    sierra = db.query(models.StockSierra).filter(models.StockSierra.diametro == diametro).first()
    if not sierra:
        raise HTTPException(status_code=404, detail=f"No hay sierras de {diametro} mm registradas")
    sierra.cantidad_disponible = datos.cantidad_disponible
    db.commit()
    db.refresh(sierra)
    return sierra

app.include_router(servicios_router)
app.include_router(sierras_router)

# --- FRONTEND COMPILADO (producción: un solo servicio en el puerto 8001) ---
# Sirve frontend/dist. Las rutas de la API se registraron antes, así que tienen prioridad;
# cualquier otra ruta (/login, /catalogo...) cae acá y devuelve la app de React (SPA).

CARPETA_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as e:
            if e.status_code == 404:
                return await super().get_response("index.html", scope)
            raise

if CARPETA_DIST.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(CARPETA_DIST), html=True), name="spa")