🎲 Bingo_backend
這是一個用於「Bingo」應用的後端伺服器，使用 Node.js + Express 架設，並連接 MySQL 作為資料庫。

📁 專案結構
Bingo_backend/
├── server.js → 啟動伺服器
├── package.json → 專案依賴
├── .gitignore
├── src/
│ ├── app.js → Express 設定與路由導入
│ ├── lib/
│ │ └── mysql.js → MySQL 連線池
│ └── controllers/
│ └── user.js → 用戶註冊/登入邏輯

🚀 快速開始
安裝依賴：

pnpm install

設定資料庫連線（在 src/lib/mysql.js）：

const pool = mysql.createPool({
host: 'localhost',
user: 'your_user',
password: 'your_password',
database: 'your_database'
});

----------------------------------------------------------------------------------

啟動伺服器：

pnpm run dev

伺服器將在 http://localhost:3000 運行。

----------------------------------------------------------------------------------

Login 功能的 Request/Response 雙向流程圖：

[Client: login.html]
    │
    │  1. 使用者輸入 Email & Password，點擊 Login
    ▼
[JavaScript fetch() 發送 POST 請求到 http://localhost:3000/user/login]
    ▼
[Server: app.js (Express router)]
    │
    │  2. 接收到 POST /user/login 的請求，交由 login 控制器處理
    ▼
[Controller: user.js]
    │
    │  3. 解析 req.body 拿到 email & password
    │  4. 呼叫 mysqlConnectionPool.getConnection()
    │  5. 向 MySQL 發出 SQL 查詢
    ▼
[Database: MySQL]
    │
    │  6. 查詢是否有符合 email/password 的帳號
    ▼
[Database 回傳查詢結果]
    ▲
    │  7. 若成功，回傳使用者資訊（UserId, Name...）
    ▲
[Controller: user.js]
    │
    │  8. 根據資料產生 JWT token
    │  9. 回傳 { id, token } 給 Express
    ▲
[Server: app.js]
    │
    │ 10. Express 將 JSON response 傳給前端
    ▲
[Client: login.html]
    │
    │ 11. JavaScript 透過 `.then()` 接收到回傳結果
    │ 12. 顯示登入成功訊息或錯誤訊息

