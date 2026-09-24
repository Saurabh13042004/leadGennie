/**
 * Split a SQL script into individual statements.
 *
 * The previous runner did `sql.split(";")`, which breaks on any `;` inside a
 * string, comment, or `DO $$ ... $$` / function body. This scanner tracks:
 *   - `-- line` comments and (nestable) slash-star block comments
 *   - 'single quoted' strings (with '' escape) and E'..' strings
 *   - "double quoted" identifiers
 *   - $tag$ dollar-quoted bodies (tag may be empty)
 * A `;` only terminates a statement when outside all of the above.
 * Comment-only fragments are dropped.
 */
export function splitStatements(script) {
  const statements = [];
  let current = "";
  let i = 0;
  const n = script.length;

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed && hasCode(trimmed)) statements.push(trimmed);
    current = "";
  };

  while (i < n) {
    const ch = script[i];
    const next = script[i + 1];

    // -- line comment
    if (ch === "-" && next === "-") {
      const end = script.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      current += script.slice(i, stop);
      i = stop;
      continue;
    }

    // /* block comment */ (Postgres allows nesting)
    if (ch === "/" && next === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (script[j] === "/" && script[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (script[j] === "*" && script[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      current += script.slice(i, j);
      i = j;
      continue;
    }

    // 'string' / "identifier"
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (script[j] === ch) {
          if (script[j + 1] === ch) {
            j += 2; // doubled quote escape
            continue;
          }
          break;
        }
        j++;
      }
      current += script.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    // $tag$ ... $tag$
    if (ch === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(script.slice(i, i + 64));
      if (m) {
        const tag = m[0];
        const close = script.indexOf(tag, i + tag.length);
        const stop = close === -1 ? n : close + tag.length;
        current += script.slice(i, stop);
        i = stop;
        continue;
      }
    }

    if (ch === ";") {
      flush();
      i++;
      continue;
    }

    current += ch;
    i++;
  }
  flush();
  return statements;
}

/** True if the fragment contains anything other than whitespace and comments. */
function hasCode(fragment) {
  const stripped = fragment
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("")
    .trim();
  return stripped.length > 0;
}
