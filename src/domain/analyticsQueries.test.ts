import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsMonthStats, analyticsRangeSummary } from './analyticsQueries';
import type { SavingsMovement, Transaction } from '../types';
const tx=(id:string,type:'income'|'expense',amount:number,category:string,relatedSavingsMovementId?:string):Transaction=>({id,type,amount,category,description:id,monthKey:'2026-11',date:'2026-11-02',paymentMethod:relatedSavingsMovementId?'Transferencia a Ahorro':'Efectivo',createdAt:1,relatedSavingsMovementId});
test('analytics month totals keep income, expense and savings transfer separate and deduplicated',()=>{
 const transactions=[tx('income','income',200000,'Trabajo Extra'),tx('expense','expense',5000,'Alimentación'),tx('mirror','expense',40000,'Aporte al Ahorro','deposit')];
 const savings: SavingsMovement[]=[{id:'deposit',monthKey:'2026-11',type:'deposit_from_month',amount:40000,description:'Aporte',date:'2026-11-02',createdAt:1},{id:'direct',monthKey:'2026-11',type:'direct_expense',amount:3000,description:'Salud',category:'Salud',date:'2026-11-03',createdAt:2}];
 const result=analyticsMonthStats({monthKey:'2026-11',transactions,savingsMovements:savings,monthConfigs:{'2026-11':{monthKey:'2026-11',year:2026,month:11,initialIncome:1000,carryoverFromPrev:0,autoRolloverEnabled:false,isConfigured:true}},includeInitialIncome:true});
 assert.equal(result.income,201000); assert.equal(result.expenses,8000); assert.equal(result.saved,40000); assert.equal(result.cats.get('Alimentación'),5000); assert.equal(result.cats.get('Salud'),3000);
});

test('filtered full-period available balance uses the shared financial formula and excludes direct savings payments from cash outflow',()=>{
 const transactions=[tx('income','income',200000,'Trabajo Extra'),tx('expense','expense',5000,'Alimentación'),tx('mirror','expense',40000,'Aporte al Ahorro','deposit')];
 const savings:SavingsMovement[]=[
 {id:'deposit',monthKey:'2026-11',type:'deposit_from_month',amount:40000,description:'Aporte',date:'2026-11-03',createdAt:1},
 {id:'withdraw',monthKey:'2026-11',type:'withdraw_to_month',amount:10000,description:'Retiro',date:'2026-11-04',createdAt:2},
 {id:'direct',monthKey:'2026-11',type:'direct_expense',amount:3000,description:'Salud',category:'Salud',date:'2026-11-05',createdAt:3},
 ];
 const result=analyticsRangeSummary({transactions,savingsMovements:savings,monthConfigs:{'2026-11':{monthKey:'2026-11',year:2026,month:11,initialIncome:5000,carryoverFromPrev:1000,autoRolloverEnabled:false,isConfigured:true}},range:{start:new Date(2026,10,1),end:new Date(2026,10,30)},category:'Todas',movementType:'all',includeInitialIncome:true,elapsedDays:30});
 assert.equal(result.totalIncome,205000); assert.equal(result.totalExpenses,8000); assert.equal(result.deposits,40000); assert.equal(result.withdrawals,10000); assert.equal(result.available,171000);
});
