import { initCart } from './cart.js';
import { initCheckout } from './checkout.js';
import apiFetch from './api.js';

// Global helper for instant product preview
window.setProductPreview = (id, data) => {
    localStorage.setItem('lucesa_product_preview', JSON.stringify({
        id: id,
        timestamp: Date.now(),
        data: data
    }));
};

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : '';

console.log('CyberTech E-commerce Prototype Initialized');

document.addEventListener('DOMContentLoaded', () => {
    // Initialize module features
    if (window.location.pathname.includes('cart')) {
        initCart();
    }
    if (window.location.pathname.includes('checkout') || window.location.href.includes('checkout')) {
        initCheckout();
    }

    // Update cart icon on page load
    updateCartIcon();

    // Basic interactions
    
    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId !== '#') {
                e.preventDefault();
                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Global Search Intercept
    const searchForms = document.querySelectorAll('.search-bar form, form#searchForm');
    searchForms.forEach(form => {
        const input = form.querySelector('input[type="text"]');
        if (!input) return;

        // Suggestions container
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'search-suggestions';
        suggestionsDiv.style.cssText = 'position:absolute; top:100%; left:0; right:0; background:white; border:1px solid #ddd; border-top:none; border-radius:0 0 8px 8px; z-index:2000; box-shadow:0 4px 12px rgba(0,0,0,0.1); display:none; max-height:300px; overflow-y:auto;';
        form.style.position = 'relative';
        form.appendChild(suggestionsDiv);

        let debounceTimer;
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const q = input.value.trim();
            if (q.length < 3) {
                suggestionsDiv.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/products?limit=5&search=${encodeURIComponent(q)}`);
                    const products = await res.json();
                    
                    if (products && products.length > 0) {
                         suggestionsDiv.innerHTML = products.map(p => {
                            const imgSrc = (p.imagen && p.imagen.startsWith('http'))
                                ? `${API_BASE}/api/image-proxy?url=${encodeURIComponent(p.imagen)}`
                                : '/assets/no-image.png';
                            
                            const prodData = JSON.stringify(p).replace(/"/g, '&quot;');
                            return `
                            <a href="/product.html?id=${p.clave || p.numParte}" onclick="window.setProductPreview('${p.clave || p.numParte}', ${prodData})" style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; text-decoration:none; color:inherit;">
                                <img src="${imgSrc}" onerror="this.src='/assets/no-image.png'" style="width:40px; height:40px; object-fit:contain;">
                                <div style="font-size:13px; line-height:1.2; flex:1;">
                                    <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.nombre}</div>
                                    <div style="color:var(--color-primary); font-weight:700;">$${p.precio}</div>
                                </div>
                            </a>
                        `}).join('') + `<div style="padding:10px; text-align:center; background:#f9f9f9;"><a href="/category.html?search=${encodeURIComponent(q)}" style="font-size:12px; color:var(--color-primary); font-weight:600;">Ver todos los resultados</a></div>`;
                        suggestionsDiv.style.display = 'block';
                    } else {
                        suggestionsDiv.style.display = 'none';
                    }
                } catch (err) {
                    console.error('Error fetching suggestions:', err);
                }
            }, 300);
        });

        // Hide suggestions on blur (with delay for clicks)
        document.addEventListener('click', (e) => {
            if (!form.contains(e.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (input.value.trim().length > 0) {
                window.location.href = `/category.html?search=${encodeURIComponent(input.value.trim())}`;
            }
        });
    });



// Fetch Dynamic Categories for the Mega Menu
    const megaMenu = document.getElementById('dynamicMegaMenu');
    if (megaMenu) {
        const CACHE_KEY = 'lucesa_categories_cache';
        const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

        const renderCategories = (data) => {
            const categories = data.categories;
            if (!categories || categories.length === 0) {
                megaMenu.innerHTML = '<div style="padding:1rem;">No hay categorías disponibles</div>';
                return;
            }
            
            // Limit to 8 categories to keep the grid design clean
            const topCats = categories.slice(0, 8); 
            
            let html = '';
            topCats.forEach(cat => {
                html += `<div class="menu-column">
                            <h4>${cat.name}</h4>`;
                            
                // Limit subcategories to 5 per column
                const topSubcats = cat.subcategories.slice(0, 5);
                topSubcats.forEach(sub => {
                    html += `<a href="/category.html?cat=${encodeURIComponent(cat.name)}&sub=${encodeURIComponent(sub)}">${sub}</a>`;
                });
                
                if (cat.subcategories.length > 5) {
                    html += `<a href="/category.html?cat=${encodeURIComponent(cat.name)}" class="view-more" style="font-weight:600; font-size: 0.85rem; margin-top: 5px; color: var(--primary-color);">Ver más...</a>`;
                }
                html += `</div>`;
            });
            
            megaMenu.innerHTML = html;
        };

        const loadCategories = async () => {
            try {
                // Check Cache
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) {
                        console.log('Loading categories from cache');
                        renderCategories(data);
                        return;
                    }
                }

                // Fetch from API
                const res = await apiFetch('/api/categories');
                if (!res) return;
                const data = await res.json();
                
                // Save to Cache
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    data,
                    timestamp: Date.now()
                }));

                renderCategories(data);
            } catch (err) {
                console.error("Error loading categories", err);
                megaMenu.innerHTML = '<div style="padding:1rem; color:red;">Error cargando categorías</div>';
            }
        };

        loadCategories();
    }
});

// --- Shopping Cart Global State ---
function getCart() {
    return JSON.parse(localStorage.getItem('lucesa_cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('lucesa_cart', JSON.stringify(cart));
    updateCartIcon();
}

function addToCart(sku, quantity = 1) {
    if (!sku || sku === 'undefined') {
        console.error('Intentando agregar un SKU inválido al carrito:', sku);
        return;
    }
    const cart = getCart();
    const existing = cart.find(item => item.sku === sku);
    if (existing) {
        existing.qty += quantity;
    } else {
        cart.push({ sku, qty: quantity });
    }
    saveCart(cart);
    
    // Feedback visual opcional
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:var(--color-primary); color:white; padding:12px 24px; border-radius:8px; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.15); animation: fadeUp 0.3s ease;';
    toast.innerHTML = '<i class="fas fa-check-circle"></i> Producto agregado al carrito';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}


function removeFromCart(sku) {
    const cart = getCart();
    saveCart(cart.filter(item => item.sku !== sku));
}

function updateCartQuantity(sku, change) {
    const cart = getCart();
    const item = cart.find(i => i.sku === sku);
    if (item) {
        item.qty += change;
        if (item.qty <= 0) {
            removeFromCart(sku);
            return;
        }
        saveCart(cart);
    }
}

function updateCartIcon() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'block' : 'none';
    });
}

// Expose to window for HTML onclick handlers
window.addToCart = addToCart;
window.getCart = getCart;
window.updateCartIcon = updateCartIcon;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;

function updateAuthUI() {
    const user = JSON.parse(localStorage.getItem('lucesa_user'));
    const authAction = document.querySelector('.header-actions a[href="/profile.html"]');
    
    if (user && authAction) {
        authAction.innerHTML = `
            <i class="fas fa-user-circle"></i>
            <span class="action-text">Hola, ${user.nombre}</span>
            ${user.es_admin ? '<span style="font-size:10px; background:var(--color-primary); color:white; padding:1px 4px; border-radius:4px; margin-left:4px;">Admin</span>' : ''}
        `;
    }
}

// Global exposure for onClick handlers
window.addToCart = addToCart;
window.getCart = getCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;

// Initialize cart UI and Auth UI on every page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartIcon();
    updateAuthUI();
});

// --- Help Modal Logic ---
function injectHelpModal() {
    if (document.getElementById('helpModal')) return;

    const modalHTML = `
        <div id="helpModal" class="help-modal-overlay">
            <div class="help-modal-container">
                <div class="help-modal-header">
                    <h2>Centro de Ayuda</h2>
                    <p>¿En qué podemos ayudarte hoy? Encuentra respuestas rápidas aquí.</p>
                    <button class="help-close-btn" onclick="closeHelpModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="help-modal-content">
                    <div class="help-categories" id="helpCatContainer">
                        <div class="help-cat-card" data-cat="envios">
                            <i class="fas fa-box"></i>
                            <span>Envíos</span>
                        </div>
                        <div class="help-cat-card" data-cat="pagos">
                            <i class="fas fa-credit-card"></i>
                            <span>Pagos</span>
                        </div>
                        <div class="help-cat-card" data-cat="devoluciones">
                            <i class="fas fa-undo"></i>
                            <span>Devoluciones</span>
                        </div>
                        <div class="help-cat-card" data-cat="facturacion">
                            <i class="fas fa-file-invoice"></i>
                            <span>Facturación</span>
                        </div>
                    </div>

                    <div class="help-section-title">
                        <i class="fas fa-question-circle"></i> <span id="faqTitle">Preguntas Frecuentes</span>
                        <button id="clearHelpFilter" style="display:none; margin-left:auto; font-size:12px; background:none; border:none; color:var(--color-primary); cursor:pointer; font-weight:600;">Ver todas</button>
                    </div>

                    <div class="help-accordion" id="helpAccordion">
                        <div class="accordion-item" data-cat="envios">
                            <div class="accordion-header">
                                <h4>¿Cómo rastrear mi pedido?</h4>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                            <div class="accordion-content">
                                <p>Una vez que tu pedido sea enviado, recibirás un correo electrónico con el número de guía y el enlace de seguimiento de la paqueteria (FedEx, Estafeta o DHL).</p>
                            </div>
                        </div>
                        <div class="accordion-item" data-cat="pagos">
                            <div class="accordion-header">
                                <h4>¿Cuáles son los métodos de pago?</h4>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                            <div class="accordion-content">
                                <p>Aceptamos tarjetas de crédito y débito a través de Mercado Pago y PayPal, así como transferencias SPEI y pagos en efectivo en OXXO.</p>
                            </div>
                        </div>
                        <div class="accordion-item" data-cat="facturacion">
                            <div class="accordion-header">
                                <h4>¿Cómo solicito una factura?</h4>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                            <div class="accordion-content">
                                <p>Puedes solicitar tu factura al finalizar tu compra o enviando un correo a luis.lucio@lucesademexico.com con tus datos fiscales y número de orden.</p>
                            </div>
                        </div>
                        <div class="accordion-item" data-cat="devoluciones">
                            <div class="accordion-header">
                                <h4>¿Qué garantía tienen los productos?</h4>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                            <div class="accordion-content">
                                <p>Todos nuestros productos cuentan con garantía directa de fabricante, que suele ser de 1 año. Nosotros te apoyamos con el proceso de gestión.</p>
                            </div>
                        </div>
                    </div>

                    <div class="help-footer-contact">
                        <div class="contact-info-small">
                            <h5>¿Necesitas más ayuda?</h5>
                            <p>Nuestro equipo de soporte está disponible de L-V 9am-6pm.</p>
                        </div>
                        <div class="contact-btns">
                            <a href="https://wa.me/525610177596" target="_blank" class="help-btn help-btn-whatsapp">
                                <i class="fab fa-whatsapp"></i> WhatsApp
                            </a>
                            <a href="mailto:luis.lucio@lucesademexico.com" class="help-btn help-btn-email">
                                <i class="far fa-envelope"></i> Email
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Accordion Logic
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        item.querySelector('.accordion-header').addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            accordionItems.forEach(i => i.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });

    // Category Filtering Logic
    const catCards = document.querySelectorAll('.help-cat-card');
    const clearBtn = document.getElementById('clearHelpFilter');
    const faqTitle = document.getElementById('faqTitle');

    catCards.forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.getAttribute('data-cat');
            
            // UI Feedback
            catCards.forEach(c => c.style.borderColor = 'var(--color-border)');
            card.style.borderColor = 'var(--color-primary)';
            card.style.background = 'white';

            // Filter FAQs
            accordionItems.forEach(item => {
                if (item.getAttribute('data-cat') === cat) {
                    item.style.display = 'block';
                    item.classList.add('active'); // Expand the filtered ones
                } else {
                    item.style.display = 'none';
                    item.classList.remove('active');
                }
            });

            faqTitle.textContent = `Preguntas sobre ${card.querySelector('span').textContent}`;
            clearBtn.style.display = 'block';
        });
    });

    clearBtn.addEventListener('click', () => {
        accordionItems.forEach(item => {
            item.style.display = 'block';
            item.classList.remove('active');
        });
        catCards.forEach(c => {
            c.style.borderColor = 'var(--color-border)';
            c.style.background = 'var(--color-bg-light)';
        });
        faqTitle.textContent = 'Preguntas Frecuentes';
        clearBtn.style.display = 'none';
    });

    // Close on overlay click
    document.getElementById('helpModal').addEventListener('click', (e) => {
        if (e.target.id === 'helpModal') closeHelpModal();
    });
}

