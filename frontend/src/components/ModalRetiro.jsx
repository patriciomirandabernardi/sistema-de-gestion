import { useState, useEffect } from 'react';
import { descontarInsumo, getSupervisores, mensajeError } from '../api';
import { MAQUINAS_FLOTA, CATEGORIA_EPP, totalConIva } from '../constants';
import CalculoPrecio from './CalculoPrecio';
import { Wrench, HardHat, MapPin, ClipboardList } from 'lucide-react';

const MODO_MAQUINA = 'maquina';
const MODO_OPERARIO = 'operario';

export default function ModalRetiro({ insumo, onCerrar, onRetirado }) {
  const [modo, setModo] = useState(insumo.categoria_gasto === CATEGORIA_EPP ? MODO_OPERARIO : MODO_MAQUINA);
  const [cantidad, setCantidad] = useState(1);
  const [supervisores, setSupervisores] = useState([]);
  const [supervisor, setSupervisor] = useState('');
  const [maquina, setMaquina] = useState('');
  const [parte, setParte] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getSupervisores()
      .then(lista => setSupervisores(lista.map(s => s.nombre_completo)))
      .catch(err => setError(`No se pudo cargar la lista de supervisores: ${mensajeError(err)}`));
  }, []);

  const confirmar = async (e) => {
    e.preventDefault();
    setError('');
    if (modo === MODO_MAQUINA && !supervisor) return setError('Elegí el supervisor que retira.');
    if (modo === MODO_MAQUINA && !maquina) return setError('Elegí la máquina destino.');

    setEnviando(true);
    try {
      await descontarInsumo(insumo.id, modo === MODO_MAQUINA
        ? { cantidad, tipo_destino: MODO_MAQUINA, maquina, parte_maquina: parte, retirado_por: supervisor }
        : { cantidad, tipo_destino: MODO_OPERARIO });
      onRetirado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const claseTab = (activo) =>
    `flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold border transition ${activo ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-xl font-bold">Retirar: {insumo.nombre}</h2>
        <p className="text-sm text-slate-600 mb-4">Disponible: <span className="font-bold">{insumo.stock_actual}</span> u.</p>

        <div className="flex gap-2 mb-5">
          <button type="button" onClick={() => setModo(MODO_MAQUINA)} className={claseTab(modo === MODO_MAQUINA)}>
            <Wrench size={16} /> Para Máquina (Supervisor)
          </button>
          <button type="button" onClick={() => setModo(MODO_OPERARIO)} className={claseTab(modo === MODO_OPERARIO)}>
            <HardHat size={16} /> Entrega a Operario (EPP / Guantes / Ropa)
          </button>
        </div>

        <form onSubmit={confirmar} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad a retirar</label>
            <div className="flex items-center gap-4">
              <input type="number" min="1" max={insumo.stock_actual} value={cantidad} required autoFocus
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                className="w-32 border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-orange-500 outline-none text-center text-xl font-bold" />
              {insumo.ultimo_precio_unitario > 0 && (
                <span className="text-sm">Consumo: <CalculoPrecio cantidad={cantidad} unitario={totalConIva(insumo.ultimo_precio_unitario, 1, insumo.alicuota_iva)} /></span>
              )}
            </div>
          </div>

          {modo === MODO_MAQUINA ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Supervisor que retira</label>
                <div className="flex flex-wrap gap-2">
                  {supervisores.map(nombre => (
                    <button key={nombre} type="button" onClick={() => setSupervisor(nombre)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition ${supervisor === nombre ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-700 border-slate-300 hover:border-orange-400'}`}>
                      {nombre}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Máquina destino</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MAQUINAS_FLOTA.map(m => (
                    <button key={m.nombre} type="button" onClick={() => setMaquina(m.nombre)}
                      className={`text-left p-2.5 rounded-lg border-2 transition ${maquina === m.nombre ? 'border-orange-600 bg-orange-50' : 'border-slate-200 hover:border-slate-400'}`}>
                      <p className="font-bold text-slate-800 text-sm">{m.nombre}</p>
                      <p className="text-xs text-slate-500 leading-tight">{m.descripcion}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parte / Ubicación en la máquina</label>
                <input type="text" value={parte} onChange={(e) => setParte(e.target.value)}
                  placeholder="Parante, cabezal, caja reductora..."
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-orange-500 outline-none" />
                {insumo.ubicacion_uso && parte !== insumo.ubicacion_uso && (
                  <button type="button" onClick={() => setParte(insumo.ubicacion_uso)}
                    className="mt-2 inline-flex items-center gap-1 text-xs bg-white text-slate-700 border border-slate-300 rounded-md px-2.5 py-1 hover:bg-slate-50">
                    <MapPin size={12} /> Usar ubicación del catálogo: {insumo.ubicacion_uso}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 flex gap-2">
              <ClipboardList size={16} className="mt-0.5 shrink-0" />
              <span>Se registrará como entrega a <span className="font-bold">Operario de Planta</span>. El detalle nominal y firma quedan asentados en la <span className="font-bold">Planilla Física de EPP</span>.</span>
            </div>
          )}

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
            <button type="submit" disabled={enviando} className="px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-md disabled:bg-slate-300">
              {enviando ? 'Procesando...' : 'Confirmar Retiro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
