/// <reference lib="dom" />
// How a person moves through the app on camera: a visible touch on every tap, smooth scrolling
// instead of jumps, typing at a human pace, and pauses long enough to read.
import type { BrowserContext, Locator, Page } from 'playwright';
import type { Take } from './recorder';

/**
 * A touch mark like iOS "Show touches": a ring that grows and fades where the finger lands. A
 * manual popover, so it is drawn in the top layer — above modal dialogs and sheets too.
 */
export async function installTouchMarks(context: BrowserContext): Promise<void> {
  // tsx (esbuild, keepNames) wraps named functions in `__name(...)`; functions sent to the page
  // carry that call with them, so the page needs the helper too.
  await context.addInitScript('globalThis.__name = (fn) => fn;');
  await context.addInitScript(() => {
    const css = `.demo-touch{position:fixed;inset:auto;margin:0;padding:0;width:46px;height:46px;border-radius:50%;
      border:2.5px solid rgba(20,24,22,.55);background:rgba(20,24,22,.16);pointer-events:none;overflow:visible;
      transform:translate(-50%,-50%) scale(.55);opacity:1;transition:transform .5s cubic-bezier(.2,.7,.3,1),opacity .5s ease-out}
      .demo-touch.go{transform:translate(-50%,-50%) scale(1.35);opacity:0}`;
    addEventListener(
      'pointerdown',
      (e) => {
        if (!document.getElementById('demo-touch-css')) {
          const style = document.createElement('style');
          style.id = 'demo-touch-css';
          style.textContent = css;
          document.head.append(style);
        }
        const ring = document.createElement('div');
        ring.className = 'demo-touch';
        ring.setAttribute('popover', 'manual');
        ring.setAttribute('aria-hidden', 'true');
        ring.style.left = `${e.clientX}px`;
        ring.style.top = `${e.clientY}px`;
        document.body.append(ring);
        ring.showPopover();
        requestAnimationFrame(() => requestAnimationFrame(() => ring.classList.add('go')));
        setTimeout(() => ring.remove(), 650);
      },
      { capture: true, passive: true },
    );
  });
}

export class Scene {
  constructor(
    readonly page: Page,
    readonly take: Take,
  ) {}

  /** Marks a beat of the scenario at this moment of the video. */
  beat(id: string): void {
    this.take.mark(id);
    this.log(`beat ${id}`);
  }

  /** With DEMO_DEBUG=1: where the time of a take goes. */
  log(what: string): void {
    if (process.env.DEMO_DEBUG) console.log(`  ${this.take.now().toFixed(1).padStart(5)} s  ${what}`);
  }

  pause(ms: number): Promise<void> {
    return this.page.waitForTimeout(ms);
  }

  /** Brings the element into view with a smooth scroll of its own scroller (window or a sheet). */
  async reveal(target: Locator, { block = 'center', ms = 750 }: { block?: 'center' | 'start' | 'end'; ms?: number } = {}) {
    this.log(`reveal ${target}`);
    await target.waitFor({ state: 'visible' });
    this.log('  visible');
    await target.evaluate(
      async (el, { block, ms }) => {
        const scroller = (() => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowY;
            if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
          }
          return document.scrollingElement as HTMLElement;
        })();
        const isPage = scroller === document.scrollingElement;
        const view = isPage
          ? { top: 0, height: innerHeight }
          : { top: scroller.getBoundingClientRect().top, height: scroller.clientHeight };
        const box = el.getBoundingClientRect();
        // Room for the sticky header above and the tab bar below.
        const pad = isPage ? 96 : 24;
        if (box.top >= view.top + pad && box.bottom <= view.top + view.height - pad) return;
        const offset =
          block === 'start'
            ? box.top - view.top - pad
            : block === 'end'
              ? box.bottom - view.top - view.height + pad
              : box.top + box.height / 2 - view.top - view.height / 2;
        const from = scroller.scrollTop;
        const to = Math.max(0, Math.min(from + offset, scroller.scrollHeight - scroller.clientHeight));
        const start = performance.now();
        const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        await new Promise<void>((done) => {
          const step = (now: number) => {
            const t = Math.min(1, (now - start) / ms);
            scroller.scrollTop = from + (to - from) * ease(t);
            if (t < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
      },
      { block, ms },
    );
    this.log('  scrolled');
    await this.pause(150);
  }

  /** Smooth scroll of the page (or of the open sheet when `within` is given) by `dy` CSS pixels. */
  async scroll(dy: number, { ms = 900, within }: { ms?: number; within?: Locator } = {}) {
    await (within ?? this.page.locator('html')).evaluate(
      async (el, args) => {
        const scroller = (el === document.documentElement ? document.scrollingElement : el) as HTMLElement;
        const from = scroller.scrollTop;
        const to = Math.max(0, Math.min(from + args.dy, scroller.scrollHeight - scroller.clientHeight));
        const start = performance.now();
        const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        await new Promise<void>((done) => {
          const step = (now: number) => {
            const t = Math.min(1, (now - start) / args.ms);
            scroller.scrollTop = from + (to - from) * ease(t);
            if (t < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
      },
      { dy, ms },
    );
    await this.pause(150);
  }

  /** A tap the viewer can follow: into view, a beat to look, the touch mark, then time to see the result. */
  async tap(target: Locator, label: string, { after = 700, before = 250 }: { after?: number; before?: number } = {}) {
    await this.reveal(target);
    await this.pause(before);
    await this.take.tapAt(target, label);
    this.log(`tap ${label}`);
    await target.click();
    await this.pause(after);
  }

  /**
   * A choice in a native select. The phone's own picker never reaches the screencast, so the touch
   * is shown on the field and the value changes as if picked.
   */
  async choose(target: Locator, option: string, label: string, { after = 900 }: { after?: number } = {}) {
    await this.reveal(target);
    await this.pause(250);
    await this.take.tapAt(target, label);
    await this.touchMark(target);
    await this.pause(450);
    await target.selectOption({ label: option });
    await this.pause(after);
  }

  /** Drags a range slider from one end to the other, slowly enough to watch. */
  async drag(target: Locator, label: string, { ms = 2400, from = 0.02, to = 0.98 } = {}) {
    await this.reveal(target);
    const box = await target.boundingBox();
    if (!box) throw new Error(`drag: ${label} has no box`);
    const y = box.y + box.height / 2;
    const x0 = box.x + box.width * from;
    const x1 = box.x + box.width * to;
    await this.take.tapAt(target, label);
    await this.page.mouse.move(x0, y);
    await this.page.mouse.down();
    const steps = Math.round(ms / 40);
    for (let i = 1; i <= steps; i++) {
      await this.page.mouse.move(x0 + ((x1 - x0) * i) / steps, y);
      await this.pause(ms / steps);
    }
    await this.page.mouse.up();
    await this.pause(300);
  }

  /** The touch ring alone, where nothing real is pressed (see `choose`). */
  private async touchMark(target: Locator) {
    await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }),
      );
    });
  }

  /** Types like a person: a tap into the field, then letter by letter. */
  async type(
    target: Locator,
    text: string,
    { delay = 95, after = 500, label = `pole: ${text}` }: { delay?: number; after?: number; label?: string } = {},
  ) {
    await this.tap(target, label, { after: 200 });
    await target.pressSequentially(text, { delay });
    await this.pause(after);
  }
}
