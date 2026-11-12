import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsuarios, getUsuarioActual, createUsuario, resetPasswordUsuario, deleteUsuario, mensajeError } from '../api';
import { getRolActual } from '../constants';
import { CargaSeccion } from './ui';
import { claseAccion, claseBotonHeader, claseBotonPagina } from '../estilos';
import { ArrowLeft, UserPlus, KeyRound, Trash2, X } from 'lucide-react';

// Mantener sincronizado con backend/schemas.py -> RolUsuario y LARGO_MINIMO_PASSWORD
const ROLES = {
  supervisor: { etiqueta: 'Supervisor', badge: 'bg-sky-100 text-sky-800' },
  gerencia: { etiqueta: 'Gerencia', badge: 'bg-amber-100 text-amber-800' },
  admin: { etiqueta: 'Administrador', badge: 'bg-purple-100 text-purple-800' }
};
const LARGO_MINIMO_PASSWORD = 8;

const claseInput = 'w-full border border-slate-300 rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none';

function Modal({ titulo, icono, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-aparecer">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-slate-500">{icono}</span> {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}

function AvisoError({ texto }) {
  return texto ? <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{texto}</div> : null;
}

// Valida la clave y su repetición; devuelve el mensaje de error o ''
const validarPassword = (password, repetir) => {
  if (password.length < LARGO_MINIMO_PASSWORD) return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
  if (password !== repetir) return 'Las contraseñas no coinciden.';
  return '';
};

function CamposPassword({ password, setPassword, repetir, setRepetir, etiqueta }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{etiqueta}</label>
        <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={`Mínimo ${LARGO_MINIMO_PASSWORD} caracteres`} className={claseInput} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Repetir contraseña</label>
        <input type="password" required autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} className={claseInput} />
      </div>
    </>
  );
}

