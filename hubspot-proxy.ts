export const config = { runtime: "nodejs20.x" };

// Change this to your app/web origin if needed
const ALLOW_ORIGIN = "*";

function withCors(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return res;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    return withCors(
      new Response(JSON.stringify({ error: "Missing HUBSPOT_PRIVATE_APP_TOKEN" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      })
    );
    }

  const url = new URL(req.url);

  // GET /api/hubspot-proxy/contacts?email=foo@bar.com
  if (url.pathname.endsWith("/contacts") && req.method === "GET") {
    const email = url.searchParams.get("email");
    if (!email) {
      return withCors(
        new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      );
    }

    const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["email", "firstname", "lastname", "phone"]
      })
    });

    const data = await hsRes.json();
    return withCors(
      new Response(JSON.stringify(data), {
        status: hsRes.status,
        headers: { "content-type": "application/json" }
      })
    );
  }

  // POST /api/hubspot-proxy/contacts { email, firstname, lastname, phone }
  if (url.pathname.endsWith("/contacts") && req.method === "POST") {
    const payload = await req.json().catch(() => ({}));
    const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ properties: payload })
    });

    const data = await hsRes.json();
    return withCors(
      new Response(JSON.stringify(data), {
        status: hsRes.status,
        headers: { "content-type": "application/json" }
      })
    );
  }

  return withCors(
    new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    })
  );
}
