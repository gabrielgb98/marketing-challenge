import assert from "node:assert/strict";
import { parseCSV, importRows, headers, csvCell } from "../lib/classrush";
const csv = headers.join(",") + '\r\n"Pregunta, con coma",a,b,c,d,B,35,1000,sí';
assert.equal(importRows(parseCSV(csv))[0].q.correct, 1);
assert.equal(importRows(parseCSV(csv))[0].errors.length, 0);
assert.equal(parseCSV('a,b\n"uno\ndos","tres"')[1][0], "uno\ndos");
assert.throws(() => parseCSV('"sin cierre'));
assert.throws(() => importRows([["mal"]]));
assert.ok(
  importRows([headers, ["?", "a", "b", "c", "d", "E", "0", "-1", "talvez"]])[0]
    .errors.length >= 4,
);
assert.equal(csvCell('=HYPERLINK("mal")'), '"\'=HYPERLINK(""mal"")"');
console.log(
  "PASS: import validation, quoted CSV, multiline fields, formula injection protection",
);

assert.ok(importRows([headers, ["Pregunta", "A", "B", "C", "D", "", "35", "1000", "no"]])[0].errors.length);
assert.ok(importRows([headers, ["Pregunta", "A", "B", "C", "D", "AB", "35", "1000", "no"]])[0].errors.length);
