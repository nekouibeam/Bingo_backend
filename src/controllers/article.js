import mysqlConnectionPool from "../lib/mysql.js";
import multer from "multer";

// 使用 memoryStorage 將檔案存入記憶體（直接寫入 DB blob）
const storage = multer.memoryStorage();
export const upload = multer({ storage }).single("file"); // 'file' 是前端 FormData 的欄位名稱

/**
 * POST /upload-article
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function uploadArticle(req, res) {
  const { title, desc, founderId } = req.body;
  const fileBuffer = req.file?.buffer;

  if (!title || !desc || !founderId || !fileBuffer) {
    return res.status(400).json({ error: "缺少必要欄位" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    const [result] = await mysql.query(
      `INSERT INTO article (Name, Depiction, Picture, FounderID) VALUES (?, ?, ?, ?)`,
      [title, desc, fileBuffer, founderId]
    );
    res.status(201).json({ message: "文章成功上傳", articleId: result.insertId });
  } catch (err) {
    console.error("上傳失敗:", err);
    res.status(500).json({ error: "伺服器錯誤" });
  } finally {
    mysql.release();
  }
}
 