// Categorías de gasto oficiales de IMCAYPER (mantener sincronizado con backend/schemas.py -> CategoriaGasto)
export const CATEGORIAS_GASTO = [
  'Rodamientos y Retenes',
  'Gases y Soldadura',
  'Discos y Abrasivos',
  'Aceites y Lubricantes',
  'Solventes y Químicos',
  'EPP y Seguridad',
  'Consumibles y Limpieza',
  'Imprenta y Librería',
  'Planta Rosario (General)',
  'Taller Metalúrgico',
  'Camiones',
  'Planta San Luis',
];

// Los insumos de esta categoría se entregan a operarios (el retiro abre en modo "Entrega a Operario")
export const CATEGORIA_EPP = 'EPP y Seguridad';

// Plantel oficial de máquinas (mantener sincronizado con backend/schemas.py -> MAQUINAS_FLOTA)
export const MAQUINAS_FLOTA = [
  { nombre: 'CC1 / SLITTER', descripcion: 'Línea de corte longitudinal de bobinas a flejes (rollos).' },
  { nombre: 'CT1', descripcion: 'Conformadora de tubos (Ø 41.28 a 76.20 mm).' },
  { nombre: 'CT2', descripcion: 'Conformadora de tubos (Ø 21.30 a 60.30 mm).' },
  { nombre: 'W6', descripcion: 'Conformadora de tubos (Ø 48.30 a 60.30 esp. grueso / Ø 73.00 a 152.40 fino y grueso).' },
  { nombre: 'Probadora Hidráulica', descripcion: 'Banco de prueba hidrostática de caños.' },
  { nombre: 'Biseladora Chica', descripcion: 'Proceso de biselado de extremos (línea chica).' },
  { nombre: 'Biseladora Grande', descripcion: 'Proceso de biselado de extremos (línea grande).' },
  { nombre: 'Cuadradora', descripcion: 'Conformado de caño redondo a cuadrado/rectangular.' },
  { nombre: 'Cubas', descripcion: 'Sistema de refrigeración de rolos y lubricación.' },
  { nombre: 'Puentes Grúa', descripcion: 'Equipos de izaje y movimiento de cargas.' },
  { nombre: 'Taller / Uso General', descripcion: 'Mantenimiento general de planta o banco de taller.' },
];

export const DESTINO_EPP = 'EPP / Uso Operario';

// Compras directas pre-aprobadas por Gerencia (mantener sincronizado con backend/schemas.py)
export const TIPO_COMPRA_ABASTECIMIENTO = 'abastecimiento_critico';
export const TIPO_COMPRA_GERENCIA = 'compra_gerencia';

// Motivos del ingreso directo: etiqueta del badge y colores para la huella de auditoría
export const COMPRAS_DIRECTAS = {
  [TIPO_COMPRA_ABASTECIMIENTO]: {
    opcion: 'Abastecimiento Crítico (Gases, EPP, automáticos)',
    etiqueta: 'Abastecimiento Crítico',
    badge: 'bg-indigo-800 text-white',
    fila: 'bg-indigo-50/40'
  },
  [TIPO_COMPRA_GERENCIA]: {
    opcion: 'Compra Directa de Gerencia (Mercadería adquirida espontáneamente fuera del circuito)',
    etiqueta: 'Compra de Gerencia',
    badge: 'bg-orange-600 text-white',
    fila: 'bg-orange-50/60'
  }
};

// Alícuotas de IVA de la factura del proveedor. Los precios con proveedores se negocian NETOS y el IVA se desglosa aparte
export const ALICUOTAS_IVA = [0, 10.5, 21, 27];
export const IVA_POR_DEFECTO = 21;
export const textoAlicuota = (iva) => `${String(iva).replace('.', ',')}%`;

// Redondeo contable a 2 decimales (EPSILON evita errores como 1.005 -> 1.00)
export const redondear2 = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

// Gasto real de una compra: (precio neto × cantidad) × (1 + alícuota / 100). Misma fórmula que el backend (schemas.con_iva)
export const totalConIva = (precioNeto, cantidad, alicuota) =>
  redondear2(redondear2((Number(precioNeto) || 0) * (Number(cantidad) || 0)) * (1 + (alicuota ?? IVA_POR_DEFECTO) / 100));

// Desglose de una factura a partir del subtotal neto: { subtotal, iva, total }
export const desgloseIva = (subtotalNeto, alicuota) => {
  const subtotal = redondear2(subtotalNeto);
  const iva = redondear2(subtotal * alicuota / 100);
  return { subtotal, iva, total: redondear2(subtotal + iva) };
};

// null si es una compra del circuito de cotización
export const compraDirecta = (pedido) => COMPRAS_DIRECTAS[pedido?.tipo_compra] || null;

export const ESTADO_OC_EMITIDA = 'OC_Emitida';

// Colores de los estados de pedido (compartidos por todos los paneles)
export const BADGE_ESTADO = {
  'Pendiente_Cotizacion': 'bg-yellow-100 text-yellow-700',
  'Pendiente_Aprobacion': 'bg-blue-100 text-blue-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'OC_Emitida': 'bg-teal-100 text-teal-800',
  'Recibido': 'bg-gray-100 text-gray-700',
  'Rechazado': 'bg-red-100 text-red-700',
  'Postergado': 'bg-orange-100 text-orange-700'
};

export const textoEstado = (estado) => estado === ESTADO_OC_EMITIDA ? 'OC Emitida' : (estado || '').replace('_', ' ');

export const numeroRequerimiento = (id) => `REQ-${String(id).padStart(4, '0')}`;

// "5 (de 10 solicitados)" cuando Gerencia aprobó una cantidad distinta a la pedida
export const textoCantidades = (pedido) => {
  const aprobada = pedido.cantidad_aprobada ?? pedido.cantidad_solicitada;
  return aprobada !== pedido.cantidad_solicitada ? `${aprobada} (de ${pedido.cantidad_solicitada} solicitados)` : `${aprobada}`;
};

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const formatearMoneda = (valor) => formateadorMoneda.format(valor || 0);

// Quita acentos y pasa a minúsculas: "rodamiento" encuentra "Rodamiento" y "oxigeno" encuentra "Oxígeno"
export const normalizarTexto = (texto) => (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// true si cada palabra de la búsqueda aparece en alguno de los textos
export const coincideBusqueda = (busqueda, ...textos) => {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  const contenido = normalizarTexto(textos.filter(Boolean).join(' '));
  return palabras.every(p => contenido.includes(p));
};

export const formatearFecha = (fecha) => fecha ? new Date(fecha).toLocaleDateString('es-AR') : '-';

// "10 u. × $ 5.000,00 c/u = $ 50.000,00" (para PDFs y textos planos)
export const textoCalculo = (cantidad, unitario) =>
  `${cantidad} u. × ${formatearMoneda(unitario)} c/u = ${formatearMoneda(cantidad * unitario)}`;

export const getRolActual = () => {
  try {
    return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).rol;
  } catch {
    return null;
  }
};
