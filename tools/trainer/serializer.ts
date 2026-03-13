import { BalanceConfig } from '../../src/app/models/configs/balance-types';

export function serializeBalanceConfig(balance: BalanceConfig): string {
  return JSON.stringify(balance, null, 2);
}

export function buildGeneratedBalanceFile(balance: BalanceConfig): string {
  return `import { BalanceConfig } from '../configs/balance-types';\n\nexport const generatedBalanceConfig = ${serializeBalanceConfig(
    balance
  )} as unknown as BalanceConfig;\n`;
}
