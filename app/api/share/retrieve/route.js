import { NextResponse } from "next/server";

// Temporary storage (use Redis for production)
const pendingShares = global.pendingShares || {};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  if (!sessionId || !pendingShares[sessionId]) {
    return NextResponse.json({ error: "No files found" }, { status: 404 });
  }

  const files = pendingShares[sessionId];

  // Clear after retrieval
  delete pendingShares[sessionId];

  return NextResponse.json(files);
}
