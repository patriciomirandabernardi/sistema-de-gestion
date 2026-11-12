import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInsumos, createInsumo, updateInsumo, deleteInsumo, mensajeError } from '../api';
import { formatearMoneda, formatearFecha, coincideBusqueda, totalConIva, textoAlicuota, ALICUOTAS_IVA, IVA_POR_DEFECTO } from '../constants';
import { useCategorias } from '../useCategorias';
import { abrirImpresionA4, escaparHtml } from '../imprimir';
import ModalRetiro from './ModalRetiro';
import ModalCompraDirecta from './ModalCompraDirecta';
import TrazabilidadSalidas from './TrazabilidadSalidas';
import GestionCategorias from './GestionCategorias';
import { PantallaCarga } from './ui';
import { claseAccion, claseBotonHeader, claseBotonPagina } from '../estilos';
import { ArrowLeft, LogOut, Package, History, PackagePlus, FileDown, Plus, MapPin, Pencil, PackageMinus, Trash2, TriangleAlert, Tags } from 'lucide-react';

const VISTA_INVENTARIO = 'inventario';
const VISTA_SALIDAS = 'salidas';
const VISTA_CATEGORIAS = 'categorias';

const FORM_NUEVO_VACIO = { nombre: '', descripcion: '', categoria_gasto: '', ubicacion_uso: '', stock_actual: 0, stock_minimo: 0, ultimo_precio_unitario: 0, alicuota_iva: IVA_POR_DEFECTO, es_critico: false };

// Valor real inmovilizado: stock × precio neto × (1 + IVA/100)
const valorStock = (insumo) => totalConIva(insumo.ultimo_precio_unitario, insumo.stock_actual, insumo.alicuota_iva);
const tieneStockBajo = (insumo) => insumo.stock_actual <= insumo.stock_minimo;

