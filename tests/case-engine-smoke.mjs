import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { CASE_DIFFICULTIES, CASE_THEMES, generateCaseStatement } from "../assets/js/case-templates.js";
import { calculateCaseSolution, gradeCase } from "../netlify/functions/lib/case-grader.mjs";

equal(CASE_THEMES.join(","), "dcf,lbo,merger-model");
equal(CASE_DIFFICULTIES.join(","), "easy,intermediate,advanced");

for (const theme of CASE_THEMES) {
  const statements = CASE_DIFFICULTIES.map((difficulty) => generateCaseStatement({ theme, difficulty, seed: 12345 }));
  deepStrictEqual(statements[0], generateCaseStatement({ theme, difficulty: "easy", seed: 12345 }));
  deepStrictEqual(statements[0].coreOutputIds, statements[1].coreOutputIds);
  deepStrictEqual(statements[1].coreOutputIds, statements[2].coreOutputIds);
  ok(statements[1].answerFields.length > statements[0].answerFields.length);
  ok(statements[2].answerFields.length > statements[1].answerFields.length);

  for (const statement of statements) {
    const solution = calculateCaseSolution(statement);
    const grade = gradeCase({ theme, difficulty: statement.difficulty, seed: 12345, answers: solution });
    equal(grade.score, 100);
    equal(grade.passed, true);
    equal(grade.breakdown.results, 100);
    equal(grade.breakdown.method, 100);
    ok(statement.answerFields.every((field) => !("expectedValue" in field)));

    const blank = gradeCase({ theme, difficulty: statement.difficulty, seed: 12345, answers: {} });
    equal(blank.score, 0);

    const field = statement.answerFields[0];
    const inside = { ...solution, [field.id]: solution[field.id] + field.tolerance * 0.99 };
    const half = { ...solution, [field.id]: solution[field.id] + field.tolerance * 1.5 };
    equal(gradeCase({ theme, difficulty: statement.difficulty, seed: 12345, answers: inside }).score, 100);
    equal(gradeCase({ theme, difficulty: statement.difficulty, seed: 12345, answers: half }).items.find((item) => item.id === field.id).credit, 0.5);
  }
}

console.log(JSON.stringify({ ok: true, engines: CASE_THEMES.length }));
