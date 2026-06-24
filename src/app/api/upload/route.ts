import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { saveUpload, assetUrl } from "@/lib/assets/assets-service";

// Authenticated image upload. Returns { id, url } for the saved asset.
export async function POST(req: Request) {
  const access = await getAccess();
  if (!access.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  // Any signed-in internal user may upload: an asset is only ever exposed once it's
  // attached via an action that authorizes that attachment, and asset reads are
  // gated separately (/api/asset/[id]). The previous capability allowlist omitted
  // CS Quality, HR, requests, issues… so those users hit a 403 the client surfaced
  // as a generic "Upload failed." Third-party (external) accounts are excluded.
  if (access.user.tier === "THIRD_PARTY") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file." }, { status: 400 });
  }
  try {
    const id = await saveUpload(file);
    return NextResponse.json({ id, url: assetUrl(id), mime: file.type });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}
