// frontend/script.js

/* ------------------------------
   API BASE (AUTO DETECT)
   ------------------------------ */

let API;

// Local development (Flask on 5000)
if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
  // If you're running frontend via Live Server (5500), still call backend on 5000
  API = (location.port === "5000") ? location.origin : "http://127.0.0.1:5000";
}
// Production / Render / Netlify (backend usually proxied under /api)
else {
  API = location.origin + "/api";
}

// Normalize trailing slash
API = (API || "").replace(/\/+$/, "");

console.log("API BASE:", API);

// If API already ends with "/api", do NOT add another "/api" in endpoints
const API_HAS_API = API.endsWith("/api");

// Endpoints (auto)
const BALANCE_EP = API_HAS_API ? "/balance/" : "/api/balance/";
// (optional) if you add other calls later:
// const USERS_EP = API_HAS_API ? "/users" : "/api/users";
// const SEND_EP  = API_HAS_API ? "/send"  : "/api/send";


/* ------------------------------
   LOGIN CHECK
   ------------------------------ */

function requireLogin(){
  const u = (sessionStorage.getItem("user") || "").trim();

  if(!u){
    window.location = "index.html";
    return false;
  }

  return true;
}


/* ------------------------------
   LOAD BALANCE
   ------------------------------ */

async function loadBalance(){
  try{
    const user = (sessionStorage.getItem("user") || "").trim();
    if(!user) return;

    // ✅ FIXED: no double /api
    const url = `${API}${BALANCE_EP}${encodeURIComponent(user)}`;

    const res = await fetch(url);
    const data = await res.json().catch(()=> ({}));

    if(res.ok && data.ok){
      const el = document.getElementById("balance");
      if(el){
        el.innerText = data.balance;
      }
    }else{
      console.log("Balance API not ok:", res.status, data);
    }

  }catch(e){
    console.log("Balance load error", e);
  }
}


/* ------------------------------
   LOGOUT
   ------------------------------ */

function logout(){
  sessionStorage.clear();
  window.location = "index.html";
}