// js/chat.js — uses Socket.io for real-time messaging with rooms
import * as Auth from './auth.js'

let socket = null
let currentRoom = 'general'

export async function init(){
  const user = Auth.getCurrentUserSync()
  if(!user){ window.location.reload(); return }

  document.getElementById('profile-name').textContent = user.name

  const token = Auth.getToken()
  // explicitly point to server to avoid origin issues (if needed)
  socket = io({ auth: { token } })

  socket.on('connect_error', err => {
    console.error('Socket connect error', err && err.message)
    if(err && err.message === 'Authentication error'){
      Auth.logout(); window.location.reload()
    }
  })

  socket.on('init', payload => {
    // payload includes messages (all), users, rooms, online
    renderRooms(payload.rooms, payload.online)
    renderUsersList(payload.users, payload.online)
    // show messages for default room
    const roomMessages = (payload.messages || []).filter(m => (m.room || 'general') === currentRoom)
    renderMessages(roomMessages)
  })

  socket.on('room:created', room => {
    addRoomToList(room)
  })

  socket.on('room:joined', info => {
    // optional: show join notification in UI
    // info = { room, email, name }
    if(info.room === currentRoom){
      appendSystem(`${info.name} joined ${info.room}`)
    }
  })

  socket.on('room:left', info => {
    if(info.room === currentRoom){
      appendSystem(`${info.name} left ${info.room}`)
    }
  })

  socket.on('room:init', payload => {
    // payload: { room, messages }
    if(payload.room === currentRoom){
      renderMessages(payload.messages || [])
    }
  })

  socket.on('message', msg => {
    // only append messages that belong to the current room
    const msgRoom = msg.room || 'general'
    if(msgRoom === currentRoom) appendMessage(msg)
  })

  socket.on('user:online', u => addOnlineUser(u))
  socket.on('user:offline', u => removeOnlineUser(u))

  // UI handlers: create room
  document.getElementById('btn-create-room').addEventListener('click', ()=>{
    const nameEl = document.getElementById('new-room-name')
    const errEl = document.getElementById('room-error')
    const name = (nameEl.value || '').trim()
    if(!name){ errEl.textContent = 'Enter room name'; return }
    errEl.textContent = ''
    socket.emit('create_room', { name })
    nameEl.value = ''
  })

  // message form
  document.getElementById('message-form').addEventListener('submit', e=>{
    e.preventDefault()
    const input = document.getElementById('message-input')
    const text = input.value.trim()
    if(!text) return
    socket.emit('message', { text, room: currentRoom })
    input.value = ''
  })
}

// --- Rooms UI helpers ---
function renderRooms(rooms, onlineList=[]){
  const ul = document.getElementById('rooms-ul')
  ul.innerHTML = ''
  rooms.forEach(r => {
    const li = document.createElement('li')
    li.id = 'room-'+r.id
    li.style.cursor = 'pointer'
    li.style.padding = '6px 4px'
    li.style.borderRadius = '6px'
    li.textContent = r.name + (r.id === 'general' ? ' • default' : '')
    li.addEventListener('click', ()=> joinRoom(r.id))
    ul.appendChild(li)
  })
  highlightCurrentRoom()
}

function addRoomToList(r){
  const ul = document.getElementById('rooms-ul')
  if(document.getElementById('room-'+r.id)) return
  const li = document.createElement('li')
  li.id = 'room-'+r.id
  li.style.cursor = 'pointer'
  li.style.padding = '6px 4px'
  li.style.borderRadius = '6px'
  li.textContent = r.name
  li.addEventListener('click', ()=> joinRoom(r.id))
  ul.appendChild(li)
}

// join room locally and ask server for messages
function joinRoom(roomId){
  if(currentRoom === roomId) return
  // leave previous room on server
  socket.emit('leave_room', { room: currentRoom })
  currentRoom = roomId
  document.getElementById('current-room').textContent = currentRoom
  highlightCurrentRoom()
  // ask server to join and get messages
  socket.emit('join_room', { room: currentRoom })
  // clear messages until room:init returns
  document.getElementById('messages').innerHTML = ''
}

function highlightCurrentRoom(){
  const lis = document.querySelectorAll('#rooms-ul li')
  lis.forEach(li=>{
    if(li.id === 'room-'+currentRoom) li.style.background = 'rgba(255,255,255,0.04)'
    else li.style.background = 'transparent'
  })
}

// --- Users list / online helpers (unchanged except show online status) ---
function renderUsersList(users, onlineList=[]){
  const ul = document.getElementById('users-ul')
  ul.innerHTML = ''
  users.forEach(u=>{
    const li = document.createElement('li')
    li.id = 'user-'+u.email
    li.textContent = u.name + ' ('+u.email+')' + (onlineList.includes(u.email) ? ' • online' : '')
    ul.appendChild(li)
  })
}

function addOnlineUser(u){
  const el = document.getElementById('user-'+u.email)
  if(el) el.textContent = u.name + ' ('+u.email+') • online'
}
function removeOnlineUser(u){
  const el = document.getElementById('user-'+u.email)
  if(el) el.textContent = u.name + ' ('+u.email+')'
}

// --- Messages UI helpers ---
function renderMessages(messages){
  const container = document.getElementById('messages')
  container.innerHTML = ''
  messages.forEach(appendMessage)
  container.scrollTop = container.scrollHeight
}

function appendMessage(msg){
  const container = document.getElementById('messages')
  const el = document.createElement('div')
  const me = Auth.getCurrentUserSync().email
  el.className = 'message' + (me === msg.from ? ' you' : '')
  el.innerHTML = `<div class="meta">${msg.fromName} • ${new Date(msg.ts).toLocaleString()}</div><div class="text">${escapeHtml(msg.text)}</div>`
  container.appendChild(el)
  container.scrollTop = container.scrollHeight
}

function appendSystem(text){
  const container = document.getElementById('messages')
  const el = document.createElement('div')
  el.className = 'message'
  el.style.opacity = '0.7'
  el.innerHTML = `<div class="meta">system • ${new Date().toLocaleTimeString()}</div><div class="text">${escapeHtml(text)}</div>`
  container.appendChild(el)
  container.scrollTop = container.scrollHeight
}

function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
