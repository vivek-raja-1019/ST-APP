// frontend/script.js

/* ------------------------------
   API BASE (AUTO DETECT)
------------------------------ */

var API = "";

// Local development
if (
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost"
) {
  API = "http://127.0.0.1:5000";
}
// Render / production
else {
  API = location.origin;
}

console.log("API BASE:", API);


/* ------------------------------
   COMMON HELPERS
------------------------------ */

function getLoggedUser() {
  return (sessionStorage.getItem("user") || "").trim();
}

function sanitizeAmount(value) {
  if (value === undefined || value === null) return "0.00";

  var txt = String(value).trim();

  if (
    !txt ||
    txt === "undefined" ||
    txt === "null" ||
    txt === "NaN"
  ) {
    return "0.00";
  }

  txt = txt.replace(/[₹,\s]/g, "");

  var num = Number(txt);
  if (isNaN(num)) return "0.00";

  return num.toFixed(2);
}

function saveBalanceAmount(value) {
  var finalAmount = sanitizeAmount(value);

  sessionStorage.setItem("balance_amount", finalAmount);
  sessionStorage.setItem("current_balance", finalAmount);
  sessionStorage.setItem("wallet_balance", finalAmount);
  sessionStorage.setItem("balance", finalAmount);

  return finalAmount;
}

function getSavedBalanceAmount() {
  return sanitizeAmount(
    sessionStorage.getItem("balance_amount") ||
    sessionStorage.getItem("current_balance") ||
    sessionStorage.getItem("wallet_balance") ||
    sessionStorage.getItem("balance") ||
    "0"
  );
}

function updateBalanceElements(value) {
  var finalAmount = saveBalanceAmount(value);

  var balanceEl = document.getElementById("balance");
  if (balanceEl) {
    balanceEl.innerText = finalAmount;
    balanceEl.textContent = finalAmount;
  }

  var secureBalanceEl = document.getElementById("secureBalanceValue");
  if (secureBalanceEl) {
    secureBalanceEl.innerText = finalAmount;
    secureBalanceEl.textContent = finalAmount;
  }

  var statementBalanceEl = document.getElementById("statementBalance");
  if (statementBalanceEl) {
    statementBalanceEl.innerText = finalAmount;
    statementBalanceEl.textContent = finalAmount;
  }

  var profileBalanceEl = document.getElementById("profileBalance");
  if (profileBalanceEl) {
    profileBalanceEl.innerText = finalAmount;
    profileBalanceEl.textContent = finalAmount;
  }

  return finalAmount;
}

function setTextIfExists(id, value) {
  var el = document.getElementById(id);
  if (el) {
    el.innerText = value;
    el.textContent = value;
  }
}

function safeJson(res) {
  return res.json().then(function (data) {
    return data;
  }).catch(function (e) {
    console.log("JSON parse error:", e);
    return {};
  });
}

function strContains(text, search) {
  if (typeof text !== "string") text = String(text || "");
  return text.indexOf(search) !== -1;
}


/* ------------------------------
   LOGIN CHECK
------------------------------ */

function requireLogin() {
  var u = getLoggedUser();

  if (!u) {
    window.location = "index.html";
    return false;
  }

  return true;
}


/* ------------------------------
   USER UI INIT
------------------------------ */

function initUserDisplay() {
  var u = getLoggedUser() || "User";

  setTextIfExists("userPill", u);
  setTextIfExists("profileUserName", u);
  setTextIfExists("profileName", u);
  setTextIfExists("welcomeUser", u);
  setTextIfExists("displayUser", u);
}


/* ------------------------------
   LOAD BALANCE
------------------------------ */

