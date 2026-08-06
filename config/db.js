const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'veripesa',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isInitialized = false;

const initializeDatabase = async (activePool) => {
  if (isInitialized) return;
  
  try {
    // Check if the 'vendors' table exists
    const [tables] = await activePool.query("SHOW TABLES LIKE 'vendors'");
    if (tables.length === 0) {
      console.log('⚠️ Database tables not found. Initializing schema from schema.sql...');
      const schemaPath = path.join(__dirname, '../schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        console.warn('schema.sql not found at ' + schemaPath);
        return;
      }
      
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Parse SQL statements by splitting on semicolon and cleaning comments
      const statements = schemaSql
        .split(';')
        .map(stmt => {
          return stmt
            .split('\n')
            .map(line => line.trim().startsWith('--') ? '' : line)
            .join('\n')
            .trim();
        })
        .filter(stmt => stmt.length > 0);

      for (const stmt of statements) {
        await activePool.query(stmt);
      }
      console.log('✅ Database schema initialized successfully!');
    }
    isInitialized = true;
  } catch (err) {
    console.error('❌ Error during schema initialization:', err.message);
  }
};

const getPool = async () => {
  if (pool) return pool;

  try {
    // Attempt standard connection pool setup
    const tempPool = mysql.createPool(dbConfig);
    // Ping to verify
    await tempPool.query('SELECT 1');
    pool = tempPool;
    await initializeDatabase(pool);
    return pool;
  } catch (err) {
    // Check if error is due to missing database
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.log(`⚠️ Database "${dbConfig.database}" does not exist. Attempting to create it...`);
      try {
        // Connect to server without database parameter
        const tempConn = await mysql.createConnection({
          host: dbConfig.host,
          user: dbConfig.user,
          password: dbConfig.password
        });
        
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        await tempConn.end();
        console.log(`✅ Database "${dbConfig.database}" created successfully.`);

        // Now setup pool again
        pool = mysql.createPool(dbConfig);
        await initializeDatabase(pool);
        return pool;
      } catch (createErr) {
        console.error('❌ Failed to auto-create database:', createErr.message);
        throw createErr;
      }
    } else {
      console.error('❌ Database connection failed. Verify your database is running.', err.message);
      throw err;
    }
  }
};

const query = async (sql, params) => {
  const activePool = await getPool();
  const [rows] = await activePool.execute(sql, params);
  return rows;
};

module.exports = {
  get pool() {
    return pool;
  },
  query
};
