import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const pesquisaId = formData.get("pesquisaId") as string | null;

    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 });
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "Arquivo muito grande (max 20MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const key = pesquisaId
      ? `pesquisas/${pesquisaId}/${uuidv4()}.${ext}`
      : `uploads/${uuidv4()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadFile(key, buffer, file.type);

    return NextResponse.json({
      url,
      key,
      nome: file.name,
      tamanhoBytes: file.size,
      mimeType: file.type,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 });
  }
}
