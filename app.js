/* B2 First Listening Practice
 * Tests live in tests/TestNN.txt (format described in README.md).
 * Audio files live in AUDIO/ (or the folder named by AUDIO_FOLDER in a test file).
 */
(function () {
  "use strict";

  var TESTS_DIR = "tests/";
  var MAX_TESTS = 99;
  var app = document.getElementById("app");
  var crumb = document.getElementById("crumb");

  /* ---------------- storage (best effort) ---------------- */
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------------- helpers ---------------- */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fetchText(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    });
  }

  /* ---------------- parser ---------------- */
  function parseTest(src, id) {
    var test = { id: id, title: id, audioFolder: "AUDIO", parts: [] };
    var part = null, q = null, lastField = null;
    var lines = src.replace(/\r/g, "").split("\n");

    function target() { return q || part || test; }

    lines.forEach(function (raw, i) {
      var line = raw.trim();
      if (!line || line.charAt(0) === "#") { lastField = null; return; }

      var m;
      if ((m = line.match(/^===\s*(.*?)\s*===$/))) {
        part = { title: m[1], type: "choice", instructions: "", heading: "", audio: [], options: [], questions: [] };
        test.parts.push(part); q = null; lastField = null; return;
      }
      if ((m = line.match(/^---\s*(.+)$/))) {
        if (!part) throw new Error("Line " + (i + 1) + ": question before any === PART === line");
        q = { num: m[1].trim(), context: "", question: "", text: "", audio: [], options: [], answers: [], anyOrder: false };
        part.questions.push(q); lastField = null; return;
      }
      if ((m = line.match(/^([A-Z][A-Z_]*)\s*:\s*(.*)$/))) {
        var key = m[1], val = m[2].trim(), t = target();
        if (key.length === 1) { // option A, B, C …
          var opt = { letter: key, text: val };
          (t === test ? [] : t.options).push(opt);
          lastField = { obj: opt, key: "text" }; return;
        }
        switch (key) {
          case "TITLE": test.title = val; lastField = { obj: test, key: "title" }; return;
          case "AUDIO_FOLDER": test.audioFolder = val.replace(/\/+$/, ""); return;
          case "TYPE": if (part) part.type = val.toLowerCase(); return;
          case "INSTRUCTIONS": if (part) { part.instructions = val; lastField = { obj: part, key: "instructions" }; } return;
          case "HEADING": if (part) { part.heading = val; lastField = { obj: part, key: "heading" }; } return;
          case "AUDIO":
            var bits = val.split("|");
            t.audio && t.audio.push({ file: bits[0].trim(), label: (bits[1] || "").trim() });
            return;
          case "CONTEXT": if (q) { q.context = val; lastField = { obj: q, key: "context" }; } return;
          case "QUESTION": if (q) { q.question = val; lastField = { obj: q, key: "question" }; } return;
          case "TEXT": if (q) { q.text = val; lastField = { obj: q, key: "text" }; } return;
          case "ANSWER": if (q) q.answers.push(val); return;
          case "ANY_ORDER": if (q) q.anyOrder = /^(yes|true|1)$/i.test(val); return;
        }
      }
      // continuation of previous text field
      if (lastField) lastField.obj[lastField.key] += " " + line;
    });

    // derive numbering and validate
    var total = 0;
    test.parts.forEach(function (p) {
      if (p.type === "match" && !p.options.length) {
        p.options = []; // allow options defined in first question by mistake
      }
      p.questions.forEach(function (qq) {
        total++;
        if (p.type === "gap") qq.blanks = Math.max(1, (qq.text.match(/_{3,}/g) || []).length);
      });
    });
    test.total = total;
    return test;
  }

  /* ---------------- answer checking ---------------- */
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[‘’`´]/g, "'")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]/g, "");
  }
  // "(large) ships | big ships" -> ["largeships","ships","bigships"]
  function variants(spec) {
    var out = [];
    spec.split("|").forEach(function (alt) {
      alt = alt.trim();
      var opts = [];
      var re = /\(([^)]*)\)/g, m, parts = [], last = 0;
      while ((m = re.exec(alt))) { parts.push(alt.slice(last, m.index)); opts.push(m[1]); last = re.lastIndex; }
      parts.push(alt.slice(last));
      var combos = 1 << opts.length;
      for (var c = 0; c < combos; c++) {
        var s = parts[0];
        for (var k = 0; k < opts.length; k++) s += ((c >> k) & 1 ? opts[k] : "") + parts[k + 1];
        out.push(norm(s));
      }
    });
    return out.filter(Boolean);
  }
  function matches(input, spec) { var n = norm(input); return !!n && variants(spec).indexOf(n) !== -1; }

  function checkGap(q, values) {
    var specs = q.answers;
    var vals = values || [];
    var res = vals.map(function () { return false; });
    if (q.anyOrder && specs.length > 1) {
      var used = specs.map(function () { return false; });
      for (var i = 0; i < specs.length; i++) {
        for (var j = 0; j < specs.length; j++) {
          if (!used[j] && matches(vals[i], specs[j])) { used[j] = true; res[i] = true; break; }
        }
      }
    } else {
      for (var b = 0; b < q.blanks; b++) {
        res[b] = matches(vals[b], specs[b] !== undefined ? specs[b] : specs[0]);
      }
    }
    var all = true;
    for (var x = 0; x < q.blanks; x++) if (!res[x]) all = false;
    return { ok: all, perBlank: res };
  }

  function isCorrect(part, q, ans) {
    if (part.type === "gap") return checkGap(q, ans).ok;
    return !!ans && q.answers.length > 0 && ans.toUpperCase() === q.answers[0].trim().toUpperCase();
  }
  function isAnswered(part, q, ans) {
    if (part.type === "gap") {
      if (!ans) return false;
      for (var i = 0; i < q.blanks; i++) if (!ans[i] || !String(ans[i]).trim()) return false;
      return true;
    }
    return !!ans;
  }
  function prettyAnswer(spec) {
    return spec.split("|").map(function (s) { return s.trim(); }).join(" / ");
  }

  /* ---------------- test discovery ---------------- */
  var cache = {};
  function loadTest(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    return fetchText(TESTS_DIR + id + ".txt").then(function (txt) {
      var t = parseTest(txt, id);
      cache[id] = t;
      return t;
    });
  }
  function discover() {
    var found = [];
    function batch(start) {
      var ids = [];
      for (var i = start; i < start + 10 && i <= MAX_TESTS; i++) ids.push("Test" + pad2(i));
      return Promise.all(ids.map(function (id) {
        return loadTest(id).then(function (t) { return t; }, function () { return null; });
      })).then(function (res) {
        var any = false;
        res.forEach(function (t) { if (t) { found.push(t); any = true; } });
        if (any && start + 10 <= MAX_TESTS) return batch(start + 10);
        return found;
      });
    }
    return batch(1);
  }

  /* ---------------- audio ---------------- */
  var currentAudio = null;
  function players(list, folder) {
    if (!list.length) return null;
    return el("div", { class: "players" }, list.map(function (a) {
      var src = (folder ? folder + "/" : "") + a.file;
      var err = el("div", { class: "err" });
      err.style.display = "none";
      var audio = el("audio", { controls: "", preload: "none", src: encodeURI(src) });
      audio.addEventListener("play", function () {
        if (currentAudio && currentAudio !== audio) currentAudio.pause();
        currentAudio = audio;
      });
      audio.addEventListener("error", function () {
        err.textContent = "File not found: " + src;
        err.style.display = "block";
      });
      return el("div", { class: "player" }, [
        a.label ? el("div", { class: "player-label", text: a.label }) : null,
        audio, err
      ]);
    }));
  }

  /* ---------------- views ---------------- */
  function renderHome() {
    crumb.textContent = "";
    document.title = "B2 First · Listening Practice";
    app.innerHTML = "";
    app.appendChild(el("p", { class: "muted", text: "Looking for tests…" }));
    discover().then(function (tests) {
      app.innerHTML = "";
      app.appendChild(el("h1", { class: "home-title", text: "Listening" }));
      app.appendChild(el("p", { class: "home-sub", text: "Choose a test. Each test has 4 parts and 30 questions." }));
      if (!tests.length) {
        app.appendChild(el("div", { class: "error-box", text: "No tests found in the tests/ folder (expected files Test01.txt, Test02.txt …)." }));
        return;
      }
      var grid = el("div", { class: "test-grid" });
      tests.forEach(function (t) {
        var saved = store.get("result:" + t.id);
        var draft = store.get("answers:" + t.id);
        var pill = null;
        if (saved) {
          var good = saved.score / saved.total >= 0.6;
          pill = el("span", { class: "pill " + (good ? "ok" : "bad"), text: "Score: " + saved.score + "/" + saved.total });
        } else if (draft && Object.keys(draft).length) {
          pill = el("span", { class: "pill", text: "In progress" });
        }
        grid.appendChild(el("a", { class: "test-card", href: "#/test/" + encodeURIComponent(t.id) }, [
          el("h3", { text: t.title }),
          el("div", { class: "meta", text: t.parts.length + " parts · " + t.total + " questions" }),
          pill ? el("div", { class: "score-pill" }, [pill]) : null
        ]));
      });
      app.appendChild(grid);
    });
  }

  function renderTest(id, partIndex) {
    app.innerHTML = "";
    app.appendChild(el("p", { class: "muted", text: "Loading…" }));
    loadTest(id).then(function (test) {
      buildTestView(test, partIndex || 0);
    }, function () {
      app.innerHTML = "";
      app.appendChild(el("div", { class: "error-box", text: "Could not load tests/" + id + ".txt" }));
    });
  }

  function buildTestView(test, startPart) {
    crumb.textContent = test.title;
    document.title = test.title + " · B2 Listening";
    var key = "answers:" + test.id;
    var answers = store.get(key) || {};
    var result = store.get("result:" + test.id);
    var submitted = !!result;
    var active = Math.min(startPart, test.parts.length - 1);

    function save() { store.set(key, answers); updateProgress(); }

    app.innerHTML = "";
    var oldBar = document.querySelector(".bottombar");
    if (oldBar) oldBar.remove();

    var head = el("div", { class: "test-head" }, [ el("h1", { text: test.title }) ]);
    app.appendChild(head);

    var resultSlot = el("div");
    app.appendChild(resultSlot);

    var tabs = el("div", { class: "tabs", role: "tablist" });
    app.appendChild(tabs);

    var partEls = [], tabEls = [], tabCounts = [];
    test.parts.forEach(function (p, pi) {
      var count = el("span", { class: "count" });
      var tab = el("button", { class: "tab", type: "button", onclick: function () { show(pi); } }, [
        el("span", { text: niceTitle(p.title, pi) }), count
      ]);
      tabs.appendChild(tab); tabEls.push(tab); tabCounts.push(count);
      var sec = el("section", { class: "part" });
      partEls.push(sec);
      app.appendChild(sec);
      buildPart(sec, p, pi);
    });

    function niceTitle(t, i) {
      var m = /^part\s*(\d+)/i.exec(t);
      return m ? "Part " + m[1] : (t || "Part " + (i + 1));
    }

    function show(i) {
      active = i;
      partEls.forEach(function (s, k) { s.classList.toggle("active", k === i); });
      tabEls.forEach(function (t, k) { t.classList.toggle("active", k === i); });
      if (currentAudio) currentAudio.pause();
      var h = "#/test/" + encodeURIComponent(test.id) + "/" + (i + 1);
      if (location.hash !== h) history.replaceState(null, "", h);
      window.scrollTo(0, 0);
    }

    /* ---- per part ---- */
    function buildPart(sec, p, pi) {
      var instr = el("div", { class: "instructions" }, [
        p.instructions ? el("p", { text: p.instructions }) : null,
        players(p.audio, test.audioFolder)
      ]);
      sec.appendChild(instr);

      if (p.type === "match") {
        sec.appendChild(el("div", { class: "match-list" }, p.options.map(function (o) {
          return el("div", { class: "row" }, [el("b", { text: o.letter }), el("span", { text: o.text })]);
        })));
      }
      if (p.type === "gap" && p.heading) sec.appendChild(el("h2", { class: "gap-heading", text: p.heading }));

      p.questions.forEach(function (q) {
        var qid = pi + ":" + q.num;
        var card = el("div", { class: "q" });
        var body = el("div", { class: "q-body" });
        card.appendChild(el("div", { class: "q-top" }, [el("span", { class: "q-num", text: q.num }), body]));
        if (q.context) body.appendChild(el("div", { class: "q-context", text: q.context }));
        if (p.type !== "gap" && q.question) body.appendChild(el("div", { class: "q-question", text: q.question }));
        var pl = players(q.audio, test.audioFolder);
        if (pl) body.appendChild(pl);

        if (p.type === "gap") buildGap(body, q, qid);
        else if (p.type === "match") buildMatch(body, p, q, qid, pi);
        else buildChoice(body, q, qid);

        q._card = card; q._qid = qid; q._body = body;
        sec.appendChild(card);
      });
    }

    function buildChoice(body, q, qid) {
      var box = el("div", { class: "options" });
      q._btns = q.options.map(function (o) {
        var b = el("button", { class: "opt", type: "button" }, [
          el("span", { class: "letter", text: o.letter }), el("span", { text: o.text })
        ]);
        b.addEventListener("click", function () {
          if (submitted) return;
          answers[qid] = o.letter; save();
          q._btns.forEach(function (x) { x.classList.toggle("selected", x === b); });
        });
        if (answers[qid] === o.letter) b.classList.add("selected");
        b._letter = o.letter;
        box.appendChild(b);
        return b;
      });
      body.appendChild(box);
    }

    function buildGap(body, q, qid) {
      var p = el("p", { class: "gap-text" });
      var pieces = q.text.split(/_{3,}/);
      var vals = answers[qid] || [];
      q._inputs = [];
      pieces.forEach(function (txt, i) {
        if (txt) p.appendChild(document.createTextNode(txt));
        if (i < pieces.length - 1) {
          var inp = el("input", {
            class: "gap-input", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
            "aria-label": "Answer " + q.num + (pieces.length > 2 ? " (" + (i + 1) + ")" : "")
          });
          inp.value = vals[i] || "";
          inp.addEventListener("input", function () {
            var cur = answers[qid] || [];
            cur[i] = inp.value; answers[qid] = cur; save();
          });
          q._inputs.push(inp);
          p.appendChild(inp);
        }
      });
      body.appendChild(p);
    }

    function buildMatch(body, p, q, qid, pi) {
      var row = el("div", { class: "match-q" }, [el("span", { class: "label", text: q.question || ("Item " + q.num) })]);
      var letters = el("div", { class: "letters" });
      q._btns = p.options.map(function (o) {
        var b = el("button", { class: "letter-btn", type: "button", text: o.letter, title: o.text });
        b._letter = o.letter;
        b.addEventListener("click", function () {
          if (submitted) return;
          answers[qid] = answers[qid] === o.letter ? null : o.letter;
          if (!answers[qid]) delete answers[qid];
          save(); refreshMatch(p, pi);
        });
        letters.appendChild(b);
        return b;
      });
      row.appendChild(letters);
      body.appendChild(row);
      // body is the card's q-body; remove the q-question that was added above for match
      var qq = body.querySelector(".q-question");
      if (qq) qq.remove();
    }

    function refreshMatch(p, pi) {
      var used = {};
      p.questions.forEach(function (q) { var a = answers[pi + ":" + q.num]; if (a) used[a] = true; });
      p.questions.forEach(function (q) {
        var a = answers[pi + ":" + q.num];
        q._btns.forEach(function (b) {
          b.classList.toggle("selected", b._letter === a);
          b.classList.toggle("used", !!used[b._letter]);
        });
      });
    }

    /* ---- bottom bar ---- */
    var progressEl = el("div", { class: "progress" });
    var btnRow = el("div", { class: "btn-row" });
    var bar = el("div", { class: "bottombar" }, [el("div", { class: "bottombar-inner" }, [progressEl, btnRow])]);
    document.body.appendChild(bar);

    function countAnswered() {
      var n = 0, per = [];
      test.parts.forEach(function (p, pi) {
        var k = 0;
        p.questions.forEach(function (q) { if (isAnswered(p, q, answers[pi + ":" + q.num])) k++; });
        per.push(k); n += k;
      });
      return { n: n, per: per };
    }

    function updateProgress() {
      var c = countAnswered();
      test.parts.forEach(function (p, pi) {
        if (submitted && result && result.perPart) {
          tabCounts[pi].textContent = result.perPart[pi] + "/" + p.questions.length;
          tabCounts[pi].className = "count" + (result.perPart[pi] === p.questions.length ? " full" : "");
        } else {
          tabCounts[pi].textContent = c.per[pi] + "/" + p.questions.length;
          tabCounts[pi].className = "count" + (c.per[pi] === p.questions.length ? " full" : "");
        }
      });
      if (submitted) {
        progressEl.innerHTML = "";
        progressEl.appendChild(document.createTextNode("Score: "));
        progressEl.appendChild(el("b", { text: result.score + " / " + result.total }));
      } else {
        progressEl.innerHTML = "";
        progressEl.appendChild(document.createTextNode("Answered: "));
        progressEl.appendChild(el("b", { text: c.n + " / " + test.total }));
      }
    }

    function renderButtons() {
      btnRow.innerHTML = "";
      if (submitted) {
        btnRow.appendChild(el("a", { class: "btn ghost small", href: "#/", text: "All tests" }));
        btnRow.appendChild(el("button", { class: "btn small", type: "button", text: "Try again", onclick: function () {
          confirmBox("Restart this test?", "Your answers and score will be deleted.", "Restart", reset);
        } }));
      } else {
        btnRow.appendChild(el("button", { class: "btn", type: "button", text: "Submit", onclick: trySubmit }));
      }
    }

    function trySubmit() {
      var c = countAnswered();
      var left = test.total - c.n;
      if (left > 0) {
        confirmBox("Submit the test?", left + (left === 1 ? " question is" : " questions are") + " still unanswered and will be marked as wrong.", "Submit", submit);
      } else {
        confirmBox("Submit the test?", "You won't be able to change your answers after submitting.", "Submit", submit);
      }
    }

    function submit() {
      var score = 0, perPart = [];
      test.parts.forEach(function (p, pi) {
        var k = 0;
        p.questions.forEach(function (q) { if (isCorrect(p, q, answers[pi + ":" + q.num])) k++; });
        perPart.push(k); score += k;
      });
      result = { score: score, total: test.total, perPart: perPart, at: Date.now() };
      store.set("result:" + test.id, result);
      submitted = true;
      applyReview();
      if (currentAudio) currentAudio.pause();
      window.scrollTo(0, 0);
    }

    function reset() {
      store.del("result:" + test.id);
      store.del(key);
      buildTestView(test, 0);
      history.replaceState(null, "", "#/test/" + encodeURIComponent(test.id) + "/1");
    }

    function applyReview() {
      renderButtons();
      updateProgress();
      resultSlot.innerHTML = "";
      if (!submitted) return;

      resultSlot.appendChild(el("div", { class: "result-box" }, [
        el("div", { class: "result-total" }, [String(result.score), el("small", { text: " / " + result.total })]),
        el("div", { class: "result-parts" }, test.parts.map(function (p, pi) {
          return el("span", { class: "result-part" }, [niceTitle(p.title, pi) + ":", el("b", { text: result.perPart[pi] + "/" + p.questions.length })]);
        }))
      ]));

      test.parts.forEach(function (p, pi) {
        p.questions.forEach(function (q) {
          var ans = answers[pi + ":" + q.num];
          var ok = isCorrect(p, q, ans);
          q._card.classList.add(ok ? "correct" : "wrong");
          var old = q._card.querySelector(".fb"); if (old) old.remove();

          if (p.type === "gap") {
            var chk = checkGap(q, ans || []);
            q._inputs.forEach(function (inp, i) {
              inp.disabled = true;
              inp.classList.add(chk.perBlank[i] ? "ok" : "bad");
              if (!inp.value) inp.placeholder = "—";
            });
            if (!ok) {
              var right = q.answers.map(prettyAnswer).join(q.anyOrder ? "  +  " : "  |  ");
              q._body.appendChild(el("div", { class: "fb bad", text: "Correct answer: " + right + (q.anyOrder ? " (in any order)" : "") }));
            }
          } else {
            var correct = (q.answers[0] || "").trim().toUpperCase();
            q._btns.forEach(function (b) {
              b.disabled = true;
              if (b._letter === correct) b.classList.add("is-correct");
              else if (b._letter === ans) b.classList.add("is-wrong");
            });
            if (!ok) {
              var txt = "Correct answer: " + correct;
              var src = p.type === "match" ? p.options : q.options;
              var o = src.filter(function (x) { return x.letter === correct; })[0];
              if (o) txt += " — " + o.text;
              if (!ans) txt = "No answer. " + txt;
              q._body.appendChild(el("div", { class: "fb bad", text: txt }));
            }
          }
        });
      });
    }

    test.parts.forEach(function (p, pi) { if (p.type === "match") refreshMatch(p, pi); });
    show(active);
    applyReview();
  }

  /* ---------------- modal ---------------- */
  function confirmBox(title, text, okLabel, onOk) {
    var back = el("div", { class: "modal-back" });
    function close() { back.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    var okBtn = el("button", { class: "btn", type: "button", text: okLabel, onclick: function () { close(); onOk(); } });
    back.appendChild(el("div", { class: "modal", role: "dialog" }, [
      el("h3", { text: title }), el("p", { text: text }),
      el("div", { class: "btn-row" }, [
        el("button", { class: "btn ghost", type: "button", text: "Cancel", onclick: close }), okBtn
      ])
    ]));
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    okBtn.focus();
  }

  /* ---------------- router ---------------- */
  function route() {
    var bar = document.querySelector(".bottombar");
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    var m = location.hash.match(/^#\/test\/([^/]+)(?:\/(\d+))?/);
    if (m) {
      renderTest(decodeURIComponent(m[1]), m[2] ? parseInt(m[2], 10) - 1 : 0);
    } else {
      if (bar) bar.remove();
      renderHome();
    }
  }
  window.addEventListener("hashchange", route);
  route();

  // exposed for testing
  window.__listening = { parseTest: parseTest, checkGap: checkGap, variants: variants };
})();
