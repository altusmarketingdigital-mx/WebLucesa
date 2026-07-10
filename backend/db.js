import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del Pool de Conexiones
// Para Hostinger, estos datos se sacan de las variables de entorno (.env)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lucesa_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Verificación inicial de conexión
pool.getConnection()
    .then(conn => {
        console.log('✅ Conexión exitosa a MySQL (Hostinger Ready)');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Error conectando a MySQL:', err.message);
        console.error('Asegúrate de configurar las variables DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en el archivo .env');
    });

export default pool;
