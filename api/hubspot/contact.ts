export const config = { runtime: 'nodejs20.x' };
import { z } from "zod";
import type { IncomingMessage, ServerResponse } from "http";
import { request as undiciRequest } from "undici";

const ContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  car_make: z.string().optional(),
  car_model: z.string().optional(),
  preferred_time_window: z.string().optional(),
});

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // TODO: lock to your app domain
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-App-Key");
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 200; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Method Not Allowed"); }

  try {
    const raw = await new Promise<string>((resolve, reject) => {
      let data = ""; req.on("data", c => data += c);
      req.on("end", () => resolve(data)); req.on("error", reject);
    });

    const parsed = ContactSchema.parse(JSON.parse(raw));

    const properties: Record<string, string> = {
      email: parsed.email,
      firstname: parsed.firstName,
      lastname: parsed.lastName,
    };
    if (parsed.phone) properties.phone = parsed.phone;
    if (parsed.car_make) properties.car_make = parsed.car_make;
    if (parsed.car_model) properties.car_model = parsed.car_model;
    if (parsed.preferred_time_window) properties.preferred_time_window = parsed.preferred_time_window;

    const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
    if (!HUBSPOT_TOKEN) { res.statusCode = 500; return res.end("Missing HUBSPOT_TOKEN"); }

    const hsResp = await undiciRequest("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties })
    });

    const text = await hsResp.body.text();
    res.statusCode = hsResp.statusCode;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      hsResp.statusCode >= 200 && hsResp.statusCode < 300
        ? text
        : JSON.stringify({ error: "HubSpot error", status: hsResp.statusCode, body: text })
    );
  } catch (e: any) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Invalid request", detail: String(e?.message || e) }));
  }
}
