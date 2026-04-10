// match-results.js — FULL FEATURE VERSION (MINIMAL CHANGE)
// Original behaviour preserved; League Avg now calculated up to selected match

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

    // find header row
    var headerIndex = -1;
    for (var i = 0; i < grid.length; i++) {
      for (var j = 0; j < grid[i].length; j++) {
        if (clean(grid[i][j]) === "Match ID") { headerIndex = i; break; }
      }
      if (headerIndex !== -1) break;
    }
    if (headerIndex === -1) throw new Error('Header row not found');

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
        top:      o["Top Score"],
        avg:      ""
      });
    }

    var matchRows = {};
    var byPlayer = {};
    for (i = 0; i < data.length; i++) {
      var rr = data[i];
      if (!matchRows[rr.matchId]) matchRows[rr.matchId] = [];
      matchRows[rr.matchId].push(rr);

      if (!byPlayer[rr.matchId]) byPlayer[rr.matchId] = {};
      byPlayer[rr.matchId][rr.player] = rr;
    }

    // match IDs newest first (unchanged)
    var matchIds = [];
    for (var k in matchRows) matchIds.push(k);
    matchIds.sort(function (a, b) {
      var da = dateFromMatchId(a);
      var db = dateFromMatchId(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });

    while (select.options.length > 1) select.remove(1);
    for (i = 0; i < matchIds.length; i++) {
      var opt = document.createElement("option");
      opt.value = matchIds[i];
      opt.textContent = matchIds[i];
      select.appendChild(opt);
    }

    function rowHtml(r) {
      var avg = r.avg;
      var scoreCell = hz(r.score);
      if (r.absent) scoreCell = (r.player === "A N Other") ? "" : "Away";

      return "<tr>" +
        "<td>" + r.matchId + "</td>" +
        "<td>" + r.details + "</td>" +
        "<td>" + r.homeAway + "</td>" +
        "<td>" + r.player + "</td>" +
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

      // ✅ REBUILD league averages UP TO selected match
      var leagueStats = {};

      // iterate oldest → selected match
      for (var mi = matchIds.length - 1; mi >= 0; mi--) {
        var mid = matchIds[mi];
        var block = matchRows[mid];

        for (var r = 0; r < block.length; r++) {
          var row = block[r];
          if (!isLeague(row.details)) continue;

          var sc = toNum(row.score);
          if (!isFinite(sc)) continue;

          if (!leagueStats[row.player]) {
            leagueStats[row.player] = { games: 0, total: 0 };
          }
          leagueStats[row.player].games += 1;
          leagueStats[row.player].total += sc;
        }

        if (mid === matchId) break;
      }

      function leagueAvg(player) {
        var p = leagueStats[player];
        if (!p || p.games === 0) return "";
        return (p.total / p.games).toFixed(3).replace(/\.?0+$/, "");
      }

      tbody.innerHTML = "";

      if (!matchId) {
        var html = "";
        for (i = 0; i < matchIds.length; i++) {
          var id = matchIds[i];
          var raw = matchRows[id];
          var block = [];

          for (j = 0; j < raw.length; j++) {
            var x = raw[j];
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
              avg: leagueAvg(x.player),
              absent: false,
              position: ""
            });
          }

          moveANOtherLast(block);
          for (j = 0; j < block.length; j++) html += rowHtml(block[j]);
        }
        tbody.innerHTML = html;
        return;
      }

      var map = byPlayer[matchId];
      if (!map) return;

      var firstRow = null;
      for (k in map) { firstRow = map[k]; break; }
      if (!firstRow) firstRow = { details: "", homeAway: "" };

      var expanded = [];

      for (i = 0; i < data.length; i++) {
        if (data[i].player && data[i].player !== "Away") break;
      }

      var rosterMap = {};
      for (i = 0; i < data.length; i++) {
        if (data[i].player && data[i].player !== "Away") rosterMap[data[i].player] = true;
      }
      var roster = [];
      for (k in rosterMap) roster.push(k);
      roster.sort();

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
            avg: leagueAvg(ex.player),
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
            avg: leagueAvg(name),
            absent: true,
            position: ""
          });
        }
      }

      if (map["A N Other"]) {
        var ano = map["A N Other"];
        expanded.push({
          matchId: ano.matchId,
          details: ano.details,
          homeAway: ano.homeAway,
          player: ano.player,
          score: ano.score,
          ducks: ano.ducks,
          spares: ano.spares,
          legsWon: ano.legsWon,
          top: ano.top,
          avg: leagueAvg(ano.player),
          absent: false,
          position: ""
        });
      }

      // positions (league only)
      if (isLeague(firstRow.details)) {
        var played = [];
        for (i = 0; i < expanded.length; i++) {
          var sc2 = toNum(expanded[i].score);
          if (expanded[i].player !== "A N Other" && isFinite(sc2) && sc2 > 0) {
            played.push(expanded[i]);
          }
        }
        played.sort(function (a, b) { return b.score - a.score; });
        for (i = 0; i < played.length; i++) played[i].position = String(i + 1);
      }

      moveANOtherLast(expanded);
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
