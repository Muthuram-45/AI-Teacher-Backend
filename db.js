const mysql = require('mysql2/promise');
require('dotenv').config();

const host = process.env.DB_HOST || 'localhost';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '8080';
const database = process.env.DB_NAME || 'ai_teacher';

const pool = mysql.createPool({
    host,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Init table
(async () => {
    try {
        // Attempt to connect and create table
        const connection = await pool.getConnection();
        await connection.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        reset_otp VARCHAR(10),
        reset_otp_expiry DATETIME
      )
    `);

        try {
            await connection.query("ALTER TABLE teachers ADD COLUMN reset_otp VARCHAR(10)");
        } catch (e) { /* Ignore if it already exists */ }
        try {
            await connection.query("ALTER TABLE teachers ADD COLUMN reset_otp_expiry DATETIME");
        } catch (e) { /* Ignore if it already exists */ }

        console.log('✅ MySQL Table `teachers` is ready.');
        connection.release();
    } catch (err) {
        if (err.code === 'ER_BAD_DB_ERROR') {
            console.log(`⚠️ Database '${database}' does not exist. Creating it...`);
            try {
                const tempConn = await mysql.createConnection({ host, user, password });
                await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
                await tempConn.end();
                console.log(`✅ Database '${database}' created.`);

                const connection = await pool.getConnection();
                await connection.query(`
          CREATE TABLE IF NOT EXISTS teachers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            reset_otp VARCHAR(10),
            reset_otp_expiry DATETIME
          )
        `);
                console.log('✅ MySQL Table `teachers` is ready.');
                connection.release();
            } catch (innerErr) {
                console.error('❌ Failed to create database automatically:', innerErr);
            }
        } else {
            console.error('❌ MySQL Error:', err);
        }
    }
})();

module.exports = pool;
