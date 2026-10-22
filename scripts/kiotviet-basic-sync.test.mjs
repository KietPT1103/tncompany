import assert from 'node:assert/strict';
import test from 'node:test';
import { parseKiotVietBasicCatalog } from '../src/lib/kiotVietBasicCatalog.ts';

test('reads the requested fields while ignoring unrelated metadata', () => {
  assert.deepEqual(parseKiotVietBasicCatalog([['Export'],['Giá vốn','Mã món','Tên món','Giá bán','Cho phép bán'],[10,'SP001','Món A',89000,0],[20,'COMBO1','Combo',0,0]]),[
    {product_code:'SP001',product_name:'Món A',price:89000},
    {product_code:'COMBO1',product_name:'Combo',price:0},
  ]);
});
test('parses numbers and common Vietnamese or English currency strings', () => {
  for (const [input, expected] of [['89.000',89000],['89,000',89000],['89.000,50',89000.5],['89,000.50',89000.5],['89000 đ',89000],['0',0]]) {
    assert.equal(parseKiotVietBasicCatalog([['Mã món','Tên món','Giá bán'],['SP1','A',input]])[0].price,expected);
  }
});
test('rejects invalid prices, duplicate codes and incomplete rows instead of skipping them', () => {
  const h=['Mã món','Tên món','Giá bán'];
  for (const price of ['',null,-1,Infinity,'abc']) assert.throws(()=>parseKiotVietBasicCatalog([h,['SP1','A',price]]));
  assert.throws(()=>parseKiotVietBasicCatalog([h,['SP1','A',10],['sp1','B',20]]),/trùng/);
  assert.throws(()=>parseKiotVietBasicCatalog([h,['SP1','',10]]));
  assert.throws(()=>parseKiotVietBasicCatalog([['Tên món','Giá bán'],['A',10]]));
});
