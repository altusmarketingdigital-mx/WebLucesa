/**
 * ShippingCalculator.jsx
 * Componente React para:
 *   1. Ingresar el código postal de destino
 *   2. Obtener cotizaciones vía API
 *   3. Mostrar las opciones de paquetería
 *   4. Seleccionar la opción deseada
 *   5. Propagar la selección al estado global del checkout
 *
 * Props:
 *   @prop {Array}    cartItems         - Items del carrito para enviarlos a CT
 *   @prop {Function} onShippingSelect  - Callback llamado cuando el usuario elige una paquetería:
 *                                        onShippingSelect({ empresa, total, codigoPostal })
 *
 * Ejemplo de uso en Checkout.jsx:
 *   <ShippingCalculator
 *     cartItems={cart}
 *     onShippingSelect={(opt) => setShipping(opt)}
 *   />
 */

import { useState, useCallback } from 'react';
import axios from 'axios';

// URL del backend — idealmente via variable de entorno
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3001' : '';


// ─── Íconos de empresa (puedes reemplazar con logos reales) ─────────────────
const COMPANY_ICONS = {
    estafeta:      '🚚',
    paquetexpress: '📦',
    dhl:           '✈️',
    fedex:         '🚀',
    ups:           '🟤',
};

function getCompanyIcon(empresa = '') {
    return COMPANY_ICONS[empresa.toLowerCase()] || '📮';
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

/**
 * Mapea los items del carrito al formato requerido por CT CONNECT.
 * Asume que cada item tiene: { sku, qty, precio, almacen, moneda }
 */
function mapCartToCT(cartItems) {
    return cartItems.map((item) => ({
        producto: item.sku || item.producto || item.id,
        cantidad:  String(item.qty ?? item.cantidad ?? 1),
        precio:    String(item.precio ?? item.price ?? 0),
        moneda:    item.moneda ?? 'MXN',
        almacen:   item.almacen ?? 'D2A',
    }));
}

// ─── Componente ─────────────────────────────────────────────────────────────
export default function ShippingCalculator({ cartItems = [], onShippingSelect }) {
    const [codigoPostal,   setCodigoPostal]   = useState('');
    const [cotizaciones,   setCotizaciones]   = useState([]);
    const [selected,       setSelected]       = useState(null);
    const [loading,        setLoading]        = useState(false);
    const [error,          setError]          = useState('');

    // ── Validación local del CP ──────────────────────────────────────────────
    const isValidCP = (cp) => /^\d{5}$/.test(cp);

    // ── Cotización ───────────────────────────────────────────────────────────
    const handleCotizar = useCallback(async () => {
        setError('');
        setCotizaciones([]);
        setSelected(null);

        if (!isValidCP(codigoPostal)) {
            setError('Por favor ingresa un código postal válido de 5 dígitos.');
            return;
        }
        if (!cartItems.length) {
            setError('El carrito está vacío.');
            return;
        }

        setLoading(true);
        try {
            const productos = mapCartToCT(cartItems);
            const { data } = await axios.post(`${API_BASE}/api/shipping/cotizar`, {
                destino: codigoPostal,
                productos
            });

            if (!data.cotizaciones?.length) {
                setError('No hay opciones de envío disponibles para ese código postal.');
                return;
            }

            setCotizaciones(data.cotizaciones);

        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Error al cotizar envío.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [codigoPostal, cartItems]);

    // ── Selección ────────────────────────────────────────────────────────────
    const handleSelect = (cotizacion) => {
        setSelected(cotizacion.empresa);
        if (typeof onShippingSelect === 'function') {
            onShippingSelect({
                empresa:      cotizacion.empresa,
                total:        cotizacion.total,
                codigoPostal: codigoPostal
            });
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="shipping-calculator" style={styles.container}>
            <h3 style={styles.title}>🚚 Calcular Envío</h3>

            {/* Input CP + botón */}
            <div style={styles.inputRow}>
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="Código Postal (ej. 83113)"
                    value={codigoPostal}
                    onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleCotizar()}
                    style={styles.input}
                    aria-label="Código Postal de destino"
                />
                <button
                    onClick={handleCotizar}
                    disabled={loading || !codigoPostal}
                    style={{
                        ...styles.btn,
                        opacity: loading || !codigoPostal ? 0.6 : 1
                    }}
                >
                    {loading ? 'Calculando...' : 'Calcular'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <p style={styles.error} role="alert">
                    ⚠️ {error}
                </p>
            )}

            {/* Lista de cotizaciones */}
            {cotizaciones.length > 0 && (
                <div style={styles.list}>
                    <p style={styles.listTitle}>Selecciona una opción de envío:</p>
                    {cotizaciones.map((cot) => {
                        const isSelected = selected === cot.empresa;
                        return (
                            <button
                                key={cot.empresa}
                                onClick={() => handleSelect(cot)}
                                style={{
                                    ...styles.option,
                                    ...(isSelected ? styles.optionSelected : {})
                                }}
                                aria-pressed={isSelected}
                            >
                                <span style={styles.optionLeft}>
                                    <span style={styles.icon}>{getCompanyIcon(cot.empresa)}</span>
                                    <span style={styles.empresa}>
                                        {cot.empresa.charAt(0).toUpperCase() + cot.empresa.slice(1)}
                                    </span>
                                </span>
                                <span style={styles.price}>{formatCurrency(cot.total)}</span>
                                {isSelected && (
                                    <span style={styles.check} aria-hidden="true">✔</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Confirmación */}
            {selected && (
                <p style={styles.confirmation}>
                    ✅ Envío seleccionado: <strong>
                        {selected.charAt(0).toUpperCase() + selected.slice(1)}
                    </strong> — {formatCurrency(cotizaciones.find(c => c.empresa === selected)?.total ?? 0)}
                </p>
            )}
        </div>
    );
}

// ─── Estilos en objeto (evita dependencia de CSS externo) ───────────────────
const styles = {
    container: {
        border:       '1px solid #e2e8f0',
        borderRadius: 10,
        padding:      '20px 24px',
        background:   '#f8fafc',
        marginBottom: 24,
        fontFamily:   'Inter, system-ui, sans-serif'
    },
    title: {
        margin:     '0 0 16px',
        fontSize:   17,
        fontWeight: 700,
        color:      '#1a202c'
    },
    inputRow: {
        display: 'flex',
        gap:     8
    },
    input: {
        flex:        1,
        padding:     '10px 14px',
        border:      '1px solid #cbd5e0',
        borderRadius: 6,
        fontSize:    15,
        outline:     'none'
    },
    btn: {
        padding:         '10px 18px',
        background:      '#2b6cb0',
        color:           '#fff',
        border:          'none',
        borderRadius:    6,
        cursor:          'pointer',
        fontWeight:      600,
        fontSize:        14,
        transition:      'background 0.2s'
    },
    error: {
        color:      '#c53030',
        marginTop:  10,
        fontSize:   14
    },
    list: {
        marginTop: 16
    },
    listTitle: {
        fontSize:   14,
        color:      '#4a5568',
        marginBottom: 8,
        fontWeight: 600
    },
    option: {
        display:       'flex',
        alignItems:    'center',
        width:         '100%',
        padding:       '12px 16px',
        marginBottom:  8,
        border:        '1.5px solid #e2e8f0',
        borderRadius:  8,
        background:    '#fff',
        cursor:        'pointer',
        textAlign:     'left',
        fontSize:      15,
        transition:    'all 0.15s'
    },
    optionSelected: {
        borderColor: '#2b6cb0',
        background:  '#ebf8ff'
    },
    optionLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flex: 1
    },
    icon:     { fontSize: 22 },
    empresa:  { fontWeight: 600, color: '#2d3748' },
    price:    { fontWeight: 700, color: '#2b6cb0', fontSize: 16 },
    check:    { marginLeft: 10, color: '#2b6cb0', fontWeight: 700 },
    confirmation: {
        marginTop:  14,
        fontSize:   14,
        color:      '#276749',
        background: '#f0fff4',
        border:     '1px solid #c6f6d5',
        padding:    '10px 14px',
        borderRadius: 6
    }
};
