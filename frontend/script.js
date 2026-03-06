// frontend/script.js

/* ------------------------------
   API BASE (AUTO DETECT)
------------------------------ */

let API;

// Local development
if (
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost"
) {
  API = "http://127.0.0.1:5000";
}

// Render / production
else {
  API = location.origin +"/api";
}

console.log("API BASE:", API);


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

    const user = sessionStorage.getItem("user");
    if(!user) return;

    const res = await fetch(`${API}/api/balance/${encodeURIComponent(user)}`);

    const data = await res.json();

    if(res.ok && data.ok){

      const el = document.getElementById("balance");

      if(el){
        el.innerText = data.balance;
      }

    }

  }catch(e){

    console.log("Balance load error", e);

  }

}


/* ------------------------------
   BALANCE LOCK SYSTEM (NEW)
------------------------------ */

function toggleBalanceLock(){

  const masked = document.getElementById("balanceMasked");
  const real = document.getElementById("balanceWrap");
  const btn = document.getElementById("balBtn");

  const visible = sessionStorage.getItem("balance_visible") === "1";

  // hide if already visible
  if(visible){

    masked.classList.remove("hidden");
    real.classList.add("hidden");
    btn.innerText = "🔒 Show";

    sessionStorage.setItem("balance_visible","0");

    return;

  }

  // ask password
  const pass = prompt("Enter password to view balance");

  const correctPass = sessionStorage.getItem("pass") || "123";

  if(pass === correctPass){

    masked.classList.add("hidden");
    real.classList.remove("hidden");
    btn.innerText = "👁 Hide";

    sessionStorage.setItem("balance_visible","1");

  }else{

    alert("Wrong password");

  }

}


/* ------------------------------
   LOGOUT
------------------------------ */

function logout(){

  sessionStorage.clear();

  window.location = "index.html";

} 