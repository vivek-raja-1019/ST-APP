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
   LOGOUT
   ------------------------------ */

function logout(){

  sessionStorage.clear();

  window.location = "index.html";

}