import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';
import { balanceRuntimeConfig } from '../../models/configs/balance-runtime-config';

@Injectable({
  providedIn: 'root',
})
export class GameStateService {
  private money = Math.round(balanceRuntimeConfig.economy.startMoney);
  private readonly moneyChanged = new BehaviorSubject<number>(Math.round(balanceRuntimeConfig.economy.startMoney));
  private baseHealth = 20;
  private readonly baseHealthChanged = new BehaviorSubject<number>(20);
  public moneyChanged$ = this.moneyChanged.asObservable();
  public baseHealthChanged$ = this.baseHealthChanged.asObservable();

  public getMoney(): number {
    return this.money;
  }

  public getBaseHealth(): number {
    return this.baseHealth;
  }

  public addReward(amount: number): void {
    this.money += amount;
    this.moneyChanged.next(this.money);
  }

  public spendMoney(amount: number): void {
    this.money -= amount;
    this.moneyChanged.next(this.money);
  }

  public damageBase(amount: number): void {
    this.baseHealth = Math.max(0, this.baseHealth - amount);
    this.baseHealthChanged.next(this.baseHealth);
  }

  public getSnapshot(): { money: number; baseHealth: number } {
    return {
      money: this.money,
      baseHealth: this.baseHealth,
    };
  }

  public restoreSnapshot(snapshot: { money: number; baseHealth: number }): void {
    this.money = snapshot.money;
    this.baseHealth = snapshot.baseHealth;
    this.moneyChanged.next(this.money);
    this.baseHealthChanged.next(this.baseHealth);
  }
}
