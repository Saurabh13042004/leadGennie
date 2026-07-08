import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  const isLoggedIn = !!request.auth?.user;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
