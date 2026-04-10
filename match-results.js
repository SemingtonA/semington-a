// match-results.js — FULL FEATURE VERSION (NO ARROW FUNCTIONS, NO BACKTICKS)
// Works with [match-results.html](https://onedrive.live.com/?id=eb81ddb5-44a8-4e1f-99af-da41307bd765&cid=c205089414b2510e&web=1&EntityRepresentationId=3fcdf7ab-1e1b-4a23-a3ff-2e3c6283441e) and [match_results.csv](https://onedrive.live.com/personal/c205089414b2510e/_layouts/15/doc.aspx?resid=c8343639-c96e-455f-ab6e-144d0a6d5ef7&cid=c205089414b2510e&EntityRepresentationId=47799a8a-eea6-43b0-b720-b1678bfdfe09). [1](https://onedrive.live.com/?id=9a101dda-8a03-47c0-8363-991291015ec1&cid=c205089414b2510e&web=1)[2](https://onedrive.live.com/personal/c205089414b2510e/_layouts/15/doc.aspx?resid=c8343639-c96e-455f-ab6e-144d0a6d5ef7&cid=c205089414b2510e)

function isLeague(details) {
  return /league/i.test(details || "");
}

function hz(v) {
  v = (v === undefined || v === null) ? "" : String(v);
  v = v.trim();
  return (v === "" || v === "0" || v === "0.00") ? "" : v;
}

function toNum(v) {
  var n = Number(String(v === undefined ? "" : v).trim());
  return isFinite(n) ? n : NaN;
}

function pound(v) {
  var t = hz(v);
  return t ? ("£" + t) : "";
}

function clean(h) {
  return String(h === undefined ? "" : h).trim().replace(/:$/, "");
}

// supports 5/9/2025 and 05/09/2025 and 19/3/2026
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

function moveANOtherLast(list) {
  var idx = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].player === "A N Other") { idx = i; break; }
  }
  if (idx !== -1) {
    var x = list.splice(idx, 1)[0];
    list.push(x);
  }
  return list;
}

var tbody  = document.getElementById("tableBody");
var select = document.getElementById("matchSelect");
var status = document.getElementById("status");

fetch(new URL("match_results.csv", window.location.href).toString(), { cache: "no-store" })
  .then(function (r) {
    if (!r.ok) throw new Error("CSV not found");
    return r.text();
  })
  .then(function (text) {

    var grid = parseCSV(text);

    // find header row containing "Match ID"
    var headerIndex = -1;
    for (var i = 0; i < grid.length; i++) {
      for (var j = 0; j < grid[i].length; j++) {
        if (clean(grid[i][j]) === "Match ID") { headerIndex = i; break; }
      }
      if (headerIndex !== -1) break;
    }
    if (headerIndex === -1) throw new Error('Header row not found (expected "Match ID")');

    var headers = [];
    for (i = 0; i < grid[headerIndex].length; i++) headers.push(clean(grid[headerIndex][i]));
    var rows = grid.slice(headerIndex + 1);

    // normalized data rows
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
        top:      o["Top Score"],
        avg:      o["League Averages"] || o["League Avg"] || o["League Average"] || ""
      });
    }
// RUNNING league averages, match by match
var runningTotals = {}; // player -> {games,total}

// reset totals helper (used when re-rendering)
function resetRunningTotals() {
  runningTotals = {};
}

