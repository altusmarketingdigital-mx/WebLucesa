import apiFetch from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    // Session check for admin
    const user = JSON.parse(localStorage.getItem('lucesa_user'));
    const token = localStorage.getItem('lucesa_token');
    
    if (!user || !token || !user.es_admin) {
        console.warn('[Admin] No valid session found. Redirecting to login.');
        window.location.href = '/login.html';
        return;
    }

    // Navigation logic
    const navLinks = document.querySelectorAll('.sidebar-menu .nav-link');
    const viewSections = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Show target section
            viewSections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });

            // Auto-close sidebar on mobile after clicking
            if (window.innerWidth <= 768) {
                document.querySelector('.sidebar').classList.remove('active');
            }
        });
    });

    // Sidebar toggle for mobile
    const toggleBtn = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.querySelector('.sidebar');

    if (toggleBtn && overlay && sidebar) {
        const toggleSidebar = () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        };

        toggleBtn.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar);

        // Actualizar el cierre automático al hacer clic en links
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                }
            });
        });
    }

    const formatPrice = (price) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
    const formatDate = (dateString) => new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));

    let allSales = []; // Para almacenar las ventas y usarlas en las notas

    function getStatusBadge(estatus) {
        const lower = estatus.toLowerCase();
        if (lower === 'pagado') return `<span class="status-badge status-pagado">${estatus}</span>`;
        if (lower === 'pendiente') return `<span class="status-badge status-pendiente">${estatus}</span>`;
        return `<span class="status-badge" style="background:#eee;color:#333">${estatus}</span>`;
    }

    // Load Dashboard Stats
    async function loadStats() {
        try {
            const res = await apiFetch('/api/admin/dashboard-stats');
            if (!res) return;
            const data = await res.json();
            
            document.getElementById('dashIncome').textContent = formatPrice(data.ingresosTotales);
            document.getElementById('dashSalesCount').textContent = data.totalVentas;
            document.getElementById('dashCustomers').textContent = data.clientesUnicos;
            
        } catch(e) { 
            console.error("Error loading stats:", e); 
            document.getElementById('dashIncome').textContent = "ERROR";
            document.getElementById('dashSalesCount').textContent = "N/A";
        }
    }

    // Load Sales / Orders Table
    async function loadSales() {
        try {
            const res = await apiFetch('/api/admin/sales');
            if (!res) return;
            const sales = await res.json();
            allSales = sales; // Guardar globalmente
            
            const dashTbody = document.getElementById('dashRecentSalesTable');
            const ordersTbody = document.getElementById('ordersTableBody');
            
            let dashHtml = '';
            let ordersHtml = '';
            
            if (sales.length === 0) {
                const emptyRow = '<tr><td colspan="7" style="text-align:center;">No hay registros</td></tr>';
                dashHtml = ordersHtml = emptyRow;
            } else {
                sales.forEach((sale, index) => {
                    // Pre-calculate rawId for absolute safety
                    const numericId = sale.rawId || (sale.id ? sale.id.replace('PED-', '') : null);
                    
                    // Only 5 latest for dashboard
                    if (index < 5) {
                        dashHtml += `
                            <tr>
                                <td><strong>${sale.id}</strong></td>
                                <td>${formatDate(sale.fecha)}</td>
                                <td>${sale.cliente.nombre}</td>
                                <td>${formatPrice(sale.total)}</td>
                                <td>${getStatusBadge(sale.estatus)}</td>
                            </tr>
                        `;
                    }
                    
                    // Detailed table for "Pedidos"
                    const canDelete = ['pendiente', 'abandonado'].includes(sale.estatus.toLowerCase());
                    
                    ordersHtml += `
                        <tr>
                            <td><strong>${sale.id}</strong></td>
                            <td>${formatDate(sale.fecha)}</td>
                            <td>
                                <div style="font-weight:600">${sale.cliente.nombre}</div>
                                <div style="font-size:0.8rem; color:var(--admin-text-muted)">${sale.cliente.email}</div>
                            </td>
                            <td>${sale.metodo_pago}</td>
                            <td style="font-weight:bold;">${formatPrice(sale.total)}</td>
                            <td>${getStatusBadge(sale.estatus)}</td>
                            <td>
                                <div style="display:flex; gap:5px;">
                                    <button class="btn-admin" onclick="window.openReceiptModal('${sale.id}')" title="Ver Detalles">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    ${canDelete ? `
                                        <button class="btn-admin" style="background:var(--admin-danger);" onclick="window.cancelOrder('${numericId}')" title="Eliminar Pedido">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            
            if(dashTbody) dashTbody.innerHTML = dashHtml;
            if(ordersTbody) ordersTbody.innerHTML = ordersHtml;
            
        } catch(e) { 
            console.error("Error loading sales:", e); 
            const errorRow = '<tr><td colspan="7" style="text-align:center; color:var(--admin-danger);">Error al cargar datos</td></tr>';
            const dashTbody = document.getElementById('dashRecentSalesTable');
            const ordersTbody = document.getElementById('ordersTableBody');
            if(dashTbody) dashTbody.innerHTML = errorRow;
            if(ordersTbody) ordersTbody.innerHTML = errorRow;
        }
    }

    // --- Custom Confirmation Modal Logic ---
    let pendingAction = null;

    window.showConfirmModal = function(title, message, callback) {
        document.getElementById('confirmTitle').textContent = title || '¿Estás seguro?';
        document.getElementById('confirmMessage').textContent = message || 'Esta acción no se puede deshacer.';
        pendingAction = callback;
        const modal = document.getElementById('confirmModal');
        modal.style.setProperty('display', 'flex', 'important');
    };

    window.closeConfirmModal = function() {
        const modal = document.getElementById('confirmModal');
        modal.style.setProperty('display', 'none', 'important');
        pendingAction = null;
    };

    document.getElementById('btnConfirmCancel').onclick = window.closeConfirmModal;
    document.getElementById('btnConfirmAction').onclick = async () => {
        if (pendingAction) {
            await pendingAction();
        }
        window.closeConfirmModal();
    };

    window.cancelOrder = function(rawId) {
        showConfirmModal(
            'Eliminar Pedido',
            `¿Estás seguro de eliminar el pedido #${rawId}? Esta acción es permanente.`,
            async () => {
                try {
                    console.log(`[Admin] Attempting to delete order ID: ${rawId}`);
                    const res = await apiFetch(`/api/admin/orders/${rawId}`, { method: 'DELETE' });
                    if (!res) return;
                    const data = await res.json();
                    
                    if (data.success) {
                        if (window.showCustomAlert) {
                            await window.showCustomAlert("Pedido eliminado correctamente.");
                        } else {
                            alert("Pedido eliminado.");
                        }
                        loadSales(); // Recargar datos
                        loadStats(); // Recargar estadísticas
                    } else {
                        alert("Error: " + data.error);
                    }
                } catch(e) { 
                    console.error("Error cancelling order:", e); 
                    alert("Error crítico al intentar eliminar el pedido. Revisa la consola.");
                }
            }
        );
    };

    window.closeReceiptModal = function() {
        const modal = document.getElementById('receiptModal');
        modal.style.setProperty('display', 'none', 'important');
    };

    // Load Customers Directory
    async function loadCustomers() {
        try {
            const res = await apiFetch('/api/admin/customers');
            if (!res) return;
            const customers = await res.json();
            const tbody = document.getElementById('customersTableBody');
            
            if (customers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay clientes registrados</td></tr>';
                return;
            }
            
            let html = '';
            customers.forEach(c => {
                html += `
                    <tr>
                        <td style="font-weight:600">${c.nombre}</td>
                        <td><a href="mailto:${c.email}" style="color:var(--admin-accent)">${c.email}</a></td>
                        <td>${c.telefono}</td>
                        <td style="text-align:center;">${c.numeroPedidos}</td>
                        <td style="font-weight:bold">${formatPrice(c.totalGastado)}</td>
                        <td>${formatDate(c.ultimoPedido)}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch(e) { 
            console.error("Error loading customers:", e); 
            document.getElementById('customersTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--admin-danger);">Error al cargar directorio</td></tr>';
        }
    }

    function getShippingStatusBadge(estatus) {
        const lower = estatus.toLowerCase();
        const map = {
            'pendiente':  { bg: '#ebf8ff', color: '#2b6cb0', label: 'Pendiente' },
            'generada':   { bg: '#faf5ff', color: '#6b46c1', label: 'Guía Generada' },
            'en_transito':{ bg: '#fffaf0', color: '#9c4221', label: 'En Tránsito' },
            'entregada':  { bg: '#f0fff4', color: '#276749', label: 'Entregada' },
            'cancelada':  { bg: '#fff5f5', color: '#c53030', label: 'Cancelada' }
        };
        const style = map[lower] || { bg: '#edf2f7', color: '#4a5568', label: estatus };
        return `<span class="status-badge" style="background:${style.bg}; color:${style.color}">${style.label}</span>`;
    }

    // Load Shipping Table
    async function loadShipping() {
        try {
            const res = await apiFetch('/api/shipping');
            if (!res) return;
            const data = await res.json();
            const tbody = document.getElementById('shippingTableBody');
            
            if (!data.success || data.shippingItems.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay registros de envío</td></tr>';
                return;
            }
            
            let html = '';
            data.shippingItems.forEach(s => {
                html += `
                    <tr>
                        <td><small>REF-${s.id}</small></td>
                        <td><strong>${s.order_id === 0 ? 'Manual/Test' : 'PED-' + s.order_id}</strong></td>
                        <td style="text-transform:uppercase">${s.paqueteria}</td>
                        <td style="font-weight:600">${formatPrice(s.costo_envio)}</td>
                        <td>
                            ${s.numero_guia 
                                ? `<code style="background:#f1f1f1; padding:2px 5px; border-radius:3px">${s.numero_guia}</code>`
                                : '<span style="color:#a0aec0; font-style:italic">No generada</span>'}
                        </td>
                        <td>${getShippingStatusBadge(s.estatus)}</td>
                        <td><small>${formatDate(s.fecha_actualizacion)}</small></td>
                        <td>
                            ${s.numero_guia ? `
                                <button class="btn-admin" style="padding:2px 8px; font-size:0.7rem; background:#4a5568" 
                                        onclick="window.trackShippingManual('${s.numero_guia}')">
                                    <i class="fas fa-search-location"></i> Track
                                </button>` : ''}
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch(e) { 
            console.error("Error loading shipping:", e); 
            document.getElementById('shippingTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--admin-danger);">Error al conectar con el servicio de envíos</td></tr>';
        }
    }

    // Modal para tracking (reutilizamos funciones del controlador si es posible o mockeamos)
    window.trackShippingManual = async function(guia) {
        try {
            const res = await apiFetch(`/api/shipping/guia/${guia}`);
            if (!res) return;
            const data = await res.json();
            alert(`Estado en CT CONNECT: ${JSON.stringify(data.detalle.estatus || data.detalle || 'No disponible')}`);
        } catch(e) { alert("Error al consultar guía: " + e.message); }
    };

    // Initialize all fetched data
    loadStats();
    loadSales();
    loadCustomers();
    loadShipping();

    // Refresh button listener
    const btnRefreshShipping = document.getElementById('btnRefreshShipping');
    if (btnRefreshShipping) {
        btnRefreshShipping.onclick = () => {
            btnRefreshShipping.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
            loadShipping().finally(() => {
                btnRefreshShipping.innerHTML = '<i class="fas fa-sync"></i> Actualizar Listado';
            });
        };
    }

    // --- INVENTORY LOGIC ---
    let inventoryData = [];
    async function loadInventory(query = '') {
        const tbody = document.getElementById('inventoryTableBody');
        const countSpan = document.getElementById('inventoryCount');
        if (!tbody) return;

        try {
            const url = query ? `/api/admin/inventory?search=${encodeURIComponent(query)}` : '/api/admin/inventory';
            const res = await apiFetch(url);
            if (!res) return;
            const data = await res.json();
            inventoryData = data.items;

            countSpan.textContent = `Mostrando ${data.items.length} de ${data.totalCount} productos`;

            if (inventoryData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;">No se encontraron productos</td></tr>';
                return;
            }

            let html = '';
            inventoryData.forEach(p => {
                const stockColor = p.stock > 0 ? 'var(--admin-success)' : 'var(--admin-danger)';
                const stockBg = p.stock > 0 ? 'rgba(56, 161, 105, 0.1)' : 'rgba(229, 62, 62, 0.1)';
                
                const marginPercent = p.costoCompra > 0 ? (((p.precio - p.costoCompra) / p.costoCompra) * 100).toFixed(0) : '0';

                html += `
                    <tr>
                        <td><code style="font-size:0.8rem;">${p.sku}</code></td>
                        <td>
                            <div style="font-weight:600; font-size:0.85rem; max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.nombre}">
                                ${p.nombre}
                            </div>
                            <div style="font-size:0.75rem; color:var(--admin-text-muted)">${p.marca}</div>
                        </td>
                        <td><span style="font-size:0.8rem; color:#666">${p.categoria}</span></td>
                        <td style="text-align:center;">
                            <div style="font-weight:700; color:${p.stock > 0 ? '#2d3748' : '#e53e3e'}">${p.stock}</div>
                            <div style="font-size:0.7rem; color: #a0aec0;">Vendidos: ${p.vendidos}</div>
                        </td>
                        <td style="color:#666">${formatPrice(p.costoCompra)}</td>
                        <td style="font-weight:bold; color:var(--admin-accent)">${formatPrice(p.precio)}</td>
                        <td style="text-align:center;"><span style="color:#38a169; font-weight:600; background:rgba(56,161,105,0.1); padding:2px 8px; border-radius:12px;">${marginPercent}%</span></td>
                        <td>
                            <span class="status-badge" style="background:${stockBg}; color:${stockColor}">
                                ${p.stock > 0 ? 'Disponible' : 'Sin Stock'}
                            </span>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (e) {
            console.error("Error loading inventory:", e);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error al cargar el inventario</td></tr>';
        }
    }

    // Search listener with debounce
    let searchTimeout;
    const searchInput = document.getElementById('inventorySearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadInventory(e.target.value);
            }, 500);
        });
    }

    // Add to navigation trigger
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetId = link.getAttribute('data-target');
            if (targetId === 'view-inventory') {
                loadInventory();
            }
        });
    });

    // Global Modal Function
    window.openReceiptModal = function(orderId) {
        const sale = allSales.find(s => s.id === orderId);
        if (!sale) return;

        let itemsHtml = '';
        if (sale.items && sale.items.length > 0) {
            sale.items.forEach(item => {
                // Determine item name securely, defaulting if unavailable
                const itemName = item.title || item.nombre || `SKU ${item.sku || 'N/A'}`;
                const itemQty = item.quantity || item.qty || 1;
                const itemPrice = parseFloat(item.unit_price || item.precio) || 0;
                
                itemsHtml += `
                    <div class="receipt-item">
                        <span style="flex-grow:1; padding-right:10px;">${itemQty}x ${itemName}</span>
                        <span>${formatPrice(itemPrice * itemQty)}</span>
                    </div>
                `;
            });
        } else {
            itemsHtml = '<p style="color:#666; font-style:italic;">No hay detalles de artículos</p>';
        }

        const modalBody = document.getElementById('receiptModalBody');
        modalBody.innerHTML = `
            <div style="text-align:center; margin-bottom: 20px;">
                <h2 style="margin:5px 0;">Lucesa Distribución</h2>
                <p style="color:#666; margin:0;">Comprobante de operación</p>
            </div>
            
            <table style="width:100%; margin-bottom:20px;">
                <tr><td style="color:#666; width:120px;">Folio Interno:</td> <td><strong>${sale.id}</strong></td></tr>
                <tr><td style="color:#666;">Fecha:</td> <td>${formatDate(sale.fecha)}</td></tr>
                <tr><td style="color:#666;">Estatus:</td> <td>${getStatusBadge(sale.estatus)}</td></tr>
            </table>

            <div style="background:#f4f6f9; padding: 15px; border-radius: 6px; margin-bottom:20px;">
                <h4 style="margin:0 0 10px 0; color:#333;">Datos del Cliente</h4>
                <p style="margin:2px 0;"><strong>Nombre:</strong> ${sale.cliente.nombre}</p>
                <p style="margin:2px 0;"><strong>Correo:</strong> ${sale.cliente.email}</p>
                <p style="margin:2px 0;"><strong>Teléfono:</strong> ${sale.cliente.telefono}</p>
            </div>

            <div style="border-top: 2px solid #333; margin-bottom: 10px;"></div>
            <h4 style="margin:10px 0;">Artículos</h4>
            ${itemsHtml}
            <div style="border-top: 2px solid #333; margin-top: 10px;"></div>

            <div style="display:flex; justify-content:space-between; margin-top:15px; font-size:1.1rem;">
                <div style="color:#666;">Método de Pago:</div>
                <div style="font-weight:600;">${sale.metodo_pago}</div>
            </div>
            <div class="receipt-total">
                Total: ${formatPrice(sale.total)}
            </div>
        `;

        document.getElementById('btnImprimir').onclick = function() {
            window.open(`/receipt.html?id=${sale.id}`, '_blank');
        };

        const modal = document.getElementById('receiptModal');
        modal.style.setProperty('display', 'flex', 'important');
    };

    // CSV Export Logic
    const btnExportCsv = document.getElementById('btnExportCsv');
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            if (!allSales || allSales.length === 0) {
                alert("No hay ventas para exportar.");
                return;
            }

            let csvContent = "ID Pedido,Fecha,Cliente,Email,Telefono,Metodo de Pago,Total,Estatus\n";

            allSales.forEach(sale => {
                const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

                const row = [
                    sale.id,
                    escapeCSV(formatDate(sale.fecha)),
                    escapeCSV(sale.cliente.nombre),
                    escapeCSV(sale.cliente.email),
                    escapeCSV(sale.cliente.telefono || 'N/A'),
                    escapeCSV(sale.metodo_pago),
                    sale.total,
                    escapeCSV(sale.estatus)
                ];
                csvContent += row.join(",") + "\n";
            });

            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            
            link.setAttribute("href", url);
            link.setAttribute("download", `Ventas_Lucesa_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
});
