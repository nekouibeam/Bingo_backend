import express from "express";
//import mysqlConnectionPool from "../lib/mysql.js"; 已模組化至controller
//import * as jose from "jose"; //已模組化至controller
import { signup, login } from "./controllers/user.js";
import cors from "cors";


// parsing body as json
const app = express();
app.use(express.json());
app.use(cors()); // 加這一行來允許跨來源請求（預設允許所有來源）

app.get("/ping", (req, res) => {
    res.json({ message: "pong" });
  });

app.post("/user/signup", signup);
app.post("/user/login", login);

/*app.listen(3000, () => {
  console.log(`Listening port ${3_000}`);
});*/
//已註解，因為已經在server.js中啟動server

export default app;