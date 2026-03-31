const fs = require('fs');
const path = require('path');

/** "00:01:23.456" or "01:23.456" → whole seconds */
function vttTimeToSeconds(vttTime) {
  const t = vttTime.trim();
  const parts = t.split(':');
  let sec = 0;
  if (parts.length === 3) {
    sec =
      parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseFloat(parts[2]);
  } else if (parts.length === 2) {
    sec = parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  } else {
    sec = parseFloat(t);
  }
  return Math.floor(sec);
}

/** Whole seconds → readable "m:ss" (same minute style as 0:12) */
function formatSecondsToTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function parseVttToChunks(vtt) {
  const lines = vtt.split(/\r?\n/);
  const chunks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    if (trimmed === 'WEBVTT') {
      i++;
      continue;
    }

    if (trimmed === 'NOTE' || trimmed.startsWith('NOTE ')) {
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        i++;
      }
      continue;
    }

    // Optional cue index (digits only)
    if (/^\d+$/.test(trimmed)) {
      i++;
      continue;
    }

    if (trimmed.includes('-->')) {
      const [startPart, endPart] = trimmed.split('-->').map((s) => s.trim());
      const start = vttTimeToSeconds(startPart);
      const end = vttTimeToSeconds(endPart);
      i++;

      const textLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
      if (text) {
        chunks.push({
          start,
          end,
          timestamp: formatSecondsToTimestamp(start),
          text,
        });
      }
      continue;
    }

    // Unknown line (e.g. region settings) — skip
    i++;
  }

  return chunks;
}

// --- run ---

const baseDir = __dirname;
const inputFile = path.join(baseDir, '151857740.vtt');
const outputFile = path.join(baseDir, '151857740.json');

const vtt = fs.readFileSync(inputFile, 'utf-8');
const chunks = parseVttToChunks(vtt);

/** Hardcoded metadata for this VTT (expand later per file if needed) */
const meta = {
  id: 'video-151857740',
  title: 'Stitch Types and Yarn Usage',
  vimeoId: '151857740',
  category: 'Basics',
  vttFile: '/data/vtt/151857740.vtt',
};

const output = {
  ...meta,
  chunks,
};

fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
console.log(`Wrote ${chunks.length} chunks → ${outputFile}`);