export default function CatalogoInsumos() {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState(VISTA_INVENTARIO);

  // Filtros rápidos de la tabla
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [soloCriticos, setSoloCriticos] = useState(false);

  // Modales
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalRetirar, setModalRetirar] = useState(null);
  const [modalCompraDirecta, setModalCompraDirecta] = useState(false);

  // Formularios
  const [formNuevo, setFormNuevo] = useState(FORM_NUEVO_VACIO);
  const [formEditar, setFormEditar] = useState({});
  const [enviando, setEnviando] = useState(false);
  const categorias = useCategorias();

  const navigate = useNavigate();

  useEffect(() => {
    cargarInsumos();
  }, []);

  const cargarInsumos = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const data = await getInsumos();
      setInsumos(data);
      setLoading(false);
    } catch (err) {
      console.error("Error cargando insumos:", err);
      setLoading(false);
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await createInsumo(formNuevo);
      setModalNuevo(false);
      setFormNuevo(FORM_NUEVO_VACIO);
      cargarInsumos();
    } catch (err) {
      alert(`Error al crear: ${err.data?.detail || err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await updateInsumo(modalEditar.id, formEditar);
      setModalEditar(null);
      cargarInsumos();
    } catch (err) {
      alert(`Error al editar: ${err.data?.detail || err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const abrirEditar = (insumo) => {
    setFormEditar({
      nombre: insumo.nombre,
      descripcion: insumo.descripcion || '',
      categoria_gasto: insumo.categoria_gasto,
      ubicacion_uso: insumo.ubicacion_uso || '',
      stock_actual: insumo.stock_actual,
      stock_minimo: insumo.stock_minimo,
      ultimo_precio_unitario: insumo.ultimo_precio_unitario || 0,
      alicuota_iva: insumo.alicuota_iva ?? IVA_POR_DEFECTO,
      es_critico: insumo.es_critico
    });
    setModalEditar(insumo);
  };

  const handleEliminar = async (insumo) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar este insumo?\n\n${insumo.nombre}`)) return;
    try {
      await deleteInsumo(insumo.id);
      cargarInsumos();
    } catch (err) {
      alert(mensajeError(err));
    }
  };

  const valorTotalPanol = insumos.reduce((suma, i) => suma + valorStock(i), 0);
  const cantidadEnAlerta = insumos.filter(tieneStockBajo).length;
  const sinPrecio = insumos.filter(i => i.stock_actual > 0 && !(i.ultimo_precio_unitario > 0)).length;

  const insumosFiltrados = insumos.filter(i =>
    (!filtroCategoria || i.categoria_gasto === filtroCategoria) &&
    (!soloCriticos || i.es_critico) &&
    coincideBusqueda(filtroTexto, i.nombre, i.descripcion, i.ubicacion_uso, i.ultimo_proveedor)
  );
  const hayFiltros = Boolean(filtroTexto.trim() || filtroCategoria || soloCriticos);
  const valorFiltrado = insumosFiltrados.reduce((suma, i) => suma + valorStock(i), 0);
  const descripcionFiltros = [
    filtroCategoria && `Categoría: ${filtroCategoria}`,
    soloCriticos && 'Solo críticos',
    filtroTexto.trim() && `Búsqueda: "${filtroTexto.trim()}"`
  ].filter(Boolean).join(' · ');

  const limpiarFiltros = () => {
    setFiltroTexto('');
    setFiltroCategoria('');
    setSoloCriticos(false);
  };

  // El PDF exporta exactamente lo que se ve en la tabla (respetando los filtros)
  const exportarInventarioPDF = () => {
    const filas = insumosFiltrados.map(i => `
      <tr>
        <td>${escaparHtml(i.nombre)}${tieneStockBajo(i) ? ' <span class="alerta">STOCK BAJO</span>' : ''}
          ${i.ubicacion_uso ? `<div class="sub">${escaparHtml(i.ubicacion_uso)}</div>` : ''}</td>
        <td>${escaparHtml(i.categoria_gasto)}</td>
        <td class="num">${i.stock_actual}</td>
        <td class="num">${i.ultimo_precio_unitario > 0 ? `${formatearMoneda(i.ultimo_precio_unitario)}<div class="sub">+ IVA ${textoAlicuota(i.alicuota_iva)}</div>` : '<span class="sub">Sin precio</span>'}</td>
        <td class="num">${formatearMoneda(valorStock(i))}</td>
        <td>${escaparHtml(i.ultimo_proveedor || '-')}${i.fecha_ultima_compra ? `<div class="sub">${formatearFecha(i.fecha_ultima_compra)}</div>` : ''}</td>
      </tr>`).join('');

    abrirImpresionA4({
      titulo: 'Inventario Valorizado del Pañol',
      documento: 'Inventario Valorizado del Pañol',
      cuerpo: `
        <div class="meta">
          <div>${hayFiltros ? `<b>Filtros:</b> ${escaparHtml(descripcionFiltros)}<br><b>Ítems listados:</b> ${insumosFiltrados.length} de ${insumos.length}` : `<b>Ítems en catálogo:</b> ${insumos.length}`}
            <br><b>Ítems con stock bajo (total pañol):</b> ${cantidadEnAlerta}
            ${sinPrecio ? `<br><b>Ítems con stock sin precio cargado:</b> ${sinPrecio}` : ''}</div>
          <div class="total"><span>${hayFiltros ? 'VALOR DE LOS ÍTEMS LISTADOS' : 'VALOR TOTAL DEL PAÑOL'}</span><strong>${formatearMoneda(valorFiltrado)}</strong></div>
        </div>
        <table>
          <thead><tr><th>Insumo</th><th>Categoría</th><th class="num">Stock</th><th class="num">P. Unit (Neto)</th><th class="num">Subtotal (IVA incl.)</th><th>Último proveedor</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="6">No hay insumos para los filtros seleccionados</td></tr>'}</tbody>
          <tfoot><tr><td colspan="4">${hayFiltros ? 'TOTAL DE LOS ÍTEMS LISTADOS' : 'TOTAL GENERAL DEL PAÑOL'}</td><td class="num">${formatearMoneda(valorFiltrado)}</td><td></td></tr></tfoot>
        </table>
        <p class="pie">Subtotal = Stock actual × (Precio neto × (1 + IVA)). Precios según la última compra del insumo o carga manual.</p>`
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return <PantallaCarga subtitulo="Catálogo de Insumos" />;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Catálogo de Insumos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/cotizacion')} className={claseBotonHeader()}>
            <ArrowLeft size={16} /> Volver al Panel
          </button>
          <button onClick={handleLogout} className={claseBotonHeader('salir')}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex gap-2 border-b border-slate-300">
          {[[VISTA_INVENTARIO, 'Inventario', <Package size={16} />],
            [VISTA_SALIDAS, 'Historial de Salidas y Máquinas', <History size={16} />],
            [VISTA_CATEGORIAS, 'Categorías', <Tags size={16} />]].map(([id, etiqueta, icono]) => (
            <button key={id} onClick={() => setVista(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 font-semibold rounded-t-lg border-b-2 -mb-px transition ${vista === id ? 'border-blue-700 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {icono} {etiqueta}
            </button>
          ))}
        </div>

        {vista === VISTA_CATEGORIAS ? <GestionCategorias onCambio={cargarInsumos} /> : vista === VISTA_SALIDAS ? <TrazabilidadSalidas /> : (
        <>
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Inventario de Insumos</h2>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setModalCompraDirecta(true)}
              className={claseBotonPagina('oscura')}
              title="Abastecimiento crítico (gases, EPP, automáticos) o compra directa de Gerencia"
            >
              <PackagePlus size={16} /> Cargar Remito/Factura (Ingreso Directo)
            </button>
            <button onClick={exportarInventarioPDF} className={claseBotonPagina()}>
              <FileDown size={16} /> Exportar Inventario PDF
            </button>
            <button onClick={() => setModalNuevo(true)} className={claseBotonPagina('primaria')}>
              <Plus size={16} /> Nuevo Insumo
            </button>
          </div>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 text-white rounded-lg shadow p-5">
            <p className="text-sm text-slate-300 uppercase tracking-wide">Valor Total del Pañol (Inventario Inmovilizado)</p>
            <p className="text-3xl font-bold mt-1">{formatearMoneda(valorTotalPanol)}</p>
            <p className="text-xs text-slate-400 mt-1">
              {insumos.length} ítems{sinPrecio > 0 && ` · ${sinPrecio} con stock sin precio cargado (no suman al total)`}
            </p>
          </div>
          <div className={`rounded-lg shadow p-5 ${cantidadEnAlerta ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
            <p className="text-sm uppercase tracking-wide opacity-90">Ítems en alerta de stock bajo</p>
            <p className="text-3xl font-bold mt-1">{cantidadEnAlerta}</p>
            <p className="text-xs opacity-80 mt-1">Stock actual menor o igual al mínimo</p>
          </div>
        </div>

        {/* Filtros rápidos */}
        <section className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Buscar</label>
            <input type="text" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder='Ej: "6310", "disco 9", "cubas"'
              className="w-full border rounded-lg p-2 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Categoría</label>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="border rounded-lg p-2 bg-slate-50">
              <option value="">Todas</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setSoloCriticos(!soloCriticos)} aria-pressed={soloCriticos}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition ${soloCriticos ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
            <span className={`h-2 w-2 rounded-full ${soloCriticos ? 'bg-amber-400' : 'bg-amber-500'}`} />
            Solo críticos
          </button>
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 underline">
              Limpiar filtros
            </button>
          )}
          <p className="text-sm text-slate-500 ml-auto">
            Mostrando <span className="font-bold text-slate-800">{insumosFiltrados.length}</span> de {insumos.length} insumos
          </p>
        </section>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-4 text-left text-slate-700 font-semibold">Insumo</th>
                <th className="p-4 text-left text-slate-700 font-semibold">Categoría</th>
                <th className="p-4 text-center text-slate-700 font-semibold">Stock Actual</th>
                <th className="p-4 text-center text-slate-700 font-semibold">Stock Mínimo</th>
                <th className="p-4 text-right text-slate-700 font-semibold">Valorización</th>
                <th className="p-4 text-center text-slate-700 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insumosFiltrados.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">
                  {insumos.length === 0 ? 'No hay insumos cargados' : 'Ningún insumo coincide con los filtros'}
                </td></tr>
              )}
              {insumosFiltrados.map(insumo => {
                const stockBajo = tieneStockBajo(insumo);
                return (
                  <tr key={insumo.id} className={`border-b hover:bg-slate-50 ${stockBajo ? 'bg-red-50' : ''}`}>
                    <td className="p-4">
                      <p className={`font-bold ${stockBajo ? 'text-red-700' : 'text-slate-800'}`}>
                        {insumo.nombre}
                        {insumo.es_critico && <span className="ml-2 align-middle text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5">CRÍTICO</span>}
                        {stockBajo && <span className="ml-2 inline-flex items-center gap-1 align-middle text-[10px] font-bold text-red-700"><TriangleAlert size={12} /> STOCK BAJO</span>}
                      </p>
                      {insumo.descripcion && <p className="text-xs text-slate-500">{insumo.descripcion}</p>}
                      {insumo.ubicacion_uso && (
                        <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1" title="Ubicación / Uso"><MapPin size={12} /> {insumo.ubicacion_uso}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-200 text-slate-700">{insumo.categoria_gasto}</span>
                    </td>
                    <td className={`p-4 text-center text-lg font-bold ${stockBajo ? 'text-red-600' : 'text-slate-800'}`}>
                      {insumo.stock_actual}
                    </td>
                    <td className="p-4 text-center text-slate-600">{insumo.stock_minimo}</td>
                    <td className="p-4 text-right">
                      {insumo.ultimo_precio_unitario > 0 ? (
                        <>
                          <p className="text-lg font-bold text-slate-900">{formatearMoneda(valorStock(insumo))}</p>
                          <p className="text-xs text-slate-500">{insumo.stock_actual} u. × {formatearMoneda(insumo.ultimo_precio_unitario)} neto c/u (+IVA {textoAlicuota(insumo.alicuota_iva)})</p>
                          {insumo.ultimo_proveedor && (
                            <p className="text-xs text-slate-400">
                              Últ. prov.: {insumo.ultimo_proveedor}{insumo.fecha_ultima_compra && ` · ${formatearFecha(insumo.fecha_ultima_compra)}`}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Sin precio cargado</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => abrirEditar(insumo)} className={claseAccion('primaria')} title="Editar insumo">
                          <Pencil size={13} /> Editar
                        </button>
                        <button
                          onClick={() => setModalRetirar(insumo)}
                          disabled={insumo.stock_actual <= 0}
                          className={claseAccion('neutra')}
                          title={insumo.stock_actual <= 0 ? 'Sin stock disponible' : 'Retirar stock (máquina u operario)'}
                        >
                          <PackageMinus size={13} /> Retirar
                        </button>
                        <button
                          onClick={() => handleEliminar(insumo)}
                          className={claseAccion('peligro')}
                          title="Eliminar insumo (solo si no tiene compras ni retiros)"
                          aria-label="Eliminar insumo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {insumosFiltrados.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td colSpan="4" className="p-4 font-bold">{hayFiltros ? 'TOTAL VALORIZADO (ÍTEMS FILTRADOS)' : 'TOTAL VALORIZADO DEL PAÑOL'}</td>
                  <td className="p-4 text-right text-lg font-bold">{formatearMoneda(valorFiltrado)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </>
        )}
      </main>

      {/* Modal Nuevo Insumo */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Nuevo Insumo</h2>
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input type="text" value={formNuevo.nombre} onChange={(e) => setFormNuevo({...formNuevo, nombre: e.target.value})} required
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input type="text" value={formNuevo.descripcion} onChange={(e) => setFormNuevo({...formNuevo, descripcion: e.target.value})}
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría de Gasto *</label>
                <select value={formNuevo.categoria_gasto} onChange={(e) => setFormNuevo({...formNuevo, categoria_gasto: e.target.value})} required
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación / Uso</label>
                <input type="text" value={formNuevo.ubicacion_uso} onChange={(e) => setFormNuevo({...formNuevo, ubicacion_uso: e.target.value})}
                  placeholder="¿En qué máquina o sector se usa? Ej: Motor de conformadora"
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial</label>
                  <input type="number" min="0" value={formNuevo.stock_actual} onChange={(e) => setFormNuevo({...formNuevo, stock_actual: parseInt(e.target.value) || 0})}
                    className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo</label>
                  <input type="number" min="0" value={formNuevo.stock_minimo} onChange={(e) => setFormNuevo({...formNuevo, stock_minimo: parseInt(e.target.value) || 0})}
                    className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio unitario de referencia (neto, $)</label>
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                  <input type="number" min="0" step="0.01" value={formNuevo.ultimo_precio_unitario}
                    onChange={(e) => setFormNuevo({...formNuevo, ultimo_precio_unitario: parseFloat(e.target.value) || 0})}
                    className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                  <select value={formNuevo.alicuota_iva} onChange={(e) => setFormNuevo({...formNuevo, alicuota_iva: Number(e.target.value)})}
                    title="IVA del precio" className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                    {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{textoAlicuota(a)}</option>)}
                  </select>
                </div>
                {formNuevo.ultimo_precio_unitario > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Valor del stock inicial (con IVA): {formNuevo.stock_actual} u. × {formatearMoneda(formNuevo.ultimo_precio_unitario)} neto c/u = <b>{formatearMoneda(totalConIva(formNuevo.ultimo_precio_unitario, formNuevo.stock_actual, formNuevo.alicuota_iva))}</b>
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={formNuevo.es_critico} onChange={(e) => setFormNuevo({...formNuevo, es_critico: e.target.checked})} />
                Marcar como insumo crítico
              </label>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setModalNuevo(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                <button type="submit" disabled={enviando} className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-md disabled:bg-slate-300">
                  {enviando ? 'Guardando...' : 'Crear Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Insumo */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Editar: {modalEditar.nombre}</h2>
            <form onSubmit={handleEditar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input type="text" value={formEditar.nombre} onChange={(e) => setFormEditar({...formEditar, nombre: e.target.value})} required
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input type="text" value={formEditar.descripcion} onChange={(e) => setFormEditar({...formEditar, descripcion: e.target.value})}
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría de Gasto *</label>
                <select value={formEditar.categoria_gasto} onChange={(e) => setFormEditar({...formEditar, categoria_gasto: e.target.value})} required
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación / Uso</label>
                <input type="text" value={formEditar.ubicacion_uso} onChange={(e) => setFormEditar({...formEditar, ubicacion_uso: e.target.value})}
                  placeholder="¿En qué máquina o sector se usa?"
                  className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Actual</label>
                  <input type="number" min="0" value={formEditar.stock_actual} onChange={(e) => setFormEditar({...formEditar, stock_actual: parseInt(e.target.value) || 0})}
                    className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo</label>
                  <input type="number" min="0" value={formEditar.stock_minimo} onChange={(e) => setFormEditar({...formEditar, stock_minimo: parseInt(e.target.value) || 0})}
                    className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio unitario de referencia (neto, $)</label>
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                  <input type="number" min="0" step="0.01" value={formEditar.ultimo_precio_unitario}
                    onChange={(e) => setFormEditar({...formEditar, ultimo_precio_unitario: parseFloat(e.target.value) || 0})}
                    className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                  <select value={formEditar.alicuota_iva} onChange={(e) => setFormEditar({...formEditar, alicuota_iva: Number(e.target.value)})}
                    title="IVA del precio" className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                    {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{textoAlicuota(a)}</option>)}
                  </select>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {modalEditar.ultimo_proveedor
                    ? `Última compra: ${modalEditar.ultimo_proveedor} · ${formatearFecha(modalEditar.fecha_ultima_compra)}. Se actualiza solo al recibir mercadería.`
                    : 'Útil para valorizar el stock existente. Se actualiza solo al recibir mercadería.'}
                  {' '}Valor del stock (con IVA): {formEditar.stock_actual} u. × {formatearMoneda(formEditar.ultimo_precio_unitario)} neto c/u = <b>{formatearMoneda(totalConIva(formEditar.ultimo_precio_unitario, formEditar.stock_actual, formEditar.alicuota_iva))}</b>
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={formEditar.es_critico} onChange={(e) => setFormEditar({...formEditar, es_critico: e.target.checked})} />
                Marcar como insumo crítico
              </label>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setModalEditar(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                <button type="submit" disabled={enviando} className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-md disabled:bg-slate-300">
                  {enviando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ingreso Directo (Abastecimiento Crítico / Compra de Gerencia) */}
      {modalCompraDirecta && (
        <ModalCompraDirecta
          insumos={insumos}
          onCerrar={() => setModalCompraDirecta(false)}
          onRegistrado={({ pedidos, total, tiene_factura }) => {
            setModalCompraDirecta(false);
            const detalle = pedidos.map(p => `- ${p.cantidad_aprobada} u. de ${p.insumo_nombre}`).join('\n');
            alert(`Ingreso registrado (${pedidos.length} ${pedidos.length === 1 ? 'insumo' : 'insumos'}):\n${detalle}\n\nTotal con IVA: ${formatearMoneda(total)}${tiene_factura ? '\nFactura adjuntada.' : ''}\nStock y gasto actualizados.`);
            cargarInsumos();
          }}
        />
      )}

      {/* Modal Retirar Stock (Máquina / Operario) */}
      {modalRetirar && (
        <ModalRetiro
          insumo={modalRetirar}
          onCerrar={() => setModalRetirar(null)}
          onRetirado={() => { setModalRetirar(null); cargarInsumos(); }}
        />
      )}
    </div>
  );
}