function runningLeagueAvg(details, player, score) {
  if (!isLeague(details)) return "";

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



    // roster = all players who ever appear (exclude placeholder "Away")
    var rosterMap = {};
    for (i = 0; i < data.length; i++) {
      var nm = data[i].player;
      if (nm && nm !== "Away") rosterMap[nm] = true;
    }
    var roster = [];
    for (var k in rosterMap) roster.push(k);
    roster.sort(function (a, b) { return a.localeCompare(b); });

    // matchRows: matchId -> array (preserve CSV order within match)
    // byPlayer: matchId -> {player: row}
    var matchRows = {};
    var byPlayer = {};
    for (i = 0; i < data.length; i++) {
      var rr = data[i];
      if (!matchRows[rr.matchId]) matchRows[rr.matchId] = [];
      matchRows[rr.matchId].push(rr);

      if (!byPlayer[rr.matchId]) byPlayer[rr.matchId] = {};
      byPlayer[rr.matchId][rr.player] = rr;
    }

    // order match IDs newest first
    var matchIds = [];
    for (k in matchRows) matchIds.push(k);
    matchIds.sort(function (a, b) {
      var da = dateFromMatchId(a);
      var db = dateFromMatchId(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });

    // populate dropdown in that order
    while (select.options.length > 1) select.remove(1);
    for (i = 0; i < matchIds.length; i++) {
      var opt = document.createElement("option");
      opt.value = matchIds[i];
      opt.textContent = matchIds[i];
      select.appendChild(opt);
    }

    function rowHtml(r) {
      var avg = avgText(r.details, r.player, r.avg);

      var scoreCell = hz(r.score);
      if (r.absent) scoreCell = (r.player === "A N Other") ? "" : "Away";

      return "<tr>" +
        "<td>" + (r.matchId || "") + "</td>" +
        "<td>" + (r.details || "") + "</td>" +
        "<td>" + (r.homeAway || "") + "</td>" +
        "<td>" + (r.player || "") + "</td>" +
        "<td>" + scoreCell + "</td>" +
        "<td>" + (r.position || "") + "</td>" +
        "<td>" + hz(r.ducks) + "</td>" +
        "<td>" + hz(r.spares) + "</td>" +
        "<td>" + pound(r.legsWon) + "</td>" +
        "<td>" + pound(r.top) + "</td>" +
        "<td>" + avg + "</td>" +
      "</tr>";
    }

    function render(matchId) {
      tbody.innerHTML = "";

      // ALL MATCHES: grouped by match, newest first (no roster expansion here)
      if (!matchId) {
        var html = "";
        for (i = 0; i < matchIds.length; i++) {
          var id = matchIds[i];
          var block = [];
          var raw = matchRows[id];

          for (j = 0; j < raw.length; j++) {
            var x = raw[j];
            block.push({
              matchId: x.matchId, details: x.details, homeAway: x.homeAway, player: x.player,
              score: x.score, ducks: x.ducks, spares: x.spares, legsWon: x.legsWon, top: x.top, avg: x.avg,
              absent: false, position: ""
            });
          }

          moveANOtherLast(block);
          for (j = 0; j < block.length; j++) html += rowHtml(block[j]);
        }
        tbody.innerHTML = html;
        return;
      }

      // SINGLE MATCH: expand roster so all players appear
      var map = byPlayer[matchId];
      if (!map) return;

      // meta from any row
      var firstRow = null;
      for (k in map) { firstRow = map[k]; break; }
      if (!firstRow) firstRow = { details: "", homeAway: "" };

      var expanded = [];
      for (i = 0; i < roster.length; i++) {
        var name = roster[i];
        var ex = map[name];

        if (ex) {
          expanded.push({
            matchId: ex.matchId, details: ex.details, homeAway: ex.homeAway, player: ex.player,
            score: ex.score, ducks: ex.ducks, spares: ex.spares, legsWon: ex.legsWon, top: ex.top, avg: ex.avg,
            absent: false, position: ""
          });
        } else {
          expanded.push({
            matchId: matchId,
            details: firstRow.details,
            homeAway: firstRow.homeAway,
            player: name,
            score: "", ducks: "", spares: "", legsWon: "", top: "", avg: "",
            absent: true, position: ""
          });
        }
      }

      // include A N Other only if present
      if (map["A N Other"]) {
        var ano = map["A N Other"];
        expanded.push({
          matchId: ano.matchId, details: ano.details, homeAway: ano.homeAway, player: ano.player,
          score: ano.score, ducks: ano.ducks, spares: ano.spares, legsWon: ano.legsWon, top: ano.top, avg: ano.avg,
          absent: false, position: ""
        });
      }

      // Sort by highest avg -> lowest avg, A N Other bottom
      expanded.sort(function (a, b) {
        if (a.player === "A N Other") return 1;
        if (b.player === "A N Other") return -1;

        var aA = toNum(avgText(a.details, a.player, a.avg));
        var bA = toNum(avgText(b.details, b.player, b.avg));
        var aHas = isFinite(aA), bHas = isFinite(bA);

        if (aHas && bHas && bA !== aA) return bA - aA;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;

        var as = toNum(a.score), bs = toNum(b.score);
        if (isFinite(as) && isFinite(bs) && bs !== as) return bs - as;

        return String(a.player).localeCompare(String(b.player));
      });

      moveANOtherLast(expanded);

      // Position: only played players (numeric score > 0), highest score = 1
      var played = [];
      for (i = 0; i < expanded.length; i++) {
        var sc = toNum(expanded[i].score);
        if (expanded[i].player !== "A N Other" && isFinite(sc) && sc > 0) played.push(expanded[i]);
      }
      played.sort(function (a, b) { return toNum(b.score) - toNum(a.score); });
      for (i = 0; i < played.length; i++) played[i].position = String(i + 1);

      // Ensure Away/non-players + A N Other stay blank
      for (i = 0; i < expanded.length; i++) {
        var s1 = toNum(expanded[i].score);
        if (!(expanded[i].player !== "A N Other" && isFinite(s1) && s1 > 0)) expanded[i].position = "";
      }

      var out = "";
      for (i = 0; i < expanded.length; i++) out += rowHtml(expanded[i]);
      tbody.innerHTML = out;
    }

    status.textContent = "Loaded " + data.length + " rows. Matches: " + matchIds.length + ".";
    render(select.value || "");
    select.addEventListener("change", function () { render(select.value); });

  })
  .catch(function (e) {
    status.style.color = "red";
    status.textContent = e.message;
  });

