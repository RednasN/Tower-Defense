import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';
import { getActiveBalanceConfig } from '../../models/configs/turret-config.model';

@Injectable({
  providedIn: 'root',
})
export class GameStateService {
  private readonly balance = getActiveBalanceConfig();
  private money = this.balance.economy.startingMoney;
  private readonly moneyChanged = new BehaviorSubject<number>(Math.round(this.balance.economy.startingMoney));
  private baseHealth = this.balance.economy.startingBaseHealth;
  private readonly baseHealthChanged = new BehaviorSubject<number>(this.balance.economy.startingBaseHealth);
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
}
