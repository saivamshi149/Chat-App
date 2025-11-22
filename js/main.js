// main.js — loads components and wires routes
import * as Auth from './auth.js'
import * as Chat from './chat.js'


const app = document.getElementById('app')


async function loadComponent(path){
const res = await fetch(path)
return await res.text()
}


async function showLogin(){
app.innerHTML = await loadComponent('components/login.html')
// wire login handlers
document.getElementById('go-signup').addEventListener('click', showSignup)
const form = document.getElementById('login-form')
form.addEventListener('submit', async e=>{
e.preventDefault()
const email = document.getElementById('login-email').value.trim()
const pass = document.getElementById('login-password').value
const ok = await Auth.login(email, pass)
const errEl = document.getElementById('login-error')
if(!ok){ errEl.textContent = 'Invalid credentials' ; return }
errEl.textContent = ''
showChat()
})
}


async function showSignup(){
app.innerHTML = await loadComponent('components/signup.html')
document.getElementById('go-login').addEventListener('click', showLogin)
const form = document.getElementById('signup-form')
form.addEventListener('submit', async e=>{
e.preventDefault()
const name = document.getElementById('signup-name').value.trim()
const email = document.getElementById('signup-email').value.trim()
const pass = document.getElementById('signup-password').value
const res = await Auth.signup({name,email,password:pass})
const errEl = document.getElementById('signup-error')
if(!res.ok){ errEl.textContent = res.msg; return }
errEl.textContent = ''
showLogin()
})
}


async function showChat(){
app.innerHTML = await loadComponent('components/chat.html')
await Chat.init()
document.getElementById('btn-logout').addEventListener('click', ()=>{
Auth.logout(); showLogin()
})
}


// bootstrap
(async ()=>{
const user = Auth.getCurrentUserSync()
if(user) showChat(); else showLogin()
})()