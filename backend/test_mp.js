import { MercadoPagoConfig, Preference } from 'mercadopago';
const mpCliente = new MercadoPagoConfig({ accessToken: 'APP_USR-1652504619526047-021817-15ada7d21195e170d3baa9bc6fb10515-2554158232' });

async function test() {
  try {
    const preference = new Preference(mpCliente);
    const result = await preference.create({
      body: {
        items: [{ title: "Test", quantity: 1, unit_price: 150, currency_id: "MXN" }],
        back_urls: {
          success: "https://lucesademexico.com",
          failure: "https://lucesademexico.com",
          pending: "https://lucesademexico.com"
        },
        auto_return: "approved"
      }
    });
    console.log("Success! ID:", result.id);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
