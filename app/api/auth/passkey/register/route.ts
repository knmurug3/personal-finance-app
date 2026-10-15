import { NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/requireAuth";
import { relyingParty, setChallenge, readChallenge, clearChallenge } from "@/lib/passkey";

export const dynamic = "force-dynamic";

// Step 1: options for navigator.credentials.create() — owner session required (demo is blocked)
export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    const { rpID, rpName } = await relyingParty();
    const existing = await db.passkey.findMany({ select: { credentialId: true, transports: true } });
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: process.env.AUTH_USERNAME || "owner",
      userDisplayName: "Owner",
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    const res = NextResponse.json(options);
    setChallenge(res, "register", options.challenge);
    return res;
  } catch (error) {
    return apiError("Failed to start passkey setup", error);
  }
}

// Step 2: verify the attestation and store the public key
export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    const expectedChallenge = await readChallenge("register");
    if (!expectedChallenge) return NextResponse.json({ error: "Passkey setup expired. Try again." }, { status: 400 });

    const { response, name } = await req.json();
    const { rpID, origin } = await relyingParty();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified) return NextResponse.json({ error: "Passkey could not be verified" }, { status: 400 });

    const { credential } = verification.registrationInfo;
    await db.passkey.create({
      data: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports || [],
        name: typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : "Passkey",
      },
    });

    const res = NextResponse.json({ success: true });
    clearChallenge(res);
    return res;
  } catch (error) {
    return apiError("Failed to save passkey", error);
  }
}
