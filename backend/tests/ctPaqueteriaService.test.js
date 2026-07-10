/**
 * ctPaqueteriaService.test.js
 * Tests unitarios del servicio CT CONNECT con mocks de Axios.
 * Framework: Node.js nativo --experimental-vm-modules + jest (o vitest)
 *
 * Instalar: npm install --save-dev vitest
 * Ejecutar: npx vitest run
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de axios ANTES de importar el servicio
vi.mock('axios', () => {
    const mockAxios = {
        create: vi.fn(() => mockAxios),
        post:   vi.fn(),
        get:    vi.fn(),
        interceptors: {
            request: { use: vi.fn() }
        }
    };
    return { default: mockAxios };
});

import axios from 'axios';
import { cotizarEnvio, buildGuiaPayload, consultarGuia } from '../services/ctPaqueteriaService.js';

// ─── Datos de prueba ──────────────────────────────────────────────────────────
const PRODUCTOS_MOCK = [
    { producto: 'MOULOG1800', cantidad: '1', precio: '1708.9', moneda: 'MXN', almacen: 'D2A' }
];

const COTIZACIONES_MOCK = [
    { empresa: 'estafeta',      total: 165.49 },
    { empresa: 'paquetexpress', total: 145.58 }
];

// ─── cotizarEnvio ─────────────────────────────────────────────────────────────
describe('cotizarEnvio()', () => {

    beforeEach(() => vi.clearAllMocks());

    it('devuelve cotizaciones ordenadas de menor a mayor', async () => {
        axios.post.mockResolvedValueOnce({ data: { cotizaciones: COTIZACIONES_MOCK } });

        const result = await cotizarEnvio('83113', PRODUCTOS_MOCK);

        expect(result).toHaveLength(2);
        // Primer elemento debe ser el más barato
        expect(result[0].empresa).toBe('paquetexpress');
        expect(result[0].total).toBe(145.58);
    });

    it('lanza error si el código postal no es de 5 dígitos', async () => {
        await expect(cotizarEnvio('123', PRODUCTOS_MOCK))
            .rejects.toThrow('Código postal inválido');
    });

    it('lanza error si el array de productos está vacío', async () => {
        await expect(cotizarEnvio('83113', []))
            .rejects.toThrow('al menos un producto');
    });

    it('lanza error si CT responde sin cotizaciones', async () => {
        axios.post.mockResolvedValueOnce({ data: {} });

        await expect(cotizarEnvio('83113', PRODUCTOS_MOCK))
            .rejects.toThrow('Respuesta de CT inválida');
    });

    it('propaga error HTTP de CT con su status', async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 503, data: { message: 'Service Unavailable' } }
        });

        await expect(cotizarEnvio('83113', PRODUCTOS_MOCK))
            .rejects.toThrow('CT CONNECT error 503');
    });
});

// ─── buildGuiaPayload ─────────────────────────────────────────────────────────
describe('buildGuiaPayload()', () => {

    it('genera el payload correcto para una paquetería', () => {
        const payload = buildGuiaPayload('Estafeta');
        expect(payload).toEqual({
            guiaConnect: { generarGuia: true, paqueteria: 'estafeta' }
        });
    });

    it('lanza error si no se pasa paquetería', () => {
        expect(() => buildGuiaPayload('')).toThrow('requerido');
        expect(() => buildGuiaPayload(null)).toThrow('requerido');
    });
});

// ─── consultarGuia ────────────────────────────────────────────────────────────
describe('consultarGuia()', () => {

    beforeEach(() => vi.clearAllMocks());

    it('devuelve el detalle de CT para una guía válida', async () => {
        const mockDetalle = { guia: 'ABC123', estatus: 'En tránsito', ubicacion: 'CDMX' };
        axios.get.mockResolvedValueOnce({ data: mockDetalle });

        const result = await consultarGuia('ABC123');
        expect(result).toEqual(mockDetalle);
    });

    it('lanza error amigable si CT devuelve 404', async () => {
        axios.get.mockRejectedValueOnce({ response: { status: 404, data: {} } });
        await expect(consultarGuia('INEXISTENTE')).rejects.toThrow('no encontrada');
    });

    it('lanza error si el folio es vacío', async () => {
        await expect(consultarGuia('')).rejects.toThrow('requerido');
        await expect(consultarGuia('   ')).rejects.toThrow('requerido');
    });
});
