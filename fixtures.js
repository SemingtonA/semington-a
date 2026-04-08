// fixtures.js
// GUARANTEED BASELINE for Fixtures_Web.csv
// Shows ALL fixtures for the season
// Uses Points columns for score and formats halves as fractions

function parseCSV(text) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.split(","));
}

// Convert decimals to halves: 1.5 -> "1 1/2", 0.5 -> "1/2"
function formatHalf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const whole = Math.floor(n);
  const frac = n - whole;
  if (Math.abs(frac - 0.5) < 0.001) {
    return whole > 0 ? `${whole} 1/2` : `1/2`;
  }
  return String(n);
}

const tbody = document.getElementById("tableBody");
const status = document.getElementById("status");

fetch("Fixtures_Web.csv", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error("Fixtures_Web.csv not found");
    return r.text();
  })
  .then(text => {
    const grid = parseCSV(text);

    // ✅ YOUR FILE: header is ALWAYS on row index 3
    const HEADER_ROW_INDEX = 3;
    const DATA_START_INDEX = 4;

    const rows = grid.slice(DATA_START_INDEX);

    const fixtures = rows
      .filter(r => r[0] && r[0].includes("-")) // keep rows with a date like 29-Aug-25
      .map(r => {
        const date = r[0];
        const day = r[1];
        const home = r[2];
        const away = r[8];

        const homePts = r[4];
        const awayPts = r[6];

        const points =
          homePts && awayPts
            ? `${formatHalf(homePts)}-${formatHalf(awayPts)}`
            : "";

        return {
          date,
          day,
          fixture: `${home} vs ${away}`,
          points,
          venue: r[9] || "",
          alley: r[10] || "",
          competition: r[14] || ""
        };
      });

    tbody.innerHTML = fixtures.map(x => `
      <tr>
        <td>${x.date}</td>
        <td>${x.day}</td>
        <td>${x.fixture}</td>
        <td>${x.points}</td>
        <td>${x.venue}</td>
        <td>${x.alley}</td>
        <td>${x.competition}</td>
      </tr>
    `).join("");

    status.textContent = `Loaded ${fixtures.length} fixtures for the season.`;
  })
  .catch(e => {
    status.style.color = "red";
    status.textContent = e.message;
  });