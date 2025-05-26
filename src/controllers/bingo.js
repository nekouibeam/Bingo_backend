import mysqlConnectionPool from "../lib/mysql.js";

/**
 * GET /bingo?owner=123
 * 傳回該創作者的所有 Bingo 清單 + 每張 Bingo 的 article 總覽（含圖片 base64）
 */
export async function getBingoByOwner(req, res) {
  const ownerId = req.query.owner;

  if (!ownerId) {
    return res.status(400).json({ error: "缺少 owner 參數" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    // 取得該創作者的 Bingo 清單
    const [bingos] = await mysql.query(`
      SELECT BingoId, BingoName, CreateTime
      FROM bingo
      WHERE Owner = ?
    `, [ownerId]);

    // 每張 Bingo 查詢對應 9 個 article（及圖片）
    const bingoList = [];
    for (const bingo of bingos) {
      const [articles] = await mysql.query(`
        SELECT a.ArticleId, a.Picture
        FROM connection c
        JOIN article a ON a.ArticleId = c.ArticleId
        WHERE c.BingoId = ?
        ORDER BY c.ArticleId ASC
      `, [bingo.BingoId]);

      // 將圖片轉成 base64，或轉 URL（目前轉 base64）
      const images = articles.map(a => {
        if (!a.Picture) return null;
        const base64 = a.Picture.toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      });

      bingoList.push({
        id: bingo.BingoId,
        title: bingo.BingoName,
        status: bingo.Status || "draft",
        createdAt: bingo.CreateTime,
        players: 0, // TODO: 未來加玩家統計
        completedCells: images.filter(Boolean).length,
        images: [...images, ...Array(9 - images.length).fill(null)] // 保證長度 9
      });
    }

    res.status(200).json(bingoList);
  } catch (err) {
    console.error("查詢 Bingo 發生錯誤：", err);
    res.status(500).json({ error: "伺服器錯誤" });
  } finally {
    mysql.release();
  }
}

/**
 * POST /bingo/full
 * 建立完整 Bingo（含 9 個 article + riddle + connection）
 */
export async function createFullBingo(req, res) {
  const { owner, title, region, reward, passlimit, hashtag, articles } = req.body;

  if (!owner || !title || !Array.isArray(articles) || articles.length < 9) {
    return res.status(400).json({ error: "請提供至少 9 筆題目資料" });
  }

  const mysql = await mysqlConnectionPool.getConnection();

  try {
    await mysql.beginTransaction();

    // 1️⃣ 建立 Bingo
    const [bingoResult] = await mysql.query(
      `INSERT INTO bingo (BingoName, Size, Owner, Reward, Region, Passlimit, Hashtag)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, articles.length, owner, reward || null, region || null, passlimit || null , hashtag || null]
    );

    const bingoId = bingoResult.insertId;
    const articleIdList = [];

    // 2️⃣ 建立每筆 Article + Riddle
    for (const entry of articles) {
      const { name, depiction, question, answer, imageBase64 } = entry;

      if (!name || !depiction || !question || !answer ) {
        throw new Error("有題目資料缺少欄位");
      }

      // 轉成圖片 BLOB
      let imageBuffer = null;
      if (imageBase64 && typeof imageBase64 === "string") {
        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        imageBuffer = Buffer.from(base64Data, 'base64');
      }

      // 插入 article
      const [articleResult] = await mysql.query(
        `INSERT INTO article (Name, Depiction, Picture, FounderID)
         VALUES (?, ?, ?, ?)`,
        [name, depiction, imageBuffer, owner]
      );

      const articleId = articleResult.insertId;
      articleIdList.push(articleId);

      // 插入 riddle
      await mysql.query(
        `INSERT INTO riddle (ArticleId, Question, Answer)
         VALUES (?, ?, ?)`,
        [articleId, question, answer]
      );
    }

    // 3️⃣ 建立 connection
    const connectionValues = articleIdList.map(articleId => [bingoId, articleId]);
    await mysql.query(`INSERT INTO connection (BingoId, ArticleId) VALUES ?`, [connectionValues]);

    await mysql.commit();
    res.status(201).json({ message: "Bingo 建立成功", bingoId });

  } catch (err) {
    await mysql.rollback();
    console.error("建立完整 Bingo 錯誤：", err);
    res.status(500).json({ error: "建立 Bingo 時發生錯誤" });
  } finally {
    mysql.release();
  }
}

/**
 * GET /bingo/:id
 * 回傳指定 Bingo 的完整資訊
 */
export async function getBingoById(req, res) {
  const bingoId = req.params.id;
  const mysql = await mysqlConnectionPool.getConnection();

  try {
    // 1️⃣ 查 bingo 本體
    const [bingoRows] = await mysql.query(`
      SELECT BingoId, BingoName, Size, Owner, Reward, Region, Passlimit, CreateTime, Hashtag
      FROM bingo WHERE BingoId = ?
    `, [bingoId]);

    if (bingoRows.length === 0) {
      return res.status(404).json({ error: "找不到 Bingo" });
    }

    const bingo = bingoRows[0];

    // 2️⃣ 查 article + riddle（根據 connection 綁定）
    const [articles] = await mysql.query(`
      SELECT
        a.ArticleId,
        a.Name AS name,
        a.Depiction AS depiction,
        r.Question AS question,
        r.Answer AS answer,
        TO_BASE64(a.Picture) AS imageBase64,
        a.FounderID
      FROM connection c
      JOIN article a ON c.ArticleId = a.ArticleId
      JOIN riddle r ON a.ArticleId = r.ArticleId
      WHERE c.BingoId = ?
    `, [bingoId]);

    // ✅ 整包回傳
    res.status(200).json({
      bingo: {
        id: bingo.BingoId,
        title: bingo.BingoName,
        size: bingo.Size,
        owner: bingo.Owner,
        reward: bingo.Reward,
        region: bingo.Region,
        passlimit: bingo.Passlimit,
        hashtag: bingo.Hashtag || null,
        createdAt: bingo.CreateTime
      },
      articles
    });

  } catch (err) {
    console.error("getBingoById error:", err);
    res.status(500).json({ error: "伺服器錯誤" });
  } finally {
    mysql.release();
  }
}

/**
 * PUT /bingo/full/:id
 * 更新完整 Bingo（含 9 個 article + riddle + connection）& 刪除舊records
 */
export async function updateFullBingo(req, res) {
  const bingoId = req.params.id;
  const { owner, title, region, reward, passlimit, articles, hashtag } = req.body;

  if (!bingoId || !owner || !title || !Array.isArray(articles) || articles.length < 9) {
    return res.status(400).json({ error: "參數不完整或格式錯誤" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    await mysql.beginTransaction();

    // 1️⃣ 更新 bingo 主資訊
    await mysql.query(`
      UPDATE bingo
      SET BingoName = ?, Reward = ?, Region = ?, Passlimit = ?, Hashtag = ?
      WHERE BingoId = ? AND Owner = ?
    `, [title, reward, region, passlimit, hashtag, bingoId, owner]);

    // 2️⃣ 查出舊 Article ID（從 connection 拿）
    const [oldConnections] = await mysql.query(`
      SELECT ArticleId FROM connection WHERE BingoId = ?
    `, [bingoId]);

    const oldArticleIds = oldConnections.map(row => row.ArticleId);
    
    // 3️⃣ 刪除舊 connection → record → riddle → article  
    if (oldArticleIds.length > 0) {      
      await mysql.query(`DELETE FROM connection WHERE BingoId = ?`, [bingoId]);
      await mysql.query(`DELETE FROM record WHERE GameId = ?`, [bingoId]);
      await mysql.query(`DELETE FROM riddle WHERE ArticleId IN (?)`, [oldArticleIds]);
      await mysql.query(`DELETE FROM article WHERE ArticleId IN (?)`, [oldArticleIds]);
    }
  
    // 4️⃣ 插入新 articles + riddle + connection
    const newArticleIds = [];

    for (const entry of articles) {
      const { name, depiction, question, answer, imageBase64 } = entry;

      if (!name || !depiction || !question || !answer ) {
        throw new Error("有題目資料缺少欄位");
      }

      let imageBuffer = null;
      if (typeof imageBase64 === "string") {
        if (imageBase64.startsWith('__EXISTING__:')) {
          const oldBase64 = imageBase64.replace('__EXISTING__:', '');
          const base64Data = oldBase64.includes(',') ? oldBase64.split(',')[1] : oldBase64;
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
          imageBuffer = Buffer.from(base64Data, 'base64');
        }
      }
      // 插入 article
      const [articleResult] = await mysql.query(`
        INSERT INTO article (Name, Depiction, Picture, FounderID)
        VALUES (?, ?, ?, ?)`,
        [name, depiction, imageBuffer, owner]
      );

      const newArticleId = articleResult.insertId;
      newArticleIds.push(newArticleId);

      // 插入 riddle
      await mysql.query(`
        INSERT INTO riddle (ArticleId, Question, Answer)
        VALUES (?, ?, ?)`,
        [newArticleId, question, answer]);
    }

    // 3️⃣ 建立 connection
    const connectionValues = newArticleIds.map(articleId => [bingoId, articleId]);
    await mysql.query(`INSERT INTO connection (BingoId, ArticleId) VALUES ?`, [connectionValues]);

    await mysql.commit();
    res.status(200).json({ message: "Bingo 更新成功", bingoId });
  } catch (err) {
    await mysql.rollback();
    console.error("更新完整 Bingo 錯誤：", err);
    res.status(500).json({ error: "更新 Bingo 發生錯誤" });
  } finally {
    mysql.release();
  }
}

/**
 * DELETE /bingo/:id
 * 刪除 Bingo（連帶刪除所有相關的 article + riddle + record + comment）
 */
export async function deleteBingo(req, res) {
  const bingoId = req.params.id;
  const tokenUserId = req.user?.id;

  if (!bingoId || !tokenUserId) {
    return res.status(400).json({ error: "缺少參數或未登入" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    await mysql.beginTransaction();

    // 檢查是否為擁有者
    const [check] = await mysql.query(`SELECT Owner FROM bingo WHERE BingoId = ?`, [bingoId]);
    if (check.length === 0) {
      return res.status(404).json({ error: "Bingo 不存在" });
    }
    if (check[0].Owner !== tokenUserId) {
      return res.status(403).json({ error: "無權限刪除此 Bingo" });
    }

    // 刪除順序：
    // ✅ connection → ✅ riddle → ✅ article → ✅ bingo
    const [articleRows] = await mysql.query(`SELECT ArticleId FROM article WHERE ArticleId IN (
      SELECT ArticleId FROM connection WHERE BingoId = ?
    )`, [bingoId]);
    const articleIds = articleRows.map(row => row.ArticleId);
    
    await mysql.query(`DELETE FROM connection WHERE BingoId = ?`, [bingoId]);

    if (articleIds.length > 0) {
      await mysql.query(`DELETE FROM record WHERE ArticleId IN (?)`, [articleIds]);
      await mysql.query(`DELETE FROM riddle WHERE ArticleId IN (?)`, [articleIds]);
      await mysql.query(`DELETE FROM article WHERE ArticleId IN (?)`, [articleIds]);
    }

    await mysql.query(`DELETE FROM record WHERE GameId = ?`, [bingoId]);
    await mysql.query(`DELETE FROM comment WHERE GameId = ?`, [bingoId]);
    await mysql.query(`DELETE FROM bingo WHERE BingoId = ?`, [bingoId]);

    await mysql.commit();
    res.status(200).json({ message: "Bingo 已成功刪除" });
  } catch (err) {
    await mysql.rollback();
    console.error("❌ 刪除 Bingo 發生錯誤：", err);
    res.status(500).json({ error: "刪除失敗" });
  } finally {
    mysql.release();
  }
}

/**
 * GET /bingo/all
 * 取得所有公開 Bingo（所有皆公開）
 */
export async function getAllBingos(req, res) {
  const mysql = await mysqlConnectionPool.getConnection();
  try {
    const [bingos] = await mysql.query(`
      SELECT b.BingoId, b.BingoName, b.CreateTime, b.region, b.Hashtag
      FROM bingo b
      ORDER BY b.CreateTime DESC
    `);

    const result = [];

    for (const bingo of bingos) {
      const [connections] = await mysql.query(`
        SELECT a.Picture
        FROM connection c
        JOIN article a ON c.ArticleId = a.ArticleId
        WHERE c.BingoId = ?
        LIMIT 9
      `, [bingo.BingoId]);

      const images = connections.map(row => {
        if (!row.Picture) return null;
        const base64 = row.Picture.toString("base64");
        return `data:image/jpeg;base64,${base64}`;
      });

      result.push({
        id: bingo.BingoId,
        title: bingo.BingoName,
        createdAt: bingo.CreateTime,
        region: bingo.region || null,
        hashtag: bingo.Hashtag || null,
        players: Math.floor(Math.random() * 500), // 🔧 模擬玩家人數，後續可接 log 或 play record
        images
      });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("取得公開 Bingo 失敗：", err);
    res.status(500).json({ error: "伺服器錯誤，無法取得 Bingo" });
  } finally {
    mysql.release();
  }
}

/**
 * GET /bingo/play/:id
 * 取得 Bingo 給玩家遊玩用（含 article + riddle）
 */
export async function getPlayableBingo(req, res) {
  const bingoId = req.params.id;

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    const [[bingo]] = await mysql.query(`
      SELECT BingoId, BingoName, Region, Passlimit, Reward
      FROM bingo
      WHERE BingoId = ?
    `, [bingoId]);

    if (!bingo) {
      return res.status(404).json({ error: "找不到 Bingo" });
    }

    // 取得該 Bingo 對應的 9 個 article + riddle
    const [rows] = await mysql.query(`
      SELECT a.ArticleId, a.Name, a.Depiction, a.Picture, r.Question, r.Answer
      FROM connection c
      JOIN article a ON c.ArticleId = a.ArticleId
      JOIN riddle r ON r.ArticleId = a.ArticleId
      WHERE c.BingoId = ?
      ORDER BY c.ArticleId ASC
    `, [bingoId]);

    const articles = rows.map(row => ({
      id: row.ArticleId,
      name: row.Name,
      depiction: row.Depiction,
      question: row.Question,
      answer: row.Answer,
      imageBase64: row.Picture
        ? `data:image/jpeg;base64,${row.Picture.toString("base64")}`
        : null
    }));

    res.status(200).json({
      id: bingo.BingoId,
      title: bingo.BingoName,
      region: bingo.Region || null,
      passlimit: bingo.Passlimit || null,
      reward: bingo.Reward,
      articles
    });

  } catch (err) {
    console.error("取得可遊玩 Bingo 失敗：", err);
    res.status(500).json({ error: "伺服器錯誤" });
  } finally {
    mysql.release();
  }
}

/**
 * GET /comments/:bingoId
 * 取得指定 Bingo 的評論列表
 */
export async function getComments(req, res) {
  const bingoId = req.params.bingoId;

  if (!bingoId) {
    return res.status(400).json({ error: "缺少 Bingo ID" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    const [comments] = await mysql.query(`
      SELECT c.CommentId AS id, c.Message, c.Commenter AS userId, u.Name AS username, c.GameId AS bingoId, c.CreatedAt AS createdAt
      FROM comment c
      LEFT JOIN user u ON c.Commenter = u.UserId
      WHERE c.GameId = ? 
      ORDER BY c.CommentId DESC
    `, [bingoId]);

    res.status(200).json(comments);
  } catch (err) {
    console.error("取得 Bingo 評論失敗：", err);
    res.status(500).json({ error: "伺服器錯誤，無法取得評論" });
  } finally {
    mysql.release();
  }
}

/**
 * POST /comment
 * 新增評論到指定 Bingo
 */
export async function addComment(req, res) {
  const userId = req.user.id;
  const { bingoId, message } = req.body;
  
  if (!bingoId || !message || !userId) {
    return res.status(400).json({ error: "缺少必要參數" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    await mysql.query(`
      INSERT INTO comment (GameId, Commenter, Message)
      VALUES (?, ?, ?)
    `, [bingoId, userId, message]);

    res.status(201).json({ message: "評論已新增" });
  } catch (err) {
    console.error("新增評論失敗：", err);
    res.status(500).json({ error: "伺服器錯誤，無法新增評論" });
  } finally {
    mysql.release();
  }
}

/**
 * DELETE /comment/:id
 * 刪除指定評論
 */
export async function deleteComment(req, res) {
  const userId = req.user.id;
  const commentId = req.params.id;

  if (!commentId || !userId) {
    return res.status(400).json({ error: "缺少必要參數" });
  }

  const mysql = await mysqlConnectionPool.getConnection();
  try {
    // 確認評論是否存在且屬於該使用者
    const [check] = await mysql.query(`
      SELECT CommentID FROM comment WHERE CommentID = ? AND Commenter = ?
    `, [commentId, userId]);

    if (check.length === 0) {
      return res.status(404).json({ error: "評論不存在或無權限刪除" });
    }

    await mysql.query(`DELETE FROM comment WHERE CommentID = ?`, [commentId]);
    res.status(200).json({ message: "評論已刪除" });
  } catch (err) {
    console.error("刪除評論失敗：", err);
    res.status(500).json({ error: "伺服器錯誤，無法刪除評論" });
  } finally {
    mysql.release();
  }
}