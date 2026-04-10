function parseCSV(text) {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).map(function (line) {
    return line.split(",");
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var tbody = document.getElementById("tableBody");
  var status = document.getElementById("status");

  if (!tbody || !status) {
    console.error("Missing #tableBody or #status in fixtures.html");
    return;
  }

  fetch("fixtures_web.csv", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("fixtures_web.csv not found");
      return r.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);
      var html = "";
      var count = 0;

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];

        // Only keep rows whose first column looks like a date e.g. 29-Aug-25
        if (!r[0] || !/^\d{2}-[A-Za-z]{3}-\d{2}$/.test(r[0])) continue;

        var points = (r[4] && r[6]) ? (r[4] + "-" + r[6]) : "";

        html +=
          "<tr>" +
          "<td>" + r[0] + "</td>" +
          "<td>" + r[1] + "</td>" +
          "<td>" + r[2] + " vs " + r[8] + "</td>" +
          "<td class='points'>" + points + "</td>" +
          "<td>" + (r[9] || "") + "</td>" +
          "<td>" + (r[10] || "") + "</td>" +
          "<td>" + (r[14] || "") + "</td>" +
          "</tr>";

        count++;
      }

      tbody.innerHTML = html;
      status.textContent = "Loaded " + count + " fixtures.";
    })
    .catch(function (e) {
      status.style.color = "red";
      status.textContent = e.message;
      console.error(e);
    });
});
