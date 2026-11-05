import assert from 'node:assert/strict'; import test from 'node:test'; import { buildFinancialInsights } from './financialInsights';
test('financial insights flag real budget overruns and category changes',()=>{
 const result=buildFinancialInsights({currentCategoryTotals:new Map([['Alimentación',900],['Internet',1200]]),previousCategoryTotals:new Map([['Internet',500]]),categoryBudgets:new Map([['Internet',1000]]),totalExpenses:4000,previousExpenses:1000,deposits:0,previousDeposits:0,trendExpenses:[0,0],averageExpenses:500,goals:[],hasMovements:true});
 assert.deepEqual(result.map(item=>item.code),['expenses_increased','category_increased','budget_exceeded']);
 assert.equal(result[2].amount,200);
});
test('savings goals and transfers alone do not become expense insights',()=>{
 const result=buildFinancialInsights({currentCategoryTotals:new Map(),previousCategoryTotals:new Map(),categoryBudgets:new Map(),totalExpenses:0,previousExpenses:0,deposits:100,previousDeposits:0,trendExpenses:[0,0,0],averageExpenses:0,goals:[],hasMovements:true});
 assert.deepEqual(result.map(item=>item.code),['savings_increased']);
});
