import bcrypt from 'bcryptjs';

const hash = '$2b$12$kMn8fQREdw384KnZGlJ/2OZ/5njyhDnntu34tWgAukqWXDExReTwe';
const passwords = ['admin123', 'admin', 'lucesa123', 'password123', '12345678'];

async function check() {
    for (const pw of passwords) {
        const match = await bcrypt.compare(pw, hash);
        console.log(`Password "${pw}": ${match ? 'CORRECT' : 'WRONG'}`);
    }
}

check();
