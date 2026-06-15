import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { saveUpload, assetUrl } from "@/lib/assets/assets-service";

// Authenticated image upload. Returns { id, url } for the saved asset.
export async function POST(req: Request) {
  const access = await getAccess();
  if (!access.user) return new NextResponse("Unauthorized", { status: 401 });

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
