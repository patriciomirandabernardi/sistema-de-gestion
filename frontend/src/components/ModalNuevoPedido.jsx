import { useState, useMemo } from 'react';
import { createSolicitud, mensajeError } from '../api';
import { coincideBusqueda } from '../constants';
import { ClipboardList, Plus, Trash2, X, MapPin } from 'lucide-react';

const MAX_SUGERENCIAS = 8;
const MAX_FILAS = 30; // Mismo límite que el backend (schemas.MAX_ITEMS_SOLICITUD)

const claseInput = 'w-full border border-slate-300 rounded-md p-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none';

// Mismos valores que backend/schemas.py -> ItemSolicitud.criticidad
const CRITICIDADES = ['Baja', 'Normal', 'Alta'];
const COLOR_CRITICIDAD = { Alta: 'border-red-300 bg-red-50 text-red-800', Normal: '', Baja: 'text-slate-500' };

// Columnas de cada fila: Insumo · Cantidad · Criticidad · Justificación · Quitar
const GRILLA_FILA = 'grid grid-cols-[minmax(0,1.4fr)_5.5rem_7.5rem_minmax(0,1fr)_2.25rem] gap-2';

let ultimaClave = 0;
// Cada fila es un insumo del catálogo (insumo) o uno nuevo que no existe todavía (nombreNuevo)
const filaVacia = () => ({ clave: ++ultimaClave, insumo: null, nombreNuevo: '', cantidad: '1', criticidad: 'Normal', justificacion: '' });

