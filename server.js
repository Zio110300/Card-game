const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// publicフォルダの中身をブラウザに表示する
app.use(express.static('public'));

let rooms = {};

io.on('connection', (socket) => {
  console.log('プレイヤーが接続しました:', socket.id);

  // 部屋に入る処理
  socket.on('join_room', (data) => {
    const roomId = data.roomId;
    socket.join(roomId);
    
    if (!rooms[roomId]) {
      rooms[roomId] = { players: 0 };
    }
    rooms[roomId].players++;
    
    // 1番目ならP1、2番目ならP2、それ以降は観戦者(0)
    let playerId = rooms[roomId].players <= 2 ? rooms[roomId].players : 0;
    socket.emit('assign_player', playerId);

    // P2が入ってきたら、P1に相手のデッキ情報を送る
    if (playerId === 2) {
      socket.to(roomId).emit('p2_ready', { deck: data.deck, leader: data.leader });
    }
  });

  // ゲーム状態の同期
  socket.on('update_game', (data) => {
    socket.to(data.roomId).emit('game_updated', data.gameState);
  });

  // カードエフェクトの同期
  socket.on('show_card_effect', (data) => {
    socket.to(data.roomId).emit('show_card_effect', data.card);
  });

  // リトライ要求
  socket.on('request_retry', (roomId) => {
    socket.to(roomId).emit('game_retry');
  });

  socket.on('disconnect', () => {
    console.log('プレイヤーが切断されました:', socket.id);
  });
});

// サーバーを3000番ポートで起動
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`サーバー起動！ 👉 http://localhost:${PORT}`);
});