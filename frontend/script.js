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

function amountToNumber(value) {
  var txt = sanitizeAmount(value);
  var num = Number(txt);
  return isNaN(num) ? 0 : num;
}

function getUserBalanceKey(user) {
  return "stpay_balance_" + String(user || "").toLowerCase();
}

function getAltUserBalanceKey(user) {
  return "balance_" + String(user || "").toLowerCase();
}

function getUserHistoryKey(user) {
  return "stpay_history_" + String(user || "").toLowerCase();
}

function getAltUserHistoryKey(user) {
  return "history_" + String(user || "").toLowerCase();
}

function getUserRechargeHistoryKey(user) {
  return "stpay_recharge_history_" + String(user || "").toLowerCase();
}

function getAltUserRechargeHistoryKey(user) {
  return "recharge_history_" + String(user || "").toLowerCase();
}

function markBalanceUpdatedNow() {
  var now = String(Date.now());
  sessionStorage.setItem("stpay_balance_last_updated", now);
  localStorage.setItem("stpay_balance_last_updated", now);

  var user = getLoggedUser();
  if (user) {
    localStorage.setItem(
      "stpay_balance_last_updated_" + String(user).toLowerCase(),
      now
    );
  }

  return now;
}

function getBalanceUpdatedAt() {
  var user = getLoggedUser();
  return Number(
    sessionStorage.getItem("stpay_balance_last_updated") ||
    (user
      ? localStorage.getItem(
          "stpay_balance_last_updated_" + String(user).toLowerCase()
        )
      : "") ||
    localStorage.getItem("stpay_balance_last_updated") ||
    0
  );
}

function hasStrongLocalBalance() {
  var user = getLoggedUser();
  var userKey = user ? getUserBalanceKey(user) : "";
  var userAltKey = user ? getAltUserBalanceKey(user) : "";

  var possible =
    sessionStorage.getItem("balance_amount") ||
    sessionStorage.getItem("current_balance") ||
    sessionStorage.getItem("wallet_balance") ||
    sessionStorage.getItem("walletBalance") ||
    sessionStorage.getItem("balance") ||
    (userKey ? localStorage.getItem(userKey) : "") ||
    (userAltKey ? localStorage.getItem(userAltKey) : "") ||
    localStorage.getItem("stpay_balance") ||
    localStorage.getItem("stpay_wallet_balance") ||
    localStorage.getItem("balance") ||
    localStorage.getItem("walletBalance") ||
    "";

  var num = amountToNumber(possible);

  return num > 0;
}

function saveBalanceAmount(value) {
  var user = getLoggedUser();
  var finalAmount = sanitizeAmount(value);

  // session
  sessionStorage.setItem("balance_amount", finalAmount);
  sessionStorage.setItem("current_balance", finalAmount);
  sessionStorage.setItem("wallet_balance", finalAmount);
  sessionStorage.setItem("walletBalance", finalAmount);
  sessionStorage.setItem("balance", finalAmount);

  // global local
  localStorage.setItem("stpay_balance", finalAmount);
  localStorage.setItem("stpay_wallet_balance", finalAmount);
  localStorage.setItem("balance", finalAmount);
  localStorage.setItem("walletBalance", finalAmount);

  // user local
  if (user) {
    localStorage.setItem(getUserBalanceKey(user), finalAmount);
    localStorage.setItem(getAltUserBalanceKey(user), finalAmount);
  }

  markBalanceUpdatedNow();
  return finalAmount;
}

function getSavedBalanceAmount() {
  var user = getLoggedUser();

  return sanitizeAmount(
    sessionStorage.getItem("balance_amount") ||
    sessionStorage.getItem("current_balance") ||
    sessionStorage.getItem("wallet_balance") ||
    sessionStorage.getItem("walletBalance") ||
    sessionStorage.getItem("balance") ||
    (user ? localStorage.getItem(getUserBalanceKey(user)) : "") ||
    (user ? localStorage.getItem(getAltUserBalanceKey(user)) : "") ||
    localStorage.getItem("stpay_balance") ||
    localStorage.getItem("stpay_wallet_balance") ||
    localStorage.getItem("balance") ||
    localStorage.getItem("walletBalance") ||
    "0"
  );
}

