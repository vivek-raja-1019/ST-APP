// frontend/script.js

// ✅ Use ONLY ONE API everywhere
const API = "https://st-app-29gb.onrender.com";

// ---------- Common ----------
function requireLogin(){
  const u = (sessionStorage.getItem("user") || "").trim();
  if(!u || u === "loggedIn"){
    window.location = "index.html";
    return false;
  }
  return true;
}

function logout(){
  sessionStorage.clear();
  window.location = "index.html";
}

// ---------- Backend health check (NEW) ----------
async function pingBackend(){
  try{
    // backend la /api/history iruku, atha ping pannu (GET)
    const r = await fetch(`${API}/api/history`, { method:"GET" });
    return r.ok;
  }catch(e){
    return false;
  }
}

// ---------- Balance ----------
async function loadBalance(){
  try{
    const u = (sessionStorage.getItem("user") || "").trim();
    if(!u || u === "loggedIn") return;

    const res = await fetch(`${API}/api/balance/${encodeURIComponent(u)}`);
    const data = await res.json().catch(()=> ({}));
    if(res.ok && data.ok){
      const el = document.getElementById("balance");
      if(el) el.innerText = data.balance ?? 0;
    }
  }catch(e){
    // ignore
  }
}

// ---------- Pay (NEW helper) ----------
async function sendMoney(sender, receiver, amount){
  const res = await fetch(`${API}/send`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ sender, receiver, amount })
  });

  const data = await res.json().catch(()=> ({}));
  if(!res.ok || data.error){
    throw new Error(data.error || "Server error");
  }
  return data; // {ok, id, sender_balance, receiver_balance}
}