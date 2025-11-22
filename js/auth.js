// auth.js — client side API for server auth & JWT storage
const API = '/api'
const TOKEN_KEY = 'chat_token'
const USER_KEY = 'chat_user'

export async function signup({name,email,password}){
  const res = await fetch(API + '/signup', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ name, email, password })
  })
  return await res.json()
}

export async function login(email,password){
  const res = await fetch(API + '/login', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = await res.json()
  if(!data.ok) return false
  localStorage.setItem(TOKEN_KEY, data.token)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return true
}

export function logout(){
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getToken(){ return localStorage.getItem(TOKEN_KEY) }
export function getCurrentUserSync(){ return JSON.parse(localStorage.getItem(USER_KEY) || 'null') }
