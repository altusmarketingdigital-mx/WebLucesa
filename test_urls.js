import https from 'https';
import http from 'http';

const urls = [
  "https://upload.wikimedia.org/wikipedia/commons/e/ea/4Gamers_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/8/8b/Acer-logo.svg",
  "https://acteck.com/cdn/shop/files/logo-acteck-black_170x@2x.png",
  "https://upload.wikimedia.org/wikipedia/commons/1/18/ADATA_Logo.svg",
  "https://www.adesso.com/wp-content/uploads/2021/03/adesso_logo.png",
  "https://www.alter.mx/wp-content/uploads/2022/10/Logo-Alter.png",
  "https://upload.wikimedia.org/wikipedia/commons/7/7c/AMD_Logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/4/49/AOC.svg",
  "https://upload.wikimedia.org/wikipedia/commons/9/91/APC_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
  "https://upload.wikimedia.org/wikipedia/commons/3/3b/Aruba_Networks_logo.svg",
  "https://www.aspel.com.mx/wp-content/uploads/2023/10/logo-aspel.svg",
  "https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/8/81/Autodesk_Logo_%282021%29.svg",
  "https://upload.wikimedia.org/wikipedia/commons/e/e0/Avast_logo.svg",
  "https://azor.com.mx/wp-content/uploads/2021/04/logo-azor.svg",
  "https://www.alliedtelesis.com/sites/default/files/images/global/logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/6/62/Amazfit_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
  "https://www.anviz.com/wp-content/uploads/2023/12/logo-anviz-1.png",
  "https://upload.wikimedia.org/wikipedia/commons/1/1a/Canon_wordmark.svg",
  "https://upload.wikimedia.org/wikipedia/commons/1/18/Epson_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg",
  "https://upload.wikimedia.org/wikipedia/commons/0/07/Lexmark_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/1/17/Logitech_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/8/82/Dell_Logo.png",
  "https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg",
  "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/9/90/Kyocera_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/6/6c/Brother_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/2/27/Fortinet_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/0/08/Cisco_logo_blue_2016.svg",
  "https://upload.wikimedia.org/wikipedia/commons/c/c4/Sony_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/1/1b/SentinelOne_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/5/52/Kaspersky_logo_%282019%29.svg",
  "https://upload.wikimedia.org/wikipedia/commons/a/af/Norton_by_Symantec_logo.svg"
];

urls.forEach(urlStr => {
  const mod = urlStr.startsWith('https') ? https : http;
  const req = mod.request(urlStr, { 
    method: 'HEAD', 
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
    } 
  }, (res) => {
    if (res.statusCode >= 400 && res.statusCode !== 403) {
      console.log(`FAILED (${res.statusCode}): ${urlStr}`);
    } else {
      console.log(`OK (${res.statusCode}): ${urlStr}`);
    }
  });
  req.on('error', e => console.log(`ERROR (${e.message}): ${urlStr}`));
  req.end();
});