function ModalNuevoUsuario({ onCerrar, onListo }) {
  const [form, setForm] = useState({ username: '', nombre_completo: '', rol: 'supervisor' });
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    const username = form.username.trim();
    if (!username || /\s/.test(username)) return setError('El usuario no puede estar vacío ni contener espacios.');
    const errorPassword = validarPassword(password, repetir);
    if (errorPassword) return setError(errorPassword);
    setEnviando(true);
    setError('');
    try {
      const nuevo = await createUsuario({ ...form, username, password });
      onListo(`Usuario '${nuevo.username}' creado como ${ROLES[nuevo.rol]?.etiqueta || nuevo.rol}.`);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Nuevo Usuario" icono={<UserPlus size={20} />}>
      <form onSubmit={confirmar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Usuario / Legajo</label>
          <input type="text" required autoFocus autoComplete="off" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Ej: 745" className={claseInput} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input type="text" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
            placeholder="Se muestra en pedidos y retiros" className={claseInput} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
          <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className={claseInput}>
            {Object.entries(ROLES).map(([valor, r]) => <option key={valor} value={valor}>{r.etiqueta}</option>)}
          </select>
        </div>
        <CamposPassword etiqueta="Contraseña inicial" password={password} setPassword={setPassword} repetir={repetir} setRepetir={setRepetir} />
        <AvisoError texto={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
          <button type="submit" disabled={enviando} className="px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded disabled:bg-slate-300">
            {enviando ? 'Creando...' : 'Crear Usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalBlanquearClave({ usuario, onCerrar, onListo }) {
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    const errorPassword = validarPassword(password, repetir);
    if (errorPassword) return setError(errorPassword);
    setEnviando(true);
    setError('');
    try {
      const r = await resetPasswordUsuario(usuario.id, password);
      onListo(`${r.mensaje}. Comunicale la nueva clave al usuario.`);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Blanquear Clave" icono={<KeyRound size={20} />}>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-slate-600">
          Nueva contraseña para <b>{usuario.username}</b>{usuario.nombre_completo !== usuario.username && ` (${usuario.nombre_completo})`}.
          La clave anterior deja de funcionar inmediatamente.
        </p>
        <CamposPassword etiqueta="Nueva contraseña" password={password} setPassword={setPassword} repetir={repetir} setRepetir={setRepetir} />
        <AvisoError texto={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
          <button type="submit" disabled={enviando} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded disabled:bg-slate-300">
            {enviando ? 'Guardando...' : 'Blanquear Clave'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Doble confirmación: 1) advertencia explícita, 2) escribir el usuario exacto para habilitar la baja
function ModalBaja({ usuario, onCerrar, onListo }) {
  const [paso, setPaso] = useState(1);
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const coincide = confirmacion.trim() === usuario.username;

  const confirmar = async (e) => {
    e.preventDefault();
    if (!coincide) return;
    setEnviando(true);
    setError('');
    try {
      const r = await deleteUsuario(usuario.id);
      onListo(r.mensaje);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Eliminar / Dar de Baja" icono={<Trash2 size={20} />}>
      {paso === 1 ? (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2">
            <p>Vas a quitarle el acceso a <b>{usuario.username}</b> ({usuario.nombre_completo}, {ROLES[usuario.rol]?.etiqueta || usuario.rol}).</p>
            <p>Si tiene pedidos u órdenes de compra registradas, queda <b>dado de baja</b> y su historial se conserva. Si no tiene historial, se elimina.</p>
            <p>Sus sesiones abiertas se cierran de inmediato.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
            <button type="button" onClick={() => setPaso(2)} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded">
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={confirmar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Para confirmar, escribí el usuario <span className="font-mono font-bold text-red-700">{usuario.username}</span>
            </label>
            <input type="text" autoFocus autoComplete="off" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)}
              className={`${claseInput} focus:ring-red-500`} />
          </div>
          <AvisoError texto={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
            <button type="submit" disabled={!coincide || enviando} className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded disabled:bg-slate-300">
              {enviando ? 'Procesando...' : 'Confirmar Baja'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [yo, setYo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modal, setModal] = useState(null); // { tipo: 'nuevo' | 'clave' | 'baja', usuario? }
  const navigate = useNavigate();

  const cargar = () =>
    Promise.all([getUsuarios(), getUsuarioActual()])
      .then(([lista, actual]) => { setUsuarios(lista); setYo(actual); setError(''); })
      .catch(err => setError(mensajeError(err)))
      .finally(() => setCargando(false));

  useEffect(() => {
    if (!localStorage.getItem('token')) return navigate('/login');
    if (getRolActual() !== 'admin') return navigate('/login');
    cargar();
  }, []);

  const terminar = (mensaje) => {
    setModal(null);
    setAviso(mensaje);
    cargar();
  };

  const activos = usuarios.filter(u => u.activo).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Gestión de Usuarios</p>
        </div>
        <button onClick={() => navigate('/cotizacion')} className={claseBotonHeader()}>
          <ArrowLeft size={16} /> Volver al Panel
        </button>
      </header>

      <main className="p-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Usuarios del Sistema</h2>
            {!cargando && <p className="text-sm text-slate-500">{activos} activos · {usuarios.length - activos} dados de baja</p>}
          </div>
          <button onClick={() => setModal({ tipo: 'nuevo' })} className={claseBotonPagina('primaria')}>
            <UserPlus size={16} /> Nuevo Usuario
          </button>
        </div>

        {aviso && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex justify-between items-center">
            <span>{aviso}</span>
            <button onClick={() => setAviso('')} className="text-green-700 hover:text-green-900 p-1 rounded-md" aria-label="Cerrar aviso"><X size={16} /></button>
          </div>
        )}
        <AvisoError texto={error} />

        <section className="bg-white rounded-lg shadow overflow-hidden">
          {cargando ? (
            <CargaSeccion />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="p-3 text-left text-slate-700 font-semibold w-16">ID</th>
                    <th className="p-3 text-left text-slate-700 font-semibold">Usuario / Legajo</th>
                    <th className="p-3 text-left text-slate-700 font-semibold">Rol</th>
                    <th className="p-3 text-right text-slate-700 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const esYo = yo?.id === u.id;
                    return (
                      <tr key={u.id} className={`border-b ${u.activo ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'}`}>
                        <td className="p-3 font-mono text-sm">{u.id}</td>
                        <td className="p-3">
                          <span className={`font-semibold ${u.activo ? 'text-slate-800' : 'line-through'}`}>{u.username}</span>
                          {esYo && <span className="ml-2 text-xs font-bold text-blue-700">(vos)</span>}
                          {u.nombre_completo && u.nombre_completo !== u.username && <p className="text-xs text-slate-500">{u.nombre_completo}</p>}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${u.activo ? (ROLES[u.rol]?.badge || 'bg-slate-100 text-slate-700') : 'bg-slate-200 text-slate-500'}`}>
                            {ROLES[u.rol]?.etiqueta || u.rol}
                          </span>
                          {!u.activo && <span className="ml-2 px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">Dado de baja</span>}
                        </td>
                        <td className="p-3">
                          {u.activo && !esYo && (
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => setModal({ tipo: 'clave', usuario: u })} className={claseAccion('neutra')}>
                                <KeyRound size={13} /> Blanquear Clave
                              </button>
                              <button onClick={() => setModal({ tipo: 'baja', usuario: u })} className={claseAccion('peligro')}>
                                <Trash2 size={13} /> Eliminar/Baja
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="text-xs text-slate-500">
          Los usuarios con pedidos u órdenes de compra registradas se dan de baja (no se borran) para conservar la trazabilidad del historial.
        </p>
      </main>

      {modal?.tipo === 'nuevo' && <ModalNuevoUsuario onCerrar={() => setModal(null)} onListo={terminar} />}
      {modal?.tipo === 'clave' && <ModalBlanquearClave usuario={modal.usuario} onCerrar={() => setModal(null)} onListo={terminar} />}
      {modal?.tipo === 'baja' && <ModalBaja usuario={modal.usuario} onCerrar={() => setModal(null)} onListo={terminar} />}
    </div>
  );
}
