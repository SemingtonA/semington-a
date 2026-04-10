function parseCSV(text) {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).map(function (line) {
    return line.split(",");
  });
}

var tbody, status;

document.addEventListener("DOMContentLoaded", function () {
  tbody = document.getElementById("tableBody");
  status = document.getElementById("status");

  if (!tbody || !status) return;

  fetch("fixtures_web.csv", { cache: "no-store" })
    .then(function (r) { return r.text(); })
    .then(function (text) {
      var rows = parseCSV(text);
      var html = "";
      var count = 0;

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0] || r[0].indexOf("-") === -1) continue;

        html +=
          "<tr>" +
          "<td>" + r[0] + "</td>" +
          "<td>" + r[1] + "</td>" +
          "<td>" + r[2] + " vs " + r[8] + "</td>" +
          "<td>" + (r[4] && r[6] ? r[4] + "-" + r[6] : "") + "</td>" +
          "<td>" + (r[9] || "") + "</td>" +
          "<td>" + (r[10] || "") + "</td>" +
          "<td>" + (r[14] || "") + "</td>" +
          "</tr>";

        count++;
      }

      tbody.innerHTML = html;
      status.textContent = "Loaded " + count + " fixtures.";
    });
});
