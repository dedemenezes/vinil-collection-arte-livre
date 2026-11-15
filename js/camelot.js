(() => {
  // Mixed In Key Camelot wheel. Canonical keys match this collection (sharps).
  const PAIRS = [
    ["1A", "G# minor"],
    ["1B", "B major"],
    ["2A", "D# minor"],
    ["2B", "F# major"],
    ["3A", "A# minor"],
    ["3B", "C# major"],
    ["4A", "F minor"],
    ["4B", "G# major"],
    ["5A", "C minor"],
    ["5B", "D# major"],
    ["6A", "G minor"],
    ["6B", "A# major"],
    ["7A", "D minor"],
    ["7B", "F major"],
    ["8A", "A minor"],
    ["8B", "C major"],
    ["9A", "E minor"],
    ["9B", "G major"],
    ["10A", "B minor"],
    ["10B", "D major"],
    ["11A", "F# minor"],
    ["11B", "A major"],
    ["12A", "C# minor"],
    ["12B", "E major"],
  ];

  const ALIASES = {
    "ab minor": "G# minor",
    "g# minor": "G# minor",
    "eb minor": "D# minor",
    "d# minor": "D# minor",
    "bb minor": "A# minor",
    "a# minor": "A# minor",
    "db major": "C# major",
    "c# major": "C# major",
    "ab major": "G# major",
    "g# major": "G# major",
    "eb major": "D# major",
    "d# major": "D# major",
    "bb major": "A# major",
    "a# major": "A# major",
    "db minor": "C# minor",
    "c# minor": "C# minor",
    "gb major": "F# major",
    "f# major": "F# major",
    "gb minor": "F# minor",
    "f# minor": "F# minor",
  };

  const camelotToKey = Object.fromEntries(PAIRS);
  const keyToCamelot = Object.fromEntries(PAIRS.map(([c, k]) => [k, c]));

  function normalizeKey(value) {
    if (!value) return "";
    let text = String(value).trim().replace(/\s+/g, " ");
    if (!text) return "";

    // Compact forms: Am, Amaj, F#m, Bbmin
    const compact = text.match(/^([A-G](?:#|b)?)(m|min|minor|maj|major)?$/i);
    if (compact) {
      const note = compact[1];
      const modeRaw = (compact[2] || "maj").toLowerCase();
      const minor = modeRaw === "m" || modeRaw === "min" || modeRaw === "minor";
      text = `${note} ${minor ? "minor" : "major"}`;
    }

    text = text
      .replace(/\bmaj\b/i, "major")
      .replace(/\bmin\b/i, "minor");

    const lower = text.toLowerCase();
    if (ALIASES[lower]) return ALIASES[lower];

    const match = lower.match(/^([a-g](?:#|b)?)\s+(major|minor)$/);
    if (!match) return text;

    const note = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const mode = match[2];
    const canonical = `${note} ${mode}`;
    return ALIASES[canonical.toLowerCase()] || canonical;
  }

  function normalizeCamelot(value) {
    if (!value) return "";
    const match = String(value).trim().toUpperCase().match(/^(\d{1,2})\s*([AB])$/);
    if (!match) return String(value).trim().toUpperCase();
    const n = Number(match[1]);
    if (n < 1 || n > 12) return String(value).trim().toUpperCase();
    return `${n}${match[2]}`;
  }

  function keyFromCamelot(camelot) {
    return camelotToKey[normalizeCamelot(camelot)] || "";
  }

  function camelotFromKey(key) {
    const canonical = normalizeKey(key);
    return keyToCamelot[canonical] || "";
  }

  window.ArteLivreCamelot = {
    normalizeKey,
    normalizeCamelot,
    keyFromCamelot,
    camelotFromKey,
    pairs: PAIRS,
  };
})();
