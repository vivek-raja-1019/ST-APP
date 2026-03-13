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
  API = location.origin;   // FIXED
}

console.log("API BASE:", API);


/* ------------------------------
   LOGIN CHECK
------------------------------ */

function requireLogin() {
  const u = (sessionStorage.getItem("user") || "").trim();

  if (!u) {
    window.location = "index.html";
    return false;
  }

  return true;
}


/* ------------------------------
   LOAD BALANCE
------------------------------ */

async function loadBalance() {
  try {
    const user = (sessionStorage.getItem("user") || "").trim();
    if (!user) return;

    const res = await fetch(`${API}/api/balance/${encodeURIComponent(user)}`);
    const data = await res.json();

    console.log("Balance API response:", data);

    const el = document.getElementById("balance");

    if (res.ok && data.ok) {
      if (el) {
        el.innerText = data.balance ?? 0;
      }
    } else {
      if (el) {
        el.innerText = "0";
      }
      console.log("Balance load failed");
    }

  } catch (e) {
    console.log("Balance load error", e);

    const el = document.getElementById("balance");
    if (el) {
      el.innerText = "0";
    }
  }
}


/* ------------------------------
   BALANCE LOCK SYSTEM
------------------------------ */

function setBalanceVisibility(show) {
  const masked = document.getElementById("balanceMasked");
  const real = document.getElementById("balanceWrap");
  const btn = document.getElementById("balBtn");

  if (!masked || !real || !btn) return;

  if (show) {
    masked.classList.add("hidden");
    real.classList.remove("hidden");
    btn.innerText = "👁 Hide";
    sessionStorage.setItem("balance_visible", "1");
  } else {
    masked.classList.remove("hidden");
    real.classList.add("hidden");
    btn.innerText = "🔒 Show";
    sessionStorage.setItem("balance_visible", "0");
  }
}

function toggleBalanceLock() {
  const visible = sessionStorage.getItem("balance_visible") === "1";

  // already visible -> hide
  if (visible) {
    setBalanceVisibility(false);
    return;
  }

  // ask password
  const pass = prompt("Enter password to view balance");
  if (pass === null) return;

  const correctPass = (sessionStorage.getItem("pass") || "123").trim();

  if (pass.trim() === correctPass) {
    const el = document.getElementById("balance");

    // fallback in case balance still empty
    if (el && !el.innerText.trim()) {
      el.innerText = "0";
    }

    setBalanceVisibility(true);
  } else {
    alert("Wrong password");
    setBalanceVisibility(false);
  }
}


/* ------------------------------
   LOGOUT
------------------------------ */

function logout() {
  sessionStorage.clear();
  window.location = "index.html";
}