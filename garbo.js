/* Garbo — garbo.js  ·  her life in pictures
   ---------------------------------------------------------------------------
   garbo_life.py writes window.GARBO_LIFE from the research archive, already in
   date order. This lays it out as one small grid, year by year under the eras
   of her life, with the film stills (other than Queen Christina and Wild
   Orchids, which sit in the life) gathered at the end by film.

   The timeline in the sticky bar is a bar per year, as tall as that year is
   full; click or drag along it to travel. Pictures can be hidden (and brought
   back from "Hidden"), and dragged anywhere: a picture dropped beside another
   takes that one's place in her life — its year, or its film. All of it is
   kept in garbo-save.json by serve.py; pictures that arrive later slot in
   where their date puts them, around whatever has been moved.
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  var ALL = window.GARBO_LIFE || [];
  var BY = {};
  ALL.forEach(function (it) { BY[it.id] = it; });
  var KEY = "garbo-life", PREFS = "garbo-life-prefs";
  var VIEW = !!window.GARBO_VIEW;   // the public copy: look, don't touch
  var DISK = !VIEW && /^https?:$/.test(location.protocol);

  var st = { hidden: [], moves: [], place: {} };
  var prefs = { size: "s", kind: "all", fit: false };
  try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS)) || {}); } catch (e) {}
  if (["all", "image", "video"].indexOf(prefs.kind) < 0) prefs.kind = "all";
  prefs.fit = true;   // the page always opens on whole pictures, uncropped
  var showHidden = false;
  var life = document.getElementById("life");
  var shown = [];     // ids on the page, in order, for the viewer

  /* ---------------- state ---------------- */

  function load() {
    if (VIEW) {
      // the arrangement as published beside the page
      try {
        var v = new XMLHttpRequest();
        v.open("GET", "garbo-save.json?t=" + Date.now(), false);
        v.send();
        if (v.status === 200) st = JSON.parse(v.responseText);
      } catch (e) {}
      return;
    }
    if (DISK) {
      try {
        var x = new XMLHttpRequest();
        x.open("GET", "api/garbo", false);
        x.send();
        if (x.status === 200) { st = JSON.parse(x.responseText); return; }
      } catch (e) {}
    }
    try { st = JSON.parse(localStorage.getItem(KEY)) || st; } catch (e) {}
  }
  function save() {
    if (VIEW) return;
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    if (DISK) fetch("api/garbo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(st) }).catch(function () {});
  }
  function savePrefs() { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (e) {} }
  // in the Archive: hidden by hand, or archived by the build (her things)
  // unless brought back
  function isHidden(id) {
    return st.hidden.indexOf(id) >= 0 || (BY[id] && BY[id].archived && st.restored.indexOf(id) < 0);
  }

  /* Her life in the order it's shown: the built order, with every move made on
     the page replayed over it. A move is kept as "this picture, just before /
     after that one", plus the year or film it was dropped into, so it holds
     wherever the rest of the page shifts when pictures arrive or regroup. */
  function arranged() {
    var out = ALL.map(function (it) {
      var p = st.place[it.id];
      return p ? Object.assign({}, it, p) : it;
    });
    var ids = out.map(function (it) { return it.id; }), byId = {};
    out.forEach(function (it) { byId[it.id] = it; });
    (st.moves || []).forEach(function (m) {
      var from = ids.indexOf(m.id);
      if (from < 0 || ids.indexOf(m.ref) < 0) return;
      ids.splice(from, 1);
      ids.splice(ids.indexOf(m.ref) + (m.side === "after" ? 1 : 0), 0, m.id);
    });
    return ids.map(function (id) { return byId[id]; });
  }

  /* ---------------- which pictures ---------------- */

  function wanted(it) {
    if (showHidden) return isHidden(it.id);
    if (isHidden(it.id)) return false;
    if (prefs.kind === "image") return it.type === "image";
    if (prefs.kind === "video") return it.type === "video";
    return true;
  }
  // the full picture: the archive original on the working page, the web-sized
  // copy (life/v/) on the public one
  function media(rel, it) {
    if (VIEW && it) return it.view || it.thumb;
    return "/media/" + rel.split("/").map(encodeURIComponent).join("/");
  }
  function when(it) {
    if (it.year == null) return "Undated";
    return (it.approx ? "c. " : "") + it.year;
  }

  /* ---------------- the page ---------------- */

  var playing = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        v.play().catch(function () {});
      } else v.pause();
    });
  }, { rootMargin: "200px" });

  function tile(it) {
    var t = document.createElement("div");
    t.className = "tile" + (isHidden(it.id) ? " gone" : "");
    t.dataset.id = it.id;
    t.draggable = !showHidden && !VIEW;
    var m;
    if (it.type === "video") {
      m = document.createElement("video");
      m.muted = true; m.loop = true; m.playsInline = true; m.preload = "none";
      m.setAttribute("muted", ""); m.setAttribute("playsinline", "");
      m.dataset.src = it.thumb;
      m.addEventListener("loadeddata", function () { m.classList.add("in"); }, { once: true });
      playing.observe(m);
    } else {
      m = document.createElement("img");
      m.loading = "lazy"; m.decoding = "async"; m.alt = "";
      m.addEventListener("load", function () { m.classList.add("in"); }, { once: true });
      m.src = it.thumb;
    }
    t.appendChild(m);
    if (it.type === "video") { var d = document.createElement("span"); d.className = "mv"; t.appendChild(d); }
    var h = document.createElement("button");
    h.className = "hide";
    h.textContent = showHidden ? "Bring back" : "Archive";
    t.appendChild(h);
    t.title = when(it) + " · " + it.title;
    return t;
  }

  function render() {
    var y0 = scrollY;
    life.innerHTML = "";
    shown = [];
    document.body.classList.toggle("fit", !!prefs.fit);
    document.documentElement.style.setProperty("--cell", { s: "96px", m: "150px", l: "240px" }[prefs.size]);
    var list = arranged().filter(wanted);
    var era = null, group = null, gkey = null, cells = null, frag = document.createDocumentFragment();
    list.forEach(function (it) {
      if (it.era !== era) {
        era = it.era;
        var h = document.createElement("div");
        h.className = "era-h";
        h.innerHTML = "<h2></h2><span class='label'></span>";
        h.firstChild.textContent = era;
        h.lastChild.textContent = list.filter(function (x) { return x.era === era; }).length;
        frag.appendChild(h);
        gkey = null;
      }
      var k = it.life ? (it.era === "Her things" ? "things" : String(it.year)) : it.film;
      if (k !== gkey) {
        gkey = k;
        group = document.createElement("section");
        group.className = it.life ? "year" : "year film";
        group.id = it.life ? (it.era === "Her things" ? "things" : "y" + it.year) : "film-" + it.film.replace(/\W+/g, "-");
        var y = document.createElement("div");
        y.className = it.life ? "y" : "y film-h";
        y.textContent = it.life ? (it.era === "Her things" ? "Objects" : it.year == null ? "Undated" : it.year) : it.film;
        var n = document.createElement("small");
        n.textContent = list.filter(function (x) { return (x.life ? (x.era === "Her things" ? "things" : String(x.year)) : x.film) === k && x.life === it.life; }).length;
        y.appendChild(n);
        cells = document.createElement("div");
        cells.className = "cells";
        group.appendChild(y);
        group.appendChild(cells);
        frag.appendChild(group);
      }
      cells.appendChild(tile(it));
      shown.push(it.id);
    });
    life.appendChild(frag);
    document.getElementById("count").textContent = showHidden
      ? list.length + " in the archive — Bring back returns one to her life"
      : list.length + " pictures · " + list.filter(function (x) { return x.type === "video"; }).length + " moving";
    timeline(list);
    scrollTo(0, y0);
    spot();
  }

  /* ---------------- timeline ---------------- */

  var years = [], first = 1905, last = 1990;
  function timeline(list) {
    var counts = {}, films = 0;
    // her lifetime a bar per year; everything after her one bar, the films another
    var after = 0;
    list.forEach(function (it) {
      if (!it.life) { films++; return; }
      if (it.year != null && it.year > 1990) { after++; return; }
      if (it.year != null) counts[it.year] = (counts[it.year] || 0) + 1;
    });
    var ys = Object.keys(counts).map(Number);
    first = Math.min.apply(null, ys.concat([1905]));
    last = 1990;
    years = [];
    for (var y = first; y <= last; y++) years.push(y);
    if (after) years.push("after");
    if (films) years.push("films");
    var max = Math.max.apply(null, years.map(function (y) { return typeof y === "string" ? 0 : counts[y] || 0; }).concat([1]));
    var bars = document.getElementById("bars");
    bars.innerHTML = "";
    years.forEach(function (y) {
      var i = document.createElement("i"), n = y === "films" ? films : y === "after" ? after : counts[y] || 0;
      i.dataset.y = y;
      i.dataset.n = n;
      if (!n) i.className = "empty";
      i.style.height = typeof y === "string" ? "100%" : Math.max(12, Math.sqrt(n / max) * 100) + "%";
      // after-her and the films get room for their names
      if (typeof y === "string") { i.style.background = "rgba(234,231,225,.16)"; i.style.marginLeft = "6px"; i.style.flexGrow = "4"; }
      bars.appendChild(i);
    });
    var lab = document.getElementById("years");
    lab.innerHTML = "";
    var bw = bars.getBoundingClientRect().width || 1;
    years.forEach(function (y, k) {
      if (typeof y === "string" || (y % 10 === 0 && y !== 1990) || k === 0) {
        var s = document.createElement("span"), b = bars.children[k];
        s.style.left = ((b.offsetLeft + b.offsetWidth / 2) / bw * 100) + "%";
        s.textContent = y === "films" ? "Films" : y === "after" ? "After" : y;
        lab.appendChild(s);
      }
    });
    var eras = document.getElementById("eras");
    eras.innerHTML = "";
    var seen = {};
    list.forEach(function (it) {
      if (!it.life || it.year == null || it.year > 1990 || seen[it.era]) return;
      seen[it.era] = 1;
      var k = years.indexOf(it.year), e = document.createElement("span");
      e.className = "era";
      e.textContent = it.era;
      e.style.left = (bars.children[k].offsetLeft / bw * 100) + "%";
      eras.appendChild(e);
    });
    var es = eras.children;
    for (var j = 0; j < es.length; j++) {
      var b90 = bars.children[years.indexOf(1990)];
      var next = j + 1 < es.length ? parseFloat(es[j + 1].style.left) : (b90.offsetLeft + b90.offsetWidth) / bw * 100;
      es[j].style.width = (next - parseFloat(es[j].style.left)) + "%";
    }
  }
  function yearAt(x) {
    var bs = document.getElementById("bars").children, best = 0;
    for (var k = 0; k < bs.length; k++) if (bs[k].getBoundingClientRect().left <= x) best = k;
    return years[best];
  }
  function go(y) {
    var target;
    if (y === "films") target = document.querySelector('[id^="film-"]');
    else if (y === "after") {
      target = [].filter.call(document.querySelectorAll('.year[id^="y"]'), function (s) { return +s.id.slice(1) > 1990; })[0];
    } else {
      // the year itself, or the nearest year that has pictures
      for (var d = 0; d < 100 && !target; d++) target = document.getElementById("y" + (y + d)) || document.getElementById("y" + (y - d));
    }
    if (target) scrollTo(0, target.getBoundingClientRect().top + scrollY - document.querySelector(".bar").offsetHeight - 6);
  }
  var tl = document.getElementById("timeline"), tip = document.getElementById("tip"), down = false;
  tl.addEventListener("mousemove", function (e) {
    var y = yearAt(e.clientX), b = document.querySelector('#bars i[data-y="' + y + '"]');
    tip.style.display = "block";
    tip.style.left = (e.clientX - tl.getBoundingClientRect().left) + "px";
    tip.textContent = (y === "films" ? "Films" : y === "after" ? "After her" : y) + " · " + (b ? b.dataset.n : 0);
    if (down) go(y);
  });
  tl.addEventListener("mouseleave", function () { tip.style.display = "none"; down = false; });
  tl.addEventListener("mousedown", function (e) { down = true; go(yearAt(e.clientX)); });
  addEventListener("mouseup", function () { down = false; });
  tl.addEventListener("touchmove", function (e) { go(yearAt(e.touches[0].clientX)); }, { passive: true });
  tl.addEventListener("touchstart", function (e) { go(yearAt(e.touches[0].clientX)); }, { passive: true });

  // the year at the top of the screen lights up on the timeline and in the bar
  function spot() {
    var line = document.querySelector(".bar").getBoundingClientRect().bottom + 30, cur = null;
    var secs = life.querySelectorAll(".year");
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top < line) cur = secs[i]; else break;
    }
    var y = cur ? (cur.id.indexOf("film-") === 0 ? "films" : cur.id === "things" ? null : +cur.id.slice(1) > 1990 ? "after" : cur.id.slice(1)) : null;
    document.querySelectorAll("#bars i.cur").forEach(function (i) { i.classList.remove("cur"); });
    if (y) { var b = document.querySelector('#bars i[data-y="' + y + '"]'); if (b) b.classList.add("cur"); }
    document.getElementById("now").textContent = cur ? (y === "films" ? "Films" : cur.id === "things" ? "Her things" : cur.id.slice(1)) : "";
  }
  addEventListener("scroll", spot, { passive: true });

  /* ---------------- hiding ---------------- */

  var toastT = 0, before = null;
  function remember() { before = JSON.stringify(st); }
  function toast(msg, undo) {
    document.getElementById("toastMsg").textContent = msg;
    document.getElementById("toastUndo").style.display = undo ? "" : "none";
    document.getElementById("toast").classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { document.getElementById("toast").classList.remove("on"); }, 4500);
  }
  function setHidden(id, on) {
    var i = st.hidden.indexOf(id), r = st.restored.indexOf(id);
    if (on && i < 0) st.hidden.push(id);
    if (!on && i >= 0) st.hidden.splice(i, 1);
    if (BY[id] && BY[id].archived) {
      if (!on && r < 0) st.restored.push(id);
      if (on && r >= 0) st.restored.splice(r, 1);
    }
    save();
  }
  document.getElementById("toastUndo").addEventListener("click", function () {
    if (before) { st = JSON.parse(before); before = null; save(); mark(); render(); }
    document.getElementById("toast").classList.remove("on");
  });

  life.addEventListener("click", function (e) {
    var t = e.target.closest(".tile");
    if (!t) return;
    var id = t.dataset.id;
    if (e.target.classList.contains("hide")) {
      if (showHidden) { remember(); setHidden(id, false); t.remove(); toast("Back on the page", true); return; }
      remember();
      setHidden(id, true);
      t.remove();
      shown.splice(shown.indexOf(id), 1);
      toast("Archived", true);
      return;
    }
    view(shown.indexOf(id));
  });

  /* ---------------- moving pictures ----------------
     Drag a picture onto another: it goes just before or after it (whichever
     half it's dropped on) and joins that picture's year — or its film, in the
     Films section. */

  var dragId = null, caret = document.getElementById("caret");
  function side(t, x) { var r = t.getBoundingClientRect(); return x > r.left + r.width / 2 ? "after" : "before"; }
  life.addEventListener("dragstart", function (e) {
    var t = e.target.closest(".tile");
    if (!t) return;
    dragId = t.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", dragId); } catch (x) {}
    requestAnimationFrame(function () { t.classList.add("dragging"); });
  });
  life.addEventListener("dragover", function (e) {
    if (!dragId) return;
    var t = e.target.closest(".tile");
    if (!t || t.dataset.id === dragId) { caret.style.display = "none"; return; }
    e.preventDefault();
    var r = t.getBoundingClientRect(), after = side(t, e.clientX) === "after";
    caret.style.display = "block";
    caret.style.left = (after ? r.right + 1 : r.left - 3) + "px";
    caret.style.top = r.top + "px";
    caret.style.height = r.height + "px";
  });
  life.addEventListener("drop", function (e) {
    var t = e.target.closest(".tile");
    if (!dragId || !t || t.dataset.id === dragId) return;
    e.preventDefault();
    var list = arranged(), ids = list.map(function (x) { return x.id; });
    var target = list[ids.indexOf(t.dataset.id)], how = side(t, e.clientX);
    remember();
    st.moves = st.moves.filter(function (m) { return m.id !== dragId; });
    st.moves.push({ id: dragId, ref: target.id, side: how });
    st.place[dragId] = { year: target.year, era: target.era, life: target.life, film: target.film, month: target.month };
    var moved = dragId;
    save(); render();
    var el = life.querySelector('[data-id="' + moved + '"]');
    if (el) { el.classList.add("landed"); }
    toast("Moved to " + (target.life ? (target.year == null ? target.era : target.year) : target.film), true);
  });
  function endDrag() {
    dragId = null;
    caret.style.display = "none";
    life.querySelectorAll(".dragging").forEach(function (x) { x.classList.remove("dragging"); });
  }
  life.addEventListener("dragend", endDrag);
  life.addEventListener("drop", endDrag);

  /* ---------------- controls ---------------- */

  function mark() {
    document.querySelectorAll("[data-kind]").forEach(function (b) { b.classList.toggle("on", b.dataset.kind === prefs.kind && !showHidden); });
    document.querySelectorAll("[data-size]").forEach(function (b) { b.classList.toggle("on", b.dataset.size === prefs.size); });
    document.getElementById("fit").classList.toggle("on", !!prefs.fit);
    var hb = document.getElementById("hiddenBtn");
    hb.classList.toggle("on", showHidden);
    hb.textContent = showHidden ? "Back to her life" : "Archive " + ALL.filter(function (it) { return isHidden(it.id); }).length;
  }
  document.querySelector(".ctrl").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.kind) { prefs.kind = b.dataset.kind; showHidden = false; }
    else if (b.dataset.size) prefs.size = b.dataset.size;
    else if (b.id === "fit") prefs.fit = !prefs.fit;
    else if (b.id === "hiddenBtn") showHidden = !showHidden;
    else if (b.id === "update") {
      b.textContent = "Updating…";
      fetch("api/rebuild-life", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
        try { sessionStorage.setItem("garbo-life-updated", j.out || ""); } catch (e) {}
        location.reload();
      }, function () { b.textContent = "Update"; toast("Couldn't update — is the board server running?", false); });
      return;
    }
    else return;
    savePrefs(); mark(); render();
  });

  /* ---------------- viewer ---------------- */

  var lb = document.getElementById("lb"), li = lb.querySelector("img"), lv = lb.querySelector("video"), at = 0;
  function view(i) {
    if (!shown.length) return;
    at = (i + shown.length) % shown.length;
    var it = BY[shown[at]], src = media(it.rel, it);
    if (/\.mp4$/i.test(VIEW ? src : it.rel)) { li.hidden = true; lv.hidden = false; lv.src = src; lv.play().catch(function () {}); }
    else { lv.hidden = true; lv.pause(); lv.removeAttribute("src"); li.hidden = false; li.src = it.thumb; var full = new Image(); full.onload = function () { if (BY[shown[at]] === it) li.src = src; }; full.src = src; }
    document.getElementById("lbt").textContent = when(it) + " · " + it.title;
    document.getElementById("lbd").textContent = it.desc || "";
    var m = document.getElementById("lbm");
    m.innerHTML = "";
    function add(text, href) {
      var e = document.createElement(href ? "a" : "span");
      e.textContent = text;
      if (href) { e.href = href; e.target = "_blank"; e.rel = "noopener"; e.className = "label"; }
      m.appendChild(e);
    }
    add((at + 1) + " / " + shown.length);
    add(VIEW ? (it.film || "") : it.folder + (it.film ? " · " + it.film : ""));
    if (it.w) add(it.w + " × " + it.h);
    if (it.url) add("Source ↗", it.url);
    if (!VIEW) add("Full size ↗", src);
    lb.classList.add("on");
  }
  function close() { lb.classList.remove("on"); lv.pause(); lv.removeAttribute("src"); }
  lb.querySelector(".x").addEventListener("click", close);
  lb.querySelector(".nav.p").addEventListener("click", function () { view(at - 1); });
  lb.querySelector(".nav.n").addEventListener("click", function () { view(at + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target === li) close(); });
  addEventListener("keydown", function (e) {
    if (!lb.classList.contains("on")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") view(at + 1);
    else if (e.key === "ArrowLeft") view(at - 1);
  });

  try {
    var done = sessionStorage.getItem("garbo-life-updated");
    if (done) { sessionStorage.removeItem("garbo-life-updated"); setTimeout(function () { toast(done.split("\n").pop(), false); }, 300); }
  } catch (e) {}
  load();
  st.hidden = (st.hidden || []).filter(function (id) { return BY[id]; });
  st.place = st.place || {};
  st.restored = st.restored || [];
  st.moves = st.moves || [];
  delete st.order;
  mark();
  render();
})();
