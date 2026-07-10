import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

let distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
    distPath = path.join(process.cwd(), 'dist');
}
if (!fs.existsSync(distPath)) {
    distPath = __dirname;
}

console.log('Serving files from:', distPath);
app.use(express.static(distPath));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.5' }));

app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Página no encontrada');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
