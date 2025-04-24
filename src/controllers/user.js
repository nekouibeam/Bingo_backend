import mysqlConnectionPool from "../lib/mysql.js";
import * as jose from "jose";

/**
 * Signup with `name`, `email` and `password` in request body.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function signup(req, res) {
  const { name, email, password } = req.body;
  const mysql = await mysqlConnectionPool.getConnection();
  try {
    await mysql.query(
      `INSERT INTO User (Name, Email, Password) VALUES (?, ?, ?)`,
      [name, email, password]
    );
    res.status(201).json({ status: "created" });
  } catch {
    res.status(400).json({ error: "User account has been used!" });
  }
}

/**
 * Login with `email` and `password` in request body.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function login(req, res) {
  const { email, password } = req.body;
  const mysql = await mysqlConnectionPool.getConnection();
  try {
    const [results] = await mysql.query(
      `SELECT UserId FROM \`User\` WHERE Email=? AND Password=?`,
      [email, password]
    );
    if (results.length === 0) throw new Error("Wrong account or password");
    const token = await new jose.SignJWT({ id: results[0]["UserId"] })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode("secret"));
    res.status(200).json({ id: results[0]["UserId"], token});
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
