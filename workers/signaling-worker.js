const ROOM_TTL_SECONDS = 60 * 60;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...init.headers,
    },
  });
}

function createRoomCode(length = 4) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function roomKey(code) {
  return `room:${String(code || "").trim().toUpperCase()}`;
}

async function createRoom(env, offer) {
  for (let i = 0; i < 8; i++) {
    const code = createRoomCode();
    const key = roomKey(code);
    const existing = await env.CULLIGAN_ROOMS.get(key);
    if (existing) continue;
    const now = Date.now();
    const room = {
      code,
      offer,
      answer: null,
      createdAt: now,
      expiresAt: now + ROOM_TTL_SECONDS * 1000,
    };
    await env.CULLIGAN_ROOMS.put(key, JSON.stringify(room), { expirationTtl: ROOM_TTL_SECONDS });
    return room;
  }
  throw new Error("Could not create a unique room code.");
}

async function getRoom(env, code) {
  const raw = await env.CULLIGAN_ROOMS.get(roomKey(code));
  return raw ? JSON.parse(raw) : null;
}

async function saveRoom(env, room) {
  await env.CULLIGAN_ROOMS.put(roomKey(room.code), JSON.stringify(room), { expirationTtl: ROOM_TTL_SECONDS });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({});
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      if (request.method === "GET" && parts.length === 0) {
        return json({
          ok: true,
          service: "Hey Culligan Man signaling",
          routes: ["POST /rooms", "GET /rooms/:code", "POST /rooms/:code/answer"],
        });
      }

      if (request.method === "POST" && parts[0] === "rooms" && parts.length === 1) {
        const body = await readJson(request);
        if (!body || !body.offer) return json({ error: "Missing offer." }, { status: 400 });
        const room = await createRoom(env, body.offer);
        return json({ code: room.code, expiresAt: room.expiresAt });
      }

      if (request.method === "GET" && parts[0] === "rooms" && parts[1]) {
        const room = await getRoom(env, parts[1]);
        if (!room) return json({ error: "Room not found." }, { status: 404 });
        return json({
          code: room.code,
          offer: room.offer,
          answer: room.answer,
          expiresAt: room.expiresAt,
        });
      }

      if (request.method === "POST" && parts[0] === "rooms" && parts[1] && parts[2] === "answer") {
        const room = await getRoom(env, parts[1]);
        if (!room) return json({ error: "Room not found." }, { status: 404 });
        const body = await readJson(request);
        if (!body || !body.answer) return json({ error: "Missing answer." }, { status: 400 });
        room.answer = body.answer;
        await saveRoom(env, room);
        return json({ ok: true });
      }

      if (request.method === "DELETE" && parts[0] === "rooms" && parts[1]) {
        await env.CULLIGAN_ROOMS.delete(roomKey(parts[1]));
        return json({ ok: true });
      }

      return json({ error: "Not found." }, { status: 404 });
    } catch (error) {
      return json({ error: error.message || "Worker error." }, { status: 500 });
    }
  },
};
