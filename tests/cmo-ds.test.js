import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const html = read('../index.html');
const meta = JSON.parse(/<script type="application\/json" id="cmo-app-meta">([\s\S]*?)<\/script>/.exec(html)[1]);
const i18n = Object.fromEntries(['es', 'en', 'pt'].map(l => [l, JSON.parse(read(`../data/i18n/${l}.json`))]));

test('firma CMO: la versión de la firma coincide con package.json', () => {
  assert.equal(meta.schema, 'cmo-app-meta/1');
  assert.equal(meta.appVersion, JSON.parse(read('../package.json')).version);
});

test('firma CMO: el rol de autoría es el mismo que declara la app en es/en/pt', () => {
  for (const l of ['es', 'en', 'pt']) assert.equal(meta.credits[0].role[l], i18n[l].footer.authorshipRole, l);
});

test('firma CMO: la referencia científica y el titular © coinciden con los textos de la app', () => {
  assert.match(i18n.es.footer.scientificReferenceMeta, /Morillo-Verdugo R, Robustillo-Cortés MA, et al\./);
  assert.ok(meta.credits[1].name.startsWith('Morillo-Verdugo R, Robustillo-Cortés MA, et al.'));
  const rights = JSON.stringify(i18n.es);
  assert.ok(rights.includes(`© ${meta.copyright.year} ${meta.copyright.holders[0]}`));
});

test('firma CMO: fecha solo con estado publicado y nunca generada en tiempo de ejecución', () => {
  if (meta.status === 'released') assert.match(meta.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
  else assert.equal(meta.releaseDate, null);
  assert.doesNotMatch(read('../assets/cmo-ds/cmo-author-signature.js'), /new Date\(|Date\.now\(/);
});

test('CMO Design System: copia fijada íntegra (sin ediciones manuales)', () => {
  const dir = new URL('../assets/cmo-ds/', import.meta.url);
  const man = JSON.parse(fs.readFileSync(new URL('CMO-DS-VERSION.json', dir), 'utf8'));
  assert.equal(man.version, meta.designSystem);
  for (const [f, h] of Object.entries(man.files)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(f, dir))).digest('hex'), h, f);
  }
});
