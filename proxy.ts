import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  const isLoggedIn = !!request.auth?.user;
  const { pathname, search } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    // Keep the query string: the extension connect flow (/extension/connect?…) must survive the sign-in round trip.
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/extension/:path*", "/login", "/signup"],
};
