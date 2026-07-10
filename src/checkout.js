import apiFetch from './api.js';

export async function initCheckout() {
    window.initCheckout = initCheckout;
    console.log('Checkout module initialized');

    const cart = window.getCart ? window.getCart() : JSON.parse(localStorage.getItem('lucesa_cart')) || [];
    const container = document.getElementById('checkoutSummaryContainer');
    
    if (cart.length === 0) {
        if(container) container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No hay artículos en tu pedido.</div>';
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        if(confirmBtn) confirmBtn.disabled = true;
        return;
    }

    let subtotal = 0;
    let html = '';
    const formatPrice = (price) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
    const orderItems = [];

    // Build processing overlay HTML
    const overlayHtml = `
      <div id="paymentOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.95); z-index:9999; flex-direction:column; justify-content:center; align-items:center; padding: 20px;">
         <div id="processingState" style="text-align:center;">
             <i class="fas fa-spinner fa-spin" style="font-size:3rem; color:var(--color-primary); margin-bottom:1rem;"></i>
             <h2 style="font-size:1.5rem; margin:0; color: var(--color-text-main);">Procesando su pago...</h2>
             <p style="color:#666; margin-top:0.5rem;">No cierre esta ventana, por favor.</p>
         </div>
         <div id="successState" style="display:none; text-align:center;">
             <i class="fas fa-check-circle" style="font-size:4rem; color:var(--color-success); margin-bottom:1rem;"></i>
             <h2 style="font-size:1.8rem; margin:0; color: var(--color-text-main);">¡Pago Exitoso!</h2>
             <p style="color:#666; margin-top:0.5rem;">Gracias por tu compra. Te hemos enviado un correo con los detalles.</p>
         </div>
         <div id="errorState" style="display:none; text-align:center; max-width: 400px;">
             <i class="fas fa-exclamation-circle" style="font-size:4rem; color:var(--color-danger); margin-bottom:1rem;"></i>
             <h2 style="font-size:1.8rem; margin:0; color: var(--color-text-main);">Error al procesar</h2>
             <p id="errorMessage" style="color:#666; margin-top:0.5rem; margin-bottom: 1.5rem;">Lo sentimos, hubo un problema con la transacción.</p>
             <button onclick="document.getElementById('paymentOverlay').style.display='none'" class="btn-save" style="background: var(--color-text-main); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">Regresar al checkout</button>
         </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', overlayHtml);

    for (const item of cart) {
        try {
            const res = await apiFetch(`/api/products/${encodeURIComponent(item.sku)}`);
            if (!res) return;
            const data = await res.json();
            const p = data.articulo || data;
            
            let finalPrice = parseFloat(p.precio) || 0;
            if (p.moneda === 'USD' && p.tipoCambio) finalPrice = finalPrice * parseFloat(p.tipoCambio);
            
            const itemSubtotal = finalPrice * item.qty;
            subtotal += itemSubtotal;

            orderItems.push({
                sku: item.sku,
                title: p.nombre || `SKU ${item.sku}`,
                quantity: item.qty,
                unit_price: finalPrice,
                currency_id: "MXN"
            });

            const imageUrl = p.imagen ? `/api/image-proxy?url=${encodeURIComponent(p.imagen)}` : '/assets/no-image.png';

            html += `
             <div class="summary-product">
               <img src="${imageUrl}" alt="${p.nombre}">
               <div class="summary-product-details">
                 <h4 style="margin: 0 0 5px 0; font-size: 14px; font-weight: 500;">${p.nombre}</h4>
                 <div style="font-size:12px; color:#666;">Cant: ${item.qty}</div>
                 <div style="font-weight:700; color:var(--color-text-main); margin-top: 5px;">${formatPrice(itemSubtotal)}</div>
               </div>
             </div>
            `;
        } catch (e) {
            console.error('Error fetching checkout item', item.sku, e);
        }
    }

    if(container) container.innerHTML = html;
    
    // Recuperar selección de envío del carrito
    const selectedShipping = JSON.parse(localStorage.getItem('lucesa_selected_shipping')) || null;
    let shippingCost = selectedShipping ? parseFloat(selectedShipping.costo) : 0;
    
    // Si no hay envío seleccionado pero hay items, se podría manejar un default o mensaje
    // Por ahora, usamos el costo recuperado.
    let finalTotal = subtotal + shippingCost;
    
    const subtotalEl = document.getElementById('checkoutSubtotal');
    if(subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    
    const shippingEl = document.getElementById('checkoutShipping');
    const totalEl = document.getElementById('checkoutTotal');
    const confirmBtn = document.getElementById('confirmPaymentBtn');

    const updateShippingUI = () => {
        if(shippingEl) {
            if (shippingCost === 0 && !selectedShipping) {
                shippingEl.textContent = 'A calcular en carrito';
                shippingEl.style.color = '#999';
            } else if (shippingCost === 0) {
                shippingEl.textContent = 'Gratis';
                shippingEl.style.color = 'var(--color-success)';
            } else {
                shippingEl.textContent = formatPrice(shippingCost);
                shippingEl.style.color = 'var(--color-text-main)';
            }
        }
        
        finalTotal = subtotal + shippingCost;
        if(totalEl) totalEl.textContent = formatPrice(finalTotal);
        if (confirmBtn && !confirmBtn.innerHTML.includes('Procesando')) {
            confirmBtn.innerHTML = `Confirmar Pago de ${formatPrice(finalTotal)}`;
        }
    };
    
    updateShippingUI();
    
    // Update the static radio button text in checkout.html to match the actual calculated cost
    const radioEstantarTitle = document.querySelector('input[name="shipping"]:checked ~ .radio-card-content .radio-card-title');
    const radioEstandarDesc = document.querySelector('input[name="shipping"]:checked ~ .radio-card-content .radio-card-desc');
    const radioEstandarPrice = document.querySelector('input[name="shipping"]:checked ~ .radio-card-content .radio-card-price');
    
    if (radioEstandarPrice) {
        if (selectedShipping) {
            if (radioEstantarTitle) radioEstantarTitle.textContent = selectedShipping.paqueteria ? `Envío Estándar (${selectedShipping.paqueteria})` : 'Envío Estándar';
            if (radioEstandarDesc && selectedShipping.tiempoEntrega) radioEstandarDesc.textContent = `Aprox. ${selectedShipping.tiempoEntrega}`;
        }
    
        if (shippingCost === 0) {
            radioEstandarPrice.textContent = 'Gratis';
            radioEstandarPrice.style.color = 'var(--color-primary)';
        } else {
            radioEstandarPrice.textContent = formatPrice(shippingCost);
            radioEstandarPrice.style.color = 'var(--color-text-main)';
        }
    }

    // Add event listener to update totals when selecting a different shipping option (like Express)
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const priceTextEl = e.target.nextElementSibling.querySelector('.radio-card-price');
            if (priceTextEl) {
                const text = priceTextEl.textContent.trim().toLowerCase();
                if (text === 'gratis') {
                    shippingCost = 0;
                } else {
                    const extracted = text.replace(/[^0-9.-]+/g, "");
                    shippingCost = parseFloat(extracted) || 0;
                }
                updateShippingUI();
            }
        });
    });

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
             // Immediate visual feedback
             confirmBtn.disabled = true;
             const originalHtml = confirmBtn.innerHTML;
             confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

             const selectedPaymentEl = document.querySelector('input[name="payment"]:checked');
             const paymentMethod = selectedPaymentEl ? selectedPaymentEl.value : 'mercadopago';

             const overlay = document.getElementById('paymentOverlay');
             const processingState = document.getElementById('processingState');
             const successState = document.getElementById('successState');
             const errorState = document.getElementById('errorState');
             const errorMessage = document.getElementById('errorMessage');

             const showError = (msg) => {
                 processingState.style.display = 'none';
                 successState.style.display = 'none';
                 errorState.style.display = 'block';
                 errorMessage.textContent = msg;
             };
             
             processingState.style.display = 'block';
             successState.style.display = 'none';
             errorState.style.display = 'none';
             overlay.style.display = 'flex';
             
             if (paymentMethod === 'mercadopago') {
                 try {
                     // Prepare items for Mercado Pago format
                     const mpItems = [...orderItems];
                     
                     if (shippingCost > 0) {
                         mpItems.push({
                             title: "Costo de Envío",
                             quantity: 1,
                             unit_price: shippingCost,
                             currency_id: "MXN"
                         });
                     }

                     const response = await apiFetch('/api/create_preference', {
                         method: 'POST',
                         body: JSON.stringify({ items: mpItems })
                     });

                     if (!response) {
                         if (overlay) overlay.style.display = 'none';
                         confirmBtn.innerHTML = originalHtml; // Use originalHtml for consistency
                         confirmBtn.disabled = false;
                         return;
                     }

                     const prefData = await response.json();
                     
                     if (!response.ok) {
                         if (prefData.error === 'TOKEN_PLACEHOLDER') {
                             showError('⚠️ CONFIGURACIÓN REQUERIDA: Debes configurar tu Access Token real de Mercado Pago en el archivo .env .');
                         } else {
                             showError('Error al conectar con Mercado Pago: ' + (prefData.message || prefData.error));
                         }
                         confirmBtn.innerHTML = originalHtml; // Use originalHtml for consistency
                         confirmBtn.disabled = false;
                         return;
                     }

                     // Obtener usuario actual de localStorage
                     const userData = JSON.parse(localStorage.getItem('lucesa_user')) || null;
                     const clienteInfo = userData ? { 
                         nombre: `${userData.nombre} ${userData.apellido || ''}`.trim(), 
                         email: userData.email, 
                         telefono: userData.telefono || 'N/A' 
                     } : { nombre: 'Invitado Web', email: 'invitado@lucesademexico.com', telefono: 'N/A' };

                     if (prefData.init_point) {
                         // Registrar orden real en backend
                         await apiFetch('/api/orders', {
                             method: 'POST',
                             body: JSON.stringify({
                                 cliente: clienteInfo,
                                 userId: userData ? userData.id : null,
                                 metodo_pago: 'Mercado Pago',
                                 total: finalTotal,
                                 items: mpItems,
                                 shippingInfo: selectedShipping,
                                 estatus: 'Pendiente'
                             })
                         }).catch(e => console.error(e));

                         localStorage.removeItem('lucesa_cart');
                         window.location.href = prefData.init_point;
                     } else {
                         throw new Error(prefData.error || prefData.details || 'Error desconocido al crear la preferencia');
                     }
                 } catch(err) {
                     console.error('Error con Mercado Pago API:', err);
                     // Restore button
                     confirmBtn.disabled = false;
                     confirmBtn.innerHTML = originalHtml;

                     // Ocultar overlay si falla
                     if (overlay) overlay.style.display = 'none';
                     
                     // Notify admin of failed payment
                     apiFetch('/api/orders/abandoned', {
                         method: 'POST',
                         body: JSON.stringify({
                             metodo_pago: 'Mercado Pago',
                             total: finalTotal,
                             items: [...orderItems],
                             cliente: { nombre: 'Invitado Web', email: 'invitado@lucesademexico.com', telefono: 'N/A' }
                         })
                     }).catch(e => console.error(e));
                     showError('Lo sentimos, no pudimos conectar con la pasarela de pago. Por favor, verifica tu conexión o intenta con otro método.');
                 }
             } else {
                 // Generic success simulation for Transferencia, OXXO, etc.
                 const loadingText = processingState.querySelector('p');
                 if (loadingText) loadingText.innerHTML = 'Generando orden y enviando correo de confirmación...';

                 setTimeout(async () => {
                     processingState.style.display = 'none';
                     
                     // Customize success message based on payment method
                     const successTitle = successState.querySelector('h2');
                     const successDesc = successState.querySelector('p');
                     
                     if (paymentMethod === 'oxxo') {
                         try {
                             loadingText.innerHTML = 'Generando Ticket OXXO mediante Mercado Pago...';
                             const res = await apiFetch('/api/create_payment_oxxo', {
                                 method: 'POST',
                                 body: JSON.stringify({
                                     total: finalTotal,
                                     email: 'invitado@lucesademexico.com',
                                     items: shippingCost > 0 ? [...orderItems, { title: "Costo de Envío", quantity: 1, unit_price: shippingCost, currency_id: "MXN" }] : orderItems,
                                 })
                             });
                             if (!res) return;
                             const data = await res.json();
                             if (data.ticket_url) {
                                   const guiaHtml = data.numeroGuia ? `
                                       <div style="background:#f4f6f9; padding:15px; border-radius:8px; margin-top:15px; border:1px solid #e2e8f0;">
                                           <div style="font-size:0.85rem; color:#718096; margin-bottom:5px;">Número de Guía CT:</div>
                                           <div style="font-weight:700; color:#2d3748; font-family:monospace; font-size:1.1rem;">${data.numeroGuia}</div>
                                           <div style="font-size:0.75rem; color:#4a5568; margin-top:5px;"><i class="fas fa-info-circle"></i> Usa este número para rastrear en el portal de CT.</div>
                                       </div>
                                   ` : '';

                                   successDesc.innerHTML = `Tu ticket de OXXO está listo.<br><br>
                                      <a href="${data.ticket_url}" target="_blank" class="btn btn-primary" style="display:inline-block; margin-top:15px; text-decoration:none; padding:10px 20px;">
                                         <i class="fas fa-file-pdf"></i> Ver / Imprimir Ticket OXXO
                                      </a>
                                      ${guiaHtml}
                                   `;
                                   successState.style.display = 'block';
                                   localStorage.removeItem('lucesa_cart');
                                   return;
                             } else {
                                  throw new Error("No se obtuvo la URL del ticket OXXO");
                             }
                         } catch (e) {
                             console.error(e);
                             showError("Error al generar ticket OXXO: " + e.message);
                             return;
                         }
                     } else if (paymentMethod === 'transferencia') {
                         successTitle.textContent = '¡Pedido Recibido!';
                         successDesc.innerHTML = 'Por favor, realiza tu transferencia a la cuenta BBVA indicada.<br><br><strong>📧 Hemos enviado las instrucciones y tu Nota de Venta por correo electrónico.</strong>';
                     } else {
                         successTitle.textContent = '¡Pago Exitoso!';
                         successDesc.innerHTML = 'Gracias por tu compra.<br><br><strong>📧 Hemos enviado un correo con tu Nota de Venta y los detalles de envío.</strong>';
                     }
                     
                     successState.style.display = 'block';
                     
                     // Registrar orden simulada (solo para transferencia y otros, los anteriores ya retornaron
                      if (paymentMethod === 'transferencia') {
                          try {
                              const userData = JSON.parse(localStorage.getItem('lucesa_user')) || null;
                              const clienteInfo = userData ? { 
                                  nombre: `${userData.nombre} ${userData.apellido || ''}`.trim(), 
                                  email: userData.email, 
                                  telefono: userData.telefono || 'N/A' 
                              } : { nombre: 'Invitado Web', email: 'invitado@lucesademexico.com', telefono: 'N/A' };

                               const res = await apiFetch('/api/orders', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                      cliente: clienteInfo,
                                      userId: userData ? userData.id : null,
                                      metodo_pago: 'Transferencia Bancaria',
                                      total: finalTotal,
                                      items: shippingCost > 0 ? [...orderItems, { title: "Costo de Envío", quantity: 1, unit_price: shippingCost, currency_id: "MXN" }] : orderItems,
                                      shippingInfo: selectedShipping,
                                      estatus: 'Pendiente'
                                  })
                              });
                              if (!res) return;
                              const orderRes = await res.json();
                              
                              if (orderRes.numeroGuia) {
                                  successDesc.innerHTML += `
                                      <div style="background:#f4f6f9; padding:15px; border-radius:8px; margin-top:15px; border:1px solid #e2e8f0;">
                                          <div style="font-size:0.85rem; color:#718096; margin-bottom:5px;">Pre-guía de Envío CT:</div>
                                          <div style="font-weight:700; color:#2d3748; font-family:monospace; font-size:1.1rem;">${orderRes.numeroGuia}</div>
                                          <div style="font-size:0.75rem; color:#4a5568; margin-top:5px;"><i class="fas fa-clock"></i> Se activará tras confirmar tu pago.</div>
                                      </div>
                                  `;
                              }
                          } catch (e) { console.error("Error creating order (transferencia):", e); }

                          localStorage.removeItem('lucesa_cart');
                      }
                 }, 2000);
             }
        };
    }
}
