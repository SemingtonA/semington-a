// tocatch.js — League match dropdown (Cup excluded), match-by-match, cumulative-to-date
// Sorted by Avg desc. To Catch = pins needed to catch next player above (by Total Pins).
// ES5 only.

function trim(v){ return (v === undefined || v === null) ? "" : String(v).trim(); }
function toNum(v){ var n = Number(trim(v)); return isFinite(n) ? n : NaN; }

function parseCSV(text){
  var lines = text.trim().split(/\r?\n/);
  var out = [];
  for (var i = 0; i < lines.length; i++) out.push(lines[i].split(","));
  return out;
}

function cleanHeader(h){ return trim(h).replace(/:$/,"").replace(/\s+$/,""); }
function isLeague(details){ return /league/i.test(details || ""); }

// dd/mm/yyyy or d/m/yyyy at the start of Match ID
function dateFromMatchId(id){
  var m = trim(id).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(!m) return null;
  return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
}

var tbody  = document.getElementById("tableBody");
var status = document.getElementById("status");
var select = document.getElementById("matchSelect");

// visible marker to confirm the script is running
status.textContent = "Loading league matches…";

fetch("match_results.csv", { cache:"no-store" })
  .then(function(r){
    if(!r.ok) throw new Error("CSV not found");
    return r.text();
  })
  .then(function(text){

    var grid = parseCSV(text);

    // find header row containing "Match ID"
    var headerRow = -1;
    for(var i=0;i<grid.length;i++){
      for(var j=0;j<grid[i].length;j++){
        if(cleanHeader(grid[i][j]) === "Match ID"){ headerRow=i; break; }
      }
      if(headerRow!==-1) break;
    }
    if(headerRow<0) throw new Error("Header row not found");

    var headers = [];
    for(i=0;i<grid[headerRow].length;i++) headers.push(cleanHeader(grid[headerRow][i]));
    var rows = grid.slice(headerRow+1);

    // normalize league rows only (Cup excluded)
    var data = [];
    for(i=0;i<rows.length;i++){
      var o = {};
      for(j=0;j<headers.length;j++) o[headers[j]] = trim(rows[i][j]);

      if(!o["Match ID"] || !o["Team Player"]) continue;
      if(!isLeague(o["Match Details"])) continue; // Cup excluded
      if(o["Team Player"]==="Away" || o["Team Player"]==="A N Other") continue;

      data.push({
        matchId:o["Match ID"],
        player:o["Team Player"],
        score:o["Total Score"],
        avg:o["League Averages"] || o["League Avg"] || o["League Average"] || ""
      });
    }

    // roster + match map
    var rosterMap={}, matchMap={};
    for(i=0;i<data.length;i++){
      rosterMap[data[i].player]=true;
      if(!matchMap[data[i].matchId]) matchMap[data[i].matchId]=[];
      matchMap[data[i].matchId].push(data[i]);
    }
    var roster=[];
    for(var nm in rosterMap) roster.push(nm);
    roster.sort(function(a,b){ return a.localeCompare(b); });

    // match IDs sorted newest first
    var matchIds=[];
    for(var mid in matchMap) matchIds.push(mid);
    matchIds.sort(function(a,b){
      var da=dateFromMatchId(a), db=dateFromMatchId(b);
      if(!da && !db) return 0;
      if(!da) return 1;
      if(!db) return -1;
      return db-da;
    });

    // populate dropdown
    while(select.options.length>1) select.remove(1);
    for(i=0;i<matchIds.length;i++){
      var opt=document.createElement("option");
      opt.value=matchIds[i];
      opt.textContent=matchIds[i];
      select.appendChild(opt);
    }

    // build cumulative snapshots oldest->newest
    var matchIdsAsc = matchIds.slice().reverse();
    var pins={}, games={}, avgRef={}, snapshots={};

    for(i=0;i<matchIdsAsc.length;i++){
      var id = matchIdsAsc[i];
      var rowsForMatch = matchMap[id];
      var matchPins = {};

      for(j=0;j<rowsForMatch.length;j++){
        var rr=rowsForMatch[j];

        var av=toNum(rr.avg);
        if(isFinite(av)) avgRef[rr.player]=av;

        var sc=toNum(rr.score);
        if(isFinite(sc) && sc>0){
          if(!pins[rr.player]) pins[rr.player]=0;
          if(!games[rr.player]) games[rr.player]=0;
          pins[rr.player]+=sc;
          games[rr.player]+=1;
          matchPins[rr.player]=sc;
        }
      }

      // clone snapshot
      var snapPins={}, snapGames={}, snapAvg={}, snapMatchPins={}, p;
      for(p in pins) snapPins[p]=pins[p];
      for(p in games) snapGames[p]=games[p];
      for(p in avgRef) snapAvg[p]=avgRef[p];
      for(p in matchPins) snapMatchPins[p]=matchPins[p];

      snapshots[id]={ pins:snapPins, games:snapGames, avg:snapAvg, matchPins:snapMatchPins };
    }

    function renderForMatch(matchId){
      tbody.innerHTML = ""; // ✅ prevents "one long list"
      if(!matchId) matchId = matchIds[0];
      var snap = snapshots[matchId];
      if(!snap) return;

      var out=[];
      for(i=0;i<roster.length;i++){
        var pl=roster[i];
        var g=snap.games[pl] || 0;
        var tp=snap.pins[pl] || 0;
        var av2=snap.avg[pl];

        var matchPin = snap.matchPins.hasOwnProperty(pl) ? String(snap.matchPins[pl]) : "Away";
        var avgNum = (av2===undefined) ? NaN : Number(av2);

        var totalPinsNum = Math.round(tp);
        var totalPinsStr = (g===0) ? "" : String(totalPinsNum);
        var expectedStr  = (av2===undefined) ? "" : String(Math.round(g * av2));

        out.push({
          player:pl,
          matchPins:matchPin,
          games:g,
          avgNum:avgNum,
          avg:(av2===undefined)?"":Number(av2).toFixed(1),
          totalPinsNum: totalPinsNum,
          toCatch:""
        });
      }

      // sort by avg desc
      out.sort(function(a,b){
        var aa=isFinite(a.avgNum)?a.avgNum:-Infinity;
        var bb=isFinite(b.avgNum)?b.avgNum:-Infinity;
        if(bb!==aa) return bb-aa;
        return a.player.localeCompare(b.player);
      });

// To Catch = (AvgAbove − AvgMe) × GamesMe
for (i = 0; i < out.length; i++) {
  if (i === 0) {
    out[i].toCatch = "0";
  } else {
    var above = out[i - 1];
    var me = out[i];

    if (
      !isFinite(above.avgNum) ||
      !isFinite(me.avgNum) ||
      !isFinite(me.games)
    ) {
      out[i].toCatch = "";
    } else {
      var diff = (above.avgNum - me.avgNum) * me.games;
      diff = Math.round(diff);
      if (diff < 0) diff = 0;

      out[i].toCatch = String(diff);
    }
  }
}

      // render (7 columns)
      for(i=0;i<out.length;i++){
        var row=out[i];
      tbody.innerHTML +=
  "<tr>" +
    "<td>" + row.player + "</td>" +
    "<td>" + row.matchPins + "</td>" +
    "<td>" + row.games + "</td>" +
    "<td>" + row.avg + "</td>" +
    "<td>" + row.toCatch + "</td>" +
  "</tr>";
      }

      status.textContent="League match: "+matchId+" (Cup excluded; sorted by Avg).";
    }

    renderForMatch(select.value);
    select.addEventListener("change", function(){ renderForMatch(select.value); });

  })
  .catch(function(e){
    status.style.color="red";
    status.textContent=e.message;
  });

