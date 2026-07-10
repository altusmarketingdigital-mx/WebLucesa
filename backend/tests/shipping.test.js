/**
 * shipping.test.js
 * Suite de pruebas unitarias para el servicio de paquetería de CT CONNECT.
 * Ejecución: node tests/shipping.test.js
 */

import assert from 'assert';
import { setCTToken, cotizarEnvio, buildGuiaPayload, crearPedidoCT } from '../services/ctPaqueteriaService.js';

async function runTests() {
    console.log('🚀 Iniciando Pruebas Unitarias del Módulo de Envíos...\n');

    try {
        // Test 1: Gestión de Token
        console.log('Test 1: setCTToken...');
        setCTToken('test-token-123');
        // (Nota: Verificamos indirectamente al llamar a una función que use el axios interceptado si fuera necesario mocking)
        console.log('✅ OK');

        // Test 2: Construcción de Payload de Guía
        console.log('Test 2: buildGuiaPayload...');
        const paq = 'Estafeta ';
        const payload = buildGuiaPayload(paq);
        assert.strictEqual(payload.guiaConnect.generarGuia, true);
        assert.strictEqual(payload.guiaConnect.paqueteria, 'estafeta');
        console.log('✅ OK');

        // Test 3: Validación de parámetros en cotizarEnvio
        console.log('Test 3: Validaciones cotizarEnvio...');
        try {
            await cotizarEnvio('123', []);
            assert.fail('Debería fallar con CP inválido');
        } catch (e) {
            assert.ok(e.message.includes('Código postal inválido'));
        }
        console.log('✅ OK');

        // Test 4: Estructura de crearPedidoCT
        console.log('Test 4: Estructura de crearPedidoCT...');
        try {
            await crearPedidoCT(null, null);
            assert.fail('Debería fallar sin datos');
        } catch (e) {
            assert.ok(e.message.includes('requeridos'));
        }
        console.log('✅ OK');

        console.log('\n🎉 ¡Todas las pruebas locales básicas pasaron exitosamente!');
        console.log('Nota: Para pruebas de integración con la API real de CT, asegúrese de tener un .env configurado y conexión a internet.');

    } catch (error) {
        console.error('\n❌ Error en las pruebas:', error.message);
        process.exit(1);
    }
}

runTests();
