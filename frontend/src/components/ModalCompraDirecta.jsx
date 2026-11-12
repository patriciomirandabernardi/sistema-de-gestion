import { useState } from 'react';
import { createCompraDirecta, mensajeError } from '../api';
import { coincideBusqueda, formatearMoneda, COMPRAS_DIRECTAS, TIPO_COMPRA_GERENCIA, ALICUOTAS_IVA, IVA_POR_DEFECTO, redondear2, totalConIva, textoAlicuota } from '../constants';
import { PackagePlus, TriangleAlert, Plus, Trash2, X } from 'lucide-react';

const MAX_RESULTADOS = 8;
const MAX_FILAS = 50; // Mismo límite que el backend

const claseInput = 'w-full border border-slate-300 rounded-md p-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none';

let ultimaClave = 0;
const filaVacia = () => ({ clave: ++ultimaClave, insumo: null, cantidad: '1', precio: '' });

const numero = (v) => parseFloat(v) || 0;
const subtotalFila = (f) => numero(f.cantidad) * numero(f.precio);

// Buscador de insumo de una fila. Oculta los que ya están en otras filas para no duplicar renglones
function SelectorInsumo({ insumos, excluidos, insumo, onElegir }) {
  const [busqueda, setBusqueda] = useState('');

  if (insumo) {
    return (
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border border-slate-300 bg-white rounded-md min-h-[42px]">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{insumo.nombre}</p>
          <p className="text-[11px] text-slate-500 truncate">
            Stock: {insumo.stock_actual}
            {insumo.ultimo_precio_unitario > 0 && ` · Última compra: ${formatearMoneda(insumo.ultimo_precio_unitario)} neto c/u (+IVA ${textoAlicuota(insumo.alicuota_iva)})`}
          </p>
        </div>
        <button type="button" onClick={() => onElegir(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-md shrink-0" title="Cambiar insumo" aria-label="Cambiar insumo">
          <X size={14} />
        </button>
      </div>
    );
  }

  const resultados = busqueda.trim()
    ? insumos.filter(i => !excluidos.has(i.id) && coincideBusqueda(busqueda, i.nombre, i.descripcion, i.ubicacion_uso, i.categoria_gasto)).slice(0, MAX_RESULTADOS)
    : [];

  return (
    <div className="relative">
      <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoComplete="off"
        placeholder='Buscar insumo... Ej: "oxígeno", "guantes"' className={claseInput} />
      {resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {resultados.map(i => (
            <li key={i.id} onMouseDown={(e) => { e.preventDefault(); setBusqueda(''); onElegir(i); }}
              className="px-3 py-2 cursor-pointer hover:bg-slate-100 text-sm">
              <span className="font-medium text-slate-800">{i.nombre}</span>
              <span className="text-xs text-slate-500"> · {i.categoria_gasto}</span>
            </li>
          ))}
        </ul>
      )}
      {busqueda.trim() && resultados.length === 0 && (
        <p className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow p-2 text-xs text-slate-500">
          Sin coincidencias. Si es un insumo nuevo, dalo de alta primero con "Nuevo Insumo".
        </p>
      )}
    </div>
  );
}

// Ingreso directo: un remito/factura con uno o varios insumos, por Abastecimiento Crítico o Compra Directa de Gerencia.
// Los precios se cargan SIN IVA; al registrar se guarda el precio unitario final con IVA (gasto real).
export default function ModalCompraDirecta({ insumos, onCerrar, onRegistrado }) {
  const [motivo, setMotivo] = useState('');
  const [filas, setFilas] = useState(() => [filaVacia()]);
  const [iva, setIva] = useState(IVA_POR_DEFECTO);
  const [proveedor, setProveedor] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Misma cuenta que el backend: cada renglón (neto × cantidad) × (1 + IVA), redondeado a 2 decimales
  const subtotal = redondear2(filas.reduce((s, f) => s + redondear2(subtotalFila(f)), 0));
  const total = redondear2(filas.reduce((s, f) => s + totalConIva(f.precio, f.cantidad, iva), 0));
  const montoIva = redondear2(total - subtotal);

  const actualizarFila = (clave, cambios) => setFilas(fs => fs.map(f => (f.clave === clave ? { ...f, ...cambios } : f)));
  const quitarFila = (clave) => setFilas(fs => (fs.length > 1 ? fs.filter(f => f.clave !== clave) : fs));
  const agregarFila = () => setFilas(fs => (fs.length < MAX_FILAS ? [...fs, filaVacia()] : fs));

  const elegirInsumo = (clave, insumo) => {
    actualizarFila(clave, { insumo });
    if (insumo?.ultimo_proveedor && !proveedor.trim()) setProveedor(insumo.ultimo_proveedor);
  };

  // Devuelve el primer problema encontrado, indicando la fila
  const validar = () => {
    if (!motivo) return 'Indicá el motivo del ingreso directo.';
    for (const [i, f] of filas.entries()) {
      const n = `Fila ${i + 1}`;
      if (!f.insumo) return `${n}: elegí el insumo.`;
      const cantidad = Number(f.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1) return `${n}: la cantidad debe ser un número entero mayor a cero.`;
      if (!(numero(f.precio) > 0)) return `${n}: el precio unitario debe ser mayor a cero.`;
    }
    if (!proveedor.trim()) return 'Indicá el proveedor.';
    return '';
  };

  const confirmar = async (e) => {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    setError('');
    setEnviando(true);

    // Precio neto y alícuota por separado: el backend guarda ambos y calcula el gasto real con IVA
    const items = filas.map(f => ({
      insumo_id: f.insumo.id,
      cantidad: Number(f.cantidad),
      precio_unitario: redondear2(numero(f.precio)),
      alicuota_iva: iva
    }));
    const datos = new FormData();
    datos.append('items', JSON.stringify(items));
    datos.append('proveedor', proveedor.trim());
    datos.append('motivo', motivo);
    datos.append('numero_comprobante', comprobante.trim());
    if (archivo) datos.append('archivo', archivo);

    try {
      onRegistrado(await createCompraDirecta(datos));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const excluidosPara = (clave) => new Set(filas.filter(f => f.clave !== clave && f.insumo).map(f => f.insumo.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[94vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><PackagePlus size={22} className="text-slate-500" /> Cargar Remito/Factura (Ingreso Directo)</h2>
        <p className="text-sm text-slate-600 mb-5">Ingreso fuera del circuito de cotización: impacta stock y gasto en un solo paso.</p>

        <form onSubmit={confirmar} className="space-y-5" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo del Ingreso directo</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
              className={`${claseInput} ${motivo === TIPO_COMPRA_GERENCIA ? 'border-orange-500' : ''}`}>
              <option value="" disabled>Seleccioná el motivo...</option>
              {Object.entries(COMPRAS_DIRECTAS).map(([valor, m]) => <option key={valor} value={valor}>{m.opcion}</option>)}
            </select>
            {motivo && (
              <p className="text-xs mt-1">
                Quedará registrado como <span className={`px-2 py-0.5 rounded font-bold ${COMPRAS_DIRECTAS[motivo].badge}`}>{COMPRAS_DIRECTAS[motivo].etiqueta}</span>
              </p>
            )}
          </div>

          {/* Renglones del comprobante */}
          <section>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_9rem_8rem_2.25rem] gap-2 px-1 mb-1 text-xs font-semibold text-slate-500 uppercase">
              <span>Insumo</span>
              <span>Cantidad</span>
              <span>P. Unit. sin IVA ($)</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>
            <div className="space-y-2">
              {filas.map((f, i) => (
                <div key={f.clave} className="grid grid-cols-[minmax(0,1fr)_6rem_9rem_8rem_2.25rem] gap-2 items-start">
                  <SelectorInsumo insumos={insumos} excluidos={excluidosPara(f.clave)} insumo={f.insumo}
                    onElegir={(insumo) => elegirInsumo(f.clave, insumo)} />
                  <input type="number" min="1" step="1" value={f.cantidad} aria-label={`Cantidad fila ${i + 1}`}
                    onChange={(e) => actualizarFila(f.clave, { cantidad: e.target.value })} className={`${claseInput} text-right`} />
                  <input type="number" min="0.01" step="0.01" value={f.precio} placeholder="0,00" aria-label={`Precio unitario sin IVA fila ${i + 1}`}
                    onChange={(e) => actualizarFila(f.clave, { precio: e.target.value })} className={`${claseInput} text-right`} />
                  <p className="text-right text-sm font-semibold text-slate-800 pt-2.5 whitespace-nowrap">{formatearMoneda(subtotalFila(f))}</p>
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

          {/* IVA y totales */}
          <section className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">IVA de la factura</label>
              <select value={iva} onChange={(e) => setIva(Number(e.target.value))} className={`${claseInput} w-40`}>
                {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{String(a).replace('.', ',')}%</option>)}
              </select>
            </div>
            <dl className="min-w-[18rem] text-sm space-y-1">
              <div className="flex justify-between gap-6"><dt className="text-slate-600">Subtotal (sin IVA)</dt><dd className="font-medium text-slate-800">{formatearMoneda(subtotal)}</dd></div>
              <div className="flex justify-between gap-6"><dt className="text-slate-600">IVA ({String(iva).replace('.', ',')}%)</dt><dd className="font-medium text-slate-800">{formatearMoneda(montoIva)}</dd></div>
              <div className="flex justify-between gap-6 border-t pt-1.5 text-base"><dt className="font-bold text-slate-900">Total Final</dt><dd className="font-bold text-slate-900">{formatearMoneda(total)}</dd></div>
            </dl>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
              <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej: Air Liquide" className={claseInput} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nº de Comprobante</label>
              <input type="text" value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="Ej: R-0001-00012345" className={claseInput} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Archivo del remito / factura (opcional)</label>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setArchivo(e.target.files[0] || null)}
              className="w-full text-sm border border-slate-300 rounded-md p-2 bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-700 file:text-white" />
            <p className="text-xs text-slate-500 mt-1">PDF o foto del comprobante, hasta 10 MB. Queda asociado a todos los insumos cargados.</p>
          </div>

          {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md">Cancelar</button>
            <button type="submit" disabled={enviando} className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-md disabled:bg-slate-300">
              <PackagePlus size={16} /> {enviando ? 'Registrando...' : `Registrar Ingreso (${filas.length} ${filas.length === 1 ? 'insumo' : 'insumos'})`}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 border-t pt-3 flex gap-1.5">
            <TriangleAlert size={13} className="shrink-0 text-amber-600" />
            Esta acción registra el gasto directo con IVA incluido e impacta el stock bajo la política de {motivo === TIPO_COMPRA_GERENCIA ? 'Compra Directa de Gerencia (Excepción)' : 'Abastecimiento Crítico'}.
          </p>
        </form>
      </div>
    </div>
  );
}
