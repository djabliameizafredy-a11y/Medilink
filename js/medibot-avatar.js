// Avatar de MediBot : bille verte (aux couleurs de Medilink) dans le coin du chat, qui change d'expression :
// repos (clignements), réflexion, écoute pendant la dictée, inquiétude en cas de situation critique.
(function () {
  var feed = document.getElementById("medibot-chat-feed");
  var card = feed && (feed.closest(".panel") || feed.parentNode);
  if (!card) return;
  card.style.position = "relative";
  var orb = document.createElement("div");
  orb.className = "medibot-orb"; orb.setAttribute("role", "img"); orb.setAttribute("aria-label", "MediBot"); orb.setAttribute("data-state", "idle");
  orb.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="mbg" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#e3f6b8"></stop><stop offset="0.55" stop-color="#8bc34a"></stop><stop offset="1" stop-color="#4c7f12"></stop></radialGradient></defs><ellipse cx="32" cy="60" rx="16" ry="3" fill="#bfe27a" opacity="0.5"></ellipse><circle cx="32" cy="32" r="26" fill="url(#mbg)"></circle><ellipse cx="22" cy="16" rx="9" ry="5" fill="#fff" opacity="0.35" transform="rotate(-25 22 16)"></ellipse><g class="eyes"><rect class="eye" x="21" y="25" width="6" height="13" rx="3" fill="#fff"></rect><rect class="eye" x="37" y="25" width="6" height="13" rx="3" fill="#fff"></rect></g><g class="brows" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M16 23 L27 19"></path><path d="M48 23 L37 19"></path></g></svg>';
  card.appendChild(orb);
  var timer = null;
  function set(s, ms) {
    clearTimeout(timer); orb.setAttribute("data-state", s);
    if (ms) timer = setTimeout(function () { orb.setAttribute("data-state", "idle"); }, ms);
  }
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        var t = n.textContent || "", bot = /bot/.test(n.className || "");
        if (/^MediBot rédige/.test(t)) set("thinking");
        else if (bot && /Situation critique/i.test(t)) set("alert", 8000);
        else if (bot) set("idle");
      });
      m.removedNodes.forEach(function (n) { if (/^MediBot rédige/.test(n.textContent || "")) set("idle"); });
    });
  }).observe(feed, { childList: true });
  document.addEventListener("medibot-state", function (e) { set(e.detail); });
})();
