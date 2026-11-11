import { NextRequest, NextResponse } from "next/server";
import { allPosts } from "@/lib/posts";
import { toMarkdown } from "@/lib/export";

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const posts = allPosts();
  if (format === "md") {
    return new NextResponse(toMarkdown(posts), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="reflow-export.md"',
      },
    });
  }
  return new NextResponse(JSON.stringify(posts, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reflow-export.json"',
    },
  });
}