function loadBalance() {
  return new Promise(function (resolve) {
    try {
      var user = getLoggedUser();

      if (!user) {
        var saved = getSavedBalanceAmount();
        updateBalanceElements(saved);
        resolve(saved);
        return;
      }

      fetch(API + "/api/balance/" + encodeURIComponent(user))
        .then(function (res) {
          return safeJson(res);
        })
        .then(function (data) {
          console.log("Balance API response:", data);

          var amount = 0;

          if (data && data.balance !== undefined && data.balance !== null) {
            amount = Number(data.balance);
          }

          if (isNaN(amount)) {
            amount = Number(getSavedBalanceAmount());
          }

          if (isNaN(amount)) {
            amount = 0;
          }

          var finalAmount = amount.toFixed(2);

          updateBalanceElements(finalAmount);

          sessionStorage.setItem("balance_amount", finalAmount);
          sessionStorage.setItem("current_balance", finalAmount);
          sessionStorage.setItem("wallet_balance", finalAmount);
          sessionStorage.setItem("balance", finalAmount);

          resolve(finalAmount);
        })
        .catch(function (e) {
          console.log("Balance load error", e);

          var fallback = getSavedBalanceAmount();
          updateBalanceElements(fallback);
          resolve(fallback);
        });

    } catch (e) {
      console.log("Balance load error", e);

      var fallback2 = getSavedBalanceAmount();
      updateBalanceElements(fallback2);
      resolve(fallback2);
    }
  });
}

/* ------------------------------
   BALANCE LOCK SYSTEM
------------------------------ */

function setBalanceVisibility(show) {
  var masked = document.getElementById("balanceMasked");
  var real = document.getElementById("balanceWrap");
  var btn = document.getElementById("balBtn");

  if (!masked || !real || !btn) return;

  if (show) {
    if (masked.classList) masked.classList.add("hidden");
    if (real.classList) real.classList.remove("hidden");

    masked.style.display = "none";
    real.style.display = "inline";

    btn.innerText = "👁 Hide";
    btn.textContent = "👁 Hide";
    sessionStorage.setItem("balance_visible", "1");
  } else {
    if (masked.classList) masked.classList.remove("hidden");
    if (real.classList) real.classList.add("hidden");

    masked.style.display = "inline";
    real.style.display = "none";

    btn.innerText = "🔒 Show";
    btn.textContent = "🔒 Show";
    sessionStorage.setItem("balance_visible", "0");
  }
}

/* dashboard compatibility */
function setBalanceVisible(show) {
  setBalanceVisibility(show);
}

function toggleBalanceLock() {
  var visible = sessionStorage.getItem("balance_visible") === "1";

  if (visible) {
    setBalanceVisibility(false);
    return;
  }

  var pass = prompt("Enter password to view balance");
  if (pass === null) return;

  var correctPass = (sessionStorage.getItem("pass") || "123").trim();

  if (pass.trim() === correctPass) {
    var current = getSavedBalanceAmount();

    if (!current || current === "0.00") {
      loadBalance().then(function () {
        setBalanceVisibility(true);
      });
    } else {
      updateBalanceElements(current);
      setBalanceVisibility(true);
    }
  } else {
    alert("Wrong password");
    setBalanceVisibility(false);
  }
}


/* ------------------------------
   SECURE BALANCE MODAL
------------------------------ */

function openBalanceFeature() {
  var modal = document.getElementById("balanceModal");
  var input = document.getElementById("balancePasswordInput");
  var error = document.getElementById("balanceError");
  var box = document.getElementById("secureAmountBox");
  var val = document.getElementById("secureBalanceValue");

  if (error) error.style.display = "none";
  if (box) box.style.display = "none";
  if (input) input.value = "";
  if (val) {
    var amt = getSavedBalanceAmount();
    val.innerText = amt;
    val.textContent = amt;
  }

  if (modal) {
    modal.style.display = "flex";
    setTimeout(function () {
      if (input) input.focus();
    }, 100);
  }
}

function closeBalanceModal() {
  var modal = document.getElementById("balanceModal");
  if (modal) modal.style.display = "none";
}

