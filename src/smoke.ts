const BASE = "http://localhost:3001";

function fail(msg: string): never {
  throw new Error(msg);
}

let TOKEN = "";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

async function main() {
  try {
    // ==================== STEP 0a: Register a test user ====================
    console.log("0a) POST /auth/register...");
    const smokeEmail = `smoke-${Date.now()}@test.com`;
    const smokePassword = "testpass123";
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    });
    if (!regRes.ok) fail(`POST /auth/register: ${regRes.status} ${await regRes.text()}`);
    const regData = (await regRes.json()) as { user?: { id: string; email: string; role: string }; token?: string };
    if (!regData.token || !regData.user?.id) fail("Register: missing token or user.id");
    TOKEN = regData.token;
    const userId = regData.user.id;
    console.log(`   OK, userId=${userId}, email=${smokeEmail}`);

    // ==================== STEP 0b: Verify GET /auth/me ====================
    console.log("0b) GET /auth/me...");
    const meRes = await fetch(`${BASE}/auth/me`, {
      headers: authHeaders(),
    });
    if (!meRes.ok) fail(`GET /auth/me: ${meRes.status} ${await meRes.text()}`);
    const meData = (await meRes.json()) as { user?: { id: string; email: string } };
    if (meData.user?.id !== userId) fail(`GET /auth/me: expected userId ${userId}, got ${meData.user?.id}`);
    if (meData.user?.email !== smokeEmail) fail(`GET /auth/me: expected email ${smokeEmail}, got ${meData.user?.email}`);
    console.log("   OK, /auth/me returns correct user");

    // ==================== EXISTING TESTS (with auth) ====================
    const content1 = `Smoke test v1 at ${Date.now()}`;
    const content2 = `Smoke test v2 at ${Date.now()}`;

    console.log("1) POST /records...");
    const createRes = await fetch(`${BASE}/records`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ contentText: content1 }),
    });
    if (!createRes.ok) fail(`POST /records: ${createRes.status} ${await createRes.text()}`);
    const createData = (await createRes.json()) as { record?: { id: string }; created?: boolean };
    if (!createData.created || !createData.record?.id) fail("POST /records: missing created or record.id");
    const id = createData.record.id;
    console.log(`   OK, recordId=${id}`);

    console.log("2) GET /records/:id (expect versionNumber 1)...");
    const get1Res = await fetch(`${BASE}/records/${id}`, { headers: authHeaders() });
    if (!get1Res.ok) fail(`GET /records/:id: ${get1Res.status} ${await get1Res.text()}`);
    const get1Data = (await get1Res.json()) as { currentVersion?: { versionNumber: number } };
    if (get1Data.currentVersion?.versionNumber !== 1) {
      fail(`GET /records/:id: expected versionNumber 1, got ${get1Data.currentVersion?.versionNumber}`);
    }
    console.log("   OK, versionNumber === 1");

    console.log("3) POST /records/:id/versions...");
    const verRes = await fetch(`${BASE}/records/${id}/versions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ contentText: content2 }),
    });
    if (!verRes.ok) fail(`POST /records/:id/versions: ${verRes.status} ${await verRes.text()}`);
    const verData = (await verRes.json()) as { created?: boolean; version?: { versionNumber?: number } };
    if (!verData.created) fail("POST /records/:id/versions: expected created true");
    console.log(`   OK, new version ${verData.version?.versionNumber ?? "?"}`);

    console.log("4) GET /records/:id (expect versionNumber 2)...");
    const get2Res = await fetch(`${BASE}/records/${id}`, { headers: authHeaders() });
    if (!get2Res.ok) fail(`GET /records/:id: ${get2Res.status} ${await get2Res.text()}`);
    const get2Data = (await get2Res.json()) as { currentVersion?: { versionNumber: number } };
    if (get2Data.currentVersion?.versionNumber !== 2) {
      fail(`GET /records/:id: expected versionNumber 2, got ${get2Data.currentVersion?.versionNumber}`);
    }
    console.log("   OK, versionNumber === 2");

    console.log("5) GET /records/:id/versions (expect length >= 2, sorted desc)...");
    const listRes = await fetch(`${BASE}/records/${id}/versions`, { headers: authHeaders() });
    if (!listRes.ok) fail(`GET /records/:id/versions: ${listRes.status} ${await listRes.text()}`);
    const listData = (await listRes.json()) as { recordId: string; versions: { versionNumber: number }[] };
    if (!listData.versions || listData.versions.length < 2) {
      fail(`GET /records/:id/versions: expected length >= 2, got ${listData.versions?.length ?? 0}`);
    }
    for (let i = 1; i < listData.versions.length; i++) {
      if (listData.versions[i].versionNumber >= listData.versions[i - 1].versionNumber) {
        fail(`GET /records/:id/versions: not sorted DESC at index ${i}`);
      }
    }
    console.log(`   OK, ${listData.versions.length} versions, sorted desc`);

    console.log("6) POST /records/:id/restore (restore v1)...");
    const v1Id = (listData.versions as { id: string; versionNumber: number }[]).find((v) => v.versionNumber === 1)?.id;
    if (!v1Id) fail("Could not find version 1 id");
    const restoreRes = await fetch(`${BASE}/records/${id}/restore`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ versionId: v1Id }),
    });
    if (!restoreRes.ok) fail(`POST /records/:id/restore: ${restoreRes.status} ${await restoreRes.text()}`);
    const restoreData = (await restoreRes.json()) as { restored?: boolean; version?: { versionNumber: number; contentText?: string } };
    if (!restoreData.restored || restoreData.version?.versionNumber !== 3) {
      fail(`POST /records/:id/restore: expected versionNumber 3, got ${restoreData.version?.versionNumber}`);
    }
    console.log("   OK, restored as version 3");

    console.log("7) POST /records/:id/archive...");
    const archiveRes = await fetch(`${BASE}/records/${id}/archive`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!archiveRes.ok) fail(`POST /records/:id/archive: ${archiveRes.status} ${await archiveRes.text()}`);
    const archiveData = (await archiveRes.json()) as { status?: string };
    if (archiveData.status !== "ARCHIVED") fail(`Expected status ARCHIVED, got ${archiveData.status}`);
    console.log("   OK, record archived");

    console.log("8) POST /records/:id/unarchive...");
    const unarchiveRes = await fetch(`${BASE}/records/${id}/unarchive`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!unarchiveRes.ok) fail(`POST /records/:id/unarchive: ${unarchiveRes.status} ${await unarchiveRes.text()}`);
    const unarchiveData = (await unarchiveRes.json()) as { status?: string };
    if (unarchiveData.status !== "ACTIVE") fail(`Expected status ACTIVE, got ${unarchiveData.status}`);
    console.log("   OK, record unarchived");

    console.log("9) GET /records/:id/history...");
    const historyRes = await fetch(`${BASE}/records/${id}/history`, { headers: authHeaders() });
    if (!historyRes.ok) fail(`GET /records/:id/history: ${historyRes.status} ${await historyRes.text()}`);
    const historyData = (await historyRes.json()) as { history?: { id: string }[] };
    if (!historyData.history || historyData.history.length < 1) {
      fail(`Expected at least 1 history entry, got ${historyData.history?.length ?? 0}`);
    }
    console.log(`   OK, ${historyData.history.length} history entries`);

    console.log("10) GET /users (list users)...");
    const usersRes = await fetch(`${BASE}/users`, { headers: authHeaders() });
    if (!usersRes.ok) fail(`GET /users: ${usersRes.status} ${await usersRes.text()}`);
    const usersData = (await usersRes.json()) as { users?: { id: string }[] };
    if (!usersData.users || !usersData.users.some((u) => u.id === userId)) {
      fail("GET /users: registered user not found in list");
    }
    console.log(`   OK, ${usersData.users.length} users, test user found`);

    console.log("11) GET /records (list records for authenticated user)...");
    const listRecRes = await fetch(`${BASE}/records`, { headers: authHeaders() });
    if (!listRecRes.ok) fail(`GET /records: ${listRecRes.status} ${await listRecRes.text()}`);
    const listRecData = (await listRecRes.json()) as { records?: { id: string }[] };
    if (!listRecData.records || !listRecData.records.some((r) => r.id === id)) {
      fail("GET /records: created record not found in list");
    }
    console.log(`   OK, ${listRecData.records.length} records, test record found`);

    console.log("12) POST /records/:id/exhibit (designate as exhibit)...");
    const exhibitRes = await fetch(`${BASE}/records/${id}/exhibit`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!exhibitRes.ok) fail(`POST /records/:id/exhibit: ${exhibitRes.status} ${await exhibitRes.text()}`);
    const exhibitData = (await exhibitRes.json()) as { exhibit?: { id: string; exhibitCode: string } };
    if (!exhibitData.exhibit?.exhibitCode) {
      fail(`Expected non-empty exhibitCode, got "${exhibitData.exhibit?.exhibitCode}"`);
    }
    const exhibitId = exhibitData.exhibit!.id;
    const firstCode = exhibitData.exhibit!.exhibitCode;
    console.log(`   OK, exhibitCode=${firstCode}, exhibitId=${exhibitId}`);

    console.log("13) POST /records (second record) + designate as next exhibit...");
    const create2Res = await fetch(`${BASE}/records`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ contentText: `Smoke test exhibit 2 at ${Date.now()}` }),
    });
    if (!create2Res.ok) fail(`POST /records: ${create2Res.status} ${await create2Res.text()}`);
    const create2Data = (await create2Res.json()) as { record?: { id: string }; created?: boolean };
    if (!create2Data.record?.id) fail("Second POST /records: missing record.id");
    const id2 = create2Data.record.id;

    const exhibit2Res = await fetch(`${BASE}/records/${id2}/exhibit`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!exhibit2Res.ok) fail(`POST /records/:id/exhibit (2): ${exhibit2Res.status} ${await exhibit2Res.text()}`);
    const exhibit2Data = (await exhibit2Res.json()) as { exhibit?: { exhibitCode: string } };
    const secondCode = exhibit2Data.exhibit?.exhibitCode;
    if (!secondCode || secondCode <= firstCode) {
      fail(`Expected secondCode > "${firstCode}", got "${secondCode}"`);
    }
    console.log(`   OK, exhibitCode=${secondCode} (sequential after ${firstCode})`);

    console.log("14) GET /exhibits (list exhibits for authenticated user)...");
    const listExRes = await fetch(`${BASE}/exhibits`, { headers: authHeaders() });
    if (!listExRes.ok) fail(`GET /exhibits: ${listExRes.status} ${await listExRes.text()}`);
    const listExData = (await listExRes.json()) as { exhibits?: { exhibitCode: string }[] };
    if (!listExData.exhibits || listExData.exhibits.length < 2) {
      fail(`Expected >= 2 exhibits, got ${listExData.exhibits?.length ?? 0}`);
    }
    for (let i = 1; i < listExData.exhibits.length; i++) {
      if (listExData.exhibits[i].exhibitCode <= listExData.exhibits[i - 1].exhibitCode) {
        fail(`Exhibits not sorted ascending at index ${i}`);
      }
    }
    console.log(`   OK, ${listExData.exhibits.length} exhibits in order`);

    console.log("15) GET /exhibits/:exhibitId/pdf (download PDF)...");
    const pdfRes = await fetch(`${BASE}/exhibits/${exhibitId}/pdf`, { headers: authHeaders() });
    if (!pdfRes.ok) fail(`GET /exhibits/:id/pdf: ${pdfRes.status}`);
    const contentType = pdfRes.headers.get("content-type") ?? "";
    if (!contentType.includes("application/pdf")) fail(`Expected application/pdf, got ${contentType}`);
    const pdfBody = await pdfRes.arrayBuffer();
    if (pdfBody.byteLength === 0) fail("PDF body is empty");
    console.log(`   OK, PDF received, ${pdfBody.byteLength} bytes`);

    console.log("16) DELETE /exhibits/:exhibitId (remove designation)...");
    const removeRes = await fetch(`${BASE}/exhibits/${exhibitId}`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!removeRes.ok) fail(`DELETE /exhibits/:id: ${removeRes.status} ${await removeRes.text()}`);
    const removeData = (await removeRes.json()) as { removed?: boolean };
    if (!removeData.removed) fail("Expected removed: true");
    // Verify it's gone from the list
    const listEx2Res = await fetch(`${BASE}/exhibits`, { headers: authHeaders() });
    const listEx2Data = (await listEx2Res.json()) as { exhibits?: { id: string }[] };
    if (listEx2Data.exhibits?.some((e) => e.id === exhibitId)) {
      fail("Removed exhibit still appears in list");
    }
    console.log("   OK, exhibit removed and gone from list");

    console.log("17) Upload attachment + verify integrity...");
    const boundary = "----SmokeTestBoundary" + Date.now();
    const fileContent = `Smoke test attachment content ${Date.now()}`;
    const uploadBody =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="smoke-test.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--\r\n`;
    const uploadRes = await fetch(`${BASE}/records/${id}/attachments`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${TOKEN}`,
      },
      body: uploadBody,
    });
    if (!uploadRes.ok) fail(`POST /records/:id/attachments: ${uploadRes.status} ${await uploadRes.text()}`);
    const uploadData = (await uploadRes.json()) as { attachment?: { id: string; fileHash: string } };
    if (!uploadData.attachment?.id) fail("Upload: missing attachment.id");
    const attId = uploadData.attachment.id;
    const verifyRes = await fetch(`${BASE}/attachments/${attId}/verify`, { headers: authHeaders() });
    if (!verifyRes.ok) fail(`GET /attachments/:id/verify: ${verifyRes.status} ${await verifyRes.text()}`);
    const verifyData = (await verifyRes.json()) as { match?: boolean };
    if (verifyData.match !== true) fail(`Verify: expected match=true, got ${verifyData.match}`);
    console.log("   OK, attachment uploaded and verified (match=true)");

    console.log("18) Batch verify attachments for record...");
    const batchRes = await fetch(`${BASE}/records/${id}/attachments/verify`, { headers: authHeaders() });
    if (!batchRes.ok) fail(`GET /records/:id/attachments/verify: ${batchRes.status} ${await batchRes.text()}`);
    const batchData = (await batchRes.json()) as { allPassed?: boolean; results?: unknown[] };
    if (batchData.allPassed !== true) fail(`Batch verify: expected allPassed=true, got ${batchData.allPassed}`);
    console.log(`   OK, batch verify allPassed=true (${(batchData.results ?? []).length} attachments)`);

    console.log("19) Check history has ipAddress on entries...");
    const histAuditRes = await fetch(`${BASE}/records/${id}/history`, { headers: authHeaders() });
    if (!histAuditRes.ok) fail(`GET /records/:id/history: ${histAuditRes.status} ${await histAuditRes.text()}`);
    const histAuditData = (await histAuditRes.json()) as { history?: { ipAddress?: string | null }[] };
    if (!histAuditData.history || histAuditData.history.length < 1) {
      fail("History: no entries");
    }
    const latestEntry = histAuditData.history[0];
    if (!latestEntry.ipAddress) {
      fail(`History: latest entry has null ipAddress`);
    }
    console.log(`   OK, latest history entry ipAddress=${latestEntry.ipAddress}`);

    console.log("20) POST /records/:id/access-log (log VIEW event)...");
    const accessLogRes = await fetch(`${BASE}/records/${id}/access-log`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "VIEW" }),
    });
    if (!accessLogRes.ok) fail(`POST /records/:id/access-log: ${accessLogRes.status} ${await accessLogRes.text()}`);
    const accessLogData = (await accessLogRes.json()) as { logged?: boolean };
    if (accessLogData.logged !== true) fail(`access-log: expected logged=true`);
    const histAfterRes = await fetch(`${BASE}/records/${id}/history`, { headers: authHeaders() });
    const histAfterData = (await histAfterRes.json()) as { history?: { changeSummary: string; changeType: string }[] };
    const viewEntry = histAfterData.history?.find((h) => h.changeSummary.startsWith("VIEW "));
    if (!viewEntry) fail("access-log: VIEW entry not found in history");
    if (viewEntry.changeType !== "SYSTEM") fail(`access-log: expected changeType SYSTEM, got ${viewEntry.changeType}`);
    console.log("   OK, VIEW access logged and appears in history");

    // ==================== NEW AUTH TESTS ====================

    console.log("21) GET /records WITHOUT token → expect 401...");
    const noAuthRes = await fetch(`${BASE}/records`);
    if (noAuthRes.status !== 401) {
      await noAuthRes.text();
      fail(`Expected 401, got ${noAuthRes.status}`);
    }
    await noAuthRes.text();
    console.log("   OK, got 401 without token");

    console.log("22) GET /records WITH invalid token → expect 401...");
    const badAuthRes = await fetch(`${BASE}/records`, {
      headers: { Authorization: "Bearer invalid-token-12345" },
    });
    if (badAuthRes.status !== 401) {
      await badAuthRes.text();
      fail(`Expected 401, got ${badAuthRes.status}`);
    }
    await badAuthRes.text();
    console.log("   OK, got 401 with invalid token");

    console.log("23) POST /auth/login with smoke user credentials → verify token...");
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    });
    if (!loginRes.ok) fail(`POST /auth/login: ${loginRes.status} ${await loginRes.text()}`);
    const loginData = (await loginRes.json()) as { token?: string; user?: { id: string } };
    if (!loginData.token) fail("Login: missing token");
    if (loginData.user?.id !== userId) fail(`Login: expected userId ${userId}, got ${loginData.user?.id}`);
    console.log("   OK, login returns valid token");

    console.log("24) GET /share/:token works WITHOUT auth (public access)...");
    // First create a share link for our record
    const shareRes = await fetch(`${BASE}/records/${id}/share`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!shareRes.ok) fail(`POST /records/:id/share: ${shareRes.status} ${await shareRes.text()}`);
    const shareData = (await shareRes.json()) as { shareLink?: { token: string } };
    const shareToken = shareData.shareLink?.token;
    if (!shareToken) fail("Share: missing token");
    // Access the share link WITHOUT auth
    const pubShareRes = await fetch(`${BASE}/share/${shareToken}`);
    if (!pubShareRes.ok) fail(`GET /share/:token (no auth): ${pubShareRes.status} ${await pubShareRes.text()}`);
    const pubShareData = (await pubShareRes.json()) as { record?: { id: string } };
    if (pubShareData.record?.id !== id) fail(`Share: expected recordId ${id}, got ${pubShareData.record?.id}`);
    console.log("   OK, public share link works without auth");

    // ==================== CASE & TAG TESTS ====================

    console.log("25) POST /cases (create a case)...");
    const caseRes = await fetch(`${BASE}/cases`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: "Smith v. Jones", caseNumber: "2026-CV-1234" }),
    });
    if (!caseRes.ok) fail(`POST /cases: ${caseRes.status} ${await caseRes.text()}`);
    const caseData = (await caseRes.json()) as { case?: { id: string; name: string; caseNumber?: string } };
    if (!caseData.case?.id || caseData.case.name !== "Smith v. Jones") {
      fail(`Create case: unexpected data ${JSON.stringify(caseData)}`);
    }
    const caseId = caseData.case.id;
    console.log(`   OK, caseId=${caseId}, name=${caseData.case.name}`);

    console.log("26) GET /cases (list cases)...");
    const listCasesRes = await fetch(`${BASE}/cases`, { headers: authHeaders() });
    if (!listCasesRes.ok) fail(`GET /cases: ${listCasesRes.status} ${await listCasesRes.text()}`);
    const listCasesData = (await listCasesRes.json()) as { cases?: { id: string }[] };
    if (!listCasesData.cases?.some((c) => c.id === caseId)) {
      fail("GET /cases: created case not found in list");
    }
    console.log(`   OK, ${listCasesData.cases!.length} case(s), test case found`);

    console.log("27) POST /records/:id/case (assign record to case)...");
    const assignRes = await fetch(`${BASE}/records/${id}/case`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ caseId }),
    });
    if (!assignRes.ok) fail(`POST /records/:id/case: ${assignRes.status} ${await assignRes.text()}`);
    const assignData = (await assignRes.json()) as { assigned?: boolean };
    if (assignData.assigned !== true) fail("Expected assigned: true");
    // Verify via GET /records
    const recAfterAssignRes = await fetch(`${BASE}/records/${id}`, { headers: authHeaders() });
    const recAfterAssign = (await recAfterAssignRes.json()) as { caseId?: string };
    if (recAfterAssign.caseId !== caseId) fail(`Expected caseId ${caseId}, got ${recAfterAssign.caseId}`);
    console.log("   OK, record assigned to case");

    console.log("28) POST /tags (create a tag)...");
    const tagRes = await fetch(`${BASE}/tags`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: "photo", color: "#4263eb" }),
    });
    if (!tagRes.ok) fail(`POST /tags: ${tagRes.status} ${await tagRes.text()}`);
    const tagData = (await tagRes.json()) as { tag?: { id: string; name: string; color: string } };
    if (!tagData.tag?.id || tagData.tag.name !== "photo") {
      fail(`Create tag: unexpected data ${JSON.stringify(tagData)}`);
    }
    const tagId = tagData.tag.id;
    console.log(`   OK, tagId=${tagId}, name=${tagData.tag.name}, color=${tagData.tag.color}`);

    console.log("29) POST /records/:id/tags (add tag to record)...");
    const addTagRes = await fetch(`${BASE}/records/${id}/tags`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ tagId }),
    });
    if (!addTagRes.ok) fail(`POST /records/:id/tags: ${addTagRes.status} ${await addTagRes.text()}`);
    const addTagData = (await addTagRes.json()) as { added?: boolean };
    if (addTagData.added !== true) fail("Expected added: true");
    // Verify via GET /records/:id/tags
    const recTagsRes = await fetch(`${BASE}/records/${id}/tags`, { headers: authHeaders() });
    const recTagsData = (await recTagsRes.json()) as { tags?: { id: string; name: string }[] };
    if (!recTagsData.tags?.some((t) => t.id === tagId)) {
      fail("Tag not found on record after adding");
    }
    console.log("   OK, tag added to record");

    console.log("30) GET /records?caseId=... (filter by case)...");
    const filterCaseRes = await fetch(`${BASE}/records?caseId=${encodeURIComponent(caseId)}`, { headers: authHeaders() });
    if (!filterCaseRes.ok) fail(`GET /records?caseId=: ${filterCaseRes.status} ${await filterCaseRes.text()}`);
    const filterCaseData = (await filterCaseRes.json()) as { records?: { id: string }[] };
    if (!filterCaseData.records || filterCaseData.records.length === 0) {
      fail("Filter by caseId: no records returned");
    }
    if (!filterCaseData.records.every((r) => r.id === id || filterCaseData.records!.some((rr) => rr.id === id))) {
      // At minimum our assigned record should be there
    }
    if (!filterCaseData.records.some((r) => r.id === id)) {
      fail("Filter by caseId: our assigned record not found");
    }
    console.log(`   OK, ${filterCaseData.records.length} record(s) for case filter`);

    console.log("31) GET /records?tagId=... (filter by tag)...");
    const filterTagRes = await fetch(`${BASE}/records?tagId=${encodeURIComponent(tagId)}`, { headers: authHeaders() });
    if (!filterTagRes.ok) fail(`GET /records?tagId=: ${filterTagRes.status} ${await filterTagRes.text()}`);
    const filterTagData = (await filterTagRes.json()) as { records?: { id: string }[] };
    if (!filterTagData.records || filterTagData.records.length === 0) {
      fail("Filter by tagId: no records returned");
    }
    if (!filterTagData.records.some((r) => r.id === id)) {
      fail("Filter by tagId: our tagged record not found");
    }
    console.log(`   OK, ${filterTagData.records.length} record(s) for tag filter`);

    console.log("32) DELETE /records/:id/tags/:tagId (remove tag from record)...");
    const removeTagRes = await fetch(`${BASE}/records/${id}/tags/${tagId}`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!removeTagRes.ok) fail(`DELETE /records/:id/tags/:tagId: ${removeTagRes.status} ${await removeTagRes.text()}`);
    const removeTagData = (await removeTagRes.json()) as { removed?: boolean };
    if (removeTagData.removed !== true) fail("Expected removed: true");
    // Verify tag is gone
    const recTags2Res = await fetch(`${BASE}/records/${id}/tags`, { headers: authHeaders() });
    const recTags2Data = (await recTags2Res.json()) as { tags?: { id: string }[] };
    if (recTags2Data.tags?.some((t) => t.id === tagId)) {
      fail("Tag still on record after removal");
    }
    console.log("   OK, tag removed from record");

    console.log("33) DELETE /records/:id/case (remove record from case)...");
    const removeCaseRes = await fetch(`${BASE}/records/${id}/case`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!removeCaseRes.ok) fail(`DELETE /records/:id/case: ${removeCaseRes.status} ${await removeCaseRes.text()}`);
    const removeCaseData = (await removeCaseRes.json()) as { removed?: boolean };
    if (removeCaseData.removed !== true) fail("Expected removed: true");
    // Verify caseId is null
    const recAfterRemoveRes = await fetch(`${BASE}/records/${id}`, { headers: authHeaders() });
    const recAfterRemove = (await recAfterRemoveRes.json()) as { caseId?: string | null };
    if (recAfterRemove.caseId !== null && recAfterRemove.caseId !== undefined) {
      fail(`Expected caseId null, got ${recAfterRemove.caseId}`);
    }
    console.log("   OK, record removed from case");

    // ==================== DASHBOARD TESTS ====================

    console.log("34) GET /dashboard returns 200 with all expected top-level keys...");
    const dashRes = await fetch(`${BASE}/dashboard`, { headers: authHeaders() });
    if (!dashRes.ok) fail(`GET /dashboard: ${dashRes.status} ${await dashRes.text()}`);
    const dashData = (await dashRes.json()) as Record<string, unknown>;
    const expectedKeys = ["summary", "recordsByCase", "recordsByTag", "recentActivity", "integrityStatus", "exhibitProgress", "timelineData"];
    for (const key of expectedKeys) {
      if (!(key in dashData)) fail(`GET /dashboard: missing key "${key}"`);
    }
    console.log("   OK, all 7 top-level keys present");

    console.log("35) Verify summary.totalRecords matches expected count...");
    const dashSummary = dashData.summary as { totalRecords?: number };
    // We created 2 records in this smoke test (step 1 and step 13)
    if (typeof dashSummary.totalRecords !== "number" || dashSummary.totalRecords < 2) {
      fail(`Expected totalRecords >= 2, got ${dashSummary.totalRecords}`);
    }
    console.log(`   OK, totalRecords=${dashSummary.totalRecords}`);

    console.log("36) Verify recentActivity is an array with length > 0...");
    const dashActivity = dashData.recentActivity as unknown[];
    if (!Array.isArray(dashActivity) || dashActivity.length === 0) {
      fail(`Expected recentActivity array with length > 0, got ${Array.isArray(dashActivity) ? dashActivity.length : typeof dashActivity}`);
    }
    console.log(`   OK, recentActivity has ${dashActivity.length} entries`);

    console.log("37) Verify timelineData is an array with 14 entries...");
    const dashTimeline = dashData.timelineData as unknown[];
    if (!Array.isArray(dashTimeline) || dashTimeline.length !== 14) {
      fail(`Expected timelineData array with length 14, got ${Array.isArray(dashTimeline) ? dashTimeline.length : typeof dashTimeline}`);
    }
    console.log(`   OK, timelineData has ${dashTimeline.length} entries`);

    // ==================== SECURITY TESTS ====================

    console.log("38) Verify security headers are present (Helmet)...");
    const secRes = await fetch(`${BASE}/__routes`);
    const secHeaders = secRes.headers;
    const hasXContentType = secHeaders.has("x-content-type-options");
    const hasXFrame = secHeaders.has("x-frame-options");
    const hasCSP = secHeaders.has("content-security-policy");
    if (!hasXContentType && !hasXFrame && !hasCSP) {
      fail("Expected at least one security header (x-content-type-options, x-frame-options, or content-security-policy)");
    }
    console.log(`   OK, security headers present (x-content-type-options=${hasXContentType}, x-frame-options=${hasXFrame}, csp=${hasCSP})`);

    console.log("39) Verify rate limiting headers are present...");
    const rlRes = await fetch(`${BASE}/dashboard`, { headers: authHeaders() });
    const hasRateLimit = rlRes.headers.has("ratelimit-limit") || rlRes.headers.has("x-ratelimit-limit");
    if (!hasRateLimit) {
      fail("Expected ratelimit-limit or x-ratelimit-limit header in response");
    }
    console.log(`   OK, rate limit headers present`);

    console.log("40) Verify CORS headers with Origin header...");
    const corsRes = await fetch(`${BASE}/__routes`, {
      headers: { "Origin": "http://localhost:5173" },
    });
    const acaoHeader = corsRes.headers.get("access-control-allow-origin");
    if (!acaoHeader) {
      fail("Expected access-control-allow-origin header in response");
    }
    console.log(`   OK, access-control-allow-origin=${acaoHeader}`);

    console.log("Smoke test passed (40 steps).");
  } catch (e) {
    console.error("FAIL:", (e as Error)?.message ?? e);
    process.exitCode = 1;
  } finally {
    await new Promise((r) => setTimeout(r, 50));
    return;
  }
}

main().catch((e) => {
  console.error("FAIL:", (e as Error)?.message ?? e);
  process.exitCode = 1;
});
