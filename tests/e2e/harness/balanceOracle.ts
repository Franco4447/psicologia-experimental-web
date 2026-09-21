import type { InductionGroup } from './types.ts';

export interface GroupCounts {
  racional: number;
  emocional: number;
  control: number;
}

export class BalanceOracle {
  private counts: GroupCounts = {
    racional: 0,
    emocional: 0,
    control: 0,
  };
  private excludedCount: number = 0;

  constructor(initialCounts?: Partial<GroupCounts>) {
    if (initialCounts) {
      this.counts = {
        racional: initialCounts.racional ?? 0,
        emocional: initialCounts.emocional ?? 0,
        control: initialCounts.control ?? 0,
      };
    }
  }

  /**
   * Returns current counts for included participants across the 3 groups.
   */
  public getCounts(): GroupCounts {
    return { ...this.counts };
  }

  public getExcludedCount(): number {
    return this.excludedCount;
  }

  public getTotalIncluded(): number {
    return this.counts.racional + this.counts.emocional + this.counts.control;
  }

  /**
   * Computes the delta between maximum and minimum group sizes.
   */
  public getBalanceDelta(): number {
    const vals = [this.counts.racional, this.counts.emocional, this.counts.control];
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    return max - min;
  }

  /**
   * Asserts whether the balance invariant holds (delta <= maxAllowedDelta).
   */
  public isBalanced(maxAllowedDelta: number = 1): boolean {
    return this.getBalanceDelta() <= maxAllowedDelta;
  }

  /**
   * Simulates the Supabase RPC `assign_induction_group()` with advisory lock protection.
   * If isIncluded is false, returns 'control' without incrementing quota counts.
   */
  public assignGroup(isIncluded: boolean): InductionGroup {
    if (!isIncluded) {
      this.excludedCount++;
      return 'control';
    }

    // Critical section simulated via advisory lock
    const vals = [
      { grp: 'racional' as InductionGroup, count: this.counts.racional },
      { grp: 'emocional' as InductionGroup, count: this.counts.emocional },
      { grp: 'control' as InductionGroup, count: this.counts.control },
    ];

    const minCount = Math.min(...vals.map((v) => v.count));
    const candidates = vals.filter((v) => v.count === minCount).map((v) => v.grp);

    // Pick uniformly among candidate groups with minimal count
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this.counts[chosen]++;
    return chosen;
  }

  /**
   * Resets counts to zero.
   */
  public reset(): void {
    this.counts = { racional: 0, emocional: 0, control: 0 };
    this.excludedCount = 0;
  }
}