// Buscador de una fila: teclado (flechas / Enter / Esc) y opción de pedir un insumo que no está en el catálogo
function BuscadorInsumo({ insumos, excluidos, fila, onCambiar }) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const sugerencias = useMemo(() => (busqueda.trim()
    ? insumos.filter(i => !excluidos.has(i.id) && coincideBusqueda(busqueda, i.nombre, i.ubicacion_uso, i.descripcion)).slice(0, MAX_SUGERENCIAS)
    : []), [busqueda, insumos, excluidos]);
  const opciones = busqueda.trim() ? [...sugerencias, { nuevo: true }] : [];

  const elegir = (opcion) => {
    onCambiar(opcion.nuevo ? { insumo: null, nombreNuevo: busqueda.trim() } : { insumo: opcion, nombreNuevo: '' });
    setBusqueda('');
    setAbierto(false);
  };

  if (fila.insumo || fila.nombreNuevo) {
    return (
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border border-slate-300 bg-white rounded-md min-h-[42px]">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{fila.insumo ? fila.insumo.nombre : fila.nombreNuevo}</p>
          {fila.insumo?.ubicacion_uso && (
            <p className="text-[11px] text-slate-500 truncate inline-flex items-center gap-1"><MapPin size={11} /> {fila.insumo.ubicacion_uso}</p>
          )}
          {!fila.insumo && <p className="text-[11px] text-blue-700">Insumo nuevo (no está en el catálogo)</p>}
        </div>
        <button type="button" onClick={() => onCambiar({ insumo: null, nombreNuevo: '' })}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md shrink-0" title="Cambiar insumo" aria-label="Cambiar insumo">
          <X size={14} />
        </button>
      </div>
    );
  }

  const alTeclear = (e) => {
    if (!abierto || opciones.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((activo + 1) % opciones.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((activo - 1 + opciones.length) % opciones.length); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(opciones[activo]); }
    else if (e.key === 'Escape') setAbierto(false);
  };

  return (
    <div className="relative">
      <input type="text" value={busqueda} autoComplete="off" placeholder="Buscar... Ej: rodamiento"
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true); setActivo(0); }}
        onFocus={() => setAbierto(true)} onBlur={() => setAbierto(false)} onKeyDown={alTeclear} className={claseInput} />
      {abierto && opciones.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-64 overflow-y-auto text-sm">
          {opciones.map((opcion, idx) => (
            <li key={opcion.nuevo ? 'nuevo' : opcion.id}
              onMouseDown={(e) => { e.preventDefault(); elegir(opcion); }} onMouseEnter={() => setActivo(idx)}
              className={`px-3 py-2 cursor-pointer ${idx === activo ? 'bg-slate-100' : ''} ${opcion.nuevo ? 'border-t text-blue-700' : ''}`}>
              {opcion.nuevo ? (
                <><Plus size={13} className="inline -mt-0.5 mr-1" />No está en la lista: pedir "<span className="font-semibold">{busqueda.trim()}</span>" como insumo nuevo</>
              ) : (
                <>
                  <span className="font-medium text-slate-800">{opcion.nombre}</span>
                  {opcion.ubicacion_uso && <span className="text-slate-500"> ({opcion.ubicacion_uso})</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Pedido de compra en lote: el supervisor carga varios insumos en una sola solicitud.
// Cada fila se convierte en un pedido individual (se cotiza y aprueba por separado) con el mismo código de solicitud.
export default function ModalNuevoPedido({ insumos, onCerrar, onCreado }) {
  const [filas, setFilas] = useState(() => [filaVacia()]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const actualizarFila = (clave, cambios) => setFilas(fs => fs.map(f => (f.clave === clave ? { ...f, ...cambios } : f)));
  const quitarFila = (clave) => setFilas(fs => (fs.length > 1 ? fs.filter(f => f.clave !== clave) : fs));
  const agregarFila = () => setFilas(fs => (fs.length < MAX_FILAS ? [...fs, filaVacia()] : fs));
  const excluidosPara = (clave) => new Set(filas.filter(f => f.clave !== clave && f.insumo).map(f => f.insumo.id));

  const validar = () => {
    const nuevos = new Set();
    for (const [i, f] of filas.entries()) {
      const n = `Fila ${i + 1}`;
      if (!f.insumo && !f.nombreNuevo) return `${n}: buscá el insumo y elegilo de la lista.`;
      const cantidad = Number(f.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1) return `${n}: la cantidad debe ser un número entero mayor a cero.`;
      if (!f.insumo) {
        const nombre = f.nombreNuevo.toLowerCase();
        if (nuevos.has(nombre)) return `${n}: el insumo "${f.nombreNuevo}" está repetido; sumá las cantidades en una sola fila.`;
        nuevos.add(nombre);
      }
    }
    return '';
  };

  const confirmar = async (e) => {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    setError('');
    setEnviando(true);
    try {
      const resultado = await createSolicitud(filas.map(f => ({
        insumo_id: f.insumo?.id ?? null,
        insumo_nuevo_nombre: f.insumo ? null : f.nombreNuevo,
        cantidad_solicitada: Number(f.cantidad),
        criticidad: f.criticidad,
        observaciones: f.justificacion.trim() || null
      })));
      onCreado(resultado);
    } catch (err) {
      setError(err?.response?.status === 401 ? 'La sesión expiró. Iniciá sesión nuevamente.' : mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-aparecer">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl p-6 max-h-[94vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><ClipboardList size={22} className="text-slate-500" /> Nuevo Pedido de Compra</h2>
        <p className="text-sm text-slate-600 mb-5">Cargá todos los insumos que necesitás. Cada uno se cotiza y aprueba por separado, pero quedan vinculados por un mismo código de solicitud.</p>

        <form onSubmit={confirmar} className="space-y-5" noValidate>
          <section>
            <div className={`${GRILLA_FILA} px-1 mb-1 text-xs font-semibold text-slate-500 uppercase`}>
              <span>Insumo</span>
              <span>Cantidad</span>
              <span>Criticidad</span>
              <span>Justificación (opcional)</span>
              <span />
            </div>
            <div className="space-y-2">
              {filas.map((f, i) => (
                <div key={f.clave} className={`${GRILLA_FILA} items-start`}>
                  <BuscadorInsumo insumos={insumos} excluidos={excluidosPara(f.clave)} fila={f}
                    onCambiar={(cambios) => actualizarFila(f.clave, cambios)} />
                  <input type="number" min="1" step="1" value={f.cantidad} aria-label={`Cantidad fila ${i + 1}`}
                    onChange={(e) => actualizarFila(f.clave, { cantidad: e.target.value })} className={`${claseInput} text-right`} />
                  <select value={f.criticidad} aria-label={`Criticidad fila ${i + 1}`}
                    onChange={(e) => actualizarFila(f.clave, { criticidad: e.target.value })}
                    className={`${claseInput} ${COLOR_CRITICIDAD[f.criticidad]}`}>
                    {CRITICIDADES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" value={f.justificacion} maxLength={500} placeholder="Ej: cambio de rodamiento CT1" aria-label={`Justificación fila ${i + 1}`}
                    onChange={(e) => actualizarFila(f.clave, { justificacion: e.target.value })} className={claseInput} />
                  <button type="button" onClick={() => quitarFila(f.clave)} disabled={filas.length === 1}
                    className="h-[42px] inline-flex items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Quitar insumo" aria-label={`Quitar fila ${i + 1}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={agregarFila} disabled={filas.length >= MAX_FILAS}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-dashed border-slate-400 text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <Plus size={15} /> Agregar otro insumo
            </button>
          </section>

          {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md">Cancelar</button>
            <button type="submit" disabled={enviando} className="inline-flex items-center gap-2 px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-md disabled:bg-slate-300">
              <ClipboardList size={16} /> {enviando ? 'Enviando...' : `Enviar Solicitud (${filas.length} ${filas.length === 1 ? 'insumo' : 'insumos'})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
