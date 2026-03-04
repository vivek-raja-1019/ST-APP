// frontend/script.js

const API = "https://st-app-29gb.onrender.com";

function requireLogin(){
  const u = (sessionStorage.getItem("user") || "").trim();
  if(!u || u === "loggedIn"){
    window.location = "index.html";
    return false;
  }
  return true;
}

async function loadBalance(){
  try{
    const u = (sessionStorage.getItem("user") || "").trim();
    if(!u || u === "loggedIn") return;

    const res = await fetch(`${API}/api/balance/${encodeURIComponent(u)}`);
    const data = await res.json();
    if(res.ok && data.ok){
      const el = document.getElementById("balance");
      if(el) el.innerText = data.balance;
    }
  }catch(e){
    // ignore
  }
}

function logout(){
  sessionStorage.clear();
  window.location = "index.html";
}