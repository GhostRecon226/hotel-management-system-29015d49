// ID document photos (stage 2): the hotel switch, upload with shrinking and hidden data removed, 60-second view
// links, no public access, roles (not reservation officers), deletion on anonymise, and Require at check-in.
// Local Supabase only (storage included).
import { test, expect, type Page } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";
import { createTestUser, localSupabase, passwordTokens } from "./local-supabase";

const BUCKET = "guest-id-documents";

/** A 3000 x 2000 JPEG made in the browser, with an Exif block (GPS) added, as a phone photo would have. */
async function phonePhoto(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 3000; c.height = 2000;
    const g = c.getContext("2d")!;
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`; g.fillRect((i * 97) % 3000, (i * 53) % 2000, 300, 200); }
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.95));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const jpeg = Buffer.from(bytes);
  // TIFF: IFD0 with a GPSInfo pointer, then a GPS IFD with GPSLatitudeRef "N".
  const tiff = Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x25, 0x88, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 1, 0, 2, 0, 2, 0, 0, 0, 0x4e, 0, 0, 0, 0, 0, 0, 0]);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const len = Buffer.alloc(2); len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, payload, jpeg.subarray(2)]);
}

function jpegSize(b: Buffer) {
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1]!;
    if (m === 0xc0 || m === 0xc2) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error("not a JPEG");
}

async function rpc(page: Page, fn: string, args: Record<string, unknown>) {
  return page.evaluate(async ([f, a]) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data, error } = await supabase.rpc(f as never, a as never);
    return { data: data as unknown, error: error?.message ?? null };
  }, [fn, args] as const);
}

async function storedObjects(prefix = "") {
  const s = localSupabase();
  const res = await fetch(`${s.url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST", headers: { apikey: s.serviceRoleKey, Authorization: `Bearer ${s.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  return res.json() as Promise<{ name: string }[]>;
}

async function setUpGuestWithDocument(page: Page) {
  const g = await rpc(page, "save_guest", { p_id: null, p_first_name: "Ifeoma", p_last_name: "Photo", p_phone: "08039990001",
    p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
  expect(g.error).toBeNull();
  const d = await rpc(page, "save_guest_document", { p_id: null, p_guest_id: g.data, p_doc_type: "passport", p_doc_number: "A7654321", p_expiry: null });
  expect(d.error).toBeNull();
  return String(g.data);
}

async function switchOn(page: Page, require = false) {
  await page.goto("/setup/property");
  await page.getByRole("switch", { name: "Allow ID photos" }).click();
  await expect(toasts(page).filter({ hasText: "ID photo settings saved." }).first()).toBeVisible();
  if (require) {
    await page.getByRole("switch", { name: "Require ID photo at check-in" }).click();
    await expect(page.getByRole("switch", { name: "Require ID photo at check-in" })).toBeChecked();
  }
}

test("ID photos are off by default; once on, a photo is shrunk, stripped of hidden data, private, and opens with a 60-second link", async ({ page }) => {
  await signInAndCreateHotel(page, "idphoto");
  const guestId = await setUpGuestWithDocument(page);
  await page.goto(`/guests/${guestId}`);
  await page.getByRole("tab", { name: /Documents/ }).click();
  await expect(page.getByRole("columnheader", { name: "Photos" })).toHaveCount(0); // switched off by default

  await switchOn(page);
  await page.goto(`/guests/${guestId}`);
  await page.getByRole("tab", { name: /Documents/ }).click();
  const photo = await phonePhoto(page);
  expect(photo.includes(Buffer.from("Exif"))).toBe(true);
  await page.getByLabel("Add front photo").setInputFiles({ name: "passport.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(toasts(page).filter({ hasText: "Photo added." })).toBeVisible();

  // What was stored: a smaller JPEG, at most 1600 px, without the Exif block (no GPS).
  const objects = (await storedObjects()).filter((o) => o.name !== ".emptyFolderPlaceholder");
  expect(objects.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "View front" }).click();
  const img = page.getByRole("img", { name: "ID document, front" });
  await expect(img).toBeVisible();
  const src = (await img.getAttribute("src"))!;
  expect(src).toContain(`/storage/v1/object/sign/${BUCKET}/`);
  const path = decodeURIComponent(new URL(src).pathname.split(`/sign/${BUCKET}/`)[1]!);
  const s = localSupabase();
  const stored = Buffer.from(await (await fetch(`${s.url}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { apikey: s.serviceRoleKey, Authorization: `Bearer ${s.serviceRoleKey}` } })).arrayBuffer());
  const dims = jpegSize(stored);
  expect(Math.max(dims.width, dims.height)).toBeLessThanOrEqual(1600);
  expect(stored.length).toBeLessThan(photo.length);
  expect(stored.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(stored.includes(Buffer.from("Exif"))).toBe(false);

  // The view link is signed for 60 seconds and works; the file has no public address.
  const token = new URL(src).searchParams.get("token")!;
  const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as { exp: number; iat: number };
  expect(claims.exp - claims.iat).toBe(60);
  expect((await fetch(src)).status).toBe(200);
  expect((await fetch(`${s.url}/storage/v1/object/public/${BUCKET}/${path}`)).ok).toBe(false);
  expect((await fetch(`${s.url}/storage/v1/object/${BUCKET}/${path}`, { headers: { apikey: s.publishableKey } })).ok).toBe(false);
});

test("a reservation officer sees no photos and cannot open one", async ({ page, browser }) => {
  await signInAndCreateHotel(page, "idphotorsv");
  const guestId = await setUpGuestWithDocument(page);
  await switchOn(page);
  await page.goto(`/guests/${guestId}`);
  await page.getByRole("tab", { name: /Documents/ }).click();
  await page.getByLabel("Add front photo").setInputFiles({ name: "passport.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(page) });
  await expect(toasts(page).filter({ hasText: "Photo added." })).toBeVisible();

  const officer = await createTestUser("idphotorsv-res");
  const tokens = (await passwordTokens(officer.email, officer.password)) as unknown as { user: { id: string } };
  const setUp = await page.evaluate(async (userId) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string }[] }).properties[0]!;
    const { data: roles } = await (supabase.from as never as (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { is: (k: string, v: null) => Promise<{ data: { id: string }[] }> } } })("roles")
      .select("id").eq("code", "RES").is("tenant_id", null);
    const out: string[] = [];
    const a = await supabase.rpc("register_invited_user" as never, { p_user_id: userId, p_full_name: "Rita Reservations", p_phone: null } as never);
    if (a.error) out.push(a.error.message);
    const b = await supabase.rpc("assign_role" as never, { p_user_id: userId, p_property_id: p.id, p_role_id: roles[0]!.id } as never);
    if (b.error) out.push(b.error.message);
    return { out, propertyId: p.id };
  }, tokens.user.id);
  expect(setUp.out).toEqual([]);
  const files = await rpc(page, "list_id_photos", { p_guest_id: guestId, p_property_id: setUp.propertyId });
  const fileId = (files.data as { id: string }[])[0]!.id;

  const ctx = await browser.newContext();
  const rsv = await ctx.newPage();
  await rsv.goto("/auth");
  await rsv.getByLabel("Email").fill(officer.email);
  await rsv.getByLabel("Password").fill(officer.password);
  await rsv.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(rsv).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await rsv.goto(`/guests/${guestId}`);
  await rsv.getByRole("tab", { name: /Documents/ }).click();
  await expect(rsv.getByText("Document numbers are hidden.", { exact: false })).toBeVisible();
  await expect(rsv.getByRole("button", { name: /View front/ })).toHaveCount(0);
  await expect(rsv.getByLabel("Add front photo")).toHaveCount(0);
  const opened = await rpc(rsv, "open_id_photo", { p_file_id: fileId, p_property_id: setUp.propertyId });
  expect(opened.error).toContain("E_FORBIDDEN");
  await ctx.close();
});

test("anonymising a guest removes their ID photos from storage", async ({ page }) => {
  await signInAndCreateHotel(page, "idphotoanon");
  const guestId = await setUpGuestWithDocument(page);
  await switchOn(page);
  await page.goto(`/guests/${guestId}`);
  await page.getByRole("tab", { name: /Documents/ }).click();
  await page.getByLabel("Add front photo").setInputFiles({ name: "passport.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(page) });
  await expect(toasts(page).filter({ hasText: "Photo added." })).toBeVisible();
  await page.getByRole("button", { name: "View front" }).click();
  const src = (await page.getByRole("img", { name: "ID document, front" }).getAttribute("src"))!;
  const path = decodeURIComponent(new URL(src).pathname.split(`/sign/${BUCKET}/`)[1]!);
  await page.keyboard.press("Escape");
  const [folder, name] = path.split("/") as [string, string];
  expect((await storedObjects(folder)).some((o) => o.name === name)).toBe(true);

  await page.getByRole("button", { name: "Anonymise" }).click();
  await page.getByLabel(/Reason/).fill("Guest asked to be removed");
  await page.getByLabel(/Type ANONYMISE/).fill("ANONYMISE");
  await page.getByRole("button", { name: "Anonymise guest" }).click();
  await expect(toasts(page).filter({ hasText: "Guest anonymised." })).toBeVisible();
  await expect.poll(async () => (await storedObjects(folder)).some((o) => o.name === name), { timeout: 10_000 }).toBe(false);
});

test("with Require on, a walk-in waits for an ID photo, then checks in with it", async ({ page }) => {
  await signInAndCreateHotel(page, "idphotoreq");
  await setUpRoomsAndRates(page);
  await switchOn(page, true);
  await page.goto("/front-desk");
  await page.getByRole("button", { name: "Walk-in" }).click();
  const walkIn = page.getByRole("dialog", { name: "Walk-in guest" });
  await walkIn.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Uche");
  await guestDialog.getByLabel("Last name").fill("Required");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(guestDialog).toBeHidden();
  await pick(page, "wi-rt", /STD/);
  await pick(page, "wi-rp", /BAR/);
  await pick(page, "fd-room", /^1 ·/);
  await walkIn.getByLabel("ID number").fill("NIN-778899");
  const calls: string[] = [];
  page.on("request", (r) => { if (/\/rpc\/walk_in_check_in/.test(r.url())) calls.push(r.url()); });
  await expect(walkIn.getByLabel(/ID photo \(required by this hotel\)/)).toBeVisible();
  await walkIn.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(800);
  expect(calls, "no check-in without the photo").toEqual([]);
  await walkIn.getByLabel(/ID photo/).setInputFiles({ name: "nin.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(page) });
  await walkIn.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Walk-in checked in." })).toBeVisible({ timeout: 15_000 });
});

test("the daily clean-up address refuses callers without the secret and runs with it", async ({ request }) => {
  const { TEST_CRON_SECRET } = await import("./test-env");
  expect((await request.get("/api/cron/id-photo-cleanup")).status()).toBe(401);
  expect((await request.get("/api/cron/id-photo-cleanup", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  const ok = await request.get("/api/cron/id-photo-cleanup", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ ok: true });
});
