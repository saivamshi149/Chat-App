// ---- Global Variables ----
const socket = io(); // make socket global
let username = null;
let currentRoom = null;

document.addEventListener("DOMContentLoaded", () => {
  // ---- Page Elements ----
  const loginPage = document.getElementById("loginPage");
  const roomPage = document.getElementById("roomPage");
  const chatPage = document.getElementById("chatPage");

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");

  const roomInput = document.getElementById("roomInput");
  const joinRoomBtn = document.getElementById("joinRoomBtn");

  const chatRoomTitle = document.getElementById("chatRoomTitle");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const backBtn = document.getElementById("backBtn");

  // ---- LOGIN ----
  loginBtn.addEventListener("click", () => {
    username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      alert("Please enter both username and password");
      return;
    }

    socket.emit("login", { username, password });
  });

  // ---- SIGNUP ----
  signupBtn.addEventListener("click", () => {
    username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      alert("Please enter both username and password");
      return;
    }

    socket.emit("signup", { username, password });
  });

  // ---- JOIN ROOM ----
  joinRoomBtn.addEventListener("click", () => {
    const room = roomInput.value.trim();
    if (!room) {
      alert("Please enter a room name");
      return;
    }

    currentRoom = room;
    socket.emit("joinRoom", { username, room });
    chatRoomTitle.textContent = `Room: ${room}`;
    roomInput.value = "";

    roomPage.style.display = "none";
    chatPage.style.display = "block";
    chatMessages.innerHTML = ""; // clear previous chat
  });

  // ---- SEND MESSAGE ----
  sendBtn.addEventListener("click", () => {
    const msg = chatInput.value.trim();
    if (msg && currentRoom) {
      socket.emit("chatMessage", { room: currentRoom, msg });
      chatInput.value = "";
    }
  });

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendBtn.click();
  });

  // ---- BACK TO ROOMS ----
  backBtn.addEventListener("click", () => {
    if (currentRoom) {
      socket.emit("leaveRoom", { username, room: currentRoom });
      currentRoom = null;
    }

    chatPage.style.display = "none";
    roomPage.style.display = "block";
  });

  // ---- SOCKET.IO EVENTS ----

  socket.on("loginSuccess", () => {
    loginPage.style.display = "none";
    roomPage.style.display = "block";
  });

  socket.on("signupSuccess", () => {
    alert("Signup successful! Please login.");
  });

  socket.on("loginError", (msg) => {
    alert(msg);
  });

  socket.on("signupError", (msg) => {
    alert(msg);
  });

  socket.on("message", (data) => {
    appendMessage(data, data.user === username);
  });
});

// ---- MESSAGE APPENDER ----
function appendMessage(data, self = false) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message");

  if (data.type === "system") {
    msgDiv.classList.add("system");
    msgDiv.textContent = `[${data.time}] ${data.msg}`;
  } else {
    msgDiv.classList.add(self ? "self" : "other");
    msgDiv.innerHTML = `<strong>${data.user}</strong> [${data.time}]: ${data.msg}`;
  }

  const chatMessages = document.getElementById("chatMessages");
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
  