import { ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

function Historial() {
  const [movimientos, setMovimientos] = useState([]);

  useEffect(() => {
    const fetchMovimientos = async () => {
      try {
        const response = await axios.get('http://localhost:8000/movimientos/');
        setMovimientos(response.data);
      } catch (error) {
        console.error('Error al cargar historial:', error);
      }
    };

    fetchMovimientos();
  }, []);

  const formatearFecha = (fechaISO) => {
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-8 h-8 text-purple-600" />
          <h2 className="text-3xl font-bold text-gray-800">Historial de Movimientos</h2>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Total de movimientos registrados: <span className="font-bold text-purple-600">{movimientos.length}</span>
        </div>

        {movimientos.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay movimientos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-purple-600 text-white">
                  <th className="border border-purple-700 px-4 py-3 text-left font-semibold">Fecha y Hora</th>
                  <th className="border border-purple-700 px-4 py-3 text-left font-semibold">Ítem</th>
                  <th className="border border-purple-700 px-4 py-3 text-center font-semibold">Tipo</th>
                  <th className="border border-purple-700 px-4 py-3 text-center font-semibold">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 font-medium">
                      {formatearFecha(mov.fecha)}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-gray-800 font-semibold">
                      {mov.item_nombre}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {mov.tipo_movimiento.toLowerCase() === 'ingreso' ? (
                        <div className="flex items-center justify-center gap-2">
                          <ArrowUpCircle className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-green-700 uppercase text-sm">Ingreso</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <ArrowDownCircle className="w-5 h-5 text-red-600" />
                          <span className="font-bold text-red-700 uppercase text-sm">Egreso</span>
                        </div>
                      )}
                    </td>
                    <td className={`border border-gray-300 px-4 py-3 text-center font-bold text-lg ${
                      mov.tipo_movimiento.toLowerCase() === 'ingreso' 
                        ? 'text-green-700' 
                        : 'text-red-700'
                    }`}>
                      {mov.tipo_movimiento.toLowerCase() === 'ingreso' ? '+' : '-'}{mov.cantidad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-green-600" />
              <span className="text-gray-700 font-semibold">Ingreso: Entrada de stock</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-red-600" />
              <span className="text-gray-700 font-semibold">Egreso: Salida de stock</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Historial;
