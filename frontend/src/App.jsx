import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/login';
import PanelSupervisor from './components/PanelSupervisor';
import PanelCotizacion from './components/PanelCotizacion';
import PanelAprobacion from './components/PanelAprobacion';
import CatalogoInsumos from './components/CatalogoInsumos';
import ControlGastos from './components/ControlGastos';
import OrdenesCompra from './components/OrdenesCompra';
import GestionUsuarios from './components/GestionUsuarios';
import PanelServiciosExternos from './components/PanelServiciosExternos';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Panel Supervisor - Flujo de Compras */}
        <Route path="/supervisor" element={<PanelSupervisor />} />

        {/* Panel Cotización - Patricio */}
        <Route path="/cotizacion" element={<PanelCotizacion />} />

        {/* Panel Aprobación - Miguel */}
        <Route path="/aprobaciones" element={<PanelAprobacion />} />

        {/* Catálogo de Insumos - Admin */}
        <Route path="/catalogo" element={<CatalogoInsumos />} />

        {/* Control de Gastos - Gerencia y Admin */}
        <Route path="/gastos" element={<ControlGastos />} />

        {/* Órdenes de Compra - Admin */}
        <Route path="/ordenes-compra" element={<OrdenesCompra />} />

        {/* Gestión de Usuarios - Admin */}
        <Route path="/usuarios" element={<GestionUsuarios />} />

        {/* Servicios Externos y Sierras - Admin */}
        <Route path="/servicios-externos" element={<PanelServiciosExternos />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
