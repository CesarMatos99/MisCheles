import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarDayCount, comparePeriodMetric, equivalentDayRanges, expenseCategoryDistribution, isPeriodInProgress, isValidAnalyticsRange, monthRangeForDate, resolveComparisonRanges, samePeriodPreviousYear, sortCategoryExpenses, highestCategoryExpense, summarizeAnnualEvolution, summarizeAnalyticsPeriod } from './analyticsPeriodComparison';
import { filterAnalyticsMovements } from './analyticsMovementFilter';
import type { SavingsMovement, Transaction } from '../types';
const tx=(id:string,type:'income'|'expense',amount:number,category:string,relatedSavingsMovementId?:string):Transaction=>({id,type,amount,category,description:id,monthKey:'2026-11',date:'2026-11-02',paymentMethod:relatedSavingsMovementId?'Transferencia a Ahorro':'Efectivo',createdAt:1,relatedSavingsMovementId});
const monthConfigs={'2026-11':{monthKey:'2026-11',year:2026,month:11,initialIncome:0,carryoverFromPrev:0,autoRolloverEnabled:false,isConfigured:true}};

test('validates custom date ranges and month quick ranges',()=>{
  assert.equal(isValidAnalyticsRange({from:'2026-11-01',to:'2026-11-30'}),true);
  assert.equal(isValidAnalyticsRange({from:'2026-11-31',to:'2026-12-01'}),false);
  assert.equal(isValidAnalyticsRange({from:'2026-11-10',to:'2026-11-01'}),false);
  assert.deepEqual(monthRangeForDate(new Date(2026,10,15)),{from:'2026-11-01',to:'2026-11-30'});
  assert.deepEqual(samePeriodPreviousYear({from:'2024-02-29',to:'2024-03-10'}),{from:'2023-02-28',to:'2023-03-10'});
});

test('counts inclusive periods of different durations',()=>{
  assert.equal(calendarDayCount({start:new Date(2026,10,1),end:new Date(2026,10,30)}),30);
  assert.equal(calendarDayCount({start:new Date(2026,9,1),end:new Date(2026,9,31)}),31);
});

test('offers equivalent days for an ongoing range without changing selected ranges',()=>{
  const a={start:new Date(2026,10,1),end:new Date(2026,10,30)};
  const b={start:new Date(2026,9,1),end:new Date(2026,9,31)};
  const resolved=equivalentDayRanges(a,b,new Date(2026,10,7));
  assert.equal(isPeriodInProgress(a,new Date(2026,10,7)),true);
  assert.equal(resolved.applied,true); assert.equal(resolved.days,7);
  assert.equal(calendarDayCount(a),30); assert.equal(calendarDayCount(b),31);
  assert.equal(calendarDayCount(resolved.a),7); assert.equal(calendarDayCount(resolved.b),7);
});

test('uses A minus B, B as percentage base, and direction-aware favorability',()=>{
  const income=comparePeriodMetric(1671000,65000,'income');
  assert.equal(income.difference,1606000); assert.equal(income.variationPercent,2470.769230769231); assert.equal(income.favorable,'good');
  assert.equal(comparePeriodMetric(400,600,'expense').favorable,'good');
  assert.equal(comparePeriodMetric(600,400,'expense').favorable,'bad');
  assert.equal(comparePeriodMetric(0,600,'savings').favorable,'bad');
  assert.equal(comparePeriodMetric(100,0,'income').variationPercent,null);
});

test('distribution excludes savings mirrors and the savings classifier and shares sum to 100%',()=>{
  const transactions=[tx('groceries','expense',750,'Supermercado'),tx('salary','income',10000,'Salario'),tx('mirror','expense',250,'Ahorros','deposit')];
  const savings:SavingsMovement[]=[{id:'deposit',monthKey:'2026-11',type:'deposit_from_month',amount:250,description:'Aporte',date:'2026-11-02',createdAt:1},{id:'rent',monthKey:'2026-11',type:'direct_expense',amount:250,description:'Renta',category:'Vivienda',date:'2026-11-03',createdAt:2},{id:'bad-category',monthKey:'2026-11',type:'direct_expense',amount:100,description:'Ahorro',category:'Ahorro',date:'2026-11-03',createdAt:3}];
  const rows=expenseCategoryDistribution(transactions,savings);
  assert.deepEqual(rows.map(row=>row.category),['Supermercado','Vivienda']);
  assert.equal(rows[0].share+rows[1].share,100);
  assert.equal(rows[0].share,75);
});

