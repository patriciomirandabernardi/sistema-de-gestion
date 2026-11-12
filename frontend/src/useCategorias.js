import { useState, useEffect } from 'react';
import { getCategorias } from './api';
import { CATEGORIAS_GASTO } from './constants';

// Listado de categorías de gasto desde el backend (el admin las gestiona desde el catálogo).
// Mientras carga —o si la llamada falla— devuelve la lista base para que el desplegable nunca quede vacío.
export function useCategorias() {
  const [categorias, setCategorias] = useState(CATEGORIAS_GASTO);

  useEffect(() => {
    let activo = true;
    getCategorias()
      .then(lista => {
        if (activo && Array.isArray(lista) && lista.length) setCategorias(lista.map(c => c.nombre));
      })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  return categorias;
}
