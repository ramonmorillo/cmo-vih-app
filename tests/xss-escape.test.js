// Regresión de seguridad: los datos tecleados, pegados o importados se escapan antes de insertarse como HTML.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('la evidencia extraída y la ventana de impresión se escapan', () => {
  const src = fs.readFileSync(new URL('../assets/modules/ui.js', import.meta.url), 'utf8');
  assert.ok(src.includes("escapeHtml(fieldState.evidence || t('common.none'))") && src.includes("escapeHtml(value.evidence || t('common.none'))"));
  const exp = fs.readFileSync(new URL('../assets/modules/export-layer.js', import.meta.url), 'utf8');
  assert.ok(exp.includes('esc(state.patientCase.pseudonymizedPatientLabel') && exp.includes('esc(item.label)'));
  assert.doesNotMatch(exp, /<p class="muted">[^<]*\$\{state\.patientCase\.(caseId|pseudonymizedPatientLabel)/, 'en HTML siempre escapado');
});
