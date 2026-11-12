import { Package, Filter, AlertCircle, Edit2, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

function Inventario() {
  const [items, setItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('todas');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    proveedor_habitual: '',
    es_critico: false,
    stock_actual: 0,
    stock_ideal: 0,
    punto_pedido: 0
  });

  const fetchItems = async () => {
    try {
      const response = await axios.get('http://localhost:8000/items/');
      setItems(response.data);
      setItemsFiltrados(response.data);
      
      const categoriasUnicas = [...new Set(response.data.map(item => item.categoria))];
      setCategorias(categoriasUnicas);
    } catch (error) {
      console.error('Error al cargar inventario:', error);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (categoriaSeleccionada === 'todas') {
      setItemsFiltrados(items);
    } else {
      setItemsFiltrados(items.filter(item => item.categoria === categoriaSeleccionada));
    }
  }, [categoriaSeleccionada, items]);

  const necesitaReposicion = (item) => {
    return item.stock_actual <= item.punto_pedido;
  };

  const handleEliminar = async (id, nombre) => {
    if (window.confirm(`¿Estás seguro de eliminar el ítem "${nombre}"?`)) {
      try {
        await axios.delete(`http://localhost:8000/items/${id}`);
        fetchItems();
      } catch (error) {
        console.error('Error al eliminar ítem:', error);
        alert('Error al eliminar el ítem');
      }
    }
  };

  const handleEditar = (item) => {
    setItemEditando(item);
    setFormData({
      nombre: item.nombre,
      categoria: item.categoria,
      proveedor_habitual: item.proveedor_habitual,
      es_critico: item.es_critico,
      stock_actual: item.stock_actual,
      stock_ideal: item.stock_ideal,
      punto_pedido: item.punto_pedido
    });
    setModalAbierto(true);
  };

  const handleCerrarModal = () => {
    setModalAbierto(false);
    setItemEditando(null);
    setFormData({
      nombre: '',
      categoria: '',
      proveedor_habitual: '',
      es_critico: false,
      stock_actual: 0,
      stock_ideal: 0,
      punto_pedido: 0
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:8000/items/${itemEditando.id}`, {
        nombre: formData.nombre,
        categoria: formData.categoria,
        proveedor_habitual: formData.proveedor_habitual,
        es_critico: formData.es_critico,
        stock_actual: parseInt(formData.stock_actual),
        stock_ideal: parseInt(formData.stock_ideal),
        punto_pedido: parseInt(formData.punto_pedido)
      });
      handleCerrarModal();
      fetchItems();
    } catch (error) {
      console.error('Error al actualizar ítem:', error);
      alert('Error al actualizar el ítem');
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-indigo-600" />
            <h2 className="text-3xl font-bold text-gray-800">Inventario Completo</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <select
              value={categoriaSeleccionada}
              onChange={(e) => setCategoriaSeleccionada(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="todas">Todas las categorías</option>
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Mostrando <span className="font-bold text-indigo-600">{itemsFiltrados.length}</span> de {items.length} ítems
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="border border-indigo-700 px-4 py-3 text-left font-semibold">Nombre</th>
                <th className="border border-indigo-700 px-4 py-3 text-left font-semibold">Categoría</th>
                <th className="border border-indigo-700 px-4 py-3 text-left font-semibold">Proveedor</th>
                <th className="border border-indigo-700 px-4 py-3 text-center font-semibold">Crítico</th>
                <th className="border border-indigo-700 px-4 py-3 text-center font-semibold">Stock Actual</th>
                <th className="border border-indigo-700 px-4 py-3 text-center font-semibold">Stock Ideal</th>
                <th className="border border-indigo-700 px-4 py-3 text-center font-semibold">Punto Pedido</th>
                <th className="border border-indigo-700 px-4 py-3 text-center font-semibold">Estado</th>
                <th className="border border-indigo-700 px-4 py-3 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-500 italic">
                    No hay ítems para mostrar
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      necesitaReposicion(item)
                        ? item.es_critico
                          ? 'bg-red-50'
                          : 'bg-yellow-50'
                        : ''
                    }`}
                  >
                    <td className="border border-gray-300 px-4 py-3 font-medium text-gray-800">
                      {item.nombre}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-700">
                      <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                        {item.categoria}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-700">
                      {item.proveedor_habitual}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {item.es_critico ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                          <AlertCircle className="w-4 h-4" />
                          SÍ
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                          NO
                        </span>
                      )}
                    </td>
                    <td className={`border border-gray-300 px-4 py-3 text-center font-bold text-lg ${
                      necesitaReposicion(item)
                        ? item.es_critico
                          ? 'text-red-700'
                          : 'text-yellow-700'
                        : 'text-green-700'
                    }`}>
                      {item.stock_actual}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-700 font-semibold">
                      {item.stock_ideal}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-700 font-semibold">
                      {item.punto_pedido}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {necesitaReposicion(item) ? (
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          item.es_critico
                            ? 'bg-red-200 text-red-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          REPONER
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditar(item)}
                          className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(item.id, item.nombre)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-50 border-2 border-red-200 rounded"></div>
              <span className="text-gray-700">Crítico - Requiere reposición</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-50 border-2 border-yellow-200 rounded"></div>
              <span className="text-gray-700">No crítico - Requiere reposición</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>
              <span className="text-gray-700">Stock normal</span>
            </div>
          </div>
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Editar Ítem</h3>
              <button
                onClick={handleCerrarModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre del Ítem
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Categoría
                </label>
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  <option value="Ferretería">Ferretería</option>
                  <option value="Electricidad">Electricidad</option>
                  <option value="Herramientas">Herramientas</option>
                  <option value="Seguridad">Seguridad</option>
                  <option value="Limpieza">Limpieza</option>
                  <option value="Oficina">Oficina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Proveedor Habitual
                </label>
                <input
                  type="text"
                  name="proveedor_habitual"
                  value={formData.proveedor_habitual}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  name="es_critico"
                  checked={formData.es_critico}
                  onChange={handleChange}
                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
                <label className="text-sm font-semibold text-gray-700">
                  ¿Es un ítem crítico?
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    name="stock_actual"
                    value={formData.stock_actual}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stock Ideal
                  </label>
                  <input
                    type="number"
                    name="stock_ideal"
                    value={formData.stock_ideal}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Punto de Pedido
                  </label>
                  <input
                    type="number"
                    name="punto_pedido"
                    value={formData.punto_pedido}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={handleCerrarModal}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventario;
