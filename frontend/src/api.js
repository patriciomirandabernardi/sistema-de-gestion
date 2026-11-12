// En producción el backend sirve también el frontend (mismo origen, puerto 8001).
// En desarrollo (npm run dev) el frontend corre en 5173 y apunta al backend por IP.
const API_BASE = import.meta.env.PROD ? '' : 'http://140.191.1.137:8001';

// Helper para obtener el token
const getToken = () => localStorage.getItem('token');

// Helper para llamadas autenticadas
const authenticatedFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };
  return fetch(url, { ...options, headers });
};

// Igual que authenticatedFetch pero lanza { response, data } si el backend responde con error
const fetchJson = async (url, options = {}) => {
  const response = await authenticatedFetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw { response, data };
  // La API siempre responde JSON. Otra cosa (ej. el HTML del frontend por un endpoint que el backend viejo no tiene) es un error
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw { response, data: { detail: 'El servidor no reconoció la llamada: reiniciá el backend para usar esta función' } };
  }
  return data;
};

// Convierte el error de fetchJson en un texto legible (incluye validaciones 422 de FastAPI)
export const mensajeError = (err) => {
  const detail = err?.data?.detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || d).join(', ');
  return detail || err?.message || 'Error inesperado';
};

// Pedidos de Compra
export const createPedido = async (pedido) => {
  const response = await authenticatedFetch(`${API_BASE}/pedidos/`, {
    method: 'POST',
    body: JSON.stringify(pedido)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw { response, data: errorData };
  }

  return response.json();
};

// Solicitud en lote del supervisor: items = [{ insumo_id | insumo_nuevo_nombre, cantidad_solicitada, criticidad, observaciones }]
// Devuelve { codigo_solicitud, pedidos }
export const createSolicitud = (items) =>
  fetchJson(`${API_BASE}/pedidos/bulk`, { method: 'POST', body: JSON.stringify({ items }) });

export const getPedidosPendientesCotizacion = async () => {
  const response = await authenticatedFetch(`${API_BASE}/pedidos/pendientes-cotizacion`);
  return response.json();
};

export const agregarCotizaciones = (pedidoId, cotizaciones) =>
  fetchJson(`${API_BASE}/pedidos/${pedidoId}/cotizaciones`, {
    method: 'POST',
    body: JSON.stringify(cotizaciones)
  });

export const getPedidosPendientesAprobacion = async () => {
  const response = await authenticatedFetch(`${API_BASE}/pedidos/pendientes-aprobacion`);
  return response.json();
};

export const aprobarPedido = (pedidoId, aprobacion) =>
  fetchJson(`${API_BASE}/pedidos/${pedidoId}/aprobar`, {
    method: 'PUT',
    body: JSON.stringify(aprobacion)
  });

// Reactiva un pedido Postergado: destino 'aprobacion' (vuelve a Gerencia) o 'cotizacion' (vuelve a Compras)
export const reactivarPedido = (pedidoId, destino) =>
  fetchJson(`${API_BASE}/pedidos/${pedidoId}/reactivar`, {
    method: 'PUT',
    body: JSON.stringify({ destino })
  });

// Categorías de gasto (listado dinámico; el ABM es solo admin)
export const getCategorias = () => fetchJson(`${API_BASE}/categorias/`);

export const createCategoria = (nombre) =>
  fetchJson(`${API_BASE}/categorias/`, { method: 'POST', body: JSON.stringify({ nombre }) });

export const updateCategoria = (id, nombre) =>
  fetchJson(`${API_BASE}/categorias/${id}`, { method: 'PUT', body: JSON.stringify({ nombre }) });

export const deleteCategoria = (id) =>
  fetchJson(`${API_BASE}/categorias/${id}`, { method: 'DELETE' });

// datos: { precio_unitario (neto), alicuota_iva, categoria_gasto?, ubicacion_uso? }
export const recibirPedido = (pedidoId, datos = {}) =>
  fetchJson(`${API_BASE}/pedidos/${pedidoId}/recibir`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });

// filtros: { anio?, mes?, categoria? } — los vacíos se omiten
export const getReporteGastos = (filtros = {}) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null));
  return fetchJson(`${API_BASE}/gastos/reporte?${params}`);
};

export const getPedidosAprobados = async () => {
  const response = await authenticatedFetch(`${API_BASE}/pedidos/aprobados`);
  return response.json();
};

export const getHistorialPedidos = async () => {
  const response = await authenticatedFetch(`${API_BASE}/pedidos/historial`);
  return response.json();
};

export const getMisPedidos = async () => {
  const response = await authenticatedFetch(`${API_BASE}/pedidos/mis-pedidos`);
  return response.json();
};

// Stock
export const getStockAlertas = async () => {
  const response = await authenticatedFetch(`${API_BASE}/stock/alertas`);
  return response.json();
};

export const getItems = async () => {
  const response = await authenticatedFetch(`${API_BASE}/items/`);
  return response.json();
};

// Insumos / Catálogo
export const getInsumos = async () => {
  const response = await authenticatedFetch(`${API_BASE}/insumos/`);
  return response.json();
};

