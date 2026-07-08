import bcrypt from "bcryptjs";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  company?: string;
};

// In-memory mock user store. Resets on server restart — replace with a real
// database (e.g. Postgres/Supabase) when moving beyond the demo.
const users: User[] = [
  {
    id: "1",
    name: "Demo User",
    email: "demo@leadgennie.ai",
    passwordHash: bcrypt.hashSync("demo1234", 10),
    company: "Juntrax Solutions",
  },
];

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  company?: string;
}): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user: User = {
    id: String(users.length + 1),
    name: input.name,
    email: input.email,
    passwordHash,
    company: input.company,
  };
  users.push(user);
  return user;
}

export async function verifyPassword(user: User, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}
