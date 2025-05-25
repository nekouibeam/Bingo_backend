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
    await mysql.beginTransaction();

    // 檢查是否已存在相同的 email
    const [existingUser] = await mysql.query(
      `SELECT UserId FROM User WHERE Email = ?`,
      [email]
    );
    if (existingUser.length > 0) {
      throw new Error("User email has been used!");
    }

    // 檢查是否已存在相同的 name
    const [existingName] = await mysql.query(
      `SELECT UserId FROM User WHERE Name = ?`,
      [name]
    );
    if (existingName.length > 0) {
      throw new Error("User name has been used!");
    }

    // 插入 User
    const [userResult] = await mysql.query(
      `INSERT INTO User (Name, Email, Password) VALUES (?, ?, ?)`,
      [name, email, password]
    );
    
    const userId = userResult.insertId;
    const contact = 'Email: ' + email; // 假設聯絡方式為 email

    // 插入 Creator
    await mysql.query(
      `INSERT INTO creator (CreatorId, Contact_Details) VALUES (?, ?)`,
      [userId, contact] // 使用剛插入的 UserId
    );
    // 插入 Player
    await mysql.query(
      `INSERT INTO player (PlayerId) VALUES (?)`,
      [userId]
    );

    await mysql.commit();
    res.status(201).json({ status: "created" });
  } catch(error) {
      await mysql.rollback();
      console.error(error);
      res.status(400).json({ error: error.message });
  } finally {
      if (mysql) mysql.release();
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