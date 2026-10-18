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
  var API_BASE = "https://lens-inventory-api.lens-laboratory.workers.dev";
  var LS = window.localStorage;

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
      '#lens-userchip{font-size:13px;opacity:.9;}' +
      '#lens-userchip a{color:inherit;text-decoration:underline;cursor:pointer;opacity:.85;}';
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
      err.textContent = "Can't reach the server — check your connection.";
    });
  }

  /* verify a stored token cheaply; cb(true/false/"offline") */
  function verify(cb) {
    fetch(API_BASE + "/api/version", { method: "GET", headers: { "X-LENS-Token": tok() } })
      .then(function (r) { cb(r.status === 401 ? false : true); })
      .catch(function () { cb("offline"); });
  }

  function fillChip() {
    var c = document.getElementById("lens-userchip");
    if (!c) return;
    var u = getUser();
    c.innerHTML = u
      ? "Signed in as " + (u.name || u.username) +
        ' · <a id="lens-signout">Sign out</a>'
      : "";
    var so = document.getElementById("lens-signout");
    if (so) so.addEventListener("click", function () { LENS.logout(); });
  }

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
    if (!tok()) { showLogin(); return; }
    verify(function (status) {
      if (status === true || status === "offline") {
        reveal();                       // trust local token; don't lock out if server unreachable
      } else {
        setTok(""); setUser(null);
        showLogin("Session expired — please sign in again.");
      }
    });
  }

  /* ---------- public API ---------- */
  window.LENS = {
    user: getUser,
    name: function () { var u = getUser(); return u && u.name ? u.name : ""; },
    isAdmin: function () { var u = getUser(); return !!(u && u.role === "admin"); },
    token: tok,
    logout: function () { setTok(""); setUser(null); location.reload(); },
    require: gateNow
  };

  /* auto-gate unless the page opts out with  window.LENS_PUBLIC = true  */
  if (!window.LENS_PUBLIC) gateNow();
})();
