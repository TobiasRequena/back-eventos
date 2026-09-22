const test = require('node:test');
const assert = require('node:assert');
const descripcionAHtml = require('./descripcionHtml');

test('formato, lista y links', () => {
  assert.strictEqual(
    descripcionAHtml('**a** *b* ~~c~~ ***d***\n- uno\n- dos\nfin https://x.com/y.'),
    '<strong>a</strong> <em>b</em> <s>c</s> <strong><em>d</em></strong>'
    + '<ul style="margin: 4px 0; padding-left: 20px;"><li>uno</li><li>dos</li></ul>'
    + 'fin <a href="https://x.com/y" style="color: #1E3A5F;">https://x.com/y</a>.',
  );
});

test('escapa HTML y no linkea otros esquemas', () => {
  const html = descripcionAHtml('<script>alert(1)</script> **<b>x</b>** javascript:alert(1) <https://a.com>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<b>'));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes('href="https://a.com"'));
});

test('links con [texto](url), sin autolinkear ni permitir otros esquemas', () => {
  assert.strictEqual(
    descripcionAHtml('mira [algo.com](https://algo.com/) y **[negrita](http://b.com)**'),
    'mira <a href="https://algo.com/" style="color: #1E3A5F;">algo.com</a> y '
    + '<strong><a href="http://b.com" style="color: #1E3A5F;">negrita</a></strong>',
  );
  const html = descripcionAHtml('[x](javascript:alert(1)) [y](https://a.com/"onmouseover="1)');
  assert.ok(!html.includes('href="javascript'));
  assert.ok(!/href="[^"]*"[^>]*onmouseover/.test(html));
});

test('vacío y marcas escapadas', () => {
  assert.strictEqual(descripcionAHtml(''), '');
  assert.strictEqual(descripcionAHtml(String.raw`2\*3`), '2*3');
});
