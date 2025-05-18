import * as jose from "jose";

const secret = new TextEncoder().encode("secret"); // 建議放到環境變數

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "未授權，缺少 token" });
    }

    const token = authHeader.split(" ")[1];
    const { payload } = await jose.jwtVerify(token, secret);

    req.user = { id: payload.id }; // 解出 userId
    next(); // 通過驗證
  } catch (err) {
    console.error("驗證失敗:", err);
    res.status(403).json({ error: "Token 無效或過期" });
  }
}
