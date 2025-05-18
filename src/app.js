import express from "express";
import { signup, login } from "./controllers/user.js";
import { createFullBingo, getBingoByOwner, updateFullBingo, getBingoById} from "./controllers/bingo.js";
import { verifyToken } from "./middlewares/auth.js";
import cors from "cors";

// parsing body as json
const app = express();
app.use(cors()); // 加這一行來允許跨來源請求（預設允許所有來源）
app.use(express.json({ limit: '20mb' })); // 放寬 Express 的 body 限制，設定請求主體大小限制為 20MB
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.post("/user/signup", signup);
app.post("/user/login", login);
app.get("/bingo", verifyToken, getBingoByOwner);
app.post("/bingo/full", verifyToken, createFullBingo);
app.get("/bingo/:id", verifyToken, getBingoById);
app.put('/bingo/full/:id', verifyToken, updateFullBingo);

export default app;