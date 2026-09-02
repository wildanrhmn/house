"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SmoothScroll } from "./SmoothScroll";
import { HowItWorks } from "./HowItWorks";
import { HeroBook } from "./HeroBook";
import { Floor } from "./Floor";
import { HouseLogo } from "./HouseLogo";

gsap.registerPlugin(useGSAP);

const TAPE: [string, string, string?][] = [
  ["Chain", "Somnia Shannon 50312"],
  ["Venue", "DreamDEX BTC 15m"],
  ["Order", "PostOnly"],
  ["Up", "BUY_YES", "up"],
  ["Down", "BUY_NO", "down"],
  ["Inventory", "Zero"],
  ["Fill", "Complete set"],
  ["SDK", "0.29.0"],
  ["Vault", "None"],
  ["Seller", "None"],
];

const WHAT_TITLE = "Not a prettier CLOB. Not a vault. A wallet that is the book.";

const CONTRASTS = [
  {
    k: "CLOB",
    t: "Needs a seller",
    p: "Someone has to be on the other side of your trade. HOUSE does not wait for that.",
  },
  {
    k: "Vault",
    t: "Needs a bankroll",
    p: "Idle capital, share tokens, a protocol to babysit. That is a different product.",
  },
  {
    k: "HOUSE",
    t: "Needs a wallet",
    p: "Rest BUY_YES under mid and BUY_NO over it. Takers mint. You keep the spread.",
    on: true,
  },
];