function verifyBalancePassword() {
  var inputEl = document.getElementById("balancePasswordInput");
  var entered = inputEl ? String(inputEl.value).trim() : "";

  var correct = String(sessionStorage.getItem("pass") || "123").trim();
  var error = document.getElementById("balanceError");
  var box = document.getElementById("secureAmountBox");
  var val = document.getElementById("secureBalanceValue");

  if (entered !== correct) {
    if (box) box.style.display = "none";
    if (error) error.style.display = "block";
    return;
  }

  if (error) error.style.display = "none";

  loadBalance().then(function (latestBalance) {
    if (val) {
      var finalValue = sanitizeAmount(latestBalance);
      val.innerText = finalValue;
      val.textContent = finalValue;
    }

    if (box) box.style.display = "block";
  });
}


/* ------------------------------
   QUICK PAY / NAV
------------------------------ */

function goPage(page) {
  window.location = page;
}

function quickPay(name) {
  sessionStorage.setItem("quick_receiver", name);
  window.location = "transaction.html";
}


/* ------------------------------
   SEARCH FILTER
------------------------------ */

function applySearch() {
  var input = document.getElementById("searchBox");
  if (!input) return;

  var q = (input.value || "").trim().toLowerCase();

  var features = document.querySelectorAll(".feature");
  var i, el, label, hide;

  for (i = 0; i < features.length; i++) {
    el = features[i];
    label = (el.getAttribute("data-label") || "").toLowerCase();
    hide = q && !strContains(label, q);
    if (el.classList) el.classList.toggle("hidden", hide);
  }

  var persons = document.querySelectorAll(".personItem");
  for (i = 0; i < persons.length; i++) {
    el = persons[i];
    var name = (el.getAttribute("data-name") || "").toLowerCase();
    hide = q && !strContains(name, q);
    if (el.classList) el.classList.toggle("hidden", hide);
  }

  var historyItems = document.querySelectorAll(".historyItem");
  for (i = 0; i < historyItems.length; i++) {
    el = historyItems[i];
    var text = (el.innerText || el.textContent || "").toLowerCase();
    hide = q && !strContains(text, q);
    if (el.classList) el.classList.toggle("hidden", hide);
  }
}

function clearSearch() {
  var input = document.getElementById("searchBox");
  if (input) input.value = "";
  applySearch();
}


/* ------------------------------
   MONEY ACTIONS
------------------------------ */

function addMoney(amount) {
  return new Promise(function (resolve) {
    try {
      var user = getLoggedUser();
      if (!user) {
        alert("Login required");
        resolve(null);
        return;
      }

      var finalAmount = Number(amount);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        alert("Enter valid amount");
        resolve(null);
        return;
      }

      fetch(API + "/api/add-money", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user: user,
          amount: finalAmount
        })
      })
        .then(function (res) {
          return Promise.all([Promise.resolve(res), safeJson(res)]);
        })
        .then(function (arr) {
          var res = arr[0];
          var data = arr[1];

          console.log("Add money response:", data);

          if (res.ok && data.ok) {
            var balanceValue = 0;
            if (data.balance !== undefined && data.balance !== null) {
              balanceValue = data.balance;
            }
            updateBalanceElements(balanceValue);
            alert("Money added successfully");
            resolve(data);
          } else {
            alert(data.message || "Add money failed");
            resolve(null);
          }
        })
        .catch(function (e) {
          console.log("Add money error:", e);
          alert("Server error");
          resolve(null);
        });

    } catch (e) {
      console.log("Add money error:", e);
      alert("Server error");
      resolve(null);
    }
  });
}

