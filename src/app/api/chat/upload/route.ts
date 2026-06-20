import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { saveUpload, assetUrl } from "@/lib/assets/assets-service";

// Chat photo upload — any authenticated user (chat is universal, unlike the
// permission-gated /api/upload). The client compresses to WebP first; we just
// persist. Images only. Per-object access is enforced when serving via
// /api/asset/[id] (only the two conversation participants).
export async function POST(req: Request) {
  const access = await getAccess();
  if (!access.user) return new NextResponse("Unauthorized", { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Images only." }, { status: 400 });
  }
  try {
    const id = await saveUpload(file);
    return NextResponse.json({ id, url: assetUrl(id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}
