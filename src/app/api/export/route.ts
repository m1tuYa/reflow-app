import { NextRequest, NextResponse } from "next/server";
import { allPosts, listRoutines } from "@/lib/posts";
import { toMarkdown } from "@/lib/export";
import { exportAll } from "@/lib/backup";

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  if (format === "md") {
    return new NextResponse(toMarkdown(allPosts(), listRoutines()), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="reflow-export.md"',
      },
    });
  }
  return new NextResponse(JSON.stringify(exportAll(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reflow-export.json"',
    },
  });
}