function Letters({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <span aria-hidden="true">
      {words.map((word, wi) => (
        <span key={wi}>
          <span className="land-word">
            {word.split("").map((ch, ci) => (
              <span className="land-letter" key={ci}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".land-intro", { autoAlpha: 0, display: "none" });
        gsap.set(
          ".land-nav, .land-hero-copy > *, .book, .land-cta, .land-tape",
          { autoAlpha: 1, y: 0, x: 0, rotation: 0, clearProps: "transform" },
        );
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set([".land-nav", ".land-cta"], { autoAlpha: 0 });
        gsap.set(".book", { y: 28, autoAlpha: 0 });
        gsap.set(".book-row, .book-mid, .book-foot", { y: 10, autoAlpha: 0 });
        gsap.set(".land-tape", { autoAlpha: 0, y: 12 });
        gsap.set(".land-hero .land-kicker", { y: 16, autoAlpha: 0 });
        gsap.set(".land-title", { y: 48, autoAlpha: 0 });
        gsap.set(".land-watermark", { y: 70, autoAlpha: 0 });
        gsap.set(".land-lede", { y: 18, autoAlpha: 0 });
        gsap.set(".land-intro-mark", { autoAlpha: 0, letterSpacing: "0.55em" });
        gsap.set(".land-reveal", { y: 36, autoAlpha: 0 });

        const boot = gsap.timeline({ defaults: { ease: "power3.out" } });
        boot
          .to(".land-intro-mark", { autoAlpha: 1, letterSpacing: "0.22em", duration: 0.7 })
          .to(".land-intro", { autoAlpha: 0, duration: 0.45, delay: 0.35, ease: "power2.inOut" })
          .set(".land-intro", { display: "none" });

        const intro = gsap.timeline({ delay: 1.2, defaults: { ease: "power2.out" } });
        intro
          .to(".land-nav", { autoAlpha: 1, duration: 0.4 })
          .to(".land-hero .land-kicker", { y: 0, autoAlpha: 1, duration: 0.4 }, "<0.06")
          .to(".land-title", { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out" }, "<0.08")
          .to(".land-watermark", { y: 0, autoAlpha: 1, duration: 1.3, ease: "power3.out" }, "<")
          .to(".land-lede", { y: 0, autoAlpha: 1, duration: 0.5 }, "<0.12")
          .to(".land-cta", { autoAlpha: 1, duration: 0.4 }, "<0.1")
          .to(".book", { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out" }, "-=0.35")
          .to(
            ".book-row, .book-mid, .book-foot",
            { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.05, ease: "power2.out" },
            "<0.15",
          )
          .to(".land-tape", { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.1")
          .add(() => ScrollTrigger.refresh());

        gsap.to(".land-watermark", {
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: ".land-hero",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        gsap.utils.toArray<HTMLElement>(".land-reveal").forEach((el) => {
          gsap.to(el, {
            y: 0,
            autoAlpha: 1,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
              once: true,
            },
          });
        });

        const what = root.current?.querySelector<HTMLElement>(".land-what");
        if (what) {
          const kicker = what.querySelector<HTMLElement>(".land-kicker");
          const title = what.querySelector<HTMLElement>("h2");
          const letters = what.querySelectorAll<HTMLElement>(".land-letter");
          const thesis = what.querySelector<HTMLElement>(".land-thesis");
          const cards = gsap.utils.toArray<HTMLElement>(".land-contrast", what);
          const onEnter = (el: Element | null, fn: () => void) => {
            if (el) ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: fn });
          };

          gsap.set([kicker, thesis], { y: 24, autoAlpha: 0 });
          gsap.set(letters, { y: 40, autoAlpha: 0, scale: 0.9 });
          cards.forEach((card) => {
            const sign = Math.random() > 0.5 ? -1 : 1;
            gsap.set(card, { rotation: sign * gsap.utils.random(10, 15), scale: 0.88, y: 28, autoAlpha: 0 });
          });

          onEnter(kicker, () => gsap.to(kicker, { y: 0, autoAlpha: 1, duration: 0.45, ease: "expo.out" }));
          onEnter(title, () =>
            gsap.to(letters, {
              y: 0,
              autoAlpha: 1,
              scale: 1,
              duration: 0.4,
              ease: "back.out(1.4)",
              stagger: 0.02,
              delay: 0.1,
            }),
          );
          onEnter(thesis, () =>
            gsap.to(thesis, { y: 0, autoAlpha: 1, duration: 0.45, ease: "expo.out", delay: 0.35 }),
          );
          cards.forEach((card, i) => {
            const delay = 0.4 + i * 0.08;
            onEnter(card, () => {
              gsap.to(card, { rotation: 0, duration: 0.38, ease: "back.out(1.4)", delay });
              gsap.to(card, { scale: 1, duration: 0.34, ease: "back.out(1.4)", delay: delay + 0.03 });
              gsap.to(card, { y: 0, autoAlpha: 1, duration: 0.45, ease: "expo.out", delay });
            });
          });
        }
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="land">
      <SmoothScroll />
      <div className="land-intro" aria-hidden="true">
        <p className="land-intro-mark">HOUSE</p>
      </div>

      <nav className="land-nav">
        <span className="land-nav-mark">
          <HouseLogo size={17} />
        </span>
        <div className="land-nav-links">
          <a href="#what">What</a>
          <a href="#how">How</a>
          <a href="#judges">Floor</a>
          <Link className="solid" href="/desk">
            Open the desk
          </Link>
        </div>
      </nav>

      <section className="land-hero">
        <p className="land-watermark" aria-hidden="true">
          HOUSE
        </p>
        <div className="land-hero-inner">
          <div className="land-hero-copy">
            <p className="land-kicker">A wallet that is the book</p>
            <h1 className="land-title">Be the book.</h1>
            <p className="land-lede">
              Event Contracts let two buyers mint a complete set with no seller. HOUSE lets a
              normal wallet quote both sides, rest the spread, and keep the next window tight.
            </p>
            <div className="land-cta">
              <Link className="solid" href="/desk">
                Quote both sides
              </Link>
              <a className="ghost" href="#how">
                How it works
              </a>
            </div>
          </div>

          <div className="land-hero-visual">
            <HeroBook />
          </div>
        </div>
      </section>

      <div className="land-tape" aria-hidden="true">
        <div className="land-tape-track">
          {[0, 1].map((copy) => (
            <div className="land-tape-loop" key={copy}>
              {[...TAPE, ...TAPE].map(([k, v, tone], i) => (
                <span
                  className={tone ? `land-tape-item land-tape-${tone}` : "land-tape-item"}
                  key={`${copy}-${i}`}
                >
                  <em>{k}</em>
                  <strong>{v}</strong>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="land-block land-what" id="what">
        <p className="land-kicker">What this is</p>
        <h2 aria-label={WHAT_TITLE}>
          <Letters text={WHAT_TITLE} />
        </h2>
        <p className="land-thesis">
          DreamDEX already lets two opposite buyers mint a complete set. The docs say it.
          Nobody shipped a product that lets a normal wallet sit on both sides with zero
          inventory.
        </p>
        <div className="land-contrasts">
          {CONTRASTS.map((c) => (
            <article className={c.on ? "land-contrast land-contrast-on" : "land-contrast"} key={c.k}>
              <span>{c.k}</span>
              <strong>{c.t}</strong>
              <p>{c.p}</p>
            </article>
          ))}
        </div>
      </section>

      <HowItWorks />

      <Floor />

      <section className="land-end land-reveal">
        <p className="land-kicker">The next window is 15 minutes</p>
        <h2>The window is open.</h2>
        <p>Connect a Shannon wallet. Quote both sides. Keep the spread.</p>
        <Link className="solid" href="/desk">
          Open the desk
        </Link>
      </section>
    </div>
  );
}