window.openHelpModal = function() {
    injectHelpModal();
    const modal = document.getElementById('helpModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
};

window.closeHelpModal = function() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
};

// --- About Us Modal Logic ---
function injectAboutModal() {
    if (document.getElementById('aboutModal')) return;

    const modalHTML = `
        <div id="aboutModal" class="about-modal-overlay">
            <div class="about-modal-container">
                <div class="about-modal-header">
                    <h2>Acerca de Nosotros</h2>
                    <p>Conoce más sobre Lucesa Distribución y nuestro compromiso con la tecnología.</p>
                    <button class="about-close-btn" onclick="closeAboutModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="about-modal-content">
                    <div style="line-height: 1.8; color: var(--color-text-main);">
                        <p style="font-size: 16px; margin-bottom: 25px;">
                            <strong>Lucesa Distribución</strong> es una empresa líder en la distribución de soluciones tecnológicas integrales. Con años de experiencia en el mercado mexicano, nos especializamos en ofrecer lo último en hardware, software y servicios de TI para empresas y entusiastas de la tecnología.
                        </p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                            <div style="background: var(--color-bg-light); padding: 20px; border-radius: 16px; border: 1px solid var(--color-border);">
                                <h3 style="color: var(--color-primary); margin-bottom: 10px; font-size: 18px;"><i class="fas fa-bullseye"></i> Nuestra Misión</h3>
                                <p style="font-size: 14px; color: var(--color-text-muted);">Facilitar el acceso a la mejor tecnología mundial mediante una cadena de suministro eficiente, precios competitivos y un soporte técnico de excelencia.</p>
                            </div>
                            <div style="background: var(--color-bg-light); padding: 20px; border-radius: 16px; border: 1px solid var(--color-border);">
                                <h3 style="color: var(--color-primary); margin-bottom: 10px; font-size: 18px;"><i class="fas fa-eye"></i> Nuestra Visión</h3>
                                <p style="font-size: 14px; color: var(--color-text-muted);">Ser el distribuidor tecnológico preferido en México, reconocido por nuestra confiabilidad, innovación y compromiso con el éxito de nuestros clientes.</p>
                            </div>
                        </div>

                        <h3 style="margin-bottom: 15px; border-bottom: 2px solid var(--color-accent); display: inline-block; padding-bottom: 5px;">Nuestros Valores</h3>
                        <ul style="list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                            <li style="background: white; padding: 15px; border-radius: 12px; border: 1px solid var(--color-border); text-align: center;">
                                <i class="fas fa-handshake" style="font-size: 24px; color: var(--color-secondary); margin-bottom: 10px; display: block;"></i>
                                <strong style="display: block; margin-bottom: 5px;">Integridad</strong>
                                <span style="font-size: 12px; color: var(--color-text-muted);">Transparencia en cada transacción.</span>
                            </li>
                            <li style="background: white; padding: 15px; border-radius: 12px; border: 1px solid var(--color-border); text-align: center;">
                                <i class="fas fa-lightbulb" style="font-size: 24px; color: var(--color-secondary); margin-bottom: 10px; display: block;"></i>
                                <strong style="display: block; margin-bottom: 5px;">Innovación</strong>
                                <span style="font-size: 12px; color: var(--color-text-muted);">A la vanguardia tecnológica.</span>
                            </li>
                            <li style="background: white; padding: 15px; border-radius: 12px; border: 1px solid var(--color-border); text-align: center;">
                                <i class="fas fa-users" style="font-size: 24px; color: var(--color-secondary); margin-bottom: 10px; display: block;"></i>
                                <strong style="display: block; margin-bottom: 5px;">Servicio</strong>
                                <span style="font-size: 12px; color: var(--color-text-muted);">El cliente es nuestro centro.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Close on overlay click
    document.getElementById('aboutModal').addEventListener('click', (e) => {
        if (e.target.id === 'aboutModal') closeAboutModal();
    });
}

window.openAboutModal = function() {
    injectAboutModal();
    const modal = document.getElementById('aboutModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
};

window.closeAboutModal = function() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
};

// --- Terms and Conditions Modal Logic ---
function injectTermsModal() {
    if (document.getElementById('termsModal')) return;

    const modalHTML = `
        <div id="termsModal" class="terms-modal-overlay">
            <div class="terms-modal-container">
                <div class="terms-modal-header">
                    <h2>Términos y Condiciones</h2>
                    <p>Por favor, revisa nuestra política de uso y términos legales.</p>
                    <button class="terms-close-btn" onclick="closeTermsModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="terms-modal-content">
                    <div style="line-height: 1.8; color: var(--color-text-main);">
                        <p>Al acceder y utilizar este sitio web, usted acepta los siguientes términos y condiciones:</p>
                        
                        <h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--color-primary); font-size: 18px;">Uso del Sitio</h3>
                        <p>El uso de este sitio es responsabilidad del usuario. No se permite el uso de este sitio para fines ilícitos o que dañen la operación del servicio.</p>
                        
                        <h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--color-primary); font-size: 18px;">Precios y Disponibilidad</h3>
                        <p>Los precios mostrados están sujetos a cambios sin previo aviso. La disponibilidad de los productos depende de nuestro inventario y el de nuestros proveedores en tiempo real.</p>
                        
                        <h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--color-primary); font-size: 18px;">Envíos y Entregas</h3>
                        <p>Los tiempos de entrega son aproximados y pueden variar según la ubicación y el transportista.</p>
                        
                        <h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--color-primary); font-size: 18px;">Garantías</h3>
                        <p>Todos nuestros productos cuentan con garantía limitada del fabricante. Los términos específicos de garantía se incluyen con cada producto.</p>
                        
                        <p style="margin-top: 30px; font-size: 13px; color: var(--color-text-muted);">Última actualización: Marzo 2026.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Close on overlay click
    document.getElementById('termsModal').addEventListener('click', (e) => {
        if (e.target.id === 'termsModal') closeTermsModal();
    });
}

