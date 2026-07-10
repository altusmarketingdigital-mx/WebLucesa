document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    if (!orderId) {
        document.getElementById('loading').textContent = 'Error: No se especificó el ID del pedido.';
        return;
    }

    try {
        // Obtenemos todas las ventas del backend y buscamos la que necesitamos
        const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? 'http://localhost:3001'
          : '';
        const res = await fetch(`${API_BASE}/api/admin/sales`);

        const sales = await res.json();
        const sale = sales.find(s => s.id === orderId);

        if (!sale) {
            document.getElementById('loading').textContent = 'Error: Pedido no encontrado.';
            return;
        }

        const formatPrice = (price) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
        const formatDate = (dateString) => new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));

        // Poblar datos generales
        document.getElementById('rFolio').textContent = sale.id;
        document.getElementById('rFecha').textContent = formatDate(sale.fecha);
        document.getElementById('rMetodo').textContent = sale.metodo_pago;
        document.getElementById('rEstatus').textContent = sale.estatus;

        // Poblar datos de cliente
        document.getElementById('rClienteNombre').textContent = sale.cliente.nombre;
        document.getElementById('rClienteEmail').textContent = sale.cliente.email;
        document.getElementById('rClienteTelefono').textContent = sale.cliente.telefono;

        // Poblar tabla de artículos
        let itemsHtml = '';
        if (sale.items && sale.items.length > 0) {
            sale.items.forEach(item => {
                const itemName = item.title || item.nombre || `SKU ${item.sku || 'N/A'}`;
                const itemQty = item.quantity || item.qty || 1;
                const itemPrice = parseFloat(item.unit_price || item.precio) || 0;
                const importe = itemPrice * itemQty;
                
                itemsHtml += `
                    <tr>
                        <td>${itemQty}</td>
                        <td>${itemName}</td>
                        <td class="price">${formatPrice(itemPrice)}</td>
                        <td class="price">${formatPrice(importe)}</td>
                    </tr>
                `;
            });
        }
        document.getElementById('rTableBody').innerHTML = itemsHtml;
        document.getElementById('rTotal').textContent = formatPrice(sale.total);

        // Mostrar documento
        document.getElementById('loading').style.display = 'none';
        document.getElementById('invoiceBox').style.display = 'block';

        // Auto imprimir
        setTimeout(() => {
            window.print();
        }, 500);

    } catch(err) {
        console.error(err);
        document.getElementById('loading').textContent = 'Ocurrió un error al cargar la información. Revisa la consola.';
    }
});
