// Indicadores de carga y etiquetas compartidas
import { Layers } from 'lucide-react';

// Código del lote del que vino un pedido (los pedidos previos a esta función no tienen)
export function EtiquetaSolicitud({ codigo, className = '' }) {
  if (!codigo) return null;
  return (
    <span title="Solicitud de origen" className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 text-[11px] font-mono font-medium text-slate-600 whitespace-nowrap ${className}`}>
      <Layers size={11} /> {codigo}
    </span>
  );
}

export function Spinner({ className = 'h-8 w-8' }) {
  return <div role="status" aria-label="Cargando" className={`animate-spin rounded-full border-4 border-blue-600 border-t-transparent ${className}`} />;
}

// Spinner centrado dentro de una sección. Aparece con una pequeña demora: si los datos llegan rápido, no se ve nada
export function CargaSeccion() {
  return (
    <div className="flex justify-center py-16 opacity-0 animate-aparecer-demorado">
      <Spinner />
    </div>
  );
}

// Primera carga de una pantalla: mantiene el fondo y la barra superior del panel para que no haya parpadeo
export function PantallaCarga({ subtitulo, header = 'bg-slate-800' }) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className={`${header} text-white p-4 shadow-md`}>
        <h1 className="text-2xl font-bold">IMCAYPER</h1>
        <p className="text-sm text-slate-400">{subtitulo || '\u00a0'}</p>
      </header>
      <CargaSeccion />
    </div>
  );
}