function updateBalanceElements(value) {
  var finalAmount = saveBalanceAmount(value);

  var ids = [
    "balance",
    "secureBalanceValue",
    "statementBalance",
    "profileBalance",
    "availableBalance",
    "walletBalance",
    "balanceAmount"
  ];

  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) {
      var displayValue = "₹" + finalAmount;
      el.innerText = displayValue;
      el.textContent = displayValue;
    }
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
  try {
    if (!res) return Promise.resolve({});
    if (res.status === 204) return Promise.resolve({});
    return res.text().then(function (txt) {
      if (!txt || !txt.trim()) return {};
      try {
        return JSON.parse(txt);
      } catch (e) {
        console.log("JSON parse error:", e);
        return {};
      }
    }).catch(function (e) {
      console.log("JSON read error:", e);
      return {};
    });
  } catch (e) {
    console.log("safeJson error:", e);
    return Promise.resolve({});
  }
}

function strContains(text, search) {
  if (typeof text !== "string") text = String(text || "");
  return text.indexOf(search) !== -1;
}

function readArrayStorage(key) {
  try {
    var raw = localStorage.getItem(key) || "[]";
    var parsed = JSON.parse(raw);
    return Object.prototype.toString.call(parsed) === "[object Array]" ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeArrayStorage(key, arr, limit) {
  var list = Object.prototype.toString.call(arr) === "[object Array]" ? arr : [];
  localStorage.setItem(key, JSON.stringify(list.slice(0, limit || 100)));
}

function dispatchBalanceUpdateEvent(value) {
  try {
    window.dispatchEvent(new CustomEvent("stpay-balance-updated", {
      detail: {
        user: getLoggedUser(),
        balance: sanitizeAmount(value)
      }
    }));
  } catch (e) {
    console.log("dispatchBalanceUpdateEvent error:", e);
  }
}

function normalizeHistoryItem(item) {
  var obj = item || {};
  var type = String(obj.type || "").toLowerCase();

  return {
    type: obj.type || "transaction",
    title: obj.title || obj.name || "Transaction",
    subtitle: obj.subtitle || obj.to || obj.billName || obj.ticketName || obj.provider || "",
    user: obj.user || getLoggedUser(),
    to: obj.to || "",
    number: obj.number || "",
    provider: obj.provider || "",
    billName: obj.billName || "",
    ticketName: obj.ticketName || "",
    plan: obj.plan || "",
    amount: amountToNumber(obj.amount),
    sign: obj.sign || (type === "credit" ? "+" : "-"),
    color: obj.color || (type === "credit" ? "green" : "red"),
    time: obj.time || new Date().toLocaleString("en-IN"),
    status: obj.status || "success",
    balanceAfter: sanitizeAmount(obj.balanceAfter || getSavedBalanceAmount()),
    txn: obj.txn || obj.txId || obj.txnId || "",
    txnId: obj.txnId || obj.txn || "",
    icon: obj.icon || "💳",
    method: obj.method || "",
    category: obj.category || type || "transaction"
  };
}

function pushUserHistory(item) {
  try {
    var user = getLoggedUser();
    if (!user || !item) return;

    var normalized = normalizeHistoryItem(item);

    // common modern + legacy
    var commonHistory = readArrayStorage("stpay_history");
    commonHistory.unshift(normalized);
    writeArrayStorage("stpay_history", commonHistory, 150);

    var commonHistoryAlt = readArrayStorage("history");
    commonHistoryAlt.unshift(normalized);
    writeArrayStorage("history", commonHistoryAlt, 150);

    // user modern + legacy
    var userHistoryKey = getUserHistoryKey(user);
    var userHistory = readArrayStorage(userHistoryKey);
    userHistory.unshift(normalized);
    writeArrayStorage(userHistoryKey, userHistory, 150);

    var altUserHistoryKey = getAltUserHistoryKey(user);
    var altUserHistory = readArrayStorage(altUserHistoryKey);
    altUserHistory.unshift(normalized);
    writeArrayStorage(altUserHistoryKey, altUserHistory, 150);

    if (String(normalized.type).toLowerCase() === "recharge") {
      var commonRecharge = readArrayStorage("stpay_recharge_history");
      commonRecharge.unshift(normalized);
      writeArrayStorage("stpay_recharge_history", commonRecharge, 100);

      var commonRechargeAlt = readArrayStorage("recharge_history");
      commonRechargeAlt.unshift(normalized);
      writeArrayStorage("recharge_history", commonRechargeAlt, 100);

      var userRechargeKey = getUserRechargeHistoryKey(user);
      var userRecharge = readArrayStorage(userRechargeKey);
      userRecharge.unshift(normalized);
      writeArrayStorage(userRechargeKey, userRecharge, 100);

      var altUserRechargeKey = getAltUserRechargeHistoryKey(user);
      var altUserRecharge = readArrayStorage(altUserRechargeKey);
      altUserRecharge.unshift(normalized);
      writeArrayStorage(altUserRechargeKey, altUserRecharge, 100);
    }

    localStorage.setItem("stpay_last_history_update", String(Date.now()));
  } catch (e) {
    console.log("pushUserHistory error:", e);
  }
}


/* ------------------------------
   BALANCE CALCULATION HELPERS
------------------------------ */

function applyBalanceDelta(delta) {
  var current = amountToNumber(getSavedBalanceAmount());
  var finalAmount = current + Number(delta || 0);

  if (isNaN(finalAmount)) {
    finalAmount = current;
  }

  if (finalAmount < 0) {
    finalAmount = 0;
  }

  var saved = updateBalanceElements(finalAmount);
  dispatchBalanceUpdateEvent(saved);
  return saved;
}

function deductBalanceAmount(amount) {
  var amt = amountToNumber(amount);
  if (amt <= 0) return getSavedBalanceAmount();
  return applyBalanceDelta(-amt);
}

function creditBalanceAmount(amount) {
  var amt = amountToNumber(amount);
  if (amt <= 0) return getSavedBalanceAmount();
  return applyBalanceDelta(amt);
}

function syncBalanceFromResponse(data, fallbackAmount, mode) {
  try {
    if (
      data &&
      data.balance !== undefined &&
      data.balance !== null &&
      !isNaN(Number(data.balance))
    ) {
      var saved = updateBalanceElements(Number(data.balance));
      dispatchBalanceUpdateEvent(saved);
      return saved;
    }

    if (mode === "credit") {
      return creditBalanceAmount(fallbackAmount);
    }

    if (mode === "debit") {
      return deductBalanceAmount(fallbackAmount);
    }

    return updateBalanceElements(getSavedBalanceAmount());
  } catch (e) {
    console.log("syncBalanceFromResponse error:", e);
    return updateBalanceElements(getSavedBalanceAmount());
  }
}

function extractAmountFromPayload(payload) {
  try {
    if (!payload) return 0;

    if (payload.amount !== undefined && payload.amount !== null) {
      return amountToNumber(payload.amount);
    }

    if (payload.rechargeAmount !== undefined && payload.rechargeAmount !== null) {
      return amountToNumber(payload.rechargeAmount);
    }

    if (payload.billAmount !== undefined && payload.billAmount !== null) {
      return amountToNumber(payload.billAmount);
    }

    if (payload.ticketAmount !== undefined && payload.ticketAmount !== null) {
      return amountToNumber(payload.ticketAmount);
    }

    if (payload.total !== undefined && payload.total !== null) {
      return amountToNumber(payload.total);
    }

    if (payload.price !== undefined && payload.price !== null) {
      return amountToNumber(payload.price);
    }

    if (payload.value !== undefined && payload.value !== null) {
      return amountToNumber(payload.value);
    }

    return 0;
  } catch (e) {
    return 0;
  }
}

function readJsonBodySafely(init) {
  try {
    if (!init || !init.body) return null;

    if (typeof init.body === "string") {
      return JSON.parse(init.body);
    }

    return null;
  } catch (e) {
    return null;
  }
}

function isDebitUrl(url) {
  var txt = String(url || "").toLowerCase();

  return (
    txt.indexOf("/api/send") !== -1 ||
    txt.indexOf("/api/pay") !== -1 ||
    txt.indexOf("/api/payment") !== -1 ||
    txt.indexOf("/api/transaction") !== -1 ||
    txt.indexOf("/api/bill") !== -1 ||
    txt.indexOf("/api/recharge") !== -1 ||
    txt.indexOf("/api/ticket") !== -1 ||
    txt.indexOf("/api/book") !== -1 ||
    txt.indexOf("/api/people") !== -1 ||
    txt.indexOf("/api/transfer") !== -1 ||
    txt.indexOf("/api/debit") !== -1 ||
    txt.indexOf("/api/deduct") !== -1
  );
}

function isCreditUrl(url) {
  var txt = String(url || "").toLowerCase();

  return (
    txt.indexOf("/api/add-money") !== -1 ||
    txt.indexOf("/api/addmoney") !== -1 ||
    txt.indexOf("/api/topup") !== -1 ||
    txt.indexOf("/api/credit") !== -1
  );
}

function shouldAutoSyncForMethod(method) {
  var m = String(method || "GET").toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH";
}


/* ------------------------------
   AUTO FETCH BALANCE SYNC FIX
------------------------------ */

if (!window.__stpayFetchWrapped) {
  window.__stpayFetchWrapped = true;

  var __nativeFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    var reqUrl = "";
    var reqMethod = "GET";
    var reqPayload = null;

    try {
      reqUrl = typeof input === "string"
        ? input
        : (input && input.url) || "";

      reqMethod =
        (init && init.method) ||
        (input && input.method) ||
        "GET";

      reqPayload = readJsonBodySafely(init);
    } catch (e) {
      console.log("fetch wrapper pre-read error:", e);
    }

    return __nativeFetch(input, init).then(function (res) {
      try {
        var shouldCheck =
          getLoggedUser() &&
          shouldAutoSyncForMethod(reqMethod) &&
          (isDebitUrl(reqUrl) || isCreditUrl(reqUrl));

        if (!shouldCheck) {
          return res;
        }

        res.clone().json().then(function (data) {
          try {
            if (!res.ok) return;

            var okState = true;
            if (data && data.ok === false) okState = false;
            if (!okState) return;

            var amount = extractAmountFromPayload(reqPayload);

            if (isCreditUrl(reqUrl)) {
              syncBalanceFromResponse(data, amount, "credit");
              return;
            }

            if (isDebitUrl(reqUrl)) {
              syncBalanceFromResponse(data, amount, "debit");
              return;
            }
          } catch (innerErr) {
            console.log("fetch wrapper sync error:", innerErr);
          }
        }).catch(function () {
          /* ignore non-json */
        });
      } catch (e) {
        console.log("fetch wrapper error:", e);
      }

      return res;
    });
  };
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
  setTextIfExists("userDisplay", u);
  setTextIfExists("walletUserName", u);
  setTextIfExists("currentUser", u);
}


/* ------------------------------
   LOAD BALANCE
------------------------------ */

function loadBalance() {
  return new Promise(function (resolve) {
    try {
      var user = getLoggedUser();
      var saved = getSavedBalanceAmount();
      var savedNum = amountToNumber(saved);
      var hasLocal = hasStrongLocalBalance();
      var lastUpdatedAt = getBalanceUpdatedAt();
      var isRecentLocalUpdate =
        lastUpdatedAt && (Date.now() - lastUpdatedAt < 30 * 60 * 1000);

      // always show local immediately
      updateBalanceElements(saved);

      if (!user) {
        resolve(saved);
        return;
      }

      fetch(API + "/api/balance/" + encodeURIComponent(user))
        .then(function (res) {
          return Promise.all([Promise.resolve(res), safeJson(res)]);
        })
        .then(function (arr) {
          var res = arr[0];
          var data = arr[1];

          console.log("Balance API response:", data);

          var serverAmount = null;

          if (
            res.ok &&
            data &&
            data.balance !== undefined &&
            data.balance !== null &&
            !isNaN(Number(data.balance))
          ) {
            serverAmount = Number(data.balance);
          }

          // server positive and local zero => always use server
          if (serverAmount !== null && serverAmount > 0 && savedNum <= 0) {
            var finalFromServerFirst = sanitizeAmount(serverAmount);
            updateBalanceElements(finalFromServerFirst);
            dispatchBalanceUpdateEvent(finalFromServerFirst);
            resolve(finalFromServerFirst);
            return;
          }

          // recent valid local positive balance
          if (hasLocal && savedNum > 0 && isRecentLocalUpdate) {
            var keepLocal = sanitizeAmount(saved);
            updateBalanceElements(keepLocal);
            dispatchBalanceUpdateEvent(keepLocal);
            resolve(keepLocal);
            return;
          }

          // server valid balance
          if (serverAmount !== null) {
            var finalFromServer = sanitizeAmount(serverAmount);
            updateBalanceElements(finalFromServer);
            dispatchBalanceUpdateEvent(finalFromServer);
            resolve(finalFromServer);
            return;
          }

          // fallback local
          var fallback = sanitizeAmount(saved);
          updateBalanceElements(fallback);
          dispatchBalanceUpdateEvent(fallback);
          resolve(fallback);
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
    val.innerText = "₹" + sanitizeAmount(amt);
    val.textContent = "₹" + sanitizeAmount(amt);
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
      var finalValue = "₹" + sanitizeAmount(latestBalance);
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
   HELP PAGE COMPATIBILITY
------------------------------ */

function back() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location = "dashboard.html";
  }
}

function go(page) {
  window.location = page;
}

function toggle(head) {
  if (!head) return;
  var item = head.closest ? head.closest(".rowItem") : null;
  if (item && item.classList) {
    item.classList.toggle("open");
  }
}

function filterFAQ() {
  var input =
    document.getElementById("q") ||
    document.getElementById("searchInput");

  var q = ((input && input.value) || "").toLowerCase().trim();

  var items = document.querySelectorAll(".faq");
  var shown = 0;

  for (var i = 0; i < items.length; i++) {
    var el = items[i];
    var text =
      (el.getAttribute("data-text") || "") + " " +
      (el.getAttribute("data-search") || "") + " " +
      (el.innerText || el.textContent || "");

    text = String(text).toLowerCase();

    var show = !q || strContains(text, q);
    el.style.display = show ? "block" : "none";
    if (show) shown++;
  }

  var empty = document.getElementById("emptyState");
  if (empty) {
    empty.style.display = shown ? "none" : "block";
  }
}


/* ------------------------------
   SEARCH FILTER
------------------------------ */

function applySearch() {
  var input =
    document.getElementById("searchBox") ||
    document.getElementById("searchInput") ||
    document.getElementById("q");

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

  if (document.querySelector(".faq")) {
    filterFAQ();
  }
}

function clearSearch() {
  var input1 = document.getElementById("searchBox");
  var input2 = document.getElementById("searchInput");
  var input3 = document.getElementById("q");

  if (input1) input1.value = "";
  if (input2) input2.value = "";
  if (input3) input3.value = "";

  applySearch();
  filterFAQ();
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
              updateBalanceElements(balanceValue);
              dispatchBalanceUpdateEvent(balanceValue);
            } else {
              creditBalanceAmount(finalAmount);
            }

            pushUserHistory({
              type: "credit",
              title: "Money Added",
              user: user,
              amount: Number(finalAmount),
              time: new Date().toLocaleString("en-IN"),
              status: "success",
              icon: "💰"
            });

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
            var finalBal = "0.00";

            if (data.balance !== undefined && data.balance !== null) {
              finalBal = updateBalanceElements(data.balance);
              dispatchBalanceUpdateEvent(finalBal);
            } else {
              finalBal = deductBalanceAmount(finalAmount);
            }

            pushUserHistory({
              type: "debit",
              title: "Money Sent",
              user: fromUser,
              to: receiver,
              amount: Number(finalAmount),
              time: new Date().toLocaleString("en-IN"),
              status: "success",
              balanceAfter: finalBal,
              icon: "📤"
            });

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
   UNIVERSAL PAYMENT HELPERS
   bills / tickets / recharge / custom pages
------------------------------ */

function completeDebitPayment(amount, historyItem) {
  var finalBal = deductBalanceAmount(amount);

  if (historyItem) {
    var item = historyItem || {};
    if (!item.time) item.time = new Date().toLocaleString("en-IN");
    if (!item.status) item.status = "success";
    if (!item.balanceAfter) item.balanceAfter = finalBal;
    pushUserHistory(item);
  }

  return finalBal;
}

function completeCreditPayment(amount, historyItem) {
  var finalBal = creditBalanceAmount(amount);

  if (historyItem) {
    var item = historyItem || {};
    if (!item.time) item.time = new Date().toLocaleString("en-IN");
    if (!item.status) item.status = "success";
    if (!item.balanceAfter) item.balanceAfter = finalBal;
    pushUserHistory(item);
  }

  return finalBal;
}

function completeBillPayment(amount, billName) {
  return completeDebitPayment(amount, {
    type: "bill",
    title: "Bill Paid",
    user: getLoggedUser(),
    amount: amountToNumber(amount),
    billName: billName || "Bill",
    icon: "🧾"
  });
}

function completeTicketPayment(amount, ticketName) {
  return completeDebitPayment(amount, {
    type: "ticket",
    title: "Ticket Booked",
    user: getLoggedUser(),
    amount: amountToNumber(amount),
    ticketName: ticketName || "Ticket",
    icon: "🎫"
  });
}

function completeRechargePayment(amount, providerName) {
  return completeDebitPayment(amount, {
    type: "recharge",
    title: "Recharge Done",
    user: getLoggedUser(),
    amount: amountToNumber(amount),
    provider: providerName || "Recharge",
    icon: "📱"
  });
}

function completeTransactionPayment(amount, titleText) {
  return completeDebitPayment(amount, {
    type: "transaction",
    title: titleText || "Transaction Paid",
    user: getLoggedUser(),
    amount: amountToNumber(amount),
    icon: "💳"
  });
}

function completePeoplePayment(amount, personName) {
  return completeDebitPayment(amount, {
    type: "people",
    title: "Paid to Contact",
    user: getLoggedUser(),
    to: personName || "",
    amount: amountToNumber(amount),
    icon: "👤"
  });
}

function completePayPayment(amount, receiverName) {
  return completeDebitPayment(amount, {
    type: "pay",
    title: "Payment Done",
    user: getLoggedUser(),
    to: receiverName || "",
    amount: amountToNumber(amount),
    icon: "💸"
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
          return Promise.all([Promise.resolve(res), safeJson(res)]);
        })
        .then(function (arr) {
          var res = arr[0];
          var data = arr[1];

          console.log("History response:", data);

          var list =
            data.history ||
            data.transactions ||
            data.items ||
            [];

          if (res.ok && Object.prototype.toString.call(list) === "[object Array]") {
            try {
              writeArrayStorage("stpay_history", list, 150);
              writeArrayStorage("history", list, 150);
              writeArrayStorage(getUserHistoryKey(user), list, 150);
              writeArrayStorage(getAltUserHistoryKey(user), list, 150);
            } catch (e) {
              console.log("History cache write error:", e);
            }
            resolve(list);
            return;
          }

          var fallback =
            readArrayStorage(getUserHistoryKey(user)).length
              ? readArrayStorage(getUserHistoryKey(user))
              : readArrayStorage(getAltUserHistoryKey(user)).length
                ? readArrayStorage(getAltUserHistoryKey(user))
                : readArrayStorage("stpay_history").length
                  ? readArrayStorage("stpay_history")
                  : readArrayStorage("history");

          resolve(fallback);
        })
        .catch(function (e) {
          console.log("History load error:", e);

          var fallback =
            readArrayStorage(getUserHistoryKey(user)).length
              ? readArrayStorage(getUserHistoryKey(user))
              : readArrayStorage(getAltUserHistoryKey(user)).length
                ? readArrayStorage(getAltUserHistoryKey(user))
                : readArrayStorage("stpay_history").length
                  ? readArrayStorage("stpay_history")
                  : readArrayStorage("history");

          resolve(fallback);
        });

    } catch (e) {
      console.log("History load error:", e);

      var user2 = getLoggedUser();
      var fallback2 =
        readArrayStorage(getUserHistoryKey(user2)).length
          ? readArrayStorage(getUserHistoryKey(user2))
          : readArrayStorage(getAltUserHistoryKey(user2)).length
            ? readArrayStorage(getAltUserHistoryKey(user2))
            : readArrayStorage("stpay_history").length
              ? readArrayStorage("stpay_history")
              : readArrayStorage("history");

      resolve(fallback2);
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
  sessionStorage.removeItem("balance_visible");
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

window.addEventListener("focus", function () {
  if (getLoggedUser()) {
    updateBalanceElements(getSavedBalanceAmount());
    loadBalance();
  }
});

window.addEventListener("pageshow", function () {
  if (getLoggedUser()) {
    updateBalanceElements(getSavedBalanceAmount());
    loadBalance();
  }
});

window.addEventListener("storage", function (e) {
  var user = getLoggedUser();

  if (
    e &&
    (
      e.key === "stpay_balance" ||
      e.key === "stpay_wallet_balance" ||
      e.key === "balance" ||
      e.key === "walletBalance" ||
      e.key === "stpay_history" ||
      e.key === "history" ||
      e.key === "stpay_balance_last_updated" ||
      e.key === getUserBalanceKey(user) ||
      e.key === getAltUserBalanceKey(user) ||
      e.key === getUserHistoryKey(user) ||
      e.key === getAltUserHistoryKey(user)
    )
  ) {
    updateBalanceElements(getSavedBalanceAmount());
  }
});

window.addEventListener("stpay-balance-updated", function () {
  updateBalanceElements(getSavedBalanceAmount());
});

window.addEventListener("DOMContentLoaded", function () {
  initUserDisplay();

  var start = Promise.resolve();

  if (getLoggedUser()) {
    updateBalanceElements(getSavedBalanceAmount());
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

    if (document.querySelector(".faq")) {
      filterFAQ();
    }
  });
});