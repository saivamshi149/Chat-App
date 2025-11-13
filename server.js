const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// ====== FILE FOR USERS ======
const USERS_FILE = path.join(__dirname, "users.json");

// Load existing users
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

// Save users helper
function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ====== SERVE PUBLIC FOLDER ======
app.use(express.static(path.join(__dirname, "public")));

// ====== SOCKET.IO ======
io.on("connection", (socket) => {
  console.log("New client connected");

  // ---- SIGNUP ----
  socket.on("signup", ({ username, password }) => {
    if (users[username]) {
      socket.emit("signupError", "❌ Username already taken");
    } else {
      users[username] = { password };
      saveUsers();
      socket.username = username;
      console.log("User signed up:", username);
      socket.emit("signupSuccess", { username });
    }
  });

  // ---- LOGIN ----
  socket.on("login", ({ username, password }) => {
    if (!users[username]) {
      socket.emit("loginError", "❌ User does not exist");
    } else if (users[username].password !== password) {
      socket.emit("loginError", "❌ Incorrect password");
    } else {
      socket.username = username;
      console.log("User logged in:", username);
      socket.emit("loginSuccess", { username });
    }
  });

  // ---- JOIN ROOM ----
  socket.on("joinRoom", ({ username, room }) => {
    socket.join(room);
    console.log(`${username} joined room: ${room}`);

    // Notify user
    socket.emit("message", {
      user: "System",
      msg: `Welcome ${username}! You joined room: ${room}`,
      time: new Date().toLocaleTimeString(),
      type: "system",
    });

    // Notify others
    socket.to(room).emit("message", {
      user: "System",
      msg: `${username} has joined the room`,
      time: new Date().toLocaleTimeString(),
      type: "system",
    });
  });

  // ---- CHAT MESSAGE ----
  socket.on("chatMessage", ({ room, msg }) => {
    if (socket.username && room && msg.trim() !== "") {
      const time = new Date().toLocaleTimeString();
      console.log(`Message from ${socket.username} in ${room}: ${msg}`);
      io.to(room).emit("message", {
        user: socket.username,
        msg,
        time,
      });
    }
  });

  // ---- LEAVE ROOM ----
  socket.on("leaveRoom", ({ username, room }) => {
    if (room) {
      socket.leave(room);
      console.log(`${username} left room: ${room}`);
      socket.to(room).emit("message", {
        user: "System",
        msg: `${username} has left the room`,
        time: new Date().toLocaleTimeString(),
        type: "system",
      });
    }
  });
  
  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    if (socket.username) {
      console.log("User disconnected:", socket.username);
    }
  });
});

// ====== START SERVER ======
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
