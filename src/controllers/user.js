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

/**
 * GET /user/info
 * 取得使用者資訊（目前僅回傳名稱）
 */
export async function getUserInfo(req, res) {
  const userId = req.user.id; // 來自 verifyToken 的 JWT

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    const [rows] = await mysql.query(`SELECT Name FROM User WHERE UserId = ?`, [userId]);
    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ name: rows[0].Name });
  } catch (err) {
    res.status(500).json({ error: "伺服器錯誤" });
  } finally {
    mysql.release();
  }
}