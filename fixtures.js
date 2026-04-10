function parseCSV(text) {
  var lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  return lines.map(function (line) {
    return line.split(",");
  });
}

var tbody = document.getElementById("tableBody");
var status = document.getElementById("status");

fetch("fixtures_web.csv", { cache: "no-store" })
  .then(function (r) {
    if (!r.ok) throw new Error("CSV not found");
    return r.text();
  })
  .then(function (text) {
    var grid = parseCSV(text);

    // ✅ Skip header rows (THIS IS THE KEY)
    var rows = grid.slice(2);

    var html = "";
    var count = 0;

    rows.forEach(function (r) {
      if (!r[0] || r[0].indexOf("-") === -1) return;

      html +=
        "<tr>" +
        "<td>" + r[0] + "</td>" +
        "<td>" + r[1] + "</td>" +
        "<td>" + r[2] + " vs " + r[8] + "</td>" +
        "<td class='points'>" + (r[4] && r[6] ? r[4] + "-" + r[6] : "") + "</td>" +
        "<td>" + (r[9] || "") + "</td>" +
        "<td>" + (r[10] || "") + "</td>" +
        "<td>" + (r[14] || "") + "</td>" +
        "</tr>";

      count++;
    });

    tbody.innerHTML = html;
    status.textContent = "Loaded " + count + " fixtures.";
  })
  .catch(function (e) {
    status.style.color = "red";
    status.textContent = e.message;
    console.error(e);
  });
``
