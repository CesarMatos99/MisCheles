import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveSavingsGoalBalance, savingsGoalMovementNet, savingsGoalOpeningBalance } from './savingsBalance';
import type { SavingsGoal, SavingsMovement } from '../types';
const goal: SavingsGoal={id:'g1',title:'Fondo',targetAmount:1000,currentAmount:100};
const movements:SavingsMovement[]=[
{id:'d1',monthKey:'2026-10',type:'deposit_from_month',amount:200,description:'Aporte',date:'2026-10-01',createdAt:1,goalId:'g1'},
{id:'w1',monthKey:'2026-10',type:'withdraw_to_month',amount:50,description:'Retiro',date:'2026-10-02',createdAt:2,goalId:'g1'},
{id:'old',monthKey:'2026-09',type:'deposit_from_month',amount:400,description:'Histórico cerrado',date:'2026-09-01',createdAt:3,goalId:'g1',balanceAffecting:false},
];
test('goal balance ignores history explicitly marked non-affecting and round-trips opening balance',()=>{
 assert.equal(savingsGoalMovementNet('g1',movements),150); assert.equal(deriveSavingsGoalBalance(goal,movements),250);
 assert.equal(savingsGoalOpeningBalance(goal,250,movements).currentAmount,100);
});
