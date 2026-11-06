/* LENS Lab — shared sign-in gate (single sign-on across group pages)
 *
 * HOW IT WORKS
 *   Every page that includes this script is locked behind the same login as
 *   the chemical inventory. Because all pages live on lens-laboratory.com they
 *   share one browser store, so a sign-in on ANY page unlocks ALL of them on
 *   that device — one account, one token. Accounts are the same ones you manage
 *   in the inventory's "Accounts 账号管理" panel.
 *
 * TO PROTECT A PAGE
 *   Put this in the <head> (ideally first, before other scripts):
 *       <script src="/lens-auth.js"></script>
 *   That's it — the page is now gated.
 *
 * TO LEAVE A PAGE OPEN  (e.g. the group literature feed)
 *   Simply do NOT include this script on that page.
 *
 * OPTIONAL, on a protected page
 *   • Put <span id="lens-userchip"></span> anywhere and it auto-fills with
 *     "Signed in as <name> · Sign out".
 *   • After sign-in, a "lensauth" event fires on document, and these are ready:
 *       LENS.name()     -> "Junke Wang"
 *       LENS.isAdmin()  -> true / false
 *       LENS.user()     -> { username, name, role }
 *       LENS.logout()
 *       LENS.token()
 */
(function () {
  // Same Worker, two addresses: custom domain (China + abroad) first, workers.dev fallback.
  // The gate auto-picks whichever the current network can reach.
  var API_BASES = ["https://api.lens-laboratory.com", "https://lens-inventory-api.lens-laboratory.workers.dev"];
  var LS = window.localStorage;
  var API_BASE = (function(){ try { return LS.getItem("lens_apibase") || API_BASES[0]; } catch(e){ return API_BASES[0]; } })();
  function probeBase(base){ return new Promise(function(res){ var ctl=(typeof AbortController!=="undefined")?new AbortController():null; var t=setTimeout(function(){ if(ctl) try{ctl.abort();}catch(e){} res(false); },3500); fetch(base+"/api/version", ctl?{method:"GET",signal:ctl.signal}:{method:"GET"}).then(function(){ clearTimeout(t); res(true); }).catch(function(){ clearTimeout(t); res(false); }); }); }
  function pickApiBase(cb){ (function go(i){ if(i>=API_BASES.length){ if(cb)cb(); return; } probeBase(API_BASES[i]).then(function(ok){ if(ok){ API_BASE=API_BASES[i]; try{ LS.setItem("lens_apibase",API_BASE); }catch(e){} if(cb)cb(); } else go(i+1); }); })(0); }

  function tok()      { try { return LS.getItem("lens_token") || ""; } catch (e) { return ""; } }
  function setTok(t)  { try { t ? LS.setItem("lens_token", t) : LS.removeItem("lens_token"); } catch (e) {} }
  function getUser()  { try { return JSON.parse(LS.getItem("lens_user") || "null"); } catch (e) { return null; } }
  function setUser(u) { try { u ? LS.setItem("lens_user", JSON.stringify(u)) : LS.removeItem("lens_user"); } catch (e) {} }

  /* ---------- styles (injected once) ---------- */
  function injectCSS() {
    if (document.getElementById("lens-auth-css")) return;
    var s = document.createElement("style");
    s.id = "lens-auth-css";
    s.textContent =
      '#lens-gate{position:fixed;inset:0;z-index:2147483647;background:#0b1f3a;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}' +
      '#lens-gate .card{width:100%;max-width:360px;background:#fff;border-radius:16px;' +
      'padding:30px 28px;box-shadow:0 18px 50px rgba(0,0,0,.35);box-sizing:border-box;}' +
      '#lens-gate h1{margin:0 0 4px;font-size:20px;color:#0b1f3a;letter-spacing:.3px;}' +
      '#lens-gate .sub{margin:0 0 20px;font-size:13px;color:#667;line-height:1.5;}' +
      '#lens-gate label{display:block;font-size:12px;color:#556;margin:12px 0 5px;font-weight:600;}' +
      '#lens-gate input{width:100%;box-sizing:border-box;padding:11px 12px;font-size:15px;' +
      'border:1px solid #cdd4de;border-radius:9px;outline:none;background:#fff;color:#111;}' +
      '#lens-gate input:focus{border-color:#1e4f8a;box-shadow:0 0 0 3px rgba(30,79,138,.15);}' +
      '#lens-gate button{width:100%;margin-top:20px;padding:12px;font-size:15px;font-weight:600;' +
      'color:#fff;background:#1e4f8a;border:0;border-radius:9px;cursor:pointer;}' +
      '#lens-gate button:disabled{opacity:.6;cursor:default;}' +
      '#lens-gate .err{min-height:18px;margin-top:12px;font-size:13px;color:#c0392b;}' +
      '#lens-gate .spin{width:28px;height:28px;border:3px solid rgba(255,255,255,.25);' +
      'border-top-color:#fff;border-radius:50%;animation:lensspin .8s linear infinite;}' +
      '@keyframes lensspin{to{transform:rotate(360deg);}}' +
      '#lens-userchip{display:inline-flex;align-items:center;gap:7px;font-size:13px;opacity:.95;}' +
      '#lens-userchip a{color:inherit;text-decoration:underline;cursor:pointer;opacity:.85;}' +
      '.lens-dot{width:6px;height:6px;border-radius:50%;background:#49c17a;display:inline-block;flex:none}' +
      '.lens-ovl{position:fixed;inset:0;z-index:2147483646;background:rgba(10,20,35,.5);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}' +
      '.lens-ovl[hidden]{display:none}' +
      '.lens-modal{width:100%;max-width:460px;background:#fff;color:#16202e;border-radius:14px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.4);max-height:90vh;overflow:auto;box-sizing:border-box}' +
      '.lens-modal h3{margin:0 0 12px;font-size:18px;color:#0b1f3a}' +
      '.lens-ulist{border:1px solid #e3e8ef;border-radius:10px;padding:4px 10px;margin-bottom:14px;max-height:240px;overflow:auto}' +
      '.lens-urow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eef1f5;font-size:14px}' +
      '.lens-urow:last-child{border-bottom:0}' +
      '.lens-dim{color:#7a8699;font-size:12px}' +
      '.lens-urow a{color:#1e4f8a;cursor:pointer;text-decoration:underline;font-size:12.5px}' +
      '.lens-urow a.lens-del{color:#c0392b}' +
      '.lens-add>b{display:block;font-size:13px;margin-bottom:8px;color:#16202e}' +
      '.lens-add input,.lens-add select{width:100%;box-sizing:border-box;padding:9px 10px;font-size:14px;border:1px solid #cdd4de;border-radius:8px;margin-bottom:8px;background:#fff;color:#111}' +
      '.lens-row{display:flex;gap:8px}.lens-row>*{flex:1}' +
      '.lens-mbtns{display:flex;gap:8px;align-items:center;margin-top:4px}' +
      '.lens-primary{padding:9px 14px;border:0;border-radius:8px;background:#1e4f8a;color:#fff;font-weight:600;cursor:pointer}' +
      '.lens-btn{padding:9px 12px;border:1px solid #cdd4de;border-radius:8px;background:#fff;color:#16202e;cursor:pointer}' +
      '.lens-msg{font-size:12.5px;color:#4a7}';
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- overlay element ---------- */
  var gate;
  function makeGate(inner) {
    if (!gate) {
      gate = document.createElement("div");
      gate.id = "lens-gate";
      document.documentElement.appendChild(gate);
      try { document.documentElement.style.overflow = "hidden"; } catch (e) {}
    }
    gate.innerHTML = inner;
  }
  function removeGate() {
    if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
    gate = null;
    try { document.documentElement.style.overflow = ""; } catch (e) {}
  }

  function showSpinner() {
    makeGate('<div class="spin"></div>');
  }

  function showLogin(msg) {
    makeGate(
      '<div class="card">' +
        '<h1>LENS Lab</h1>' +
        '<p class="sub">Sign in to continue · 登录以继续</p>' +
        '<label for="lgx_user">Username 用户名</label>' +
        '<input id="lgx_user" autocomplete="username" autocapitalize="off" spellcheck="false">' +
        '<label for="lgx_pw">Password 密码</label>' +
        '<input id="lgx_pw" type="password" autocomplete="current-password">' +
        '<button id="lgx_go">Sign in 登录</button>' +
        '<div class="err" id="lgx_err">' + (msg || "") + '</div>' +
      '</div>'
    );
    var u = document.getElementById("lgx_user"),
        p = document.getElementById("lgx_pw"),
        b = document.getElementById("lgx_go");
    u.addEventListener("keydown", function (e) { if (e.key === "Enter") p.focus(); });
    p.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    b.addEventListener("click", doLogin);
    try { u.focus(); } catch (e) {}
  }

  function doLogin() {
    var u = (document.getElementById("lgx_user").value || "").trim();
    var pw = document.getElementById("lgx_pw").value || "";
    var err = document.getElementById("lgx_err");
    var btn = document.getElementById("lgx_go");
    if (!u || !pw) { err.textContent = "Enter your username and password."; return; }
    err.textContent = "Signing in…"; btn.disabled = true;
    fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: pw })
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { err.textContent = (res.j && res.j.error) || "Sign-in failed."; return; }
      setTok(res.j.token);
      setUser({ username: res.j.username, name: res.j.name, role: res.j.role });
      reveal();
    }).catch(function () {
      btn.disabled = false;
      pickApiBase(function () {});
      err.textContent = "Network hiccup — tap Sign in again.";
    });
  }

  /* verify a stored token cheaply; cb(true/false/"offline") */
  function verify(cb) {
    fetch(API_BASE + "/api/version", { method: "GET", headers: { "X-LENS-Token": tok() } })
      .then(function (r) { cb(r.status === 401 ? false : true); })
      .catch(function () { cb("offline"); });
  }

  function changePw() {
    var u = getUser();
    var pw = window.prompt("Set a new password for your account (" + ((u && u.name) || "") + "):", "");
    if (pw == null) return;
    pw = pw.trim();
    if (pw.length < 4) { alert("Password must be at least 4 characters."); return; }
    fetch(API_BASE + "/api/mypassword", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-LENS-Token": tok() },
      body: JSON.stringify({ password: pw })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { alert(res.ok && res.j && res.j.ok ? "Password changed — use it next time you sign in." : ((res.j && res.j.error) || "Could not change the password.")); })
      .catch(function () { alert("Could not reach the server."); });
  }

  function fillChip() {
    var c = document.getElementById("lens-userchip");
    if (!c) return;
    var u = getUser();
    var admin = !!(u && u.role === "admin");
    c.innerHTML = u
      ? '<i class="lens-dot"></i>' + (u.name || u.username) +
        (admin ? ' · <a id="lens-acct-link">accounts</a>' : '') +
        ' · <a id="lens-pw">password</a> · <a id="lens-signout">sign out</a>'
      : "";
    var al = document.getElementById("lens-acct-link");
    if (al) al.addEventListener("click", openAccounts);
    var pwl = document.getElementById("lens-pw");
    if (pwl) pwl.addEventListener("click", changePw);
    var so = document.getElementById("lens-signout");
    if (so) so.addEventListener("click", function () { LENS.logout(); });
  }

  /* ---------- admin: member accounts (shown on any gated page for admins) ---------- */
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(x){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[x];});}
  function acctFetch(path, opts){ opts = opts || {}; opts.headers = { "Content-Type": "application/json", "X-LENS-Token": tok() }; return fetch(API_BASE + path, opts); }
  function openAccounts(){
    var ov = document.getElementById("lens-acct");
    if (!ov){ ov = document.createElement("div"); ov.id = "lens-acct"; ov.className = "lens-ovl"; document.documentElement.appendChild(ov); ov.addEventListener("click", function(e){ if (e.target === ov) ov.hidden = true; }); }
    ov.hidden = false;
    ov.innerHTML =
      '<div class="lens-modal"><h3>Accounts 账号管理</h3>' +
      '<div id="lens-ulist" class="lens-ulist">Loading…</div>' +
      '<div class="lens-add"><b>Add or update a member</b>' +
        '<input id="la_user" placeholder="username (for login)" autocapitalize="off" autocorrect="off" spellcheck="false">' +
        '<input id="la_name" placeholder="display name 姓名">' +
        '<div class="lens-row"><select id="la_role"><option value="user">member</option><option value="admin">admin</option></select>' +
        '<input id="la_pw" placeholder="password (required for new)" type="text"></div>' +
        '<div class="lens-mbtns"><button class="lens-primary" id="la_add">Add / update</button><button class="lens-btn" id="la_close">Close</button><span id="la_msg" class="lens-msg"></span></div>' +
      '</div></div>';
    document.getElementById("la_close").addEventListener("click", function(){ ov.hidden = true; });
    document.getElementById("la_add").addEventListener("click", addUser);
    renderUsers();
  }
  function msgA(t, bad){ var m = document.getElementById("la_msg"); if (m){ m.textContent = t || ""; m.style.color = bad ? "#c0392b" : "#4a7"; } }
  function renderUsers(){
    acctFetch("/api/users", { method: "GET" }).then(function(r){ return r.ok ? r.json() : { users: [] }; }).then(function(j){
      var box = document.getElementById("lens-ulist"); if (!box) return;
      var us = j.users || [];
      box.innerHTML = us.length ? us.map(function(u){
        return '<div class="lens-urow"><div><b>' + esc(u.name) + '</b> <span class="lens-dim">' + esc(u.username) + (u.role === "admin" ? " · admin" : "") + '</span></div>' +
          '<div><a class="lens-rp" data-u="' + esc(u.username) + '" data-n="' + esc(u.name) + '" data-r="' + esc(u.role || "user") + '">reset pw</a> · <a class="lens-del" data-u="' + esc(u.username) + '">delete</a></div></div>';
      }).join("") : '<div class="lens-dim" style="padding:8px 0">No accounts yet.</div>';
      [].forEach.call(box.querySelectorAll(".lens-del"), function(a){ a.addEventListener("click", function(){ delUserA(a.getAttribute("data-u")); }); });
      [].forEach.call(box.querySelectorAll(".lens-rp"), function(a){ a.addEventListener("click", function(){ resetPwA(a.getAttribute("data-u"), a.getAttribute("data-n"), a.getAttribute("data-r")); }); });
    }).catch(function(){ var box = document.getElementById("lens-ulist"); if (box) box.innerHTML = '<div class="lens-dim">Could not load accounts.</div>'; });
  }
  function addUser(){
    var u = (document.getElementById("la_user").value || "").trim();
    var n = (document.getElementById("la_name").value || "").trim();
    var r = document.getElementById("la_role").value;
    var pw = (document.getElementById("la_pw").value || "").trim();
    if (!u || !n){ msgA("Username and name are required.", true); return; }
    var body = { username: u, name: n, role: r }; if (pw) body.password = pw;
    acctFetch("/api/users", { method: "POST", body: JSON.stringify(body) }).then(function(x){ return x.json().then(function(j){ return { ok: x.ok, j: j }; }); }).then(function(res){
      if (!res.ok){ msgA((res.j && res.j.error) || "Could not save.", true); return; }
      msgA("Saved."); document.getElementById("la_user").value = ""; document.getElementById("la_name").value = ""; document.getElementById("la_pw").value = ""; renderUsers();
    }).catch(function(){ msgA("Network error.", true); });
  }
  function delUserA(un){ if (!window.confirm('Delete account "' + un + '"? Their past entries keep their recorded name.')) return; acctFetch("/api/users?username=" + encodeURIComponent(un), { method: "DELETE" }).then(function(){ renderUsers(); }); }
  function resetPwA(un, n, r){ var pw = window.prompt("New password for " + n + ":", ""); if (pw == null) return; pw = pw.trim(); if (pw.length < 4){ alert("Password must be at least 4 characters."); return; } acctFetch("/api/users", { method: "POST", body: JSON.stringify({ username: un, name: n, role: r, password: pw }) }).then(function(x){ return x.json().then(function(j){ return { ok: x.ok, j: j }; }); }).then(function(res){ alert(res.ok ? "Password updated." : ((res.j && res.j.error) || "Could not update.")); }); }

  function reveal() {
    removeGate();
    try { document.dispatchEvent(new Event("lensauth")); } catch (e) {}
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fillChip);
    } else {
      fillChip();
    }
  }

  function gateNow() {
    injectCSS();
    showSpinner();
    pickApiBase(function () {           // find a reachable address first (handles China / travel)
      if (!tok()) { showLogin(); return; }
      verify(function (status) {
        if (status === true || status === "offline") {
          reveal();                     // trust local token; don't lock out if server unreachable
        } else {
          setTok(""); setUser(null);
          showLogin("Session expired — please sign in again.");
        }
      });
    });
  }

  /* ---------- public API ---------- */
  window.LENS = {
    user: getUser,
    name: function () { var u = getUser(); return u && u.name ? u.name : ""; },
    isAdmin: function () { var u = getUser(); return !!(u && u.role === "admin"); },
    token: tok,
    logout: function () { setTok(""); setUser(null); location.reload(); },
    accounts: function () { var u = getUser(); if (u && u.role === "admin") openAccounts(); },
    require: gateNow
  };

  /* auto-gate unless the page opts out with  window.LENS_PUBLIC = true  */
  if (!window.LENS_PUBLIC) gateNow();
})();
