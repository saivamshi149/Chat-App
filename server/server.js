// server/server.js (full updated file)
const fs = require('fs')
const path = require('path')
const express = require('express')
const http = require('http')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
const bodyParser = require('body-parser')
const cors = require('cors')

const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const MSG_FILE = path.join(DATA_DIR, 'messages.json')
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json')

if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if(!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}))
if(!fs.existsSync(MSG_FILE)) fs.writeFileSync(MSG_FILE, JSON.stringify([]))
if(!fs.existsSync(ROOMS_FILE)) fs.writeFileSync(ROOMS_FILE, JSON.stringify([
  { id: 'general', name: 'general', createdBy: 'system', createdAt: 0 }
]))

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me' // change in prod
const TOKEN_EXP = '7d'

function readUsers(){ return JSON.parse(fs.readFileSync(USERS_FILE,'utf8') || '{}') }
function writeUsers(u){ fs.writeFileSync(USERS_FILE, JSON.stringify(u,null,2)) }
function readMessages(){ return JSON.parse(fs.readFileSync(MSG_FILE,'utf8') || '[]') }
function writeMessages(m){ fs.writeFileSync(MSG_FILE, JSON.stringify(m,null,2)) }
function readRooms(){ return JSON.parse(fs.readFileSync(ROOMS_FILE,'utf8') || '[]') }
function writeRooms(r){ fs.writeFileSync(ROOMS_FILE, JSON.stringify(r,null,2)) }

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: true, methods: ['GET','POST'] } })

app.use(cors({ origin: true, credentials: true }))
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, '..')))

// Signup endpoint (unchanged)
app.post('/api/signup', async (req,res)=>{
  const { name, email, password } = req.body || {}
  if(!name || !email || !password) return res.status(400).json({ ok:false, msg:'Missing fields' })
  const users = readUsers()
  if(users[email]) return res.status(400).json({ ok:false, msg:'Email already registered' })
  const hash = await bcrypt.hash(password, 10)
  users[email] = { name, email, passwordHash: hash, created: Date.now() }
  writeUsers(users)
  return res.json({ ok:true })
})

// Login endpoint (unchanged)
app.post('/api/login', async (req,res)=>{
  const { email, password } = req.body || {}
  const users = readUsers()
  const user = users[email]
  if(!user) return res.status(400).json({ ok:false, msg:'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if(!ok) return res.status(400).json({ ok:false, msg:'Invalid credentials' })
  const token = jwt.sign({ email, name: user.name }, SECRET, { expiresIn: TOKEN_EXP })
  return res.json({ ok:true, token, user:{ email:user.email, name:user.name } })
})

// Simple endpoint to fetch all users (demo)
app.get('/api/users', (req,res)=>{
  const users = readUsers()
  return res.json(Object.values(users).map(u=>({ name:u.name, email:u.email })))
})

// endpoint to get rooms (optional, handy for debugging)
app.get('/api/rooms', (req,res) => {
  const rooms = readRooms()
  return res.json(rooms)
})

// Verify token
function verifyToken(token){
  try{ return jwt.verify(token, SECRET) }catch(e){ return null }
}

// socket auth
io.use((socket, next)=>{
  const token = socket.handshake.auth && socket.handshake.auth.token
  if(!token) return next(new Error('Authentication error'))
  const payload = verifyToken(token)
  if(!payload) return next(new Error('Invalid token'))
  socket.user = payload
  next()
})

const online = new Map() // email -> socket.id

io.on('connection', socket => {
  const user = socket.user
  online.set(user.email, socket.id)
  console.log('socket connected', user.email)

  // send initial payload: rooms, messages (all) and users + online
  const messages = readMessages()
  const users = Object.values(readUsers()).map(u=>({ name:u.name,email:u.email }))
  const rooms = readRooms()
  socket.emit('init', { messages, users, rooms, online: Array.from(online.keys()) })

  // notify others user came online
  io.emit('user:online', { email:user.email, name:user.name })

  // join default general room automatically
  socket.join('general')
  io.to('general').emit('system', { msg:`${user.name} joined general`, ts: Date.now() })

  // --- Rooms: create, join, leave via socket events ---

  // create_room: { id?, name } -> server will ensure unique id
  socket.on('create_room', data => {
    const name = String((data && data.name) || '').trim()
    if(!name) return socket.emit('error', { msg:'Room name required' })
    const rooms = readRooms()
    // generate id-friendly string
    const id = name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'')
    if(rooms.find(r=>r.id === id || r.name === name)) {
      return socket.emit('error', { msg:'Room name already exists' })
    }
    const room = { id, name, createdBy: user.email, createdAt: Date.now() }
    rooms.push(room); writeRooms(rooms)
    io.emit('room:created', room) // broadcast new room to everyone
  })

  // join_room: { room }
  socket.on('join_room', data => {
    const room = String((data && data.room) || '')
    const rooms = readRooms()
    if(!rooms.find(r => r.id === room)) {
      return socket.emit('error', { msg:'Room not found' })
    }
    socket.join(room)
    // send last messages for that room
    const msgs = readMessages().filter(m => (m.room || 'general') === room)
    socket.emit('room:init', { room, messages: msgs })
    io.to(room).emit('room:joined', { room, email: user.email, name: user.name })
  })

  // leave_room: { room }
  socket.on('leave_room', data => {
    const room = String((data && data.room) || '')
    socket.leave(room)
    io.to(room).emit('room:left', { room, email: user.email, name: user.name })
  })

  // message: { text, room }
  socket.on('message', data => {
    const text = String((data && data.text) || '').trim()
    if(!text) return
    const room = String((data && data.room) || 'general')
    const msg = { id: Date.now(), from: user.email, fromName: user.name, text, ts: Date.now(), room }
    const arr = readMessages(); arr.push(msg); writeMessages(arr)
    // emit only to the room (and to the sender if in that room)
    io.to(room).emit('message', msg)
  })

  socket.on('disconnect', ()=>{
    online.delete(user.email)
    io.emit('user:offline', { email:user.email })
    console.log('socket disconnected', user.email)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, ()=> console.log('Server listening on', PORT))
