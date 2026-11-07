(function () {
  const sections = window.CSLB_SECTIONS;
  const lessons = window.CSLB_LESSONS;
  const cards = window.CSLB_CARDS.map(function (c, i) {
    return { id: "c" + i, section: c[0], q: c[1], a: c[2] };
  });
  const questions = window.CSLB_QUESTIONS.map(function (q, i) {
    return { id: "q" + i, section: q[0], stem: q[1], choices: q[2], answer: q[3], why: q[4] };
  });
  const plan = window.CSLB_PLAN;
  const formulas = window.CSLB_FORMULAS;
  const KEY = "cslb-law-desk-v1";

  const main = document.getElementById("main");
  const findForm = document.getElementById("find-form");
  const findInput = document.getElementById("find-q");

  let memory = load();
  let cardFilter = "due";
  let cardQueue = [];
  let cardIndex = 0;
  let cardFlipped = false;
  let work = null;
  let timerId = null;
  let lastRoute = "";

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || typeof raw !== "object") return fresh();
      raw.boxes = raw.boxes || {};
      raw.answers = raw.answers || {};
      raw.plan = raw.plan || {};
      return raw;
    } catch (err) {
      return fresh();
    }
  }

  function fresh() {
    return { boxes: {}, answers: {}, plan: {} };
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(memory));
  }

  function sectionById(id) {
    return sections.find(function (s) { return s.id === id; });
  }

  function h(tag, attrs) {
    const node = document.createElement(tag);
    const kids = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value == null || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key.indexOf("on") === 0 && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else node.setAttribute(key, value);
      });
    }
    kids.flat().forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    });
    return node;
  }

  function p(text) { return h("p", null, text); }
  function btn(label, className, click) {
    return h("button", { class: "btn " + (className || ""), type: "button", onclick: click }, label);
  }

  function route() {
    const hash = (location.hash || "#desk").slice(1);
    const parts = hash.split("/");
    return { name: parts[0] || "desk", arg: parts[1] || "" };
  }

  function setTab(name) {
    const map = { desk: "desk", find: "desk", lesson: "lessons", lessons: "lessons", cards: "cards", work: "work", numbers: "numbers", plan: "plan" };
    const current = map[name] || "desk";
    document.querySelectorAll(".tabs a").forEach(function (a) {
      if (a.getAttribute("data-tab") === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function accuracy(sectionId) {
    const rows = questions.filter(function (q) {
      return (!sectionId || q.section === sectionId) && memory.answers[q.id];
    });
    if (!rows.length) return null;
    const right = rows.filter(function (q) { return memory.answers[q.id].correct; }).length;
    return { right: right, total: rows.length, pct: Math.round((right / rows.length) * 100) };
  }

  function knownCount(sectionId) {
    return cards.filter(function (c) {
      return (!sectionId || c.section === sectionId) && (memory.boxes[c.id] || 0) >= 2;
    }).length;
  }

  function render() {
    const r = route();
    const routeKey = r.name + "/" + r.arg;
    const routeChanged = routeKey !== lastRoute;
    if (routeChanged) lastRoute = routeKey;
    setTab(r.name);
    stopTimer();
    main.replaceChildren();
    if (r.name === "lessons") renderLessons();
    else if (r.name === "lesson") renderLesson(r.arg);
    else if (r.name === "cards") renderCards();
    else if (r.name === "work") renderWork(r.arg);
    else if (r.name === "numbers") renderNumbers();
    else if (r.name === "plan") renderPlan();
    else if (r.name === "find") renderFind(decodeURIComponent(r.arg || ""));
    else renderDesk();
    if (routeChanged) {
      const snap = function () { window.scrollTo(0, 0); };
      snap();
      requestAnimationFrame(snap);
      setTimeout(snap, 0);
    }
  }

  function renderDesk() {
    const acc = accuracy();
    const known = knownCount();
    const weak = weakestSection();
    main.append(
      h("p", { class: "kicker" }, "California Contractors State License Board"),
      h("h1", null, "Pass the Law and Business exam."),
      p("Seven sections. The same exam for every classification. This desk follows CSLB study guide 13E-LAW (March 2026): the rules, the numbers, and the arithmetic. Your trade exam, if you have one, is a separate test. A C-61 limited specialty has no trade exam."),
      h("div", { class: "grid-2" },
        h("section", { class: "panel" },
          h("h2", null, "How this sitting works"),
          h("dl", { class: "facts" },
            fact("Time", "3 1/2 hours"),
            fact("Format", "Multiple choice, 4 answers, one best"),
            fact("Materials", "Closed book. Calculator provided"),
            fact("Guessing", "No penalty. Leave nothing blank"),
            fact("Pass line", "Told to you at the test site"),
            fact("If you fail", "21 days to reschedule. 18-month void date")
          ),
          h("div", { class: "row", style: "margin-top:14px" },
            h("a", { class: "btn", href: weak ? "#lesson/" + weak.id : "#lessons" }, weak ? "Study " + weak.short : "Start the lessons"),
            h("a", { class: "btn secondary", href: "#work" }, "Do the work"),
            h("a", { class: "btn ghost", href: "#cards" }, "Flashcards")
          )
        ),
        h("section", { class: "panel" },
          h("h2", null, "Your desk"),
          p((acc ? acc.pct + "% on " + acc.total + " practiced questions. " : "No practice scored yet. ") + known + " of " + cards.length + " cards are in the known pile. Progress stays in this browser."),
          h("div", { class: "row" },
            btn("Reset this browser", "ghost", function () {
              if (confirm("Erase card scores, quiz scores, and the plan checkboxes on this browser?")) {
                memory = fresh();
                save();
                cardQueue = [];
                render();
              }
            })
          )
        )
      ),
      h("section", { class: "panel", style: "margin-top:14px" },
        h("h2", null, "Weight of each section"),
        h("p", { class: "muted" }, "Bars show the approximate share of the exam. A copper bar appears after you have answered questions from that section."),
        sections.map(function (s) {
          const a = accuracy(s.id);
          const share = Math.round((s.weight / 21) * 100);
          return h("div", null,
            h("div", { class: "bar" },
              h("b", null, s.short),
              h("div", { class: "track", title: s.weight + " percent of the exam" }, h("span", { style: "width:" + share + "%" })),
              h("em", null, s.weight + "%")
            ),
            a ? h("div", { class: "bar" },
              h("b", null, "Your score"),
              h("div", { class: "track score" }, h("span", { style: "width:" + a.pct + "%" })),
              h("em", null, a.pct + "%")
            ) : null
          );
        })
      ),
      h("section", { class: "callout" },
        h("strong", null, "Practice target. "),
        "CSLB does not publish one statewide raw percentage. Score 80 percent or better on the timed set, including the math, before you sit. The pass report is not a license."
      )
    );
  }

  function fact(term, value) {
    return [h("div", null, h("dt", null, term), h("dd", null, value))];
  }

  function weakestSection() {
    let pick = null;
    sections.forEach(function (s) {
      const a = accuracy(s.id);
      const score = a ? a.pct : -1;
      if (!pick || score < pick.score) pick = { id: s.id, short: s.short, score: score };
    });
    if (pick && pick.score === -1) return sectionById("contracts");
    if (pick && pick.score < 80) return pick;
    return null;
  }

  function renderLessons() {
    main.append(
      h("p", { class: "kicker" }, "Lessons"),
      h("h1", null, "The seven sections, in exam order."),
      p("Read a section, then use the cards and the work for that section the same day. The traps are the pairs of numbers people swap.")
    );
    const wrap = h("div", { class: "stack" });
    sections.forEach(function (s, i) {
      const a = accuracy(s.id);
      wrap.append(h("a", { class: "hit", href: "#lesson/" + s.id },
        h("small", null, "Section " + (i + 1) + " · " + s.weight + "%"),
        h("h2", null, s.name),
        h("p", { class: "muted" }, s.covers + (a ? " Your practice score: " + a.pct + "%." : ""))
      ));
    });
    main.append(wrap);
  }

  function renderLesson(id) {
    const section = sectionById(id);
    const lesson = lessons[id];
    if (!section || !lesson) {
      main.append(h("h1", null, "That section is not in the guide."), h("a", { href: "#lessons" }, "Back to the lessons"));
      return;
    }
    main.append(
      h("p", { class: "kicker" }, section.weight + "% of the exam"),
      h("h1", null, section.name),
      p(section.covers)
    );
    const article = h("article", { class: "lesson" });
    lesson.parts.forEach(function (part) {
      const block = h("div", { class: "part" }, h("h2", null, part.h));
      (part.p || []).forEach(function (text) { block.append(p(text)); });
      if (part.b && part.b.length) {
        block.append(h("ul", null, part.b.map(function (item) { return h("li", null, item); })));
      }
      if (part.trap) {
        block.append(h("div", { class: "callout" }, h("strong", null, "Exam trap. "), part.trap));
      }
      article.append(block);
    });
    main.append(article);
    main.append(h("div", { class: "row", style: "margin-top:16px" },
      h("a", { class: "btn", href: "#cards" }, "Drill these cards"),
      h("a", { class: "btn secondary", href: "#work" }, "Work this section"),
      h("a", { class: "btn ghost", href: "#lessons" }, "All sections")
    ));
  }

  function dueCards(filter) {
    let pool = cards.slice();
    if (filter && filter !== "all" && filter !== "due") {
      pool = pool.filter(function (c) { return c.section === filter; });
    }
    if (filter === "due") {
      const freshCards = pool.filter(function (c) { return (memory.boxes[c.id] || 0) < 2; });
      pool = freshCards.length ? freshCards : pool;
    }
    return shuffle(pool);
  }

  function renderCards() {
    if (!cardQueue.length) {
      cardQueue = dueCards(cardFilter);
      cardIndex = 0;
      cardFlipped = false;
    }
    const card = cardQueue[cardIndex];
    const section = card ? sectionById(card.section) : null;
    main.append(
      h("p", { class: "kicker" }, "Flashcards"),
      h("h1", null, "Say the answer, then flip."),
      h("div", { class: "filters" },
        chip("Due", "due"),
        chip("All", "all"),
        sections.map(function (s) { return chip(s.short, s.id); })
      )
    );
    if (!card) {
      main.append(p("No cards in this pile."));
      return;
    }
    const face = h("div", { class: "face " + (cardFlipped ? "back" : "front") },
      h("div", { class: "tag" }, (section ? section.short : "") + " · " + (cardIndex + 1) + " of " + cardQueue.length),
      h("p", null, cardFlipped ? card.a : card.q)
    );
    const flip = h("button", {
      class: "flip" + (cardFlipped ? " is-back" : ""),
      type: "button",
      "aria-pressed": cardFlipped ? "true" : "false",
      "aria-label": cardFlipped ? "Card back. Activate to see the question." : "Card front. Activate to see the answer.",
      onclick: function () { cardFlipped = !cardFlipped; render(); }
    }, h("div", { class: "flip-inner" }, face));
    const stage = h("div", { class: "stage" },
      h("div", { class: "statline" },
        h("span", null, knownCount() + " known of " + cards.length),
        h("span", null, "Space flips. 1 = again. 2 = know it.")
      ),
      flip,
      h("div", { class: "card-actions" },
        btn("Again", "warn", function () { gradeCard(card, 0); }),
        btn("Know it", "", function () { gradeCard(card, 1); })
      )
    );
    main.append(stage);
  }

  function chip(label, id) {
    return h("button", {
      class: "chip",
      type: "button",
      "aria-pressed": cardFilter === id ? "true" : "false",
      onclick: function () {
        cardFilter = id;
        cardQueue = [];
        render();
      }
    }, label);
  }

  function gradeCard(card, knew) {
    memory.boxes[card.id] = knew ? 2 : 0;
    save();
    cardFlipped = false;
    if (!knew) {
      const insertAt = Math.min(cardQueue.length, cardIndex + 3);
      cardQueue.splice(insertAt, 0, card);
    }
    cardIndex += 1;
    if (cardIndex >= cardQueue.length) cardQueue = [];
    render();
  }

  function renderWork(arg) {
    if (arg === "run" && work) return renderQuestion();
    if (arg === "done" && work) return renderResults();
    main.append(
      h("p", { class: "kicker" }, "The work"),
      h("h1", null, "Answer it before you look."),
      p("Each question has one best answer. After you commit, the explanation shows the arithmetic or the statute. Misses stay in the bank so you can run them again.")
    );
    const panel = h("section", { class: "panel stack" });
    panel.append(h("h2", null, "Choose a set"));
    const picks = [{ id: "mixed", label: "Mixed, 20 questions" }, { id: "timed", label: "Timed set, 40 questions, 70 minutes" }, { id: "missed", label: "Missed questions only" }];
    sections.forEach(function (s) { picks.push({ id: s.id, label: s.short + " only" }); });
    const select = h("select", { id: "work-set" });
    picks.forEach(function (pick) {
      select.append(h("option", { value: pick.id }, pick.label));
    });
    panel.append(select, btn("Start", "", function () { startWork(select.value); }));
    const acc = accuracy();
    if (acc) panel.append(p("So far: " + acc.right + " correct out of " + acc.total + " (" + acc.pct + "%)."));
    main.append(panel);
  }

  function startWork(which) {
    let pool = questions.slice();
    let minutes = 0;
    let title = "Practice";
    if (which === "timed") {
      pool = shuffle(pool).slice(0, 40);
      minutes = 70;
      title = "Timed set";
    } else if (which === "missed") {
      pool = pool.filter(function (q) {
        return memory.answers[q.id] && !memory.answers[q.id].correct;
      });
      title = "Missed questions";
    } else if (which === "mixed") {
      pool = shuffle(pool).slice(0, 20);
      title = "Mixed set";
    } else {
      pool = shuffle(pool.filter(function (q) { return q.section === which; }));
      title = sectionById(which).name;
    }
    if (!pool.length) {
      alert("Nothing in that pile yet. Miss a few questions first, or pick another set.");
      return;
    }
    work = {
      title: title,
      items: pool,
      index: 0,
      picked: null,
      locked: false,
      correct: 0,
      bySection: {},
      endsAt: minutes ? Date.now() + minutes * 60 * 1000 : 0
    };
    location.hash = "#work/run";
  }

  function renderQuestion() {
    if (work.index >= work.items.length) {
      location.hash = "#work/done";
      return;
    }
    const q = work.items[work.index];
    const section = sectionById(q.section);
    const wrap = h("div", { class: "stage" });
    wrap.append(
      h("div", { class: "statline" },
        h("span", null, work.title + " · " + (work.index + 1) + " of " + work.items.length),
        h("span", { class: "clock", id: "clock" }, work.endsAt ? "" : section.short)
      ),
      h("p", { class: "kicker" }, section.name),
      h("h2", { class: "q-stem" }, q.stem)
    );
    q.choices.forEach(function (choice, i) {
      let cls = "choice";
      if (work.locked && i === q.answer) cls += " right";
      else if (work.locked && i === work.picked && i !== q.answer) cls += " wrong";
      else if (!work.locked && i === work.picked) cls += " picked";
      wrap.append(h("button", {
        class: cls,
        type: "button",
        disabled: work.locked,
        onclick: function () { work.picked = i; render(); }
      }, h("span", { class: "key" }, String.fromCharCode(65 + i)), choice));
    });
    if (!work.locked) {
      wrap.append(btn("Commit answer", "", function () {
        if (work.picked == null) return;
        work.locked = true;
        const ok = work.picked === q.answer;
        if (ok) work.correct += 1;
        const bucket = work.bySection[q.section] || { right: 0, total: 0 };
        bucket.total += 1;
        if (ok) bucket.right += 1;
        work.bySection[q.section] = bucket;
        memory.answers[q.id] = { correct: ok, at: Date.now() };
        save();
        render();
      }));
    } else {
      wrap.append(
        h("div", { class: work.picked === q.answer ? "good-note why" : "bad-note why" },
          h("strong", null, work.picked === q.answer ? "Correct. " : "Not this one. "),
          q.why
        ),
        btn(work.index + 1 === work.items.length ? "See the score" : "Next", "", function () {
          work.index += 1;
          work.picked = null;
          work.locked = false;
          if (work.index >= work.items.length) location.hash = "#work/done";
          else render();
        })
      );
    }
    main.append(wrap);
    if (work.endsAt) tick();
  }

  function tick() {
    const clock = document.getElementById("clock");
    if (!clock || !work || !work.endsAt) return;
    const left = Math.max(0, work.endsAt - Date.now());
    const min = Math.floor(left / 60000);
    const sec = Math.floor((left % 60000) / 1000);
    clock.textContent = (min < 10 ? "0" : "") + min + ":" + (sec < 10 ? "0" : "") + sec;
    if (left <= 0) {
      const start = work.locked ? work.index + 1 : work.index;
      for (let i = start; i < work.items.length; i += 1) {
        const q = work.items[i];
        memory.answers[q.id] = { correct: false, at: Date.now() };
        const bucket = work.bySection[q.section] || { right: 0, total: 0 };
        bucket.total += 1;
        work.bySection[q.section] = bucket;
      }
      work.index = work.items.length;
      work.locked = false;
      save();
      if (location.hash !== "#work/done") location.hash = "#work/done";
      else render();
      return;
    }
    timerId = setTimeout(tick, 250);
  }

  function stopTimer() {
    if (timerId) clearTimeout(timerId);
    timerId = null;
  }

  function renderResults() {
    const pct = Math.round((work.correct / work.items.length) * 100);
    const note = pct >= 80
      ? "That is the cushion to take into the test site. Run the misses once more this week."
      : pct >= 70
        ? "Close. The section bars below are the pages to reread before you add another set."
        : "Not yet. Go back to the weak section's lesson and clear those cards before another full set.";
    main.append(
      h("p", { class: "kicker" }, work.title),
      h("h1", null, "The score"),
      h("p", { class: "score-big" }, String(pct) + "%", h("span", null, "  " + work.correct + " of " + work.items.length)),
      h("div", { class: pct >= 80 ? "good-note" : "callout" }, note)
    );
    const panel = h("section", { class: "panel" }, h("h2", null, "By section"));
    sections.forEach(function (s) {
      const bucket = work.bySection[s.id];
      if (!bucket) return;
      const sp = Math.round((bucket.right / bucket.total) * 100);
      panel.append(h("div", { class: "bar" },
        h("b", null, s.short),
        h("div", { class: "track score" }, h("span", { style: "width:" + sp + "%" })),
        h("em", null, bucket.right + "/" + bucket.total)
      ));
    });
    panel.append(h("div", { class: "row", style: "margin-top:12px" },
      h("a", { class: "btn", href: "#work" }, "Another set"),
      h("a", { class: "btn secondary", href: "#lessons" }, "Reread a lesson")
    ));
    main.append(panel);
  }

  function renderNumbers() {
    main.append(
      h("p", { class: "kicker" }, "Numbers and formulas"),
      h("h1", null, "Write these on the scratch paper first."),
      p("The exam mixes calendar days with business days, and it mixes markup with margin. These are the pairs.")
    );
    const rows = [
      ["License exemption", "Under $1,000, no permit, no employees", "BPC 7048"],
      ["Home improvement writing", "Price exceeds $500", "BPC 7159"],
      ["Service and repair", "$750 or less, buyer called you, pay at the end", "BPC 7159.10"],
      ["Down payment", "Lesser of $1,000 or 10%", "BPC 7159"],
      ["Cancel", "3 business days; 5 if 65+; 7 after a declared emergency", "BPC 7159"],
      ["Refund after cancel", "10 days to return money; 20 days to pick up goods", "BPC 7159"],
      ["Qualifier replacement and address changes", "90 days", "BPC 7068.2 and 7083"],
      ["RME hours", "32 hours or 80% of operating hours, whichever is less", "CSLB / BPC 7068"],
      ["Extra firm", "20% common ownership, and no more than 3 firms a year", "BPC 7068.1"],
      ["Qualifier bond exemption", "RMO or LLC qualifier owns at least 10%", "BPC 7071.9"],
      ["Bonds", "$25,000 license; $25,000 qualifier; $100,000 LLC worker", "BPC 7071"],
      ["Preliminary notice", "20 days after first furnishing", "Civil Code 8204"],
      ["Lien, no notice of completion", "90 days after completion", "Civil Code 8412 / 8414"],
      ["Lien after notice of completion", "Direct contractor 60 days; everyone else 30", "Civil Code 8412 / 8414"],
      ["Foreclose the lien", "90 days after recording", "Civil Code 8460"],
      ["Pay a sub from a progress payment", "7 days; withhold at most 150% of a dispute", "BPC 7108.5"],
      ["Pass retention through", "10 days", "Civil Code 8814"],
      ["Prevailing wage", "Public works over $1,000", "Labor Code 1771"],
      ["Public payment bond", "Over $25,000, at least 100%", "Civil Code 9550 / 9554"],
      ["Fall protection", "More than 7 1/2 feet", "Title 8 §1670"],
      ["Trench protection / egress / spoil", "5 feet / 4 feet and 25 feet of travel / 2 feet back", "Title 8"],
      ["Serious injury report", "Immediately, no later than 8 hours", "Title 8 §342"],
      ["Tailgate", "At least every 10 working days", "Title 8 §1509"],
      ["Heat", "Shade above 80°F; high-heat procedures at 95°F", "Title 8 §3395"],
      ["Daily overtime", "1.5x after 8 hours; 2x after 12; 7th day is 1.5x then 2x", "Labor Code 510"],
      ["Final pay", "Immediately if fired; 72 hours if the worker quits without notice", "Labor Code 201 / 202"]
    ];
    const table = h("table", null,
      h("thead", null, h("tr", null, h("th", null, "Item"), h("th", null, "Number"), h("th", null, "Where"))),
      h("tbody", null, rows.map(function (row) {
        return h("tr", null, h("td", null, row[0]), h("td", null, row[1]), h("td", null, row[2]));
      }))
    );
    main.append(h("div", { class: "panel", style: "padding:0; overflow:auto" }, table));
    const formulasPanel = h("section", { class: "panel", style: "margin-top:14px" }, h("h2", null, "Worked formulas"));
    formulas.forEach(function (f) {
      formulasPanel.append(h("div", { class: "formula" },
        h("div", null, h("h3", null, f.name), h("code", null, f.rule)),
        h("div", null, f.example)
      ));
    });
    main.append(formulasPanel);
  }

  function renderPlan() {
    const done = plan.filter(function (day) { return memory.plan[day.day]; }).length;
    main.append(
      h("p", { class: "kicker" }, done + " of " + plan.length + " days checked"),
      h("h1", null, "Fourteen days."),
      p("Contracts and employment get the most days because they are 21 and 20 percent of the exam. Check a day only after the work for that day is done.")
    );
    const list = h("div", { class: "panel" });
    plan.forEach(function (day) {
      const id = "day" + day.day;
      list.append(h("label", { class: "check" },
        h("input", {
          type: "checkbox",
          id: id,
          checked: memory.plan[day.day] ? "checked" : null,
          onchange: function (event) {
            memory.plan[day.day] = event.target.checked;
            save();
            render();
          }
        }),
        h("span", null, h("strong", null, "Day " + day.day + ". " + day.title), h("div", { class: "muted" }, day.do))
      ));
    });
    main.append(list);
  }

  function renderFind(query) {
    main.append(h("p", { class: "kicker" }, "Search"), h("h1", null, query ? "Results for “" + query + "”" : "Search the guide"));
    if (!query || query.trim().length < 2) {
      main.append(p("Type at least two letters. Search covers lessons, cards, and questions."));
      return;
    }
    const needle = query.trim().toLowerCase();
    const hits = [];
    sections.forEach(function (s) {
      const lesson = lessons[s.id];
      const blob = lesson.parts.map(function (part) {
        return [part.h].concat(part.p || [], part.b || [], part.trap || "").join(" ");
      }).join(" ");
      if ((s.name + " " + blob).toLowerCase().indexOf(needle) >= 0) {
        hits.push({ href: "#lesson/" + s.id, kind: "Lesson", title: s.name, text: s.covers });
      }
    });
    cards.forEach(function (c) {
      if ((c.q + " " + c.a).toLowerCase().indexOf(needle) >= 0) {
        hits.push({ href: "#cards", kind: "Card · " + sectionById(c.section).short, title: c.q, text: c.a });
      }
    });
    questions.forEach(function (q) {
      if ((q.stem + " " + q.why).toLowerCase().indexOf(needle) >= 0) {
        hits.push({ href: "#work", kind: "Question · " + sectionById(q.section).short, title: q.stem, text: q.why });
      }
    });
    if (!hits.length) {
      main.append(p("Nothing matched. Try “down payment,” “7 1/2,” or “preliminary.”"));
      return;
    }
    const wrap = h("div", { class: "hits" });
    hits.slice(0, 40).forEach(function (hit) {
      wrap.append(h("a", { class: "hit", href: hit.href },
        h("small", null, hit.kind),
        h("strong", null, " " + clip(hit.title, 180)),
        h("div", { class: "muted" }, clip(hit.text, 220))
      ));
    });
    main.append(wrap);
  }

  function clip(text, n) {
    if (text.length <= n) return text;
    return text.slice(0, n - 1) + "…";
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  document.addEventListener("keydown", function (event) {
    const tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return;
    const name = route().name;
    if (name === "cards") {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        cardFlipped = !cardFlipped;
        render();
      } else if (event.key === "1") {
        const card = cardQueue[cardIndex];
        if (card) gradeCard(card, 0);
      } else if (event.key === "2") {
        const card = cardQueue[cardIndex];
        if (card) gradeCard(card, 1);
      }
    } else if (name === "work" && route().arg === "run" && work && !work.locked) {
      const n = "ABCD".indexOf(event.key.toUpperCase());
      if (n >= 0) {
        work.picked = n;
        render();
      }
    }
  });

  findForm.addEventListener("submit", function (event) {
    event.preventDefault();
    location.hash = "#find/" + encodeURIComponent(findInput.value.trim());
  });

  window.addEventListener("hashchange", render);

  const broken = questions.filter(function (q) {
    return q.answer < 0 || q.answer > 3 || q.choices.length !== 4;
  });
  if (broken.length) console.error("Question bank errors", broken);

  render();
})();
