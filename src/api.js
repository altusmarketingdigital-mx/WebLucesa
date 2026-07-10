/**
 * api.js
 * Wrapper centralizado para fetch que maneja:
 * - Inyección automática de token JWT.
 * - Redirección a login en caso de error 401 (Sesión expirada).
 * - Manejo base de la URL de la API.
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : ''; // Ruta relativa para producción (Hostinger)

let sessionExpiredAlertShown = false;

/**
 * Muestra un mensaje emergente personalizado y centrado
 */
function showCustomAlert(message, type = 'info') {
  console.log('[API] showCustomAlert triggered:', { message, type });
  
  // Limpieza inicial
  const existing = document.getElementById('lucesa-alert-overlay');
  if (existing) existing.remove();

  // Crear el overlay directamente con el contenido
  const overlay = document.createElement('div');
  overlay.id = 'lucesa-alert-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85); /* Fondo más oscuro para mayor énfasis */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000000; /* Z-index extremo */
  `;

  const iconColor = type === 'error' ? '#ff4d4d' : '#4dabff';
  const icon = type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';

  overlay.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 20px; text-align: center; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 2px solid ${iconColor};">
      <div style="font-size: 4rem; color: ${iconColor}; margin-bottom: 20px;">
        <i class="fas ${icon}"></i>
      </div>
      <h2 style="font-size: 1.5rem; margin-bottom: 15px; color: #1a1a1a; font-family: sans-serif;">Mensaje del Sistema</h2>
      <p style="font-size: 1.1rem; line-height: 1.4; color: #444; margin-bottom: 30px; font-family: sans-serif;">
        ${message}
      </p>
      <button id="lucesa-alert-btn" style="width: 100%; padding: 15px; background: #123e66; color: white; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: bold; cursor: pointer;">
        CONTINUAR
      </button>
    </div>
  `;

  if (!document.body) {
    console.warn('[API] document.body not found, skipping alert');
    return Promise.resolve();
  }

  document.body.appendChild(overlay);
  console.log('[API] Alert overlay appended');

  return new Promise((resolve) => {
    // Función de cierre compartida
    const closeAlert = () => {
      console.log('[API] Closing alert');
      overlay.remove();
      resolve();
    };

    // Cerrar con botón
    const btn = document.getElementById('lucesa-alert-btn');
    if (btn) btn.onclick = closeAlert;

    // Failsafe: Cerrar al hacer clic en el fondo vacío (shadow)
    overlay.onclick = (e) => {
      if (e.target.id === 'lucesa-alert-overlay') {
        console.log('[API] Failsafe: Closing alert via background click');
        closeAlert();
      }
    };

    // Timeout de emergencia si todo falla
    if (!btn) {
      console.warn('[API] Close button not found, resolving in 3s automatically');
      setTimeout(closeAlert, 3000);
    }
  });
}

// Hacerlo disponible globalmente para otros módulos
window.showCustomAlert = showCustomAlert;

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('lucesa_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401) {
      if (!sessionExpiredAlertShown) {
        sessionExpiredAlertShown = true;
        console.warn('Sesión expirada o no autorizada. Redirigiendo a login...');
        localStorage.removeItem('lucesa_token');
        localStorage.removeItem('lucesa_user');
        
        // Evitar alertas infinitas si ya estamos en una página pública o login
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
          await showCustomAlert('Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo.', 'error');
          window.location.href = '/login.html';
        }
      }
      return null;
    }

    return response;
  } catch (error) {
    console.error(`Error en apiFetch (${endpoint}):`, error);
    throw error;
  }
}

export default apiFetch;
