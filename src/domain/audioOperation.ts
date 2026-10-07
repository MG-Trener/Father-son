/** Serializes native audio actions and invalidates continuations after unmount. */
export class AudioOperation {
  private alive = true;
  private revision = 0;
  private locked = false;
  activate() {
    this.alive = true;
  }
  dispose() {
    this.alive = false;
    this.revision++;
    this.locked = false;
  }
  begin(): number | null {
    if (!this.alive || this.locked) return null;
    this.locked = true;
    return ++this.revision;
  }
  valid(token: number) {
    return this.alive && token === this.revision;
  }
  finish(token: number) {
    if (this.valid(token)) this.locked = false;
  }
  get active() {
    return this.alive;
  }
}