window.openTermsModal = function() {
    injectTermsModal();
    const modal = document.getElementById('termsModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
};

window.closeTermsModal = function() {
    const modal = document.getElementById('termsModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
};

// --- Privacy Modal Logic ---
function injectPrivacyModal() {
    if (document.getElementById('privacyModal')) return;

    const modalHTML = `
        <div id="privacyModal" class="privacy-modal-overlay">
            <div class="privacy-modal-container">
                <div class="privacy-modal-header">
                    <h2>Aviso de Privacidad</h2>
                    <p>En Lucesa Distribución valoramos tu privacidad y protegemos tus datos personales.</p>
                    <button class="privacy-close-btn" onclick="closePrivacyModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="privacy-modal-content">
                    <div style="line-height: 1.8; color: var(--color-text-main);">
                        <p>En <strong>Lucesa Distribución</strong>, valoramos su privacidad y estamos comprometidos a proteger sus datos personales de acuerdo con las leyes aplicables.</p>
                        
                        <h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--color-primary); font-size: 18px;">¿Qué información recolectamos?</h3>
                        <p>Recopilamos información necesaria para procesar sus pedidos y mejorar su experiencia de compra, incluyendo:</p>
                        <ul style="margin-left: 20px; margin-bottom: 15px;">
                            <li>Nombre completo y datos de contacto.</li>
                            <li>Dirección de envío y facturación.</li>
                            <li>Información de pago enviada a través de pasarelas seguras (Mercado Pago o PayPal).</li>
                            <li>Historial de navegación y preferencias en nuestro sitio.</li>
                        </ul>

                        <h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--color-primary); font-size: 18px;">Finalidad del tratamiento de datos</h3>
                        <p>Utilizamos su información para:</p>
                        <ul style="margin-left: 20px; margin-bottom: 15px;">
                            <li>Procesar y entregar sus pedidos.</li>
                            <li>Enviar notificaciones sobre el estado de su compra.</li>
                            <li>Brindar soporte técnico y atención al cliente.</li>
                            <li>Mejorar nuestros servicios y ofertas.</li>
                        </ul>

                        <h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--color-primary); font-size: 18px;">Protección de datos</h3>
                        <p>Implementamos medidas de seguridad técnicas y administrativas para garantizar que sus datos no sean robados, alterados o accesados por terceros no autorizados.</p>
                        
                        <p style="margin-top: 30px; font-size: 13px; color: var(--color-text-muted);">Última actualización: Marzo 2026.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Close on overlay click
    document.getElementById('privacyModal').addEventListener('click', (e) => {
        if (e.target.id === 'privacyModal') closePrivacyModal();
    });
}

window.openPrivacyModal = function() {
    injectPrivacyModal();
    const modal = document.getElementById('privacyModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
};

window.closePrivacyModal = function() {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
};

// Global click interceptor for Modal links (Help, About, Terms & Privacy)
document.addEventListener('click', (e) => {
    const helpLink = e.target.closest('a[href="/help.html"]');
    if (helpLink) {
        e.preventDefault();
        window.openHelpModal();
        return;
    }

    const aboutLink = e.target.closest('a[href="/about.html"]');
    if (aboutLink) {
        e.preventDefault();
        window.openAboutModal();
        return;
    }

    const termsLink = e.target.closest('a[href="/terms.html"]');
    if (termsLink) {
        e.preventDefault();
        window.openTermsModal();
        return;
    }

    const privacyLink = e.target.closest('a[href="/privacy.html"]');
    if (privacyLink) {
        e.preventDefault();
        window.openPrivacyModal();
        return;
    }
});
