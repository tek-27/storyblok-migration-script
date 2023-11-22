const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// MySQL database configuration
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: 'Holacasa@123',
  database: 'tkf',
};

// Function to search for a value in all tables and fields
const searchValueInDatabase = async (searchValue) => {

const connection = await mysql.createConnection(dbConfig);
  try {
    // Get all tables in the database
    const [tables] = await connection.execute('SHOW TABLES');

    for (const table of tables) {
      const tableName = table[`Tables_in_${dbConfig.database}`];

      console.log("searching table", tableName);

      // Get all columns in the current table
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);

      for (const column of columns) {
        const columnName = column.Field;

        // Search for the value in the current table and column
        const [searchResults] = await connection.execute(`SELECT * FROM ${tableName} WHERE ${columnName} LIKE ?`, [`%${searchValue}%`]);

        if (searchResults.length > 0) {
          console.log(`Found in ${tableName}.${columnName}`);
          console.log(searchResults);
          const logMessage = `Found in ${tableName}.${columnName}\n${JSON.stringify(searchResults, null, 2)}\n\n`;
          console.log(logMessage);

          // Append log to the file
          fs.appendFileSync('searchLogs.txt', logMessage);
          break
        }else{
            console.log("didn't find")
        }
      }
    }
  } catch (err) {
    throw err;
  } finally {
    // Close the connection
    await connection.end();
  }
};

// Replace these values with your actual database credentials and search value
// const searchValue = "Delivering effective place-based care";
const searchValue = "Join our virtual conference in February 2024";

// Call the search function
searchValueInDatabase(searchValue);
