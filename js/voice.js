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
    rec.onstart = function () { document.dispatchEvent(new CustomEvent("medibot-state", { detail: "listening" })); mark(true); note.textContent = "Je vous écoute… L’audio est traité par le service de reconnaissance de votre navigateur."; };
    rec.onresult = function (e) {
      var t = "";
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      input.value = (base + t).slice(0, 500);
    };
    rec.onerror = function (e) { failed = true; note.textContent = ERR[e.error] !== undefined ? ERR[e.error] : "La dictée a échoué."; };
    rec.onend = function () {
      document.dispatchEvent(new CustomEvent("medibot-state", { detail: "idle" }));
      mark(false); rec = null;
      if (!failed) note.textContent = input.value.trim() ? "Relisez le texte, puis appuyez sur Envoyer." : "";
      input.focus();
    };
    try { rec.start(); } catch (err) { rec = null; mark(false); note.textContent = "La dictée n’a pas pu démarrer."; }
  };

  // ---- Mode conversation vocale (étape 1) : MediBot lit ses réponses à voix haute,
  // puis relance automatiquement l'écoute. Désactivable par le bouton « Haut-parleur » ;
  // coupé d'office si l'utilisateur écrit dans le chat.
  var TTS = "speechSynthesis" in window;
  var voiceOn = false;
  try { voiceOn = localStorage.getItem("medilink_voice") === "1"; } catch (e) {}
  var vbtn = document.createElement("button");
  vbtn.type = "button"; vbtn.className = "btn " + (voiceOn ? "btn-dark" : "btn-outline-dark");
  vbtn.title = "Lire les réponses de MediBot à voix haute et enchaîner la dictée";
  vbtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"></path><path class="wv" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"></path></svg>';
  function vmark() {
    vbtn.className = "btn " + (voiceOn ? "btn-dark" : "btn-outline-dark");
    vbtn.setAttribute("aria-pressed", String(voiceOn));
    vbtn.setAttribute("aria-label", voiceOn ? "Couper la lecture vocale" : "Activer la lecture vocale");
    var wv = vbtn.querySelector(".wv"); if (wv) wv.style.opacity = voiceOn ? "1" : "0.25";
  }
  group.insertBefore(vbtn, btn); vmark();
  vbtn.onclick = function () {
    voiceOn = !voiceOn;
    try { localStorage.setItem("medilink_voice", voiceOn ? "1" : "0"); } catch (e) {}
    if (!voiceOn && TTS) window.speechSynthesis.cancel();
    vmark();
    if (voiceOn && TTS && !window.speechSynthesis.getVoices().some(function (v) { return /^fr/i.test(v.lang); })) {
      note.textContent = "Lecture vocale activée. Si aucune voix française n’est installée, le son peut être étranger.";
    }
  };
  function frVoice() {
    var vs = window.speechSynthesis.getVoices() || [];
    return vs.filter(function (v) { return /^fr[-_]FR/i.test(v.lang); })[0] || vs.filter(function (v) { return /^fr/i.test(v.lang); })[0] || null;
  }
  function speakThenListen(text) {
    if (!voiceOn || !TTS) return;
    var u = new SpeechSynthesisUtterance(String(text || "").slice(0, 600));
    u.lang = "fr-FR"; var v = frVoice(); if (v) u.voice = v;
    u.onstart = function () { document.dispatchEvent(new CustomEvent("medibot-state", { detail: "speaking" })); };
    u.onend = function () {
      document.dispatchEvent(new CustomEvent("medibot-state", { detail: "idle" }));
      if (voiceOn && !rec) btn.onclick(); // relance automatique de l'écoute
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  document.addEventListener("medibot-message", function (e) {
    var d = e.detail || {};
    if (!d.text || /r[ée]dige une r[ée]ponse/.test(d.text)) return;
    if (d.who === "user") { if (TTS) window.speechSynthesis.cancel(); return; } // l'utilisateur tape : on coupe la voix
    var t = d.text.replace(/^(Quel est le niveau|Pour quelle situation|Où êtes-vous|Où devez-vous)[\s\S]*$/, function (m) { return m.split("?")[0] + "?"; });
    speakThenListen(t);
  });
})();
