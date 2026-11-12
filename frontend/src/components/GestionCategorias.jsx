import { useState, useEffect } from 'react';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria, mensajeError } from '../api';
import { CargaSeccion } from './ui';
import { claseAccion, claseBotonPagina } from '../estilos';
import { Plus, Pencil, Trash2, Check, X, Tags } from 'lucide-react';

// ABM de categorías de gasto (solo admin llega acá: la pestaña vive en el catálogo).
// Renombrar una categoría actualiza los insumos que la usan; eliminar solo se permite si ninguno la usa.
export default function GestionCategorias({ onCambio }) {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [nueva, setNueva] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre }
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    try {
      const lista = await getCategorias();
      setCategorias(Array.isArray(lista) ? lista : []);
      setError('');
    } catch (err) {
      setCategorias([]);
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  const crear = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await createCategoria(nueva.trim());
      setNueva('');
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const guardarEdicion = async () => {
    setEnviando(true);
    try {
      await updateCategoria(editando.id, editando.nombre.trim());
      setEditando(null);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async (categoria) => {
    if (!window.confirm(`¿Eliminar la categoría "${categoria.nombre}"?\n\nSolo se puede eliminar si ningún insumo la usa.`)) return;
    try {
      await deleteCategoria(categoria.id);
      await cargar();
      onCambio?.();
    } catch (err) {
      alert(mensajeError(err));
    }
  };

  if (cargando) return <CargaSeccion />;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 inline-flex items-center gap-2"><Tags size={18} /> Categorías de Gasto</h2>
          <p className="text-sm text-slate-500 mt-0.5">Listado que usan el catálogo, las recepciones y el Control de Gastos.</p>
        </div>
        <form onSubmit={crear} className="flex gap-2">
          <input type="text" value={nueva} onChange={(e) => setNueva(e.target.value)} required maxLength={80}
            placeholder="Nueva categoría..." className="border rounded-lg p-2 bg-slate-50 w-64 focus:ring-2 focus:ring-blue-500 outline-none" />
          <button type="submit" disabled={enviando || !nueva.trim()} className={claseBotonPagina('primaria')}>
            <Plus size={16} /> Agregar
          </button>
        </form>
      </div>

      {error && <div className="m-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <table className="w-full">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-3 text-left text-slate-700 font-semibold">Categoría</th>
            <th className="p-3 text-center text-slate-700 font-semibold w-32">Insumos que la usan</th>
            <th className="p-3 text-center text-slate-700 font-semibold w-56">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {categorias.length === 0 && (
            <tr><td colSpan="3" className="p-8 text-center text-slate-500">No hay categorías cargadas</td></tr>
          )}
          {categorias.map(c => (
            <tr key={c.id} className="border-b hover:bg-slate-50">
              <td className="p-3">
                {editando?.id === c.id ? (
                  <input type="text" value={editando.nombre} autoFocus maxLength={80}
                    onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarEdicion(); } if (e.key === 'Escape') setEditando(null); }}
                    className="border rounded-md p-1.5 bg-white w-full max-w-md focus:ring-2 focus:ring-blue-500 outline-none" />
                ) : (
                  <span className="font-semibold text-slate-800">{c.nombre}</span>
                )}
              </td>
              <td className="p-3 text-center">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.insumos ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                  {c.insumos}
                </span>
              </td>
              <td className="p-3">
                <div className="flex gap-1.5 justify-center">
                  {editando?.id === c.id ? (
                    <>
                      <button onClick={guardarEdicion} disabled={enviando || !editando.nombre.trim()} className={claseAccion('primaria')}>
                        <Check size={13} /> Guardar
                      </button>
                      <button onClick={() => setEditando(null)} className={claseAccion('neutra')}>
                        <X size={13} /> Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditando({ id: c.id, nombre: c.nombre })} className={claseAccion('primaria')} title="Renombrar (actualiza los insumos que la usan)">
                        <Pencil size={13} /> Renombrar
                      </button>
                      <button onClick={() => eliminar(c)} disabled={c.insumos > 0} className={claseAccion('peligro')}
                        title={c.insumos > 0 ? `No se puede eliminar: ${c.insumos} insumo(s) la usan` : 'Eliminar categoría'}>
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
