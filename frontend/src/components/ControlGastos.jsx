import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReporteGastos, abrirFactura, mensajeError } from '../api';
import { MESES, TIPO_COMPRA_ABASTECIMIENTO, TIPO_COMPRA_GERENCIA, compraDirecta, formatearMoneda, formatearFecha, getRolActual,
  redondear2, totalConIva, textoAlicuota } from '../constants';
import { useCategorias } from '../useCategorias';
import { abrirImpresionA4, escaparHtml } from '../imprimir';
import TrazabilidadSalidas from './TrazabilidadSalidas';
import { CargaSeccion, Spinner } from './ui';
import { claseBotonHeader, claseBotonPagina } from '../estilos';
import { ArrowLeft, Wallet, Wrench, FileDown, Paperclip } from 'lucide-react';

const PESTANA_COMPRAS = 'compras';
const PESTANA_MAQUINAS = 'maquinas';

const COLORES_CATEGORIA = {
  'Rodamientos y Retenes': 'bg-blue-600',
  'Gases y Soldadura': 'bg-orange-500',
  'Discos y Abrasivos': 'bg-red-600',
  'Aceites y Lubricantes': 'bg-amber-500',
  'Solventes y Químicos': 'bg-lime-600',
  'EPP y Seguridad': 'bg-green-600',
  'Consumibles y Limpieza': 'bg-purple-600',
  'Imprenta y Librería': 'bg-pink-500',
  'Planta Rosario (General)': 'bg-sky-700',
  'Taller Metalúrgico': 'bg-stone-600',
  'Camiones': 'bg-indigo-600',
  'Planta San Luis': 'bg-teal-600',
  'Sin categoría': 'bg-slate-400'
};

const ANIO_INICIAL = 2025;

const esAbastecimiento = (d) => d.tipo_compra === TIPO_COMPRA_ABASTECIMIENTO;
const esCompraGerencia = (d) => d.tipo_compra === TIPO_COMPRA_GERENCIA;
// Gasto real (lo que se pagó) = (precio neto × cantidad) × (1 + alícuota / 100)
const subtotalNeto = (d) => redondear2(d.precio_unitario * d.cantidad);
const gastoReal = (d) => totalConIva(d.precio_unitario, d.cantidad, d.alicuota_iva);
const sumarTotales = (filas) => redondear2(filas.reduce((s, d) => s + gastoReal(d), 0));

const enCamino = (d) => d.estado !== 'Recibido';

const textoEstadoCotizacion = (d) => enCamino(d) ? (d.numero_oc ? 'OC emitida · En camino' : 'Aprobado · Sin OC') : 'Recibido';

const textoOrigen = (d) => [
  compraDirecta(d)?.etiqueta || `Cotización · ${textoEstadoCotizacion(d)}`,
  d.numero_oc,
  d.numero_comprobante && `Comp. ${d.numero_comprobante}`,
  d.tiene_factura && 'Factura adjunta'
].filter(Boolean).join(' · ');

