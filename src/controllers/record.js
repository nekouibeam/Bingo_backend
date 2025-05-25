import mysqlConnectionPool from "../lib/mysql.js";

/**
 * POST /record
 * 儲存玩家紀錄
*/
export async function savePlayerRecord(req, res) {
  const { gameId, articleId, recordText } = req.body;
  const playerId = req.user.id; // ⬅️ 由 verifyToken middleware 提供

  if (!gameId || !articleId) {
    return res.status(400).json({ error: "參數不足" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    await mysql.query(`
      INSERT INTO record (PlayerId, GameId, ArticleId, RecordText)
      VALUES (?, ?, ?, ?)
    `, [playerId, gameId, articleId, recordText || ""]);

    res.status(201).json({ message: "已儲存紀錄" });
  } catch (err) {
    console.error("儲存紀錄失敗:", err);
    res.status(500).json({ error: "儲存失敗" });
  } finally {
    mysql.release();
  }
}

/**
 * GET /record/:bingoId
 * 取得玩家的遊戲紀錄
*/
export async function getPlayerRecords(req, res) {
  const bingoId = req.params.bingoId;
  const playerId = req.user.id;

  if (!bingoId) {
    return res.status(400).json({ error: "缺少 Bingo ID" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    const [rows] = await mysql.query(`
      SELECT ArticleId
      FROM record
      WHERE PlayerId = ? AND GameId = ?
    `, [playerId, bingoId]);

    const completed = rows.map(r => r.ArticleId);
    res.status(200).json({ completed });
  } catch (err) {
    console.error("讀取玩家紀錄錯誤：", err);
    res.status(500).json({ error: "伺服器錯誤，無法讀取紀錄" });
  } finally {
    mysql.release();
  }
}
 