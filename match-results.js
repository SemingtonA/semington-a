// match-results.js — FINAL LOCKED VERSION
// Meets ALL requirements exactly as specified

function isLeague(details) {
  return /league/i.test(details || "");
}

function toNum(v) {
  var n = Number(String(v === undefined ? "" : v).trim());
  return isFinite(n) ? n : NaN;
}

// blank if 0 or empty
function blankZero(v) {
  var n = toNum(v);
  return isFinite(n) && n !== 0 ? n : "";
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
var leagueTotals = {};

function resetLeagueTotals() {
  leagueTotals = {};
}

function updateLeagueTotals(player, score) {
  if (!leagueTotals[player]) leagueTotals[player] = { games: 0, total: 0 };
  leagueTotals[player].games += 1;
  leagueTotals[player].total += score;
}

function leagueAvgSnapshot() {
  var snap = {};
  for (var p in leagueTotals) {
    var t = leagueTotals[p];
    snap[p] = t.games
      ? (t.total / t.games).toFixed(3).replace(/\.?0+$/, "")
      : "";
  }
  return snap;
}

fetch("match_results.csv", { cache: "no-store" })
  .then(function (r) {
    if (!r.ok) throw new Error("CSV not found");
    return r.text();
  })
  .then(function (text) {

    var grid = parseCSV(text);

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
        score:    o["Total Score"],
        ducks:    o["Ducks"],
        spares:   o["Spares"],
        legsWon:  o["Legs Won"],
        top:      o["Top Score"]
      });
    }

    var matchRows = {};
    for (i = 0; i < data.length; i++) {
      if (!matchRows[data[i].matchId]) matchRows[data[i].matchId] = [];
      matchRows[data[i].matchId].push(data[i]);
    }

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

    while (select.options.length > 1) select.remove(1);
    for (i = matchIds.length - 1; i >= 0; i--) {
      var opt = document.createElement("option");
      opt.value = matchIds[i];
      opt.textContent = matchIds[i];
      select.appendChild(opt);
    }

    function render(selectedMatch) {
      resetLeagueTotals();
      tbody.innerHTML = "";
      var out = [];

      for (i = 0; i < matchIds.length; i++) {
        var id = matchIds[i];
        if (selectedMatch && id !== selectedMatch) continue;

        var rows = matchRows[id];
        var isLeagueMatch = isLeague(rows[0].details);

        // --- positions ONLY for league matches
        if (isLeagueMatch) {
          var ranked = [];
          for (j = 0; j < rows.length; j++) {
            var sc = toNum(rows[j].score);
            if (isFinite(sc)) ranked.push({ idx: j, score: sc });
          }
          ranked.sort(function (a, b) { return b.score - a.score; });
          for (j = 0; j < ranked.length; j++) {
            rows[ranked[j].idx]._pos = j + 1;
          }
        }

        // --- update league totals
        if (isLeagueMatch) {
          for (j = 0; j < rows.length; j++) {
            var sc2 = toNum(rows[j].score);
            if (rows[j].player && rows[j].player !== "A N Other" && isFinite(sc2)) {
              updateLeagueTotals(rows[j].player, sc2);
            }
          }
        }

        var avgSnap = leagueAvgSnapshot();

        // --- render rows (A N Other last)
        var normal = [], anOther = null;
        for (j = 0; j < rows.length; j++) {
          if (rows[j].player === "A N Other") anOther = rows[j];
          else normal.push(rows[j]);
        }
        if (anOther) normal.push(anOther);

        for (j = 0; j < normal.length; j++) {
          var r = normal[j];
          var num = toNum(r.score);

          var scoreCell =
            isFinite(num) ? num : (r.player === "A N Other" ? "" : "Away");

          out.push(
            "<tr>" +
              "<td>" + r.matchId + "</td>" +
              "<td>" + (r.details || "") + "</td>" +
              "<td>" + (r.homeAway || "") + "</td>" +
              "<td>" + r.player + "</td>" +
              "<td>" + scoreCell + "</td>" +
              "<td>" + (r._pos || "") + "</td>" +
              "<td>" + blankZero(r.ducks) + "</td>" +
              "<td>" + blankZero(r.spares) + "</td>" +
              "<td>" + poundBlankZero(r.legsWon) + "</td>" +
              "<td>" + poundBlankZero(r.top) + "</td>" +
              function poundBlankZero(v) {
              var n = toNum(v);
              return isFinite(n) && n !== 0 ? "£" + n : "";
              }
              "<td>" + (avgSnap[r.player] || "") + "</td>" +
            "</tr>"
          );
        }
      }

      // newest match first
      for (i = out.length - 1; i >= 0; i--) {
        tbody.insertAdjacentHTML("beforeend", out[i]);
      }
    }

    status.textContent = "Loaded " + data.length + " rows.";
    render("");
    select.addEventListener("change", function () { render(select.value); });
  })
  .catch(function (e) {
    status.style.color = "red";
    status.textContent = e.message;
  });
