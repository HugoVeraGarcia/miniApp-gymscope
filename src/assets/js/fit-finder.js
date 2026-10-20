/* GymScope — treadmill fit finder. Runs entirely in the browser.
   Needs window.__DB__ (db.js) and window.__FF__ (config inlined by build.py). */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) { return v.toLocaleString("en-US"); }

  function init() {
    var root = document.querySelector("[data-ff]");
    var DB = window.__DB__, CFG = window.__FF__;
    if (!root || !DB || !CFG) return;
    var form = root.querySelector("[data-ff-form]");
    var weight = root.querySelector("[data-ff-weight]"), weightOut = root.querySelector("[data-ff-weight-out]");
    var list = root.querySelector("[data-ff-list]"), summary = root.querySelector("[data-ff-summary]");
    var viz = root.querySelector("[data-ff-viz]");
    var focus = (new URLSearchParams(location.search).get("ids") || "").split(",").filter(Boolean);

    var USE = CFG.use;          // {desk:{speed, belt:[s,m,t]}, ...}
    var USE_LABEL = { desk: "walking at a desk", walk: "walking workouts", jog: "jogging", run: "running" };

    function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }

    function neededBelt(a) { return USE[a.use].belt[a.height]; }

    function evaluate(p, a) {
      var s = p.specs, checks = [];
      function add(st, t) { checks.push({ st: st, t: t }); }
      var u = USE[a.use];
      // 1. speed for the workout
      if (s.speed_max_mph == null) add("warn", "Top speed not published");
      else if (s.speed_max_mph >= u.speed) add("ok", "Tops out at " + s.speed_max_mph + " mph — enough for " + USE_LABEL[a.use]);
      else add("no", "Tops out at " + s.speed_max_mph + " mph; " + USE_LABEL[a.use] + " needs about " + u.speed + " mph");
      // 2. belt length for stride
      var need = neededBelt(a);
      if (s.belt_len_in == null) add("warn", "Belt length not published — check before buying if you're tall");
      else if (s.belt_len_in >= need) add("ok", "Belt " + s.belt_len_in + " in long (you want " + need + "+ in)");
      else if (s.belt_len_in >= need - 3) add("warn", "Belt " + s.belt_len_in + " in — a little short for your stride (" + need + "+ in)");
      else add("no", "Belt " + s.belt_len_in + " in is too short for your stride (" + need + "+ in)");
      // 3. weight capacity
      if (s.max_user_lb == null) add("warn", "Weight limit not published");
      else if (s.max_user_lb >= a.weight * 1.15) add("ok", "Rated for " + s.max_user_lb + " lb");
      else if (s.max_user_lb >= a.weight) add("warn", "Rated for " + s.max_user_lb + " lb — close to your weight; expect more wear");
      else add("no", "Rated for " + s.max_user_lb + " lb, below your weight");
      // 4. incline
      var inc = s.incline_max_pct || 0;
      if (a.incline === "some") {
        if (inc >= 5) add("ok", "Inclines to " + inc + "%" + (s.auto_incline ? " (motorized)" : " (manual)"));
        else add("no", inc ? "Only " + inc + "% incline" : "No incline");
      } else if (a.incline === "steep") {
        if (inc >= 10) add("ok", "Inclines to " + inc + "%" + (s.auto_incline ? " (motorized)" : " (set by hand)"));
        else add("no", inc ? "Max " + inc + "% — not steep enough" : "No incline");
      } else if (a.incline === "auto") {
        if (inc >= 10 && s.auto_incline) add("ok", "Motorized incline to " + inc + "%");
        else if (s.auto_incline) add("warn", "Motorized incline, but only to " + inc + "%");
        else add("no", inc ? "Incline is manual (" + inc + "%)" : "No incline");
      }
      // 5. storage
      if (a.store === "under") {
        if (p.tags.indexOf("stores-under") > -1) add("ok", "Slides under a sofa or bed" + (s.flat_height_in ? " (" + s.flat_height_in + " in tall)" : ""));
        else add("no", "Too tall to slide under furniture");
      } else if (a.store === "upright") {
        if (p.tags.indexOf("stores-upright") > -1) add("ok", "Folds to stand upright");
        else if (p.tags.indexOf("stores-under") > -1) add("warn", "Stores flat, not upright (check if it can lean on a wall)");
        else add("no", "Doesn't fold upright");
      }
      // 6. handrail
      if (a.rail === "yes") {
        if (s.handrail && !/^None/i.test(s.handrail)) add("ok", "Handrail: " + s.handrail);
        else add("no", "No handrail");
      } else if (a.rail === "no" && a.use === "desk") {
        if (p.tags.indexOf("under-desk") > -1) add("ok", "Works under a standing desk");
        else add("no", "Fixed console or rails get in the way of a desk");
      }
      // 7. budget (price band only — exact prices live on Amazon)
      if (a.budget < 99 && p.tier != null && p.tier > a.budget) add("no", "Above your budget (" + p.band + ")");
      var st = checks.some(function (c) { return c.st === "no"; }) ? "no" : checks.some(function (c) { return c.st === "warn"; }) ? "warn" : "ok";
      return { p: p, st: st, checks: checks };
    }

    function drawViz(a, results) {
      var need = neededBelt(a);
      var rs = results.filter(function (r) { return r.p.specs.belt_len_in != null; })
        .sort(function (x, y) { return x.p.specs.belt_len_in - y.p.specs.belt_len_in; });
      if (!rs.length) { viz.hidden = true; return; }
      viz.hidden = false;
      var W = 640, H = 190, base = 160, maxIn = 64, px = (base - 20) / maxIn, bw = Math.min(30, (W - 40) / rs.length - 6);
      var y = function (inch) { return base - inch * px; };
      var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Belt lengths compared with the length your stride needs">';
      svg += '<line x1="0" x2="' + W + '" y1="' + y(need) + '" y2="' + y(need) + '" class="ff-line"/>';
      svg += '<text x="8" y="' + (y(need) - 7) + '" class="ff-sofa-t">Your stride needs ' + need + ' in of belt</text>';
      svg += '<line x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '" class="ff-floor"/>';
      rs.forEach(function (r, i) {
        var L = r.p.specs.belt_len_in, x = 24 + i * (bw + 6);
        var cls = L >= need ? "ok" : L >= need - 3 ? "warn" : "no";
        svg += '<g class="ff-bar ff-bar--' + cls + '"><title>' + esc(r.p.name) + " — " + L + ' in belt</title><rect x="' + x + '" y="' + y(L) + '" width="' + bw + '" height="' + (L * px) + '" rx="4"/>' +
          '<text x="' + (x + bw / 2) + '" y="' + (base + 16) + '" text-anchor="middle">' + L + "</text></g>";
      });
      svg += "</svg>";
      viz.innerHTML = svg + '<p class="ff-viz__cap">Each bar is one model\'s belt length in inches, drawn to scale. Green is long enough for your stride, amber is a little short, red is too short.</p>';
    }

    function render() {
      var a = {
        use: val("use") || "walk", height: parseInt(val("height") || "1", 10), weight: parseFloat(weight.value),
        incline: val("incline"), store: val("store"), rail: val("rail"), budget: parseInt(val("budget") || "99", 10)
      };
      weightOut.textContent = num(a.weight) + " lb";
      var results = DB.products.map(function (p) { return evaluate(p, a); });
      var rank = { ok: 0, warn: 1, no: 2 };
      results.sort(function (x, y) {
        var fx = focus.indexOf(x.p.id) > -1 ? 0 : 1, fy = focus.indexOf(y.p.id) > -1 ? 0 : 1;
        return fx - fy || rank[x.st] - rank[y.st] || y.p.score - x.p.score;
      });
      var nOk = results.filter(function (r) { return r.st === "ok"; }).length;
      var nWarn = results.filter(function (r) { return r.st === "warn"; }).length;
      summary.innerHTML = "<b>" + nOk + "</b> great fit" + (nOk === 1 ? "" : "s") + " · <b>" + nWarn + "</b> with caveats · <b>" + (results.length - nOk - nWarn) + "</b> not a fit";
      var labels = { ok: "Great fit", warn: "Fits, with caveats", no: "Not a fit" };
      list.innerHTML = results.map(function (r) {
        var p = r.p;
        return '<article class="ff-card ff-card--' + r.st + (focus.indexOf(p.id) > -1 ? " is-focus" : "") + '">' +
          '<a class="ff-card__img" tabindex="-1" aria-hidden="true" href="' + esc(p.url) + '"><img src="' + esc(p.img) + '" alt="" loading="lazy"></a>' +
          '<div class="ff-card__body"><div class="ff-card__top"><span class="ff-status">' + labels[r.st] + '</span><span class="score-pill" title="Editor score">' + p.score + "</span></div>" +
          '<h3><a href="' + esc(p.url) + '">' + esc(p.name) + "</a></h3>" +
          '<ul class="ff-checks">' + r.checks.map(function (c) { return '<li class="is-' + c.st + '">' + esc(c.t) + "</li>"; }).join("") + "</ul>" +
          '<div class="ff-card__actions">' + (p.band ? '<span class="ff-price">' + esc(p.band) + "</span>" : "") +
          '<a class="btn btn--amazon btn--xs" href="' + esc(p.aff) + '" target="_blank" rel="sponsored nofollow noopener">Check price on Amazon<svg class="ico"><use href="#i-ext"/></svg></a>' +
          '<a class="btn btn--ghost btn--xs" href="' + esc(p.url) + '">Review</a></div></div></article>';
      }).join("") + '<p class="note note--muted">Price ranges are approximate; check Amazon for today\'s price. Specs are manufacturer claims — see each review for sources.</p>';
      drawViz(a, results);
    }

    form.addEventListener("input", render);
    form.addEventListener("change", render);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