function sendMoney(toUser, amount) {
  return new Promise(function (resolve) {
    try {
      var fromUser = getLoggedUser();
      if (!fromUser) {
        alert("Login required");
        resolve(null);
        return;
      }

      var receiver = String(toUser || "").trim();
      var finalAmount = Number(amount);

      if (!receiver) {
        alert("Receiver required");
        resolve(null);
        return;
      }

      if (isNaN(finalAmount) || finalAmount <= 0) {
        alert("Enter valid amount");
        resolve(null);
        return;
      }

      fetch(API + "/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromUser,
          to: receiver,
          amount: finalAmount
        })
      })
        .then(function (res) {
          return Promise.all([Promise.resolve(res), safeJson(res)]);
        })
        .then(function (arr) {
          var res = arr[0];
          var data = arr[1];

          console.log("Send money response:", data);

          if (res.ok && data.ok) {
            var balanceValue = 0;
            if (data.balance !== undefined && data.balance !== null) {
              balanceValue = data.balance;
            }
            updateBalanceElements(balanceValue);
            alert("Payment successful");
            resolve(data);
          } else {
            alert(data.message || "Payment failed");
            resolve(null);
          }
        })
        .catch(function (e) {
          console.log("Send money error:", e);
          alert("Server error");
          resolve(null);
        });

    } catch (e) {
      console.log("Send money error:", e);
      alert("Server error");
      resolve(null);
    }
  });
}


/* ------------------------------
   HISTORY
------------------------------ */

function loadHistory() {
  return new Promise(function (resolve) {
    try {
      var user = getLoggedUser();
      if (!user) {
        resolve([]);
        return;
      }

      fetch(API + "/api/history/" + encodeURIComponent(user))
        .then(function (res) {
          return safeJson(res);
        })
        .then(function (data) {
          console.log("History response:", data);

          var list =
            data.history ||
            data.transactions ||
            data.items ||
            [];

          if (Object.prototype.toString.call(list) === "[object Array]") {
            resolve(list);
          } else {
            resolve([]);
          }
        })
        .catch(function (e) {
          console.log("History load error:", e);
          resolve([]);
        });

    } catch (e) {
      console.log("History load error:", e);
      resolve([]);
    }
  });
}


/* ------------------------------
   FILE TRANSFER
------------------------------ */

function uploadFile(formData) {
  return new Promise(function (resolve) {
    try {
      fetch(API + "/api/upload", {
        method: "POST",
        body: formData
      })
        .then(function (res) {
          return Promise.all([Promise.resolve(res), safeJson(res)]);
        })
        .then(function (arr) {
          var res = arr[0];
          var data = arr[1];

          console.log("Upload response:", data);

          if (res.ok && data.ok) {
            alert("File uploaded successfully");
            resolve(data);
          } else {
            alert(data.message || "Upload failed");
            resolve(null);
          }
        })
        .catch(function (e) {
          console.log("Upload error:", e);
          alert("Server error");
          resolve(null);
        });

    } catch (e) {
      console.log("Upload error:", e);
      alert("Server error");
      resolve(null);
    }
  });
}


/* ------------------------------
   LOGOUT
------------------------------ */

function logout() {
  sessionStorage.removeItem("quick_receiver");
  sessionStorage.clear();
  window.location = "index.html";
}


/* ------------------------------
   AUTO INIT
------------------------------ */

window.addEventListener("click", function (e) {
  var modal = document.getElementById("balanceModal");
  if (modal && e.target === modal) {
    closeBalanceModal();
  }
});

window.addEventListener("DOMContentLoaded", function () {
  initUserDisplay();

  var start = Promise.resolve();

  if (getLoggedUser()) {
    start = loadBalance();
  }

  start.then(function () {
    if (
      document.getElementById("balanceMasked") &&
      document.getElementById("balanceWrap") &&
      document.getElementById("balBtn")
    ) {
      setBalanceVisibility(false);
    }

    var quickReceiver = sessionStorage.getItem("quick_receiver");
    var receiverInput =
      document.getElementById("receiver") ||
      document.getElementById("toUser") ||
      document.getElementById("receiverName");

    if (quickReceiver && receiverInput && !receiverInput.value) {
      receiverInput.value = quickReceiver;
    }
  });
});