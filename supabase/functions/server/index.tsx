import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BUCKET_NAME = "make-e27a5f03-absenquiz";

const supabaseAdmin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Init storage bucket
(async () => {
  try {
    const sb = supabaseAdmin();
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    if (!exists) {
      await sb.storage.createBucket(BUCKET_NAME, { public: false });
      console.log("Bucket created:", BUCKET_NAME);
    }
  } catch (e) {
    console.log("Bucket init error:", e);
  }
})();

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

const BASE = "/make-server-e27a5f03";

app.get(`${BASE}/health`, (c) => c.json({ status: "ok" }));

// ============ AUTH / USERS ============

app.post(`${BASE}/auth/login`, async (c) => {
  try {
    const { name, password, role } = await c.req.json();
    if (!name || !password || !role) return c.json({ error: "Nama, password, dan role wajib diisi" }, 400);
    const userKey = `user:${role}:${name.toLowerCase().trim()}`;
    if (role === "intern") {
      if (password !== "interntelkomgspo") return c.json({ error: "Password intern salah!" }, 401);
    } else if (role === "mentor") {
      if (password !== "mentortelkom") return c.json({ error: "Password mentor salah!" }, 401);
    } else {
      return c.json({ error: "Role tidak valid" }, 400);
    }
    let user = await kv.get(userKey);
    if (!user) {
      user = { name: name.trim(), role, createdAt: new Date().toISOString(), totalPoints: 0, quizCount: 0 };
      await kv.set(userKey, user);
      const listKey = `userlist:${role}`;
      const list = (await kv.get(listKey)) || [];
      list.push(name.toLowerCase().trim());
      await kv.set(listKey, list);
    }
    return c.json({ success: true, user });
  } catch (e) {
    console.log("Login error:", e);
    return c.json({ error: `Login error: ${e}` }, 500);
  }
});

app.get(`${BASE}/interns`, async (c) => {
  try {
    const list = (await kv.get("userlist:intern")) || [];
    const users = [];
    for (const name of list) {
      const user = await kv.get(`user:intern:${name}`);
      if (user) {
        const today = new Date().toISOString().split("T")[0];
        const att = await kv.get(`attendance:${name}:${today}`);
        users.push({ ...user, todayAttendance: att || null });
      }
    }
    return c.json({ interns: users });
  } catch (e) {
    console.log("Get interns error:", e);
    return c.json({ error: `Get interns error: ${e}` }, 500);
  }
});

// ============ ATTENDANCE ============

app.post(`${BASE}/attendance/clockin`, async (c) => {
  try {
    const formData = await c.req.formData();
    const name = formData.get("name") as string;
    const lat = formData.get("lat") as string;
    const lng = formData.get("lng") as string;
    const address = formData.get("address") as string;
    const photo = formData.get("photo") as File | null;
    if (!name) return c.json({ error: "Nama wajib diisi" }, 400);
    const today = new Date().toISOString().split("T")[0];
    const timeNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
    const attKey = `attendance:${name.toLowerCase().trim()}:${today}`;
    const existing = await kv.get(attKey);
    if (existing && existing.clockIn) return c.json({ error: "Sudah clock in hari ini" }, 400);
    let photoUrl = null;
    if (photo && photo.size > 0) {
      const sb = supabaseAdmin();
      const filePath = `attendance/${name.toLowerCase().trim()}/${today}_in_${Date.now()}.jpg`;
      const { error: uploadError } = await sb.storage.from(BUCKET_NAME).upload(filePath, photo, { contentType: "image/jpeg", upsert: true });
      if (uploadError) { console.log("Photo upload error:", uploadError); }
      else {
        const { data: signedData } = await sb.storage.from(BUCKET_NAME).createSignedUrl(filePath, 86400 * 30);
        photoUrl = signedData?.signedUrl;
      }
    }
    const record = { date: today, clockIn: timeNow, clockOut: null, locationIn: { lat, lng, address: address || "Unknown" }, locationOut: null, photoIn: photoUrl, photoOut: null, report: null, status: "clocked-in", approvedBy: null };
    await kv.set(attKey, record);
    return c.json({ success: true, attendance: record });
  } catch (e) {
    console.log("Clock in error:", e);
    return c.json({ error: `Clock in error: ${e}` }, 500);
  }
});

