(function () {
  var C = window.MEDILINK_CONFIG || {};
  var CATS = { nutrition: "Nutrition", sante_mentale: "Santé mentale", sommeil: "Sommeil", prevention: "Prévention", maladies_infectieuses: "Maladies infectieuses", paludisme: "Paludisme", typhoide: "Typhoïde", diabete: "Diabète", hypertension: "Hypertension", medicaments: "Médicaments", sante_maternelle_infantile: "Santé maternelle et infantile" };
  var SRC = { medlineplus: "MedlinePlus, National Library of Medicine", europe_pmc: "Europe PMC" };
  var PAGE = 12, UUID = /^[0-9a-f-]{36}$/i;
  var st = { type: "advice", cat: "", page: 0, fav: false };
  var $ = function (i) { return document.getElementById(i); };
  var ls = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var interests = ls("medilink_health_interests", []), favs = ls("medilink_saved_articles", []);
  function el(t, a) {
    var e = document.createElement(t);
    for (var k in a || {}) { if (k === "class") e.className = a[k]; else if (k === "text") e.textContent = a[k]; else if (k.slice(0, 2) === "on") e[k] = a[k]; else e.setAttribute(k, a[k]); }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.append(arguments[i]);
    return e;
  }
  var safe = function (u) { return /^https:\/\//i.test(u || "") ? u : "#"; };

  function toggleFav(a, btn) {
    var i = favs.findIndex(function (f) { return f.id === a.id; });
    if (i >= 0) favs.splice(i, 1);
    else favs.unshift({ id: a.id, title: a.title, summary: a.summary, url: a.url, source: a.source, institution: a.institution, journal: a.journal, language: a.language, category: a.category, content_type: a.content_type, published_at: a.published_at });
    favs = favs.slice(0, 100); put("medilink_saved_articles", favs);
    btn.textContent = i >= 0 ? "Enregistrer" : "Enregistré";
    if (st.fav) load(true);
  }
  async function translate(a, title, sum, badge, btn) {
    if (btn.getAttribute("data-done")) { title.textContent = a.title; sum.textContent = a.summary || ""; badge.hidden = true; btn.textContent = "Traduire"; btn.removeAttribute("data-done"); return; }
    btn.disabled = true; btn.textContent = "Traduction…";
    try {
      var r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) });
      var j = await r.json(); if (!r.ok || !j.title) throw new Error("x");
      title.textContent = j.title; sum.textContent = j.summary || ""; badge.hidden = false; btn.setAttribute("data-done", "1"); btn.textContent = "Voir l’original";
    } catch (e) { btn.textContent = "Traduction indisponible"; }
    btn.disabled = false;
  }
  function card(a) {
    var title = el("h3", { text: a.title }), sum = el("p", { class: "meta mb-2", text: a.summary || "" });
    var badge = el("span", { class: "badge text-bg-light border mb-2", text: "Traduction automatique", hidden: "" });
    var isFav = favs.some(function (f) { return f.id === a.id; });
    var meta = [a.published_at ? new Date(a.published_at).toLocaleDateString("fr-FR") : "", a.source === "institution" ? a.institution : SRC[a.source], a.journal].filter(Boolean).join(", ");
    var btns = el("div", { class: "d-flex flex-wrap gap-2 mt-auto pt-2" },
      el("a", { class: "btn btn-primary btn-sm", href: safe(a.url), target: "_blank", rel: "noopener noreferrer", text: "Lire l’article" }),
      el("button", { class: "btn btn-outline-dark btn-sm", type: "button", text: isFav ? "Enregistré" : "Enregistrer", onclick: function () { toggleFav(a, this); } }));
    if (a.language !== "fr" && UUID.test(String(a.id))) btns.append(el("button", { class: "btn btn-outline-dark btn-sm", type: "button", text: "Traduire", onclick: function () { translate(a, title, sum, badge, this); } }));
    return el("div", { class: "col-md-6 col-lg-4" }, el("article", { class: "article-card d-flex flex-column" },
      el("div", { class: "kicker mb-1", text: CATS[a.category] || "Santé" }), title,
      a.language !== "fr" ? el("p", { class: "meta mb-1", text: "Texte en anglais" }) : null, badge, sum,
      el("p", { class: "meta mb-1", text: meta }),
      a.source === "medlineplus" ? el("p", { class: "meta mb-1", text: "Source : MedlinePlus, National Library of Medicine." }) : null,
      a.content_type === "research" ? el("p", { class: "meta mb-1", text: "Étude scientifique : ne constitue pas un conseil médical personnalisé." }) : null,
      btns));
  }
  function render(rows) {
    rows.sort(function (x, y) { return (interests.indexOf(y.category) >= 0) - (interests.indexOf(x.category) >= 0); });
    rows.forEach(function (a) { $("feed").append(card(a)); });
  }
  async function load(reset) {
    if (reset) { st.page = 0; $("feed").replaceChildren(); }
    $("status").textContent = ""; $("more").hidden = true;
    if (st.fav) {
      var f = favs.filter(function (x) { return x.content_type === st.type && (!st.cat || x.category === st.cat); });
      render(f); if (!f.length) $("status").textContent = "Aucun article enregistré dans cet onglet."; return;
    }
    if (!C.supabaseUrl || !C.supabaseAnonKey) { $("status").textContent = "Le fil d’actualités n’est pas encore activé."; return; }
    var u = C.supabaseUrl + "/rest/v1/articles?select=*&content_type=eq." + st.type + "&order=published_at.desc.nullslast,created_at.desc&limit=" + PAGE + "&offset=" + st.page * PAGE;
    if (st.cat) u += "&category=eq." + encodeURIComponent(st.cat);
    var q = $("q").value.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
    if (q) u += "&or=(title.ilike.*" + encodeURIComponent(q) + "*,summary.ilike.*" + encodeURIComponent(q) + "*)";
    try {
      var r = await fetch(u, { headers: { apikey: C.supabaseAnonKey, Authorization: "Bearer " + C.supabaseAnonKey } });
      if (!r.ok) throw new Error("x");
      var rows = await r.json(); render(rows); $("more").hidden = rows.length < PAGE;
      if (!$("feed").children.length) $("status").textContent = "Aucun article pour le moment.";
    } catch (e) { $("status").textContent = "Impossible de charger les articles pour le moment."; }
  }
  async function live() {
    var q = $("q").value.trim();
    if (q.length < 2) { $("status").textContent = "Saisissez au moins 2 caractères."; return; }
    $("feed").replaceChildren(); $("more").hidden = true; $("status").textContent = "Recherche dans Europe PMC…";
    try {
      var r = await fetch("/api/discover-search?q=" + encodeURIComponent(q));
      var j = await r.json(); if (!r.ok) throw new Error("x");
      render(j.results || []);
      $("status").textContent = j.results.length ? "Résultats directs d’Europe PMC (articles relus par des pairs)." : "Aucun résultat.";
    } catch (e) { $("status").textContent = "Europe PMC est indisponible pour le moment."; }
  }
  function chips() {
    $("cats").replaceChildren();
    [["", "Tous"]].concat(Object.keys(CATS).map(function (k) { return [k, CATS[k]]; })).forEach(function (c) {
      $("cats").append(el("button", { class: "btn btn-sm btn-outline-dark" + (st.cat === c[0] ? " active" : ""), type: "button", "aria-pressed": String(st.cat === c[0]), text: c[1], onclick: function () { st.cat = c[0]; chips(); load(true); } }));
    });
  }
  Object.keys(CATS).forEach(function (k) {
    var id = "int-" + k, cb = el("input", { type: "checkbox", id: id, class: "form-check-input" });
    cb.checked = interests.indexOf(k) >= 0;
    cb.onchange = function () { interests = interests.filter(function (x) { return x !== k; }); if (cb.checked) interests.push(k); put("medilink_health_interests", interests); load(true); };
    $("interests").append(el("div", { class: "form-check form-check-inline" }, cb, el("label", { class: "form-check-label", for: id, text: CATS[k] })));
  });
  [["advice", "t-advice"], ["news", "t-news"], ["research", "t-research"]].forEach(function (t) {
    $(t[1]).onclick = function () {
      st.type = t[0];
      ["t-advice", "t-news", "t-research"].forEach(function (i) { $(i).classList.toggle("active", i === t[1]); $(i).setAttribute("aria-selected", String(i === t[1])); });
      $("live").hidden = t[0] !== "research"; load(true);
    };
  });
  $("sform").onsubmit = function (e) { e.preventDefault(); st.fav = false; $("favbtn").classList.remove("active"); load(true); };
  $("live").onclick = live;
  $("more").onclick = function () { st.page++; load(false); };
  $("favbtn").onclick = function () { st.fav = !st.fav; this.classList.toggle("active", st.fav); load(true); };
  chips(); load(true);
})();
