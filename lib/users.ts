import bcrypt from "bcryptjs";
import { sql } from "@/lib/db/client";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  company?: string;
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  company: string | null;
};

function toUser(row: UserRow): User {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    company: row.company ?? undefined,
  };
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await sql`
    select id, name, email, password_hash, company
    from users
    where lower(email) = lower(${email})
    limit 1
  `;
  const row = rows[0] as UserRow | undefined;
  return row ? toUser(row) : undefined;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  company?: string;
}): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const rows = await sql`
    insert into users (name, email, password_hash, company)
    values (${input.name}, ${input.email}, ${passwordHash}, ${input.company ?? null})
    returning id, name, email, password_hash, company
  `;
  return toUser(rows[0] as UserRow);
}

export async function verifyPassword(user: User, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}
