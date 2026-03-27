import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    // Fetch the target URL acting as a real Chrome browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    let html = await response.text();

    // CRITICAL HACK: Inject a <base> tag so relative CSS/JS/Images load from the original site!
    const origin = new URL(url).origin;
    html = html.replace('<head>', `<head><base href="${origin}/">`);

    // We return pure HTML. Because this comes from our own API, the browser won't block the iframe!
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return new NextResponse(`Failed to load page: ${error}`, { status: 500 });
  }
}