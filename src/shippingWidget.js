/**
 * shippingWidget.js
 * Módulo de cotización de envío para el checkout en vanilla JS.
 * Se inicializa en checkout.html pasando los items del carrito.
 *
 * Uso en checkout.html:
 *   <script type="module">
 *     import { initShippingWidget } from './shippingWidget.js';
 *     initShippingWidget({
 *       containerSelector: '#shippingWidget',
 *       cartItems: lucesa_cart,
 *       onSelect: (shipping) => { window._selectedShipping = shipping; }
 *     });
 *   </script>
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : '';


const COMPANY_ICONS = {
    estafeta:      '🚚',
    paquetexpress: '📦',
    dhl:           '✈️',
    fedex:         '🚀',
    ups:           '🟤',
};

const formatMXN = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

/**
 * Mapea los items del carrito local al formato que espera CT CONNECT.
 * @param {Array} items  - Items del localStorage (lucesa_cart)
 */
function mapItemsToCT(items) {
    return items.map(item => ({
        producto: item.sku || item.clave || item.id,
        cantidad:  String(item.qty ?? item.quantity ?? 1),
        precio:    String(item.precio ?? item.price ?? 0),
        moneda:    'MXN',
        almacen:   item.almacen ?? 'D2A'
    }));
}

/**
 * Inicializa el widget de cotización de envío.
 * @param {object}   opts
 * @param {string}   opts.containerSelector  - Selector CSS del contenedor
 * @param {Array}    opts.cartItems           - Items del carrito
 * @param {Function} opts.onSelect            - Callback al elegir paquetería: ({ empresa, total, codigoPostal })
 */
export function initShippingWidget({ containerSelector, cartItems, onSelect }) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`[ShippingWidget] No se encontró el contenedor "${containerSelector}"`);
        return;
    }

    // ─── Render inicial ────────────────────────────────────────────────────
    container.innerHTML = `
        <div class="shipping-widget">
            <h4 style="margin:0 0 12px;font-size:15px;font-weight:700;">🚚 Calculadora de Envío</h4>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <input
                    id="sw-cp"
                    type="text"
                    inputmode="numeric"
                    maxlength="5"
                    placeholder="Código Postal (ej. 83113)"
                    style="flex:1;padding:10px 12px;border:1px solid #cbd5e0;border-radius:6px;font-size:15px;"
                />
                <button
                    id="sw-btn"
                    style="padding:10px 16px;background:#1a5c2c;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:14px;"
                >
                    Calcular
                </button>
            </div>
            <div id="sw-error" style="color:#c53030;font-size:13px;display:none;"></div>
            <div id="sw-list"  style="margin-top:10px;"></div>
            <div id="sw-selected" style="display:none;margin-top:10px;padding:10px 14px;background:#f0fff4;border:1px solid #c6f6d5;border-radius:6px;font-size:14px;color:#276749;"></div>
        </div>`;

    const cpInput    = document.getElementById('sw-cp');
    const calcBtn    = document.getElementById('sw-btn');
    const errorDiv   = document.getElementById('sw-error');
    const listDiv    = document.getElementById('sw-list');
    const selectedDiv= document.getElementById('sw-selected');

    let currentSelection = null;

    function showError(msg) {
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
    }
    function clearError() {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }

    // ─── Cotizar ─────────────────────────────────────────────────────────────
    async function cotizar() {
        clearError();
        listDiv.innerHTML = '';
        selectedDiv.style.display = 'none';
        currentSelection = null;

        const cp = cpInput.value.trim();
        if (!/^\d{5}$/.test(cp)) {
            showError('Ingresa un código postal válido de 5 dígitos.');
            return;
        }
        if (!cartItems || !cartItems.length) {
            showError('El carrito está vacío.');
            return;
        }

        calcBtn.disabled = true;
        calcBtn.textContent = 'Calculando...';

        try {
            const res  = await fetch(`${API_BASE}/api/shipping/cotizar`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ destino: cp, productos: mapItemsToCT(cartItems) })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al cotizar');
            if (!data.cotizaciones?.length) {
                showError('No hay opciones de envío disponibles para ese código postal.');
                return;
            }

            renderOptions(data.cotizaciones, cp);

        } catch (err) {
            showError('Error al conectar con el servicio de envíos: ' + err.message);
        } finally {
            calcBtn.disabled = false;
            calcBtn.textContent = 'Calcular';
        }
    }

    // ─── Render opciones ──────────────────────────────────────────────────────
    function renderOptions(cotizaciones, cp) {
        listDiv.innerHTML = '<p style="font-size:13px;color:#4a5568;font-weight:600;margin:0 0 8px;">Selecciona una opción:</p>';
        cotizaciones.forEach(cot => {
            const icon = COMPANY_ICONS[cot.empresa?.toLowerCase()] || '📮';
            const btn  = document.createElement('button');
            btn.style.cssText = `
                display:flex;align-items:center;width:100%;padding:11px 14px;margin-bottom:8px;
                border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;
                font-size:14px;text-align:left;transition:all .15s;`;
            btn.innerHTML = `
                <span style="font-size:22px;margin-right:10px;">${icon}</span>
                <span style="flex:1;font-weight:600;color:#2d3748;text-transform:capitalize;">${cot.empresa}</span>
                <span style="font-weight:700;color:#1a5c2c;font-size:16px;">${formatMXN(cot.total)}</span>`;
            btn.onclick = () => selectOption(cot, cp, btn);
            btn.dataset.empresa = cot.empresa;
            listDiv.appendChild(btn);
        });
    }

    // ─── Seleccionar opción ───────────────────────────────────────────────────
    function selectOption(cot, cp, clickedBtn) {
        // Reset all buttons
        listDiv.querySelectorAll('button').forEach(b => {
            b.style.borderColor = '#e2e8f0';
            b.style.background  = '#fff';
        });
        // Highlight selected
        clickedBtn.style.borderColor = '#1a5c2c';
        clickedBtn.style.background  = '#f0fff4';

        currentSelection = { empresa: cot.empresa, total: cot.total, codigoPostal: cp };

        selectedDiv.innerHTML = `✅ Envío seleccionado: <strong style="text-transform:capitalize;">${cot.empresa}</strong> — ${formatMXN(cot.total)}`;
        selectedDiv.style.display = 'block';

        if (typeof onSelect === 'function') {
            onSelect(currentSelection);
        }
    }

    // ─── Eventos ──────────────────────────────────────────────────────────────
    calcBtn.addEventListener('click', cotizar);
    cpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') cotizar(); });
}
