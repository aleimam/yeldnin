import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { getAccess } from "@/lib/auth/access";
import { MAX_UPLOAD_BYTES } from "@/lib/assets/assets-service";
import { sanitizeContent } from "@/lib/documents/documents-service";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Convert an uploaded .docx into sanitized rich-text HTML for the document editor.
// The file itself is NOT stored — only the converted HTML is returned, which the
// client seeds into the Tiptap editor. Same auth as /api/upload.
export async function POST(req: Request) {
  const access = await getAccess();
  if (!access.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (access.user.tier === "THIRD_PARTY") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const isDocx = file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) return NextResponse.json({ error: "Please upload a Word .docx file." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large (max 32 MB)." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.convertToHtml({ buffer });
    const html = sanitizeContent(result.value);
    return NextResponse.json({ html });
  } catch {
    return NextResponse.json({ error: "Could not read that Word file." }, { status: 400 });
  }
}
