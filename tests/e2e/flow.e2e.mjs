// Recorrido extremo a extremo de CMO-VIH en Chromium (Playwright). Datos ficticios.
//   npm run test:e2e            (requiere Playwright con Chromium)
//   AXE_PATH=<axe.min.js>       añade la auditoría WCAG A/AA en las etapas principales
//   E2E_OUT=<carpeta>           guarda capturas
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({chromium} = require('playwright')); } catch { try { ({chromium} = await import('playwright')); } catch { chromium = null; } }
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = process.env.E2E_OUT;
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json'};
let server, browser, origin;
const external = [];

before(async () => {
  if (!chromium) return;
  server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (file.endsWith(path.sep)) file += 'index.html';
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'}); res.end(data); });
  });
  await new Promise(r => server.listen(0, r));
  origin = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
  if (OUT) fs.mkdirSync(OUT, {recursive: true});
});
after(async () => { await browser?.close(); server?.close(); });

async function open(viewport = {width: 1280, height: 900}) {
  const context = await browser.newContext({viewport, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write']});
  const page = await context.newPage();
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { if (d.type() === 'beforeunload') { d.accept(); return; } dialogs.push(d.message()); d.dismiss(); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  await page.goto(origin);
  await page.waitForSelector('#localeSelect', {state: 'attached'});
  return {page, errors, dialogs};
}
async function spanish(page) { await page.evaluate(() => localStorage.clear()); await page.selectOption('#localeSelect', 'es'); await page.waitForFunction(() => document.getElementById('localeSelect').value === 'es'); }
const text = (page, sel) => page.textContent(sel);
const step = (page, id) => page.click(`.wizard-step[data-stage="${id}"]`);
async function axe(page, label) {
  if (!process.env.AXE_PATH) return;
  await page.evaluate(() => { const t = document.querySelector('.cmo-toast'); if (t) t.hidden = true; });
  await page.addScriptTag({path: process.env.AXE_PATH});
  const violations = await page.evaluate(async () => (await window.axe.run(document, {preload: false, runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']})).violations.map(v => `${v.id}(${v.nodes.length}): ${v.nodes.map(n => n.html.slice(0, 90)).join(' | ')}`));
  assert.deepEqual(violations, [], `axe ${label}`);
}
const skip = {skip: !chromium && 'Playwright no disponible'};
const NARRATIVE = 'Paciente embarazada. Carga viral <20 copias. Vive solo. Presenta depresión.';

test('análisis asistido: nada puntúa hasta confirmar; un solo clic en «Analizar»; confirmar y descartar', skip, async () => {
  const {page, errors, dialogs} = await open();
  await spanish(page);
  await page.click('#assistedRouteBtn');
  await page.fill('#narrativeInput', NARRATIVE);
  await page.click('#analyzeTextBtn'); // un solo clic: antes el primer clic se perdía por el re-render del campo de texto
  await page.waitForSelector('[data-gate-action="confirm"]');
  assert.match(await text(page, '.notice--warn'), /sin confirmar/);
  assert.ok(await page.locator('[data-gate-action="confirm"]').count() >= 3);
  assert.deepEqual(dialogs, [], 'sin diálogos bloqueantes');
  await axe(page, 'revisión');
  // Nada puntúa: embarazo propuesto no activa la prioridad automática
  await page.click('#continueToStratifyBtn');
  assert.match(await text(page, '.dashboard-section'), /Resultado provisional/);
  assert.match(await text(page, '.dashboard-section'), /Prioridad 3|Priority 3|Prioridad 3/i);
  assert.equal(await page.locator('.dashboard-grid .metric-card').nth(1).locator('strong').textContent(), '0');
  await axe(page, 'estratificación provisional');
  // Confirmar el embarazo → prioridad automática 1; descartar la depresión
  await step(page, 'review');
  await page.locator('.field-card', {hasText: 'Embarazo'}).locator('[data-gate-action="confirm"]').click();
  await page.locator('.field-card', {hasText: 'Depresión'}).locator('[data-gate-action="discard"]').click();
  assert.equal(await page.locator('.field-card', {hasText: 'Depresión'}).locator('[data-gate-action]').count(), 0, 'lo descartado vuelve a estar sin valorar');
  await page.click('#continueToStratifyBtn');
  assert.match(await text(page, '.dashboard-grid'), /Prioridad 1/);
  // Modificación del clínico: sin justificación no se aplica; con justificación se aplica y se advierte
  await page.check('#overrideEnabled');
  await page.selectOption('#overrideLevel', '3');
  await page.click('#recalculateBtn');
  assert.match(await text(page, '.dashboard-section'), /no se aplica: indique una justificación/);
  assert.match(await text(page, '.dashboard-grid'), /Prioridad 1/);
  await page.fill('#overrideReason', 'Justificación clínica ficticia suficiente');
  await page.click('#recalculateBtn');
  assert.match(await text(page, '.dashboard-grid'), /Prioridad 3/);
  assert.match(await text(page, '.dashboard-section'), /disminuye una prioridad automática/);
  // Necesidades, intervenciones y seguimiento
  await page.click('#continueToFollowUpBtn');
  assert.match(await text(page, '.dashboard-section'), /Necesidades, intervenciones y seguimiento/);
  assert.match(await text(page, '.dashboard-section'), /propuesta sin confirmar/, 'los pendientes distinguen las propuestas sin confirmar');
  assert.ok(await page.locator('[data-intervention-id]').count() >= 3);
  await page.selectOption('[data-intervention-id]:nth-of-type(1) >> nth=0', 'done');
  await page.selectOption('[data-intervention-id] >> nth=1', 'planned');
  await page.fill('#planNextReview', '2027-02-10'); await page.fill('#planNotes', '<img src=x onerror="window.__xss=1"> Revisión telefónica.'); await page.locator('#planNotes').blur();
  await axe(page, 'seguimiento');
  // Informe: el estado y la modificación figuran en las salidas
  await page.click('#continueToSavedCasesBtn');
  await page.click('#continueToReportBtn');
  await page.click('#copyRecordBtn');
  await page.waitForFunction(() => document.querySelector('.cmo-toast') || true);
  const record = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(record, /Valoración: Provisional/);
  assert.match(record, /Modificación por criterio profesional: [^\n]*Justificación clínica ficticia suficiente/);
  assert.match(record, /Resultado calculado por el modelo:/);
  assert.match(record, /Realizadas en esta consulta:/); assert.match(record, /Planificadas \/ pendientes:/); assert.match(record, /Próxima valoración prevista: 10\/02\/2027/);
  assert.match(await text(page, '.report-box'), /RESULTADO DE ESTRATIFICACIÓN/);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('#pdfBtn')]);
  const bytes = fs.readFileSync(await pdf.path());
  assert.equal(bytes.subarray(0, 8).toString('latin1'), '%PDF-1.4'); assert.ok(bytes.toString('latin1').includes('Resultado de estratificaci'));
  const [txt] = await Promise.all([page.waitForEvent('download'), page.click('#textBtn')]);
  assert.match(fs.readFileSync(await txt.path(), 'utf8'), /RESULTADO DE ESTRATIFICACIÓN/);
  // El mismo informe en inglés: rótulos del núcleo traducidos
  await page.selectOption('#localeSelect', 'en');
  await page.waitForFunction(() => document.getElementById('localeSelect').value === 'en' && /Stratification result/i.test(document.querySelector('.report-box')?.textContent || ''));
  assert.doesNotMatch(await text(page, '.report-box'), /Fecha de evaluación|Resultado de estratificación/);
  await page.selectOption('#localeSelect', 'es');
  await page.waitForFunction(() => /RESULTADO DE ESTRATIFICACIÓN/.test(document.querySelector('.report-box')?.textContent || ''));
  assert.doesNotMatch(record, /Paciente embarazada|Vive solo/, 'el texto clínico pegado no llega al informe');
  const [json] = await Promise.all([page.waitForEvent('download'), page.click('#jsonExportBtn')]);
  const data = JSON.parse(fs.readFileSync(await json.path(), 'utf8'));
  assert.equal(data.schema, 'cmo-vih-export/1'); assert.equal(data.status, 'provisional'); assert.equal(data.override.reason, 'Justificación clínica ficticia suficiente');
  assert.ok(!('narrative' in data) && !JSON.stringify(data).includes('Vive solo'), 'el JSON no contiene texto clínico libre ni evidencia sin confirmar');
  assert.equal(data.fields.socioeconomic.value, '', 'una propuesta sin confirmar no se exporta');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#csvExportBtn')]);
  assert.match(fs.readFileSync(await csv.path(), 'utf8'), /status,automaticLevel,overrideLevel,overrideReason/);
  await axe(page, 'informe');
  // El borrador del navegador no conserva el texto pegado
  assert.ok(!(await page.evaluate(() => JSON.stringify({...localStorage}))).includes('Vive solo'));
  assert.deepEqual(errors, []);
});

test('importación hostil: se descartan valores inválidos y la aplicación sigue funcionando tras recargar', skip, async () => {
  const {page, errors} = await open();
  await spanish(page);
  await page.click('#manualRouteBtn');
  await page.fill('#importInput', JSON.stringify({viralLoad: 'banana', pregnancy: 'yes', pseudonymizedPatientLabel: '<img src=x onerror="window.__xss=1">', narrative: 'TEXTO LIBRE'}));
  await page.click('#importBtn');
  await page.waitForFunction(() => /no admitidos por el modelo/.test(document.querySelector('.cmo-toast')?.textContent || ''));
  assert.match(await text(page, '.cmo-toast'), /viralLoad/);
  assert.equal(await page.inputValue('select[data-field-id="viralLoad"]'), '');
  assert.equal(await page.inputValue('select[data-field-id="pregnancy"]'), 'yes');
  await page.fill('#importInput', JSON.stringify({viralLoad: 'banana'}));
  await page.click('#importBtn');
  await page.waitForFunction(() => /ningún valor válido|no contiene valores válidos/.test(document.querySelector('.cmo-toast')?.textContent || ''));
  await page.fill('#importInput', 'esto no es json');
  await page.click('#importBtn');
  await page.waitForFunction(() => /JSON válido/.test(document.querySelector('.cmo-toast')?.textContent || ''));
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  // Estado corrupto en el navegador: la aplicación arranca igualmente (antes quedaba en blanco)
  await page.evaluate(() => { const k = Object.keys(localStorage).find(x => x.includes('state')); const s = JSON.parse(localStorage.getItem(k)); s.patientCase.fields.viralLoad = {value: 'banana', status: 'confirmed', source: 'manual', clinicianConfirmed: true}; localStorage.setItem(k, JSON.stringify(s)); });
  await page.reload();
  await page.waitForSelector('#localeSelect', {state: 'attached'});
  assert.equal(await page.locator('#app *').count() > 10, true);
  assert.deepEqual(errors.filter(e => !/Failed to load resource/.test(e)), []);
});

test('móvil 375 px: sin desbordamiento horizontal y propuestas visibles', skip, async () => {
  const {page, errors} = await open({width: 375, height: 740});
  await spanish(page);
  await page.click('#assistedRouteBtn');
  await page.fill('#narrativeInput', NARRATIVE);
  await page.click('#analyzeTextBtn');
  await page.waitForSelector('[data-gate-action="confirm"]');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(await overflow() <= 0, `revisión: desbordamiento ${await overflow()}px`);
  await page.click('#continueToStratifyBtn');
  assert.ok(await overflow() <= 0, `estratificación: desbordamiento ${await overflow()}px`);
  await page.click('#continueToFollowUpBtn');
  assert.ok(await overflow() <= 0, `seguimiento: desbordamiento ${await overflow()}px`);
  assert.deepEqual(errors, []);
});

test('sin peticiones a terceros en todo el recorrido', skip, () => { assert.deepEqual(external, []); });
