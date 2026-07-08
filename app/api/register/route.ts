import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/users";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, password, company } = body as {
    name?: string;
    email?: string;
    password?: string;
    company?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  if (await findUserByEmail(email)) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const user = await createUser({ name, email, password, company });

  return NextResponse.json({ id: user.id, email: user.email });
}
