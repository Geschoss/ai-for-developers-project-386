// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the smallest Лимит бронирований is 1
const minimumPerDay = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the largest Лимит бронирований is 18
const maximumPerDay = 18;

/** How many Бронирования one email may hold on one civil day of a Календарь. */
class DailyBookingLimit {
  private constructor(public readonly perDay: number) {}

  public static parse(perDay: number): DailyBookingLimit {
    if (!Number.isInteger(perDay) || perDay < minimumPerDay || perDay > maximumPerDay) {
      throw new Error(`Daily booking limit ${String(perDay)} is outside 1..18`);
    }
    return new DailyBookingLimit(perDay);
  }

  public reached(count: number): boolean {
    return count >= this.perDay;
  }
}

export { DailyBookingLimit };
