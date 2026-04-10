// fixtures.js
// Robust loader for fixtures_web.csv
// Shows ALL fixtures and ignores header rows safely

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

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("tableBody");
  const status = document.getElementById("status");

  if (!tbody || !status) {
    console.error("Missing table body or status element");
    return;
  }

  fetch("fixtures_web.csv", { cache: "no-store" })
    .then(r => {
      if (!r.ok) throw new Error("fixtures_web.csv not found");
      return r.text();
    })
    .then(text => {
      const grid = parseCSV(text);

      const fixtures = grid
        // ✅ only rows that start with a date like 29-Aug-25
        .filter(r => r[0] && /\d{2}-[A-Za-z]{3}-\d{2}/.test(r[0]))
        .map(r => {
          const home = r[2];
          const away = r[8];
          const homePts = r[4];
          const awayPts = r[6];
          const points =
            homePts && awayPts
              ? `${formatHalf(homePts)}-${formatHalf(awayPts)}`
              : "";

          return `
            <tr>
              <td>${r[0]}</td>
              <td>${r[1]}</td>
              <td>${home} vs ${away}</td>
              <td class="points">${points}</td>
              <td>${r[9] || ""}</td>
              <td>${r[10] || ""}</td>
              <td>${r[14] || ""}</td>
            </tr>
          `;
        });

      tbody.innerHTML = fixtures.join("");
      status.textContent = `Loaded ${fixtures.length} fixtures for the season.`;
    })
    .catch(e => {
      status.style.color = "red";
      status.textContent = e.message;
      console.error(e);
    });
});
