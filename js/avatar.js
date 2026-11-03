// Avatar par défaut : couleur et forme déduites du nom, générées ici (aucun service externe, aucun nom envoyé).
window.Avatar = {
  html(name, size) {
    const n = String(name || "?").trim() || "?";
    let h = 0;
    for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const hue = h % 360, r = 28 + (h >> 3) % 22;
    const ini = n.split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("").replace(/[&<>"']/g, "");
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" role="img" aria-label="Avatar"><rect width="100" height="100" rx="' + r + '" fill="hsl(' + hue + ',45%,82%)"/><text x="50" y="63" text-anchor="middle" font-size="40" font-family="Newsreader,Georgia,serif" fill="hsl(' + hue + ',45%,22%)">' + ini + "</text></svg>";
  }
};
