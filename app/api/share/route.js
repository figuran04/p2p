import { NextResponse } from "next/server";

const pendingShares = global.pendingShares || {};
global.pendingShares = pendingShares;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files");

    const processedFiles = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      }))
    );

    const sessionId = Math.random().toString(36).substring(2);
    pendingShares[sessionId] = processedFiles;

    // Clean up after 10 minutes
    setTimeout(() => {
      delete pendingShares[sessionId];
    }, 10 * 60 * 1000);

    return NextResponse.redirect(
      new URL(`/share?shared=true&session=${sessionId}`, request.url)
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/share?error=share-failed`, request.url)
    );
  }
}
