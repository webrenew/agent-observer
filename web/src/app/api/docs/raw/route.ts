import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<Response> {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const sanitizedPath = path.replace(/\.\./g, "").replace(/^\/+/, "");

  try {
    const directFilePath = join(
      process.cwd(),
      "content",
      "docs",
      `${sanitizedPath}.mdx`
    );
    const nestedIndexPath = join(
      process.cwd(),
      "content",
      "docs",
      sanitizedPath,
      "index.mdx"
    );
    let content: string;

    try {
      content = await readFile(directFilePath, "utf-8");
    } catch {
      content = await readFile(nestedIndexPath, "utf-8");
    }
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "File not found" },
      {
        status: 404,
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      }
    );
  }
}
