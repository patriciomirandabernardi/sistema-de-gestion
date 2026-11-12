// Estilos de botones compartidos por todas las pantallas

// Columna "Acciones" de las tablas: compactos y sobrios
const BASE_ACCION = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';
const VARIANTES_ACCION = {
  primaria: 'bg-slate-700 border-slate-700 text-white hover:bg-slate-800',
  neutra: 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400',
  peligro: 'bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300'
};
export const claseAccion = (variante = 'neutra') => `${BASE_ACCION} ${VARIANTES_ACCION[variante]}`;

// Barra superior de cada panel
const VARIANTES_HEADER = {
  neutra: 'bg-white/10 hover:bg-white/20 text-white',
  primaria: 'bg-blue-700 hover:bg-blue-800 text-white',
  salir: 'bg-white/10 hover:bg-red-700 text-white'
};
export const claseBotonHeader = (variante = 'neutra') =>
  `inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-semibold transition ${VARIANTES_HEADER[variante]}`;

// Botones principales de la página (exportar, nuevo, cargar...)
const VARIANTES_PAGINA = {
  neutra: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
  primaria: 'bg-blue-800 hover:bg-blue-900 text-white',
  oscura: 'bg-slate-800 hover:bg-slate-900 text-white'
};
export const claseBotonPagina = (variante = 'neutra') =>
  `inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTES_PAGINA[variante]}`;