test('shared movement filters and summary keep income, expenses, savings separate in custom periods',()=>{
  const transactions=[tx('income','income',1671000,'Trabajo'),tx('food','expense',750,'Supermercado'),tx('mirror','expense',250,'Ahorros','deposit')];
  const savings:SavingsMovement[]=[{id:'deposit',monthKey:'2026-11',type:'deposit_from_month',amount:250,description:'Aporte',date:'2026-11-02',createdAt:1},{id:'rent',monthKey:'2026-11',type:'direct_expense',amount:250,description:'Renta',category:'Vivienda',date:'2026-11-03',createdAt:2}];
  const filtered=filterAnalyticsMovements(transactions,savings,'all');
  const summary=summarizeAnalyticsPeriod({transactions:filtered.transactions,savingsMovements:filtered.savingsMovements,monthConfigs,range:{start:new Date(2026,10,1),end:new Date(2026,10,10)},category:'Todas',movementType:'all',includeInitialIncome:true});
  assert.equal(summary.income,1671000); assert.equal(summary.expenses,1000); assert.equal(summary.savings,250);
  assert.equal(summary.categories.get('Supermercado'),750); assert.equal(summary.categories.get('Vivienda'),250);
});

test('comparison has no preselected periods and resolves only complete valid selections',()=>{
  const empty={mode:'months' as const,monthA:'',monthB:'',rangeAFrom:'',rangeATo:'',rangeBFrom:'',rangeBTo:''};
  assert.equal(resolveComparisonRanges(empty),null);
  const months=resolveComparisonRanges({...empty,monthA:'2026-11',monthB:'2025-11'});
  assert.equal(months?.a.start.toISOString().slice(0,10),'2026-11-01');
  assert.equal(months?.a.end.toISOString().slice(0,10),'2026-11-30');
  assert.equal(months?.b.start.toISOString().slice(0,10),'2025-11-01');
  assert.equal(resolveComparisonRanges({...empty,monthA:'2026-13',monthB:'2026-10'}),null);
  const ranges=resolveComparisonRanges({...empty,mode:'ranges',rangeAFrom:'2026-11-01',rangeATo:'2026-11-07',rangeBFrom:'2026-10-01',rangeBTo:'2026-10-31'});
  assert.equal(calendarDayCount(ranges!.a),7); assert.equal(calendarDayCount(ranges!.b),31);
  assert.equal(resolveComparisonRanges({...empty,mode:'ranges',rangeAFrom:'2026-11-08',rangeATo:'2026-11-07',rangeBFrom:'2026-10-01',rangeBTo:'2026-10-31'}),null);
});

test('quick chart ordering and highest expense use amounts independently of list sort',()=>{
  const rows=[{category:'Alimentación',amount:9000,share:68.2},{category:'Internet',amount:2200,share:16.7},{category:'Regalo',amount:2000,share:15.1}];
  assert.deepEqual(sortCategoryExpenses(rows).map(row=>row.category),['Alimentación','Internet','Regalo']);
  assert.deepEqual(sortCategoryExpenses(rows,'low').map(row=>row.category),['Regalo','Internet','Alimentación']);
  assert.equal(highestCategoryExpense(sortCategoryExpenses(rows,'low'))?.category,'Alimentación');
});
test('annual evolution includes only active months and avoids a trend conclusion for one month',()=>{
  const one=summarizeAnnualEvolution([{key:'2026-01',label:'ene',income:1000,expenses:200,saved:0},{key:'2026-02',label:'feb',income:0,expenses:0,saved:0}]);
  assert.equal(one.activeMonths.length,1); assert.equal(one.averageMonthlyExpenses,200); assert.equal(one.expenseTrend,null);
  const many=summarizeAnnualEvolution([{key:'2026-01',label:'ene',income:1000,expenses:200,saved:0},{key:'2026-02',label:'feb',income:0,expenses:0,saved:0},{key:'2026-03',label:'mar',income:0,expenses:300,saved:50}]);
  assert.deepEqual(many.activeMonths.map(month=>month.key),['2026-01','2026-03']); assert.equal(many.averageMonthlyExpenses,250); assert.equal(many.expenseTrend,100);
});