app.post(`${BASE}/attendance/clockout`, async (c) => {
  try {
    const formData = await c.req.formData();
    const name = formData.get("name") as string;
    const lat = formData.get("lat") as string;
    const lng = formData.get("lng") as string;
    const address = formData.get("address") as string;
    const report = formData.get("report") as string;
    const photo = formData.get("photo") as File | null;
    if (!name || !report) return c.json({ error: "Nama dan laporan wajib diisi" }, 400);
    const today = new Date().toISOString().split("T")[0];
    const timeNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
    const attKey = `attendance:${name.toLowerCase().trim()}:${today}`;
    const existing = await kv.get(attKey);
    if (!existing || !existing.clockIn) return c.json({ error: "Belum clock in hari ini" }, 400);
    let photoUrl = null;
    if (photo && photo.size > 0) {
      const sb = supabaseAdmin();
      const filePath = `attendance/${name.toLowerCase().trim()}/${today}_out_${Date.now()}.jpg`;
      const { error: uploadError } = await sb.storage.from(BUCKET_NAME).upload(filePath, photo, { contentType: "image/jpeg", upsert: true });
      if (!uploadError) {
        const { data: signedData } = await sb.storage.from(BUCKET_NAME).createSignedUrl(filePath, 86400 * 30);
        photoUrl = signedData?.signedUrl;
      }
    }
    const record = { ...existing, clockOut: timeNow, locationOut: { lat, lng, address: address || "Unknown" }, photoOut: photoUrl, report, status: "pending" };
    await kv.set(attKey, record);
    return c.json({ success: true, attendance: record });
  } catch (e) {
    console.log("Clock out error:", e);
    return c.json({ error: `Clock out error: ${e}` }, 500);
  }
});

// ── Mid-Day Check In ──
app.post(`${BASE}/attendance/midday`, async (c) => {
  try {
    const formData = await c.req.formData();
    const name = formData.get("name") as string;
    const lat = formData.get("lat") as string;
    const lng = formData.get("lng") as string;
    const address = formData.get("address") as string;
    const activity = formData.get("activity") as string;
    const photo = formData.get("photo") as File | null;

    if (!name) return c.json({ error: "Nama wajib diisi" }, 400);
    if (!activity) return c.json({ error: "Kegiatan wajib diisi" }, 400);

    const today = new Date().toISOString().split("T")[0];
    const timeNow = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta",
    });
    const attKey = `attendance:${name.toLowerCase().trim()}:${today}`;
    const existing = await kv.get(attKey);

    if (!existing || !existing.clockIn) return c.json({ error: "Belum clock in hari ini" }, 400);
    if (existing.midDayCheckIn) return c.json({ error: "Mid-day check in sudah dilakukan hari ini" }, 400);

    let photoUrl = null;
    if (photo && photo.size > 0) {
      const sb = supabaseAdmin();
      const filePath = `attendance/${name.toLowerCase().trim()}/${today}_midday_${Date.now()}.jpg`;
      const { error: uploadError } = await sb.storage.from(BUCKET_NAME).upload(filePath, photo, {
        contentType: "image/jpeg", upsert: true,
      });
      if (!uploadError) {
        const { data: signedData } = await sb.storage.from(BUCKET_NAME).createSignedUrl(filePath, 86400 * 30);
        photoUrl = signedData?.signedUrl;
      }
    }

    const record = {
      ...existing,
      midDayCheckIn: timeNow,
      locationMidDay: { lat, lng, address: address || "Unknown" },
      photoMidDay: photoUrl,
      midDayActivity: activity,
    };
    await kv.set(attKey, record);
    return c.json({ success: true, attendance: record });
  } catch (e) {
    console.log("Mid-day check in error:", e);
    return c.json({ error: `Mid-day check in error: ${e}` }, 500);
  }
});

app.get(`${BASE}/attendance/:name`, async (c) => {
  try {
    const name = c.req.param("name").toLowerCase().trim();
    const records = await kv.getByPrefix(`attendance:${name}:`);
    return c.json({ attendance: records || [] });
  } catch (e) {
    console.log("Get attendance error:", e);
    return c.json({ error: `Get attendance error: ${e}` }, 500);
  }
});

app.post(`${BASE}/attendance/approve`, async (c) => {
  try {
    const { internName, date, mentorName } = await c.req.json();
    const attKey = `attendance:${internName.toLowerCase().trim()}:${date}`;
    const record = await kv.get(attKey);
    if (!record) return c.json({ error: "Attendance record tidak ditemukan" }, 404);
    record.status = "approved";
    record.approvedBy = mentorName;
    await kv.set(attKey, record);
    return c.json({ success: true, attendance: record });
  } catch (e) {
    console.log("Approve error:", e);
    return c.json({ error: `Approve error: ${e}` }, 500);
  }
});

// ============ QUIZ ============

