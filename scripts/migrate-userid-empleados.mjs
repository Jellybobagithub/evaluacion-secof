import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: false } });

try {
  await conn.execute('ALTER TABLE `empleados` ADD COLUMN IF NOT EXISTS `userId` int');
  console.log('✓ Columna userId agregada a empleados');
} catch (e) {
  if (e.message.includes('Duplicate column')) {
    console.log('✓ Columna userId ya existe en empleados');
  } else {
    console.error('Error:', e.message);
  }
}

await conn.end();
console.log('Migración completada');
