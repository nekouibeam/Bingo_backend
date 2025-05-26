import mysqlConnectionPool from "../lib/mysql.js";
/**
 * POST /reward
 * 發放點數給玩家
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function rewardPlayer(req, res) {
  const userId = req.user?.id;
  const { bingoId, reward } = req.body;

  if (!userId || !bingoId || typeof reward !== "number") {
    return res.status(400).json({ error: "缺少參數" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    // 是否已經領過獎勵？
    const [existing] = await mysql.query(
      `SELECT * FROM record WHERE PlayerId = ? AND GameId = ? AND RecordText = 'rewarded'`,
      [userId, bingoId]
    );

    if (existing.length > 0) {
      return res.status(200).json({ message: "已領過獎勵" });
    }

    // 發點數
    await mysql.query(
      `UPDATE player SET Point = Point + ? WHERE PlayerId = ?`,
      [reward, userId]
    );

    // 加入紀錄避免重複
    await mysql.query(
      `INSERT INTO record (PlayerId, GameId, ArticleId, RecordText) VALUES (?, ?, NULL, 'rewarded')`,
      [userId, bingoId]
    );

    res.status(200).json({ message: "點數發放成功" });
  } catch (err) {
    console.error("發放點數錯誤：", err);
    res.status(500).json({ error: "伺服器錯誤" });
  } finally {
    mysql.release();
  }
}
