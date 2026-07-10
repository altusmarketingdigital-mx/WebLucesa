import fs from 'fs';

const fileNames = ['category.html', 'product.html', 'cart.html', 'checkout.html'];

const replacer = (fileContent) => {
    let content = fileContent;
    // Replace unsplash GPU generic with actual RTX 4070 image
    content = content.replace(/https:\/\/images\.unsplash\.com\/photo-1591488320449-011701bb6704\?w=\d+/g, 'https://m.media-amazon.com/images/I/71YvNoI2-iL._AC_SL1500_.jpg');
    // Replace unsplash CPU generic with actual Ryzen 5800X image
    content = content.replace(/https:\/\/images\.unsplash\.com\/photo-1591799264318-7b447ebde171\?w=\d+/g, 'https://m.media-amazon.com/images/I/61DYLoyNRWL._AC_SL1384_.jpg');
    // Replace unsplash generic with actual ASUS laptop image
    content = content.replace(/https:\/\/images\.unsplash\.com\/photo-1603302576837-37561b2e2302\?w=\d+/g, 'https://m.media-amazon.com/images/I/71h6PpGaz9L._AC_SL1500_.jpg');
    
    // Replace wikipedia payment icons with reliable clearbit logos
    content = content.replace(/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/b\/b5\/PayPal\.svg\/200px-PayPal\.svg\.png/g, 'https://logo.clearbit.com/paypal.com');
    content = content.replace(/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/4\/41\/Visa_Logo\.png/g, 'https://logo.clearbit.com/visa.com');
    content = content.replace(/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/b\/b7\/MasterCard_Logo\.svg/g, 'https://logo.clearbit.com/mastercard.com');
    
    // Replace mercado pago
    content = content.replace(/https:\/\/logodownload\.org\/wp-content\/uploads\/2019\/06\/mercado-pago-logo-0\.png/g, 'https://logo.clearbit.com/mercadopago.com.mx');
    
    return content;
};

for (const p of fileNames) {
    if (fs.existsSync(p)) {
        const original = fs.readFileSync(p, 'utf-8');
        const updated = replacer(original);
        if (original !== updated) {
            fs.writeFileSync(p, updated, 'utf-8');
            console.log(`Updated images in ${p}`);
        }
    }
}
