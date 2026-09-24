import { describe, expect, it } from "vitest";
import { splitStatements } from "../../scripts/lib/sql-split.mjs";

describe("splitStatements", () => {
  it("splits simple statements and drops empties", () => {
    expect(splitStatements("select 1; select 2;;")).toEqual(["select 1", "select 2"]);
  });

  it("ignores semicolons inside line comments", () => {
    const out = splitStatements("-- does X; does Y\ncreate table a (id int);\nselect 1;");
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("create table a");
  });

  it("ignores semicolons inside strings and quoted identifiers", () => {
    const out = splitStatements(`insert into t values ('a;b', 'it''s; ok'); select "we;ird" from t;`);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("'a;b'");
  });

  it("keeps DO $$ blocks and function bodies intact", () => {
    const script = `
      do $$ begin
        if true then perform 1; end if;
      end $$;
      create function f() returns int language plpgsql as $body$ begin return 1; end; $body$;
      select 3;`;
    const out = splitStatements(script);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatch(/^do \$\$/);
    expect(out[1]).toContain("$body$ begin return 1; end; $body$");
  });

  it("handles block comments (including nested) and comment-only fragments", () => {
    const out = splitStatements("/* a; /* nested; */ b; */ select 1; -- trailing only;");
    expect(out).toEqual(["/* a; /* nested; */ b; */ select 1"]);
  });
});
