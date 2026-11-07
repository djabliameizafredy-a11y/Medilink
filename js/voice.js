// Dictée vocale (parole vers texte) dans le chat MediBot, via l'API Web Speech du navigateur.
// Le texte reconnu est placé dans le champ : l'utilisateur le relit avant de l'envoyer.
(function () {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var feed = document.getElementById("medibot-chat-feed");
  var form = feed && feed.parentNode.querySelector("form");
  var input = form && form.querySelector("input");
  if (!SR || !input) return; // navigateur sans dictée : le chat écrit reste disponible
  var group = input.parentNode, send = group.querySelector("button[type=submit]");
  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "btn btn-outline-dark"; btn.title = "Dicter un message";
  btn.setAttribute("aria-label", "Dicter un message"); btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg>';
  var note = document.createElement("p");
  note.className = "meta mb-0 mt-1"; note.setAttribute("role", "status");
  group.insertBefore(btn, send); group.parentNode.insertBefore(note, group.nextSibling);
  var ERR = { "not-allowed": "Micro refusé : autorisez-le dans votre navigateur.", "service-not-allowed": "Micro refusé : autorisez-le dans votre navigateur.", "no-speech": "Aucune voix détectée. Réessayez.", "audio-capture": "Aucun micro détecté.", "network": "Le service de dictée est indisponible.", "aborted": "" };
  var rec = null, base = "", failed = false;
  function mark(on) {
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Arrêter la dictée" : "Dicter un message");
    btn.classList.toggle("btn-danger", on); btn.classList.toggle("btn-outline-dark", !on);
  }
  btn.onclick = function () {
    if (rec) { rec.stop(); return; }
    failed = false; base = input.value.trim() ? input.value.trim() + " " : "";
    rec = new SR(); rec.lang = "fr-FR"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onstart = function () { mark(true); note.textContent = "Je vous écoute… L’audio est traité par le service de reconnaissance de votre navigateur."; };
    rec.onresult = function (e) {
      var t = "";
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      input.value = (base + t).slice(0, 500);
    };
    rec.onerror = function (e) { failed = true; note.textContent = ERR[e.error] !== undefined ? ERR[e.error] : "La dictée a échoué."; };
    rec.onend = function () {
      mark(false); rec = null;
      if (!failed) note.textContent = input.value.trim() ? "Relisez le texte, puis appuyez sur Envoyer." : "";
      input.focus();
    };
    try { rec.start(); } catch (err) { rec = null; mark(false); note.textContent = "La dictée n’a pas pu démarrer."; }
  };
})();
