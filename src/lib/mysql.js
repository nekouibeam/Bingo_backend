/* /lib/mysql.js */
import mysql2 from "mysql2/promise";

const access = {
  user: "root", // write your username
  password: "112306069", // write your password
  database: "bingoDB", // write your database
};
const mysqlConnectionPool = mysql2.createPool(access);

export default mysqlConnectionPool;