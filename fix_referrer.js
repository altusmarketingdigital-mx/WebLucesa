import fs from 'fs';

const files = ['index.html', 'category.html', 'product.html', 'cart.html', 'checkout.html', 'profile.html'];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('name="referrer"')) {
       // Insert it right after the <head> tag
        content = content.replace('<head>', '<head>\n    <meta name="referrer" content="strict-origin-when-cross-origin" />');
       fs.writeFileSync(f, content);
       console.log('Fixed', f);
    }
  }
});
