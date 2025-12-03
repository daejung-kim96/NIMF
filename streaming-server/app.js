// app.js
// streaming rtmp 서버
// Author: Junghyun Park
// Date: 2025-08-07

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { handleSocketConnection } = require('./socket/handler');
const streamRouter = require('./routes/stream');

dotenv.config();
const app = express();
const server = createServer(app); // http 서버 생성

// Socket.IO 서버 설정
// const io = new Server(server, {
//   cors:{
//     origin: [
//       process.env.AI_ORIGIN,
//     ]
//   }
// })
const io = new Server(server, {
  cors:{
    origin: "*",  // 임시로 모든 origin 허용
    methods: ["GET", "POST"]
  }
})

// 소켓 연결 핸들러 등록
io.on('connection', handleSocketConnection);

// app 설정
app.use(cors());
app.use(express.json());


// 라우트
app.get('/', (req, res) => {
  res.send('Stream Server is running!');
});

app.use('/stream', streamRouter);



// 서버 실행
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`🚀 Stream server running on port ${PORT}`);
});