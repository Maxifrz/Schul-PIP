/**
 * How long to wait between two refreshes of an open chat or board: three seconds while things happen, then slower the
 * longer nothing changes, and back to three seconds with the first change.
 */
export class PollPacing {
  private quiet = 0;

  /** The milliseconds to wait after a refresh that did or did not bring something new. */
  next(changed: boolean): number {
    this.quiet = changed ? 0 : this.quiet + 1;
    if (this.quiet < 4) return 3000;
    if (this.quiet < 8) return 6000;
    return 12000;
  }
}
