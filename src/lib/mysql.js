/* /lib/mysql.js */
import mysql2 from "mysql2/promise";

const access = {
  user: "root", // write your username
  password: "112306069", // write your password
  database: "dbmsExample", // write your database
};
const mysqlConnectionPool = mysql2.createPool(access);

export default mysqlConnectionPool;

/*(async () => {
  const mysql = await mysqlConnectionPool.getConnection();

  const result = await mysql.query("SELECT 1+1");
  console.log(result);
  process.exit();
})();*/