export default function ControlGastos() {
  const hoy = new Date();
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  const [mes, setMes] = useState(String(hoy.getMonth() + 1));
  const [categoria, setCategoria] = useState('');
  const [pestana, setPestana] = useState(PESTANA_COMPRAS);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const rol = getRolActual();
  const categorias = useCategorias();

  const anios = Array.from({ length: hoy.getFullYear() - ANIO_INICIAL + 1 }, (_, i) => String(hoy.getFullYear() - i));

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    setCargando(true);
    setError('');
    getReporteGastos({ anio, mes: anio ? mes : '', categoria })
      .then(setReporte)
      .catch(err => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, [anio, mes, categoria]);

  const periodoTexto = !anio ? 'Todos los períodos' : mes ? `${MESES[mes - 1]} ${anio}` : `Año ${anio}`;
  const categoriaTexto = categoria || 'Todas las categorías';
  const categoriasConGasto = reporte?.por_categoria.filter(c => c.total > 0) || [];
  const comprasAbastecimiento = reporte?.detalle.filter(esAbastecimiento) || [];
  const comprasGerencia = reporte?.detalle.filter(esCompraGerencia) || [];
  const totalAbastecimiento = sumarTotales(comprasAbastecimiento);
  const totalGerencia = sumarTotales(comprasGerencia);
  const totalGeneral = sumarTotales(reporte?.detalle || []);
  const totalNeto = redondear2((reporte?.detalle || []).reduce((s, d) => s + subtotalNeto(d), 0));
  const totalIva = redondear2(totalGeneral - totalNeto);

  const exportarPDF = () => {
    const filasResumen = categoriasConGasto.map(c => `
      <tr><td>${escaparHtml(c.categoria)}</td><td class="num">${c.cantidad_compras}</td>
      <td class="num">${formatearMoneda(c.total)}</td><td class="num">${c.porcentaje.toFixed(1)}%</td></tr>`).join('');
    const filasDetalle = reporte.detalle.map(d => `
      <tr><td>${formatearFecha(d.fecha)}</td><td>${escaparHtml(d.insumo)}</td><td>${escaparHtml(d.categoria_gasto)}</td>
      <td>${escaparHtml(d.proveedor || '-')}</td><td class="num">${d.cantidad}</td>
      <td class="num">${formatearMoneda(d.precio_unitario)}</td><td class="num">${formatearMoneda(subtotalNeto(d))}</td>
      <td class="num">${textoAlicuota(d.alicuota_iva)}</td><td class="num">${formatearMoneda(gastoReal(d))}</td>
      <td>${compraDirecta(d) ? `<b>${escaparHtml(textoOrigen(d))}</b>` : escaparHtml(textoOrigen(d))}</td></tr>`).join('');

    const cuerpo = `
      <div class="meta">
        <div><b>Período:</b> ${escaparHtml(periodoTexto)}<br><b>Categoría:</b> ${escaparHtml(categoriaTexto)}<br><b>Compras incluidas:</b> ${reporte.detalle.length}
          <br><b>Neto:</b> ${formatearMoneda(totalNeto)} · <b>IVA:</b> ${formatearMoneda(totalIva)}
          <br><b>Por Abastecimiento Crítico:</b> ${formatearMoneda(totalAbastecimiento)} (${comprasAbastecimiento.length} ingresos directos)
          <br><b>Por Compra Directa de Gerencia:</b> ${formatearMoneda(totalGerencia)} (${comprasGerencia.length} ingresos directos)</div>
        <div class="total"><span>GASTO TOTAL (CON IVA)</span><strong>${formatearMoneda(totalGeneral)}</strong></div>
      </div>
      <h2>Resumen por Categoría de Gasto</h2>
      <table><thead><tr><th>Categoría</th><th class="num">Compras</th><th class="num">Monto</th><th class="num">% del total</th></tr></thead>
        <tbody>${filasResumen || '<tr><td colspan="4">Sin gastos en el período</td></tr>'}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${reporte.detalle.length}</td><td class="num">${formatearMoneda(totalGeneral)}</td><td class="num">100%</td></tr></tfoot>
      </table>
      <h2>Detalle de Compras</h2>
      <table><thead><tr><th>Fecha</th><th>Insumo</th><th>Categoría</th><th>Proveedor</th><th class="num">Cant.</th><th class="num">P. Unit (Neto)</th><th class="num">Subtotal Neto</th><th class="num">IVA</th><th class="num">Total Final</th><th>Origen / Estado</th></tr></thead>
        <tbody>${filasDetalle || '<tr><td colspan="10">Sin compras en el período</td></tr>'}</tbody>
        <tfoot><tr><td colspan="6">TOTAL GENERAL</td><td class="num">${formatearMoneda(totalNeto)}</td><td></td><td class="num">${formatearMoneda(totalGeneral)}</td><td></td></tr></tfoot>
      </table>
      <p class="pie">Total Final = (Cantidad × Precio Unitario Neto) × (1 + IVA). Cada gasto se imputa al mes de aprobación de la compra.
        "Abastecimiento Crítico" = ingreso directo por excepción pre-aprobada por Gerencia (sin circuito de cotización).
        "Compra de Gerencia" = mercadería adquirida directamente por Gerencia fuera del circuito de cotización (excepción).</p>`;

    abrirImpresionA4({
      titulo: `Reporte de Gastos - ${periodoTexto}`,
      documento: 'Reporte de Gastos de Pañol y Compras',
      cuerpo
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Control de Gastos</p>
        </div>
        <button onClick={() => navigate(rol === 'admin' ? '/cotizacion' : '/aprobaciones')} className={claseBotonHeader()}>
          <ArrowLeft size={16} /> Volver al Panel
        </button>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex gap-2 border-b border-slate-300">
          {[[PESTANA_COMPRAS, 'Gastos de Compras', <Wallet size={16} />], [PESTANA_MAQUINAS, 'Consumo por Máquina', <Wrench size={16} />]].map(([id, etiqueta, icono]) => (
            <button key={id} onClick={() => setPestana(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 font-semibold rounded-t-lg border-b-2 -mb-px transition ${pestana === id ? 'border-blue-700 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {icono} {etiqueta}
            </button>
          ))}
        </div>

        {pestana === PESTANA_MAQUINAS ? <TrazabilidadSalidas /> : (
        <>
        {/* Filtros */}
        <section className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Año</label>
            <select value={anio} onChange={(e) => setAnio(e.target.value)} className="border rounded-lg p-2 bg-slate-50">
              <option value="">Todos</option>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mes</label>
            <select value={anio ? mes : ''} onChange={(e) => setMes(e.target.value)} disabled={!anio}
              className="border rounded-lg p-2 bg-slate-50 disabled:opacity-50">
              <option value="">Todo el año</option>
              {MESES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Categoría de Gasto</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="border rounded-lg p-2 bg-slate-50">
              <option value="">Todas</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {cargando && reporte && <Spinner className="h-5 w-5 border-2 mb-2.5" />}
          <button onClick={exportarPDF} disabled={!reporte || cargando} className={`ml-auto ${claseBotonPagina()}`}>
            <FileDown size={16} /> Exportar Reporte PDF
          </button>
        </section>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg">{error}</div>}

        {/* Al cambiar filtros se mantiene el reporte anterior atenuado: sin saltos de pantalla */}
        {!reporte ? <CargaSeccion /> : (
          <div className={`space-y-6 transition-opacity duration-200 ${cargando ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Resumen Ejecutivo */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-800 text-white rounded-lg shadow p-6 flex flex-col justify-center">
                <p className="text-sm text-slate-300 uppercase tracking-wide">Gasto Total (con IVA)</p>
                <p className="text-4xl font-bold mt-2">{formatearMoneda(totalGeneral)}</p>
                <p className="text-sm text-slate-300 mt-1">Neto {formatearMoneda(totalNeto)} · IVA {formatearMoneda(totalIva)}</p>
                <p className="text-sm text-slate-400 mt-2">{periodoTexto} · {categoriaTexto}</p>
                <p className="text-sm text-slate-400">{reporte.detalle.length} compras</p>
                {totalAbastecimiento > 0 && (
                  <p className="text-sm text-indigo-200 mt-2">
                    Incluye {formatearMoneda(totalAbastecimiento)} por Abastecimiento Crítico
                  </p>
                )}
                {totalGerencia > 0 && (
                  <p className="text-sm text-orange-300 mt-1">
                    Incluye {formatearMoneda(totalGerencia)} por Compra de Gerencia
                  </p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                <h2 className="text-lg font-bold text-slate-800 mb-4">Desglose por Categoría</h2>
                {categoriasConGasto.length === 0 ? (
                  <p className="text-slate-500">No hay gastos registrados en el período seleccionado.</p>
                ) : (
                  <div className="space-y-3">
                    {categoriasConGasto.map(c => (
                      <div key={c.categoria}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-semibold text-slate-700">{c.categoria}</span>
                          <span className="text-slate-600">{formatearMoneda(c.total)} · <span className="font-bold">{c.porcentaje.toFixed(1)}%</span></span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div className={`${COLORES_CATEGORIA[c.categoria] || 'bg-slate-500'} h-3 rounded-full transition-all`}
                            style={{ width: `${c.porcentaje}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Tabla Detallada */}
            <section className="bg-white rounded-lg shadow overflow-hidden">
              <h2 className="text-lg font-bold text-slate-800 p-4 border-b">Detalle de Compras</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-3 text-left text-slate-700 font-semibold">Fecha</th>
                      <th className="p-3 text-left text-slate-700 font-semibold">Insumo</th>
                      <th className="p-3 text-left text-slate-700 font-semibold">Categoría</th>
                      <th className="p-3 text-left text-slate-700 font-semibold">Proveedor</th>
                      <th className="p-3 text-right text-slate-700 font-semibold">Cantidad</th>
                      <th className="p-3 text-right text-slate-700 font-semibold">P. Unit (Neto)</th>
                      <th className="p-3 text-right text-slate-700 font-semibold">Subtotal Neto</th>
                      <th className="p-3 text-right text-slate-700 font-semibold">IVA</th>
                      <th className="p-3 text-right text-slate-700 font-semibold">Total Final</th>
                      <th className="p-3 text-left text-slate-700 font-semibold">Origen / Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.detalle.length === 0 && (
                      <tr><td colSpan="10" className="p-8 text-center text-slate-500">Sin compras en el período</td></tr>
                    )}
                    {reporte.detalle.map(d => (
                      <tr key={d.pedido_id} className={`border-b hover:bg-slate-50 ${compraDirecta(d)?.fila || ''}`}>
                        <td className="p-3 text-sm text-slate-600">{formatearFecha(d.fecha)}</td>
                        <td className="p-3 font-medium text-slate-800">{d.insumo}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-200 text-slate-700">{d.categoria_gasto}</span>
                        </td>
                        <td className="p-3 text-sm">{d.proveedor || '-'}</td>
                        <td className="p-3 text-right">
                          {d.cantidad}
                          {d.cantidad_solicitada != null && d.cantidad_solicitada !== d.cantidad && (
                            <p className="text-xs text-amber-700">de {d.cantidad_solicitada} solic.</p>
                          )}
                        </td>
                        <td className="p-3 text-right text-sm">{formatearMoneda(d.precio_unitario)}</td>
                        <td className="p-3 text-right text-sm">{formatearMoneda(subtotalNeto(d))}</td>
                        <td className="p-3 text-right text-sm whitespace-nowrap">
                          {formatearMoneda(redondear2(gastoReal(d) - subtotalNeto(d)))}
                          <p className="text-xs text-slate-500">{textoAlicuota(d.alicuota_iva)}</p>
                        </td>
                        <td className="p-3 text-right font-semibold">{formatearMoneda(gastoReal(d))}</td>
                        <td className="p-3">
                          {compraDirecta(d) ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${compraDirecta(d).badge}`} title={d.observaciones || ''}>
                              {compraDirecta(d).etiqueta}
                            </span>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${enCamino(d) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                              Cotización · {textoEstadoCotizacion(d)}
                            </span>
                          )}
                          <p className="text-xs text-slate-500 mt-1 space-x-2">
                            {d.numero_oc && <span className="font-mono font-semibold text-teal-800">{d.numero_oc}</span>}
                            {d.numero_comprobante && <span>Comp. {d.numero_comprobante}</span>}
                          </p>
                          {d.tiene_factura && (
                            <button onClick={() => abrirFactura(d.pedido_id)}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-700 border border-slate-300 bg-white rounded-md px-2 py-0.5 hover:bg-slate-50 whitespace-nowrap">
                              <Paperclip size={12} /> Ver Factura
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {reporte.detalle.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-800 text-white">
                        <td colSpan="6" className="p-3 font-bold">TOTAL GENERAL</td>
                        <td className="p-3 text-right font-bold">{formatearMoneda(totalNeto)}</td>
                        <td className="p-3 text-right font-bold">{formatearMoneda(totalIva)}</td>
                        <td className="p-3 text-right font-bold">{formatearMoneda(totalGeneral)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