app.get(`${BASE}/quiz/questions`, async (c) => {
  try {
    let questions = await kv.get("quiz_questions");
    if (!questions || questions.length === 0) {
      questions = [
        { id: 1, question: "Apa kepanjangan dari GSPO dalam struktur organisasi Telkom Indonesia?", options: ["General Service Provider Operations", "Government & Strategic Portfolio Office", "Global System Performance Office", "Gateway Service Protocol Operations"], correctAnswer: 1 },
        { id: 2, question: "Teknologi apa yang digunakan untuk layanan internet fiber optik Telkom?", options: ["ADSL", "FTTH (Fiber to the Home)", "Cable Modem", "Satellite"], correctAnswer: 1 },
        { id: 3, question: "Apa tujuan utama unit SDA di Telkom Indonesia?", options: ["Software Development Agency", "Strategic Digital Architecture", "System Database Administration", "Sumber Daya Alam & Pengelolaan Aset"], correctAnswer: 3 },
        { id: 4, question: "Manakah yang BUKAN merupakan brand layanan Telkom Indonesia?", options: ["IndiHome", "Telkomsel", "Smartfren", "by.U"], correctAnswer: 2 },
        { id: 5, question: "Tahun berapa PT Telkom Indonesia pertama kali didirikan?", options: ["1991", "1965", "1884", "1945"], correctAnswer: 2 },
      ];
      await kv.set("quiz_questions", questions);
    }
    return c.json({ questions });
  } catch (e) {
    console.log("Get quiz error:", e);
    return c.json({ error: `Get quiz error: ${e}` }, 500);
  }
});

app.put(`${BASE}/quiz/questions`, async (c) => {
  try {
    const { questions } = await c.req.json();
    await kv.set("quiz_questions", questions);
    return c.json({ success: true });
  } catch (e) {
    console.log("Update quiz error:", e);
    return c.json({ error: `Update quiz error: ${e}` }, 500);
  }
});

app.post(`${BASE}/quiz/submit`, async (c) => {
  try {
    const { name, score, totalQuestions, answers } = await c.req.json();
    const key = `quiz_result:${name.toLowerCase().trim()}:${Date.now()}`;
    const result = {
      name: name.trim(), score, totalQuestions,
      percentage: Math.round((score / totalQuestions) * 100),
      pointsEarned: score * 20, answers,
      completedAt: new Date().toISOString(),
    };
    await kv.set(key, result);
    const userKey = `user:intern:${name.toLowerCase().trim()}`;
    const user = await kv.get(userKey);
    if (user) {
      user.totalPoints = (user.totalPoints || 0) + result.pointsEarned;
      user.quizCount = (user.quizCount || 0) + 1;
      await kv.set(userKey, user);
    }
    return c.json({ success: true, result });
  } catch (e) {
    console.log("Submit quiz error:", e);
    return c.json({ error: `Submit quiz error: ${e}` }, 500);
  }
});

app.get(`${BASE}/quiz/results/:name`, async (c) => {
  try {
    const name = c.req.param("name").toLowerCase().trim();
    const results = await kv.getByPrefix(`quiz_result:${name}:`);
    return c.json({ results: results || [] });
  } catch (e) {
    console.log("Get quiz results error:", e);
    return c.json({ error: `Get quiz results error: ${e}` }, 500);
  }
});

// ============ MATERIALS ============

// Upload material (PDF storage only)
app.post(`${BASE}/materials/upload`, async (c) => {
  try {
    const formData = await c.req.formData();
    const title = formData.get("title") as string;
    const file = formData.get("file") as File;

    if (!title || !file) return c.json({ error: "Judul dan file wajib diisi" }, 400);

    const sb = supabaseAdmin();
    const filePath = `materials/${Date.now()}_${file.name}`;
    const { error: uploadError } = await sb.storage.from(BUCKET_NAME).upload(filePath, file, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });
    if (uploadError) {
      return c.json({ error: `Upload error: ${uploadError.message}` }, 500);
    }

    const { data: signedData } = await sb.storage.from(BUCKET_NAME).createSignedUrl(filePath, 86400 * 365);

    const materials = (await kv.get("materials_list")) || [];
    const material = {
      id: Date.now(),
      title,
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      filePath,
      url: signedData?.signedUrl,
      uploadedAt: new Date().toISOString(),
      quizGenerated: false,
      quizCount: 0,
    };
    materials.push(material);
    await kv.set("materials_list", materials);

    return c.json({ success: true, material });
  } catch (e) {
    console.log("Upload material error:", e);
    return c.json({ error: `Upload material error: ${e}` }, 500);
  }
});

app.get(`${BASE}/materials`, async (c) => {
  try {
    const materials = (await kv.get("materials_list")) || [];
    return c.json({ materials });
  } catch (e) {
    console.log("Get materials error:", e);
    return c.json({ error: `Get materials error: ${e}` }, 500);
  }
});

app.delete(`${BASE}/materials/:id`, async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const materials = (await kv.get("materials_list")) || [];
    const material = materials.find((m: any) => m.id === id);
    if (material) {
      const sb = supabaseAdmin();
      await sb.storage.from(BUCKET_NAME).remove([material.filePath]);
    }
    const updated = materials.filter((m: any) => m.id !== id);
    await kv.set("materials_list", updated);
    return c.json({ success: true });
  } catch (e) {
    console.log("Delete material error:", e);
    return c.json({ error: `Delete material error: ${e}` }, 500);
  }
});

Deno.serve(app.fetch);