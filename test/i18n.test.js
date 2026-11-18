import test from 'node:test';
import assert from 'node:assert/strict';
import { translations } from '../public/translations.js';
import { translate, setLanguage, locale } from '../public/i18n.js';
test('idiomas traduzem interface e preservam texto desconhecido', () => {
  assert.equal(translate('Meu diário','en'),'My diary');
  assert.equal(translate('Meu diário','es'),'Mi diario');
  assert.equal(translate('Ansiedade II','en'),'Anxiety II');
  assert.equal(translate('9:30','en'),'9:30');
  assert.equal(translate('Sertralina · 50 mg · 09:30','en'),'Sertralina · 50 mg · 09:30');
  assert.equal(translate('  Salvar avaliação  ','en'),'  Save check-in  ');
  assert.equal(translate('Enviar relatório para meu médico ↗','es'),'Enviar informe a mi médico ↗');
  assert.equal(translate('3 avaliações nesta semana','en'),'3 check-ins this week');
  assert.equal(setLanguage('fr'),false); assert.equal(locale(),'pt-BR');
  assert.equal(setLanguage('es'),true); assert.equal(translate('Meu diário'),'Mi diario'); setLanguage('pt-BR');
  for(const [source,targets] of Object.entries(translations)){assert.equal(targets.length,2,source);assert.ok(targets.every(value=>typeof value==='string'&&value.length),source);}
});