export const createInsumo = async (insumo) => {
  const response = await authenticatedFetch(`${API_BASE}/insumos/`, {
    method: 'POST',
    body: JSON.stringify(insumo)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw { response, data: errorData };
  }
  return response.json();
};

export const updateInsumo = async (id, insumo) => {
  const response = await authenticatedFetch(`${API_BASE}/insumos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(insumo)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw { response, data: errorData };
  }
  return response.json();
};

// Órdenes de Compra
// La alícuota de IVA queda guardada en la OC y en cada pedido (los precios son netos)
export const emitirOrdenCompra = (pedidoIds, alicuotaIva) =>
  fetchJson(`${API_BASE}/ordenes-compra/`, {
    method: 'POST',
    body: JSON.stringify({ pedido_ids: pedidoIds, alicuota_iva: alicuotaIva })
  });

export const getOrdenesCompra = () => fetchJson(`${API_BASE}/ordenes-compra/`);

// Facturas digitales (PDF o imagen). Se envía como multipart: no se fija Content-Type para que el navegador ponga el boundary
export const subirFactura = async (pedidoId, archivo) => {
  const datos = new FormData();
  datos.append('archivo', archivo);
  const response = await fetch(`${API_BASE}/pedidos/${pedidoId}/factura`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: datos
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw { response, data };
  return data;
};

// Abre la factura en otra pestaña. Se descarga con el token (no hay URL pública) y se muestra como blob.
// La pestaña se abre antes del fetch para que el navegador no la bloquee como ventana emergente.
export const abrirFactura = async (pedidoId) => {
  const pestana = window.open('', '_blank');
  try {
    const response = await fetch(`${API_BASE}/pedidos/${pedidoId}/factura`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw { response, data };
    }
    const url = URL.createObjectURL(await response.blob());
    if (pestana) pestana.location.href = url;
    else window.location.href = url;
  } catch (err) {
    pestana?.close();
    alert(`No se pudo abrir la factura: ${mensajeError(err)}`);
  }
};

// Ingreso directo (multipart): FormData con items (JSON de { insumo_id, cantidad, precio_unitario (neto), alicuota_iva }),
// proveedor, motivo, numero_comprobante? y archivo?. Devuelve { pedidos, total, tiene_factura }
export const createCompraDirecta = async (formData) => {
  const response = await fetch(`${API_BASE}/compras-directas/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw { response, data };
  return data;
};

export const deleteInsumo = (id) => fetchJson(`${API_BASE}/insumos/${id}`, { method: 'DELETE' });

// datos: { cantidad, tipo_destino: 'maquina' | 'operario', maquina?, parte_maquina?, retirado_por? }
export const descontarInsumo = (id, datos) =>
  fetchJson(`${API_BASE}/insumos/${id}/descontar`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });

export const getSupervisores = () => fetchJson(`${API_BASE}/usuarios/supervisores`);

// Gestión de usuarios (solo admin)
export const getUsuarioActual = () => fetchJson(`${API_BASE}/usuarios/me`);

export const getUsuarios = () => fetchJson(`${API_BASE}/usuarios/`);

// usuario: { username, password, rol, nombre_completo? }
export const createUsuario = (usuario) =>
  fetchJson(`${API_BASE}/usuarios/`, { method: 'POST', body: JSON.stringify(usuario) });

export const resetPasswordUsuario = (id, password) =>
  fetchJson(`${API_BASE}/usuarios/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) });

// Devuelve { mensaje, accion: 'eliminado' | 'baja' }
export const deleteUsuario = (id) => fetchJson(`${API_BASE}/usuarios/${id}`, { method: 'DELETE' });

// Servicios externos (reparaciones / afilado) y stock de sierras — solo admin
// estado: 'Enviado' | 'Devuelto' | '' (todos)
export const getServiciosExternos = (estado = '') =>
  fetchJson(`${API_BASE}/servicios-externos/${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`);

// envio: { tipo, descripcion, proveedor_destino, fecha_envio? }
export const registrarEnvio = (envio) =>
  fetchJson(`${API_BASE}/servicios-externos/`, { method: 'POST', body: JSON.stringify(envio) });

export const marcarDevuelto = (id) =>
  fetchJson(`${API_BASE}/servicios-externos/${id}/devolver`, { method: 'PUT' });

export const deleteServicioExterno = (id) =>
  fetchJson(`${API_BASE}/servicios-externos/${id}`, { method: 'DELETE' });

export const getStockSierras = () => fetchJson(`${API_BASE}/sierras/`);

export const updateStockSierra = (diametro, cantidad) =>
  fetchJson(`${API_BASE}/sierras/${diametro}`, { method: 'PUT', body: JSON.stringify({ cantidad_disponible: cantidad }) });

// filtros: { anio?, mes?, tipo_destino?, maquina?, q? } — los vacíos se omiten
export const getSalidas = (filtros = {}) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null));
  return fetchJson(`${API_BASE}/movimientos/salidas?${params}`);
};

// Login: usuario (Gerencia: "Miguel"; resto: legajo) + contraseña. Lanza { response, data } si las credenciales no son válidas
export const login = async (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username.trim());
  formData.append('password', password);

  const response = await fetch(`${API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw { response, data };
  return data;
};
