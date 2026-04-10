// match-results.js — FULL FEATURE VERSION (SAFE RE-ADAPT)
// Original behaviour preserved
// League Avg is now a RUNNING league average up to the selected match
// All Matches view shows the running avg at each match point in time
// Sorting within each match: by avg ONLY (high→low), A N Other always last

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

// stable sort by avg only, A N Other always last.
// If neither has avg (or equal), keep original order.
function sortByAvgOnlyStable(list) {
  var copy = [];
  for (var i = 0; i < list.length; i++) {
    copy.push({ idx: i, item: list[i] });
  }

  copy.sort(function (A, B) {
    var a = A.item;
    var b = B.item;

    if (a.player === "A N Other") return 1;
    if (b.player === "A N Other") return -1;

    var aA = toNum(a.avg);
    var bA = toNum(b.avg);

    var aHas = isFinite(aA);
    var bHas = isFinite(bA);

    if (aHas && bHas && bA !== aA) return bA - aA;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;

    // keep original order
    return A.idx - B.idx;
  });

  var out = [];
  for (i = 0; i < copy.length; i++) out.push(copy[i].item);
  return out;
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
        avg:      "" // computed in render()
      });
    }

    // roster = all players who ever appear (exclude placeholder "Away")
    // ensure A N Other always exists for dropdown view
    var rosterMap = {};
    for (i = 0; i < data.length; i++) {
      var nm = data[i].player;
      if (nm && nm !== "Away") rosterMap[nm] = true;
    }
    rosterMap["A N Other"] = true;

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

    // order match IDs newest first (keep your original dropdown behaviour)
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

    // populate dropdown in newest-first order (unchanged)
    while (select.options.length > 1) select.remove(1);
    for (i = 0; i < matchIds.length; i++) {
      var opt = document.createElement("option");
      opt.value = matchIds[i];
      opt.textContent = matchIds[i];
      select.appendChild(opt);
    }

    // build league snapshots per match (running cumulative), oldest -> newest
    // snapshots[matchId][player] = avg after that match
    function buildLeagueSnapshots(stopAtMatchId) {
      var snapshots = {};
      var leagueStats = {}; // player -> {games,total}

      // walk oldest -> newest: since matchIds is newest-first, iterate backwards
      for (var mi = matchIds.length - 1; mi >= 0; mi--) {
        var mid = matchIds[mi];
        var raw = matchRows[mid];

        // update stats with THIS match (league only)
        for (var r = 0; r < raw.length; r++) {
          var row = raw[r];
          if (!isLeague(row.details)) continue;
      
          var sc = toNum(row.score);
          if (!isFinite(sc)) continue;

          if (!leagueStats[row.player]) leagueStats[row.player] = { games: 0, total: 0 };
          leagueStats[row.player].games += 1;
          leagueStats[row.player].total += sc;
        }

        // snapshot after this match
        var snap = {};
        for (var p in leagueStats) {
          var st = leagueStats[p];
          snap[p] = st.games ? (st.total / st.games).toFixed(3).replace(/\.?0+$/, "") : "";
        }
        // NOTE: A N Other avg shown if they exist in stats (normally blank unless they played in league & you decide to count them)
        // we keep A N Other avg blank by default unless you ever choose to track it separately
        if (snap["A N Other"] === undefined) snap["A N Other"] = "";

        snapshots[mid] = snap;

        if (stopAtMatchId && mid === stopAtMatchId) break;
      }

      return snapshots;
    }

    function rowHtml(r) {
      var avg = r.avg;

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

      // build snapshots up to selection
      var snapshots = buildLeagueSnapshots(matchId || "");

      // ALL MATCHES: grouped by match, newest first (as original)
      if (!matchId) {
        var html = "";
        for (i = 0; i < matchIds.length; i++) {
          var id = matchIds[i];
          var raw = matchRows[id];
          var block = [];

          for (j = 0; j < raw.length; j++) {
            var x = raw[j];
            var snap = snapshots[id] || {};
            block.push({
              matchId: x.matchId,
              details: x.details,
              homeAway: x.homeAway,
              player: x.player,
              score: x.score,
              ducks: x.ducks,
              spares: x.spares,
              legsWon: x.legsWon,
              top: x.top,
              avg: (snap[x.player] || ""), // running avg at that match
              absent: false,
              position: ""
            });
          }

          // sort within match by avg only (high→low), A N Other last
          var sortedBlock = sortByAvgOnlyStable(block);
          for (j = 0; j < sortedBlock.length; j++) html += rowHtml(sortedBlock[j]);
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

      var snapForMatch = snapshots[matchId] || {};

      var expanded = [];
      for (i = 0; i < roster.length; i++) {
        var name = roster[i];
        var ex = map[name];

        if (ex) {
          expanded.push({
            matchId: ex.matchId,
            details: ex.details,
            homeAway: ex.homeAway,
            player: ex.player,
            score: ex.score,
            ducks: ex.ducks,
            spares: ex.spares,
            legsWon: ex.legsWon,
            top: ex.top,
            avg: (snapForMatch[name] || ""),
            absent: false,
            position: ""
          });
        } else {
          expanded.push({
            matchId: matchId,
            details: firstRow.details,
            homeAway: firstRow.homeAway,
            player: name,
            score: "",
            ducks: "",
            spares: "",
            legsWon: "",
            top: "",
            avg: (snapForMatch[name] || ""),
            absent: true,
            position: ""
          });
        }
      }

      // positions ONLY for league matches
      if (isLeague(firstRow.details)) {
        var played = [];
        for (i = 0; i < expanded.length; i++) {
          var sc = toNum(expanded[i].score);
          if (expanded[i].player !== "A N Other" && isFinite(sc) && sc > 0) played.push(expanded[i]);
        }
        played.sort(function (a, b) { return toNum(b.score) - toNum(a.score); });
        for (i = 0; i < played.length; i++) played[i].position = String(i + 1);
      }

      // Ensure Away/non-players + A N Other stay blank position
      for (i = 0; i < expanded.length; i++) {
        var s1 = toNum(expanded[i].score);
        if (!(expanded[i].player !== "A N Other" && isFinite(s1) && s1 > 0)) expanded[i].position = "";
      }

      // sort within match by avg only, A N Other last
      var sortedExpanded = sortByAvgOnlyStable(expanded);

      var out = "";
      for (i = 0; i < sortedExpanded.length; i++) out += rowHtml(sortedExpanded[i]);
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
