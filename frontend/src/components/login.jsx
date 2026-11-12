import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, mensajeError } from '../api';

const PANEL_POR_ROL = { admin: '/cotizacion', gerencia: '/aprobaciones', supervisor: '/supervisor' };

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(usuario, password);
      localStorage.setItem('token', data.access_token);

      // Decodificar token para redirigir según rol
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      navigate(PANEL_POR_ROL[payload.rol] || '/login');
    } catch (err) {
      setPassword('');
      setError(err?.response?.status === 401 ? 'Usuario o contraseña incorrectos.' : `No se pudo iniciar sesión: ${mensajeError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const claseInput = 'w-full border border-slate-300 rounded-lg px-4 py-3 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none transition';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-slate-900 px-8 py-7 text-center border-b-4 border-blue-700">
            <h1 className="text-3xl font-extrabold tracking-[0.2em] text-white">IMCAYPER</h1>
            <p className="text-slate-400 text-sm mt-1 uppercase tracking-wider">Sistema de Gestión de Pañol y Compras</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Iniciar sesión</h2>
              <p className="text-sm text-slate-500">Ingresá con tus credenciales corporativas.</p>
            </div>

            <div>
              <label htmlFor="usuario" className="block text-sm font-semibold text-slate-700 mb-1">Usuario / Legajo</label>
              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Ej: 511"
                className={claseInput}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Ingresá tu contraseña"
                  className={`${claseInput} pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(v => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {verPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-3 rounded-lg text-base tracking-wide shadow transition-colors disabled:bg-slate-400"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} IMCAYPER · Acceso restringido a personal autorizado
        </p>
      </div>
    </div>
  );
}
