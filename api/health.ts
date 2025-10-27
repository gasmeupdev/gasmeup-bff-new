export const config = { runtime: "nodejs20.x" };

export default async function handler(_req: Request) {
  return new Response(JSON.stringify({ ok: true, service: "gasmeup-bff", ts: Date.now() }), {
    headers: { "content-type": "application/json" }
  });
}
