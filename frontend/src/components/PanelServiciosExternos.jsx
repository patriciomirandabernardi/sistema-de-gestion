import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServiciosExternos, registrarEnvio, marcarDevuelto, deleteServicioExterno, getStockSierras, updateStockSierra, mensajeError } from '../api';
import { getRolActual, formatearFecha } from '../constants';
import { CargaSeccion } from './ui';
import { claseAccion, claseBotonHeader, claseBotonPagina } from '../estilos';
import { ArrowLeft, Truck, Disc3, Plus, Minus, PackageCheck, Trash2, Send, X, History } from 'lucide-react';

// Mantener sincronizado con backend/schemas.py -> TipoServicioExterno
const TIPOS = {
  'Reparación General': 'bg-sky-100 text-sky-800',
  'Afilado de Sierra': 'bg-amber-100 text-amber-800'
};

const claseInput = 'w-full border border-slate-300 rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Días corridos desde el envío (hasta hoy o hasta la devolución)
const diasFuera = (envio, retorno) =>
  Math.max(0, Math.floor(((retorno ? new Date(retorno) : new Date()) - new Date(envio)) / 86400000));

function AvisoError({ texto }) {
  return texto ? <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{texto}</div> : null;
}

function ModalRegistrarEnvio({ onCerrar, onListo }) {
  const [form, setForm] = useState({ tipo: 'Reparación General', descripcion: '', proveedor_destino: '', fecha: hoyISO() });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim() || !form.proveedor_destino.trim()) return setError('Completá la descripción y el proveedor.');
    setEnviando(true);
    setError('');
    try {
      const nuevo = await registrarEnvio({
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        proveedor_destino: form.proveedor_destino.trim(),
        // Mediodía local: evita que el cambio de zona horaria corra la fecha un día
        fecha_envio: form.fecha === hoyISO() ? undefined : `${form.fecha}T12:00:00`
      });
      onListo(`Envío registrado: ${nuevo.descripcion} a ${nuevo.proveedor_destino}.`);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-aparecer">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-slate-500"><Send size={20} /></span> Registrar Envío
        </h2>
        <form onSubmit={confirmar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de servicio</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={claseInput}>
              {Object.keys(TIPOS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <input type="text" required autoFocus maxLength={120} value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder={form.tipo === 'Afilado de Sierra' ? 'Ej: Sierra 500 (x2)' : 'Ej: Hidrolavadora'} className={claseInput} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor / Taller destino</label>
            <input type="text" required maxLength={120} value={form.proveedor_destino}
              onChange={(e) => setForm({ ...form, proveedor_destino: e.target.value })} className={claseInput} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de envío</label>
            <input type="date" required max={hoyISO()} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={claseInput} />
          </div>
          <AvisoError texto={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
            <button type="submit" disabled={enviando} className="px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded disabled:bg-slate-300">
              {enviando ? 'Registrando...' : 'Registrar Envío'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SeccionEnvios({ onAviso, onError }) {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verHistorial, setVerHistorial] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [procesando, setProcesando] = useState(null);

  const cargar = () =>
    getServiciosExternos()
      .then(lista => setServicios(Array.isArray(lista) ? lista : []))
      .catch(err => { setServicios([]); onError(mensajeError(err)); })
      .finally(() => setCargando(false));

  useEffect(() => { cargar(); }, []);

  const enviados = servicios.filter(s => s.estado === 'Enviado');
  const devueltos = servicios.filter(s => s.estado === 'Devuelto');

  const ejecutar = async (servicio, accion, mensaje) => {
    setProcesando(servicio.id);
    try {
      await accion(servicio.id);
      onAviso(mensaje);
      await cargar();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setProcesando(null);
    }
  };

  const devolver = (s) => {
    if (!window.confirm(`¿Confirmás que "${s.descripcion}" volvió de ${s.proveedor_destino}?`)) return;
    ejecutar(s, marcarDevuelto, `"${s.descripcion}" marcado como devuelto.`);
  };

  const eliminar = (s) => {
    if (!window.confirm(`¿Eliminar el registro de "${s.descripcion}"? Usalo solo para corregir una carga errónea.`)) return;
    ejecutar(s, deleteServicioExterno, `Registro de "${s.descripcion}" eliminado.`);
  };

  const filas = verHistorial ? devueltos : enviados;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{verHistorial ? 'Historial de Devoluciones' : 'Fuera de la Fábrica'}</h2>
          {!cargando && <p className="text-sm text-slate-500">{enviados.length} en servicio externo · {devueltos.length} devueltos</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setVerHistorial(!verHistorial)} className={claseBotonPagina()}>
            {verHistorial ? <><Truck size={16} /> Ver Enviados</> : <><History size={16} /> Ver Historial</>}
          </button>
          <button onClick={() => setModalAbierto(true)} className={claseBotonPagina('primaria')}>
            <Plus size={16} /> Registrar Envío
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {cargando ? <CargaSeccion /> : filas.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            {verHistorial ? 'Todavía no hay envíos devueltos.' : 'No hay equipos ni sierras fuera de la fábrica.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b">
                <tr>
                  <th className="p-3 text-left text-slate-700 font-semibold">Tipo</th>
                  <th className="p-3 text-left text-slate-700 font-semibold">Descripción</th>
                  <th className="p-3 text-left text-slate-700 font-semibold">Proveedor</th>
                  <th className="p-3 text-left text-slate-700 font-semibold">Enviado</th>
                  {verHistorial && <th className="p-3 text-left text-slate-700 font-semibold">Devuelto</th>}
                  <th className="p-3 text-right text-slate-700 font-semibold">Días fuera</th>
                  <th className="p-3 text-right text-slate-700 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(s => {
                  const dias = diasFuera(s.fecha_envio, s.fecha_retorno);
                  return (
                    <tr key={s.id} className={`border-b ${verHistorial ? 'text-slate-500' : 'hover:bg-slate-50'}`}>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${verHistorial ? 'bg-slate-100 text-slate-500' : (TIPOS[s.tipo] || 'bg-slate-100 text-slate-700')}`}>{s.tipo}</span>
                      </td>
                      <td className={`p-3 font-semibold ${verHistorial ? 'line-through' : 'text-slate-800'}`}>{s.descripcion}</td>
                      <td className="p-3">{s.proveedor_destino}</td>
                      <td className="p-3 text-sm">{formatearFecha(s.fecha_envio)}</td>
                      {verHistorial && <td className="p-3 text-sm">{formatearFecha(s.fecha_retorno)}</td>}
                      <td className={`p-3 text-right font-mono text-sm ${!verHistorial && dias > 30 ? 'text-red-700 font-bold' : ''}`}>{dias}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1.5">
                          {!verHistorial && (
                            <button onClick={() => devolver(s)} disabled={procesando === s.id} className={claseAccion('primaria')}>
                              <PackageCheck size={13} /> Devuelto
                            </button>
                          )}
                          <button onClick={() => eliminar(s)} disabled={procesando === s.id} className={claseAccion('peligro')} title="Eliminar registro">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!verHistorial && <p className="text-xs text-slate-500">Los envíos con más de 30 días fuera se resaltan en rojo.</p>}

      {modalAbierto && (
        <ModalRegistrarEnvio onCerrar={() => setModalAbierto(false)}
          onListo={(mensaje) => { setModalAbierto(false); onAviso(mensaje); cargar(); }} />
      )}
    </section>
  );
}

function SeccionSierras({ onAviso, onError }) {
  const [sierras, setSierras] = useState([]);
  const [edicion, setEdicion] = useState({}); // diametro -> texto del input
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);

  useEffect(() => {
    getStockSierras()
      .then(lista => setSierras(Array.isArray(lista) ? lista : []))
      .catch(err => { setSierras([]); onError(mensajeError(err)); })
      .finally(() => setCargando(false));
  }, []);

  const guardar = async (sierra, cantidad) => {
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      setEdicion(e => ({ ...e, [sierra.diametro]: undefined }));
      return onError('La cantidad debe ser un número entero mayor o igual a 0.');
    }
    if (cantidad === sierra.cantidad_disponible) return setEdicion(e => ({ ...e, [sierra.diametro]: undefined }));
    setGuardando(sierra.diametro);
    try {
      const actualizada = await updateStockSierra(sierra.diametro, cantidad);
      setSierras(lista => lista.map(s => s.diametro === actualizada.diametro ? actualizada : s));
      setEdicion(e => ({ ...e, [sierra.diametro]: undefined }));
      onAviso(`Sierras de ${sierra.diametro} mm: ${actualizada.cantidad_disponible} disponibles.`);
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(null);
    }
  };

  const total = sierras.reduce((acc, s) => acc + s.cantidad_disponible, 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Stock de Sierras</h2>
        {!cargando && <p className="text-sm text-slate-500">{total} sierras disponibles en total. Usá + / − o escribí la cantidad del relevamiento.</p>}
      </div>

      {cargando ? <div className="bg-white rounded-lg shadow"><CargaSeccion /></div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {sierras.map(s => {
            const ocupada = guardando === s.diametro;
            const texto = edicion[s.diametro] ?? String(s.cantidad_disponible);
            return (
              <div key={s.diametro} className={`bg-white rounded-lg shadow p-5 border-t-4 ${s.cantidad_disponible === 0 ? 'border-red-500' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="flex items-center gap-2 text-slate-500 text-sm font-semibold"><Disc3 size={16} /> Diámetro</span>
                  <span className="text-2xl font-bold text-slate-900">{s.diametro} <span className="text-sm font-medium text-slate-500">mm</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => guardar(s, s.cantidad_disponible - 1)} disabled={ocupada || s.cantidad_disponible === 0}
                    className="p-2.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Restar una">
                    <Minus size={18} />
                  </button>
                  <input type="number" min="0" step="1" inputMode="numeric" value={texto} disabled={ocupada}
                    onChange={(e) => setEdicion(ed => ({ ...ed, [s.diametro]: e.target.value }))}
                    onBlur={() => edicion[s.diametro] !== undefined && guardar(s, Number(texto))}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="flex-1 min-w-0 text-center text-2xl font-bold border border-slate-300 rounded-md py-1.5 focus:ring-2 focus:ring-blue-600 outline-none" />
                  <button onClick={() => guardar(s, s.cantidad_disponible + 1)} disabled={ocupada}
                    className="p-2.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Sumar una">
                    <Plus size={18} />
                  </button>
                </div>
                {s.cantidad_disponible === 0 && <p className="mt-3 text-xs font-semibold text-red-700">Sin stock</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function PanelServiciosExternos() {
  const [pestana, setPestana] = useState('envios');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const esAdmin = getRolActual() === 'admin';

  useEffect(() => {
    if (!localStorage.getItem('token') || !esAdmin) navigate('/login');
  }, []);

  if (!esAdmin) return null;

  const mostrarAviso = (m) => { setError(''); setAviso(m); };
  const mostrarError = (m) => { setAviso(''); setError(m); };

  const PESTANAS = [
    { id: 'envios', etiqueta: 'Seguimiento de Envíos', icono: <Truck size={16} /> },
    { id: 'sierras', etiqueta: 'Stock de Sierras', icono: <Disc3 size={16} /> }
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Servicios Externos y Sierras</p>
        </div>
        <button onClick={() => navigate('/cotizacion')} className={claseBotonHeader()}>
          <ArrowLeft size={16} /> Volver al Panel
        </button>
      </header>

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex gap-1 border-b border-slate-300">
          {PESTANAS.map(p => (
            <button key={p.id} onClick={() => setPestana(p.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${pestana === p.id ? 'border-blue-800 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {p.icono} {p.etiqueta}
            </button>
          ))}
        </div>

        {aviso && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex justify-between items-center">
            <span>{aviso}</span>
            <button onClick={() => setAviso('')} className="text-green-700 hover:text-green-900 p-1 rounded-md" aria-label="Cerrar aviso"><X size={16} /></button>
          </div>
        )}
        <AvisoError texto={error} />

        {pestana === 'envios'
          ? <SeccionEnvios onAviso={mostrarAviso} onError={mostrarError} />
          : <SeccionSierras onAviso={mostrarAviso} onError={mostrarError} />}
      </main>
    </div>
  );
}
