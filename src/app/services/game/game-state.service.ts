import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GameStateService {
  private money = 100;
  private readonly moneyChanged = new BehaviorSubject<number>(Math.round(100));
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
}
