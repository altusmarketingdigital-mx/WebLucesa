import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEPLOY_DIR = path.join(__dirname, 'hostinger_deploy');
const ZIP_NAME = 'PROYECTO_LUCESA_READY.zip';

// Limpiar directorio previo
if (fs.existsSync(DEPLOY_DIR)) {
    fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DEPLOY_DIR);

const filesToCopy = [
    'dist',
    'backend',
    'assets',
    'server.js',
    'package.json',
    '.env.example',
    'setup_vps.sh'
];

console.log('--- PREPARING HOSTINGER DEPLOY PACKAGE ---');

filesToCopy.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(DEPLOY_DIR, file);

    if (fs.existsSync(src)) {
        console.log(`Copying ${file}...`);
        if (fs.lstatSync(src).isDirectory()) {
            fs.cpSync(src, dest, { recursive: true });
        } else {
            fs.copyFileSync(src, dest);
        }
    } else {
        console.warn(`Warning: ${file} not found, skipping.`);
    }
});

// Rename .env.example to .env in deploy dir if .env doesn't exist there
// But usually we want the user to configure it.
// We'll copy the actual .env but with a warning.
if (fs.existsSync(path.join(__dirname, '.env'))) {
    console.log('Copying .env (Remember to update credentials for Hostinger)...');
    fs.copyFileSync(path.join(__dirname, '.env'), path.join(DEPLOY_DIR, '.env'));
}

console.log('Creating ZIP archive (Flat structure for Migration tool)...');
try {
    // Usar el comando zip -j o entrar a la carpeta para que los archivos queden en la raíz del ZIP
    execSync(`zip -r ../${ZIP_NAME} .`, { cwd: DEPLOY_DIR });
    console.log(`✅ Success! Package created at root: ${ZIP_NAME}`);
} catch (error) {
    console.error('Error creating ZIP:', error.message);
}
