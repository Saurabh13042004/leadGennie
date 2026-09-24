import type { PGlite } from "@electric-sql/pglite";

type Row = Record<string, unknown>;

/**
 * A lazily-executed query, mirroring Neon's NeonQueryPromise: it is a thenable
 * (await it) but also exposes text/params so sql.transaction([...]) can batch it.
 */
class TestQuery implements PromiseLike<Row[]> {
  constructor(
    readonly text: string,
    readonly params: unknown[],
    private readonly run: (text: string, params: unknown[]) => Promise<Row[]>,
  ) {}

  then<T1 = Row[], T2 = never>(
    onfulfilled?: ((value: Row[]) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return this.run(this.text, this.params).then(onfulfilled, onrejected);
  }
}

/**
 * Drop-in stand-in for `sql` from lib/db/client.ts (Neon HTTP driver), backed by
 * an in-process Postgres. Supports the three call shapes the app uses:
 *   sql`select ... ${x}`            tagged template
 *   sql.query(text, params)         dynamic SQL
 *   sql.transaction([...]|fn)       atomic batch
 */
export function createTestSql(getDb: () => Promise<PGlite>) {
  const run = async (text: string, params: unknown[]): Promise<Row[]> => {
    const db = await getDb();
    return (await db.query<Row>(text, params)).rows;
  };

  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
    return new TestQuery(text, values, run);
  };

  tag.query = (text: string, params: unknown[] = []) => new TestQuery(text, params, run);

  tag.transaction = async (arg: TestQuery[] | ((sql: typeof tag) => TestQuery[])) => {
    const queries = typeof arg === "function" ? arg(tag) : arg;
    const db = await getDb();
    return db.transaction(async (tx) => {
      const out: Row[][] = [];
      for (const q of queries) out.push((await tx.query<Row>(q.text, q.params)).rows);
      return out;
    });
  };

  return tag;
}
