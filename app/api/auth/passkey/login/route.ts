import { NextResponse } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { relyingParty, setChallenge, readChallenge, clearChallenge, setSessionCookie } from "@/lib/passkey";

export const dynamic = "force-dynamic";

// Step 1 (public): challenge for navigator.credentials.get() — discoverable credentials, no username needed
export async function GET() {
  try {
    const count = await db.passkey.count();
    if (count === 0) return NextResponse.json({ available: false });
    const { rpID } = await relyingParty();
    const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
    const res = NextResponse.json({ available: true, options });
    setChallenge(res, "login", options.challenge);
    return res;
  } catch {
    // Table missing (schema not pushed yet) or DB down — just hide the passkey button
    return NextResponse.json({ available: false });
  }
}

// Step 2 (public): verify the signed assertion and start an owner session
export async function POST(req: Request) {
  const fail = (status = 401) => NextResponse.json({ error: "Passkey sign-in failed" }, { status });
  try {
    const expectedChallenge = await readChallenge("login");
    if (!expectedChallenge) return NextResponse.json({ error: "Sign-in expired. Try again." }, { status: 400 });

    const { response } = await req.json();
    if (!response?.id) return fail(400);

    const passkey = await db.passkey.findUnique({ where: { credentialId: response.id } });
    if (!passkey) return fail();

    const { rpID, origin } = await relyingParty();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });
    if (!verification.verified) return fail();

    await db.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });

    const username = process.env.AUTH_USERNAME || "user";
    const res = NextResponse.json({ success: true, username, isDemo: false });
    clearChallenge(res);
    setSessionCookie(res, username);
    return res;
  } catch (error) {
    console.error("Passkey login error:", error);
    return fail();
  }
}
