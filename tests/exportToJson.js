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

// Function to export data to JSON file
const exportToJSON = async (query, filename) => {
  const connection = await mysql.createConnection(dbConfig);

  try {

    const hash = {}
    // Run the query
    const [results] = await connection.execute(query);

    for (let datum of results) {
      if (!hash.hasOwnProperty(datum.vid)) {
        hash[datum.vid] = datum
      }
    }

    // Convert the results to JSON
    const jsonData = JSON.stringify(hash, null, 2);

    // Write JSON data to file
    fs.writeFileSync(path.join(__dirname, '..', `data/raw/${filename}`), jsonData);

    console.log(`Data exported to ${filename}`);
  } catch (err) {
    throw err;
  } finally {
    // Close the connection
    await connection.end();
  }
};

module.exports = async () => {
  // Specify your query
  const query = "SELECT fm.*, mfd.mid, mfd.vid, mfd.name FROM tkf.file_managed fm LEFT JOIN tkf.media_field_data mfd on mfd.thumbnail__target_id = fm.fid where fm.filemime in ('image/jpg', 'image/jpeg', 'image/png');";

  // Specify the filename for the JSON export
  const filename = 'staff-image.json';

  // Call the export function
  await exportToJSON(query, filename);
}
