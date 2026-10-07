import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchText } from './utils.ts';
test('Vietnamese search handles accents, d-stroke, case, partial text and empty fields', () => {
for (const [name,query] of [['Đường Nước','duong'],['Bột Matcha','bot ma'],['NGUYỄN ĐẶNG','nguyen dang'],['đậu đỏ','ĐẬU']]) assert.ok(normalizeSearchText(name).includes(normalizeSearchText(query)));
assert.equal(normalizeSearchText('Đường'.normalize('NFD')), 'duong');
assert.equal(normalizeSearchText(null), '');
assert.equal(normalizeSearchText(undefined), '');
assert.ok(!normalizeSearchText('Bột Matcha').includes(normalizeSearchText('cacao')));
});
