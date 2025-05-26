import express from "express";
import { signup, login, getUserInfo } from "./controllers/user.js";
import { createFullBingo, getBingoByOwner, updateFullBingo, getBingoById, deleteBingo, getAllBingos, getPlayableBingo, 
addComment, getComments, deleteComment } from "./controllers/bingo.js";
import { savePlayerRecord, getPlayerRecords } from "./controllers/record.js";
import { rewardPlayer, getPlayerPoints, updatePlayerPoints } from './controllers/reward.js';
import { verifyToken } from "./middlewares/auth.js";
import cors from "cors";

// parsing body as json
const app = express();
app.use(cors()); // 加這一行來允許跨來源請求（預設允許所有來源）
app.use(express.json({ limit: '20mb' })); // 放寬 Express 的 body 限制，設定請求主體大小限制為 20MB
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.post("/user/signup", signup);
app.post("/user/login", login);
app.get("/user/info", verifyToken, getUserInfo);

app.get("/bingo", verifyToken, getBingoByOwner);
app.get("/bingo/all", verifyToken, getAllBingos); // 固定路徑 

app.get("/bingo/:id", verifyToken, getBingoById); // 動態路由 
app.delete("/bingo/:id", verifyToken, deleteBingo); // 動態路由 

app.post("/bingo/full", verifyToken, createFullBingo);
app.put('/bingo/full/:id', verifyToken, updateFullBingo);

app.get("/bingo/play/:id", verifyToken, getPlayableBingo);

app.post('/comments', verifyToken, addComment);
app.get('/comments/:bingoId', verifyToken, getComments);
app.delete('/comments/:id', verifyToken, deleteComment);

app.post("/record", verifyToken, savePlayerRecord);
app.get("/record/:bingoId", verifyToken, getPlayerRecords);

app.post('/reward', verifyToken, rewardPlayer);
app.get("/player/points", verifyToken, getPlayerPoints);
app.put("/player/points", verifyToken, updatePlayerPoints);

export default app;