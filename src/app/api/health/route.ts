/** Liveness: the process is up. No dependencies, so a database outage never restarts the container. */
export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
