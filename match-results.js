// match-results.js
// FINAL VERSION: running league average + correct positions + newest-first display

function isLeague(details) {
  return /league/i.test(details || "");
}

function hz(v) {
  v = (v === undefined || v === null) ? "" : String(v).trim();
  return (v === "" || v === "0" || v === "0.00") ? "" : v;
}

function toNum(v) {
  var n = Number(String(v === undefined ? "" : v).trim());
  return isFinite(n) ? n : NaN;
}

function clean(h) {
  return String(h === undefined ? "" : h).trim().replace(/:$/, "");
}

function dateFromMatchId(id) {
  var m = String(id || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseCSV(text) {
  var lines = text.trim().split(/\r?\n/);
  var out = [];
  for (var i = 0; i < lines.length; i++) out.push(lines[i].split(","));
  return out;
}

var tbody  = document.getElementById("tableBody");
var select = document.getElementById("matchSelect");
var status = document.getElementById("status");

/* ===== RUNNING LEAGUE TOTALS ===== */
var runningTotals = {};

function resetRunningTotals() {
  runningTotals = {};
}

function runningLeagueAvg(details, player, score) {
  if (!isLeague(details)) return "";
  if (!player || player === "A N Other") return "";

  if (!runningTotals[player]) {
    runningTotals[player] = { games: 0, total: 0 };
  }

  var s = toNum(score);
  if (isFinite(s)) {
    runningTotals[player].games += 1;
    runningTotals[player].total += s;
  }

  if (runningTotals[player].games === 0) return "";

  var avg = (runningTotals[player].total / runningTotals[player].games).toFixed(3);
  return avg.replace(/\.?0+$/, "");
}

fetch("match_results.csv", { cache: "no-store" })
  .then(function (r) {
    if (!r.ok) throw new Error("CSV not found");
    return r.text();
  })
  .then(function (text) {

    var grid = parseCSV(text);

    /* ---- locate header ---- */
    var headerIndex = -1;
    for (var i = 0; i < grid.length; i++) {
      for (var j = 0; j < grid[i].length; j++) {
        if (clean(grid[i][j]) === "Match ID") { headerIndex = i; break; }
      }
      if (headerIndex !== -1) break;
    }
    if (headerIndex === -1) throw new Error("Header row not found");

    var headers = [];
    for (i = 0; i < grid[headerIndex].length; i++) headers.push(clean(grid[headerIndex][i]));
    var rows = grid.slice(headerIndex + 1);

    /* ---- normalise rows ---- */
    var data = [];
    for (i = 0; i < rows.length; i++) {
      var o = {};
      for (j = 0; j < headers.length; j++) o[headers[j]] = (rows[i][j] || "").trim();
      if (!o["Match ID"] || !o["Team Player"]) continue;

      data.push({
        matchId:  o["Match ID"],
        details:  o["Match Details"],
        homeAway: o["Home or Away"],
        player:   o["Team Player"],
        score:    o["Total Score"]
      });
    }

    /* ---- group by match ---- */
    var matchRows = {};
    for (i = 0; i < data.length; i++) {
      if (!matchRows[data[i].matchId]) matchRows[data[i].matchId] = [];
      matchRows[data[i].matchId].push(data[i]);
    }

    /* ---- chronological order for calculations ---- */
    var matchIds = [];
    for (var k in matchRows) matchIds.push(k);

    matchIds.sort(function (a, b) {
      var da = dateFromMatchId(a);
      var db = dateFromMatchId(b);
      if (!da && !db) return 0;
      if (!da) return -1;
      if (!db) return 1;
      return da - db;
    });

    /* ---- dropdown newest first ---- */
    while (select.options.length > 1) select.remove(1);
    for (i = matchIds.length - 1; i >= 0; i--) {
      var opt = document.createElement("option");
      opt.value = matchIds[i];
      opt.textContent = matchIds[i];
      select.appendChild(opt);
    }

    function rowHtml(r, position, avg) {
      var scoreNum = toNum(r.score);
      var scoreCell = isFinite(scoreNum) ? scoreNum : (r.player === "A N Other" ? "" : "Away");

      return "<tr>" +
        "<td>" + r.matchId + "</td>" +
        "<td>" + (r.details || "") + "</td>" +
        "<td>" + (r.homeAway || "") + "</td>" +
        "<td>" + r.player + "</td>" +
        "<td>" + scoreCell + "</td>" +
        "<td>" + (position || "") + "</td>" +
        "<td>" + avg + "</td>" +
      "</tr>";
    }

function render(selectedMatch) {
  resetRunningTotals();
  tbody.innerHTML = "";

  var rendered = [];

  // --- process matches in chronological order (oldest → newest)
  for (var i = 0; i < matchIds.length; i++) {
    var matchId = matchIds[i];
    if (selectedMatch && matchId !== selectedMatch) continue;

    var rows = matchRows[matchId];

    // --- FIRST: calculate match positions (score high → low)
    var played = [];
    for (var j = 0; j < rows.length; j++) {
      var s = toNum(rows[j].score);
      if (isFinite(s)) played.push({ idx: j, score: s });
    }
    played.sort(function (a, b) { return b.score - a.score; });
    for (j = 0; j < played.length; j++) {
      rows[played[j].idx]._pos = j + 1;
    }

    // --- SECOND: update running league totals (once per row)
    for (j = 0; j < rows.length; j++) {
      runningLeagueAvg(rows[j].details, rows[j].player, rows[j].score);
    }

    // --- THIRD: compute league avg ONCE for this match
    var leagueAvgByPlayer = {};
    for (var p in runningTotals) {
      var t = runningTotals[p];
      leagueAvgByPlayer[p] =
        t.games ? (t.total / t.games).toFixed(3).replace(/\.?0+$/, "") : "";
    }

    // --- FOURTH: render rows (A N Other forced last)
    var normal = [], anOther = null;
    for (j = 0; j < rows.length; j++) {
      if (rows[j].player === "A N Other") {
        anOther = rows[j];
      } else {
        normal.push(rows[j]);
      }
    }
    if (anOther) normal.push(anOther);

    for (j = 0; j < normal.length; j++) {
      var r = normal[j];
      var scoreNum = toNum(r.score);

      var scoreCell =
        isFinite(scoreNum)
          ? scoreNum
          : (r.player === "A N Other" ? "" : "Away");

      var avg =
        leagueAvgByPlayer[r.player] || "";

      rendered.push(
        "<tr>" +
          "<td>" + r.matchId + "</td>" +
          "<td>" + (r.details || "") + "</td>" +
          "<td>" + (r.homeAway || "") + "</td>" +
          "<td>" + r.player + "</td>" +
          "<td>" + scoreCell + "</td>" +
          "<td>" + (r._pos || "") + "</td>" +
          "<td>" + avg + "</td>" +
        "</tr>"
      );
    }
  }

  // --- newest match first in display
  for (i = rendered.length - 1; i >= 0; i--) {
    tbody.insertAdjacentHTML("beforeend", rendered[i]);
  }
}

  })
  .catch(function (e) {
    status.style.color = "red";
    status.textContent = e.message;
  });
