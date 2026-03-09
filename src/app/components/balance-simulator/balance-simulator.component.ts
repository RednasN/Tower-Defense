import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Subscription } from 'rxjs';

import { DamageType } from '../../models/configs/turret-config.model';
import { BalanceReplayService, ReplayWaveRow } from '../../services/simulation/balance-replay.service';

@Component({
  selector: 'app-balance-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './balance-simulator.component.html',
  styleUrl: './balance-simulator.component.scss',
})
export class BalanceSimulatorComponent implements OnInit, OnDestroy {
  @Output() closeSimulator = new EventEmitter<void>();

  private readonly replayService = inject(BalanceReplayService);
  private stateSubscription: Subscription | null = null;

  public maxWaves = 20;
  public replaySpeed = 2;
  public running = false;
  public paused = false;
  public money = 0;
  public baseHealth = 0;
  public leaks = 0;
  public currentWave = 1;

  public waveRows: ReplayWaveRow[] = [];
  public towerMetrics: { type: string; cost: number; dps: number; dpsPerGold: number }[] = [];
  public buildLog: { wave: number; tower: string; x: number; y: number; cost: number }[] = [];
  public damageByType: Record<DamageType, number> = {
    [DamageType.Bullet]: 0,
    [DamageType.Explosive]: 0,
    [DamageType.Energy]: 0,
    [DamageType.SlowExplosive]: 0,
  };

  public readonly trackByWave = (_: number, row: ReplayWaveRow): number => row.wave;
  public readonly trackByBuild = (index: number): number => index;

  public ngOnInit(): void {
    this.stateSubscription = this.replayService.state$.subscribe(state => {
      this.running = state.running;
      this.paused = state.paused;
      this.money = state.money;
      this.baseHealth = state.baseHealth;
      this.leaks = state.leaks;
      this.currentWave = state.currentWave;
      this.waveRows = state.waveRows;
      this.towerMetrics = state.towerMetrics;
      this.buildLog = state.buildLog;
      this.damageByType = state.damageByType;
    });
  }

  public ngOnDestroy(): void {
    this.stateSubscription?.unsubscribe();
  }

  public close(): void {
    this.closeSimulator.emit();
  }

  public startReplay(): void {
    this.replayService.start({
      maxWaves: this.maxWaves,
      replaySpeed: this.replaySpeed,
    });
  }

  public pauseReplay(): void {
    this.replayService.pause();
  }

  public resumeReplay(): void {
    this.replayService.resume();
  }

  public stopReplay(): void {
    this.replayService.stop();
  }
}
