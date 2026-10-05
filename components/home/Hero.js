'use client';

import Link from 'next/link';
import LandingHeader from './LandingHeader';
import { ArrowRight, ArrowUpRight, Droplet, HelpCircle, PawPrint, Plus } from '@/components/icons/Icons';
import styles from './Hero.module.css';

const TITLE_LINES = [
  ['Every', 'Drop'],
  ['Counts', 'for', 'Pets'],
];
const WORD_DELAY_START = 200;
const WORD_DELAY_STEP = 100;

/**
 * Builds the inline style that delays an entrance animation.
 * @param {number} ms Delay in milliseconds.
 * @return {{animationDelay: string}} Style object to spread onto an element.
 */
function delay(ms) {
  return { animationDelay: `${ms}ms` };
}

/**
 * Hero statistic showing how many pets are registered.
 * @return {JSX.Element} The stat block.
 */
function RegisteredStat() {
  return (
    <div className={styles.hero__stat}>
      <div className={styles.hero__statValue}>2,480</div>
      <div className={styles.hero__statLabel}>
        <span className={styles.hero__avatars}>
          <span className={styles.hero__avatar}>
            <PawPrint size={12} />
          </span>
          <span className={`${styles.hero__avatar} ${styles.hero__avatarMore}`}>
            <Plus size={12} />
          </span>
        </span>
        pets registered
      </div>
    </div>
  );
}

/**
 * Hero statistic showing how many lives have been saved.
 * @return {JSX.Element} The stat block.
 */
function SavedStat() {
  return (
    <div className={styles.hero__stat}>
      <div className={styles.hero__statValue}>
        940
        <Droplet size={22} className={styles.hero__statIcon} />
      </div>
      <div className={styles.hero__statLabel}>lives saved</div>
    </div>
  );
}

/**
 * Main call to action: a link to the dashboard when signed in, otherwise a
 * button that starts registration.
 * @param {{auth: ?Object, onSignInClick: function(): void, className: string,
 *     style: (Object|undefined)}} props Signed-in account, the sign-in handler
 *     and styling for the element.
 * @return {JSX.Element} The link or button.
 */
function PrimaryAction({ auth, onSignInClick, className, style }) {
  if (auth) {
    return (
      <Link href="/dashboard" className={className} style={style}>
        Go to dashboard
        <ArrowRight size={16} />
      </Link>
    );
  }
  return (
    <button type="button" className={className} style={style} onClick={onSignInClick}>
      Register your pet
      <ArrowRight size={16} />
    </button>
  );
}

/**
 * Hero section of the landing page with the animated title, calls to action,
 * feature cards, stats and photos.
 * @param {{auth: ?Object, onSignInClick: function(): void}} props Signed-in
 *     account and the sign-in handler.
 * @return {JSX.Element} The hero section.
 */
export default function Hero({ auth, onSignInClick }) {
  let wordIndex = 0;

  return (
    <div className={styles.hero}>
      <div className={styles.hero__inner}>
        <div className={styles.hero__header} style={delay(100)}>
          <LandingHeader auth={auth} onSignInClick={onSignInClick} />
        </div>

        <div className={styles.hero__body}>
          <h1 className={styles.hero__title}>
            {TITLE_LINES.map((words) => (
              <span key={words.join(' ')} className={styles.hero__line}>
                {words.map((word) => (
                  <span
                    key={word}
                    className={styles.hero__word}
                    style={delay(WORD_DELAY_START + WORD_DELAY_STEP * wordIndex++)}
                  >
                    {word}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p className={styles.hero__subtitle} style={delay(500)}>
            Bloodhound connects your dog, cat, rabbit, or bird with pets in urgent need nearby — a quick vet visit
            that turns your good boy (or bunny) into a lifesaver.
          </p>
          <PrimaryAction
            auth={auth}
            onSignInClick={onSignInClick}
            className={`${styles.hero__cta} ${styles.hero__ctaInline}`}
            style={delay(600)}
          />

          <div className={styles.hero__cards}>
            <a href="#how" className={`${styles.hero__card} ${styles.hero__cardLeft}`} style={delay(600)}>
              <span className={`${styles.hero__cardMedia} ${styles.hero__cardMediaLeft}`}>
                <img className={styles.hero__img} src="/images/home/card-left.jpg" alt="Two dogs running together" />
                <span className={styles.hero__cardArrow}>
                  <ArrowUpRight size={16} />
                </span>
              </span>
              <span className={styles.hero__cardText}>How donating works</span>
              <span className={styles.hero__cardStrong}>3 quick steps</span>
            </a>

            <a href="#faq" className={`${styles.hero__card} ${styles.hero__cardRight}`} style={delay(700)}>
              <span className={`${styles.hero__cardMedia} ${styles.hero__cardMediaRight}`}>
                <img className={styles.hero__img} src="/images/home/card-right.jpg" alt="A tabby cat looking up" />
                <span className={styles.hero__cardAction}>
                  <span className={styles.hero__cardBadge}>
                    <HelpCircle size={18} />
                  </span>
                  <span className={styles.hero__cardCaption}>Is my pet eligible? Read the FAQ</span>
                </span>
              </span>
            </a>
          </div>

          <div className={styles.hero__statsRow} style={delay(800)}>
            <RegisteredStat />
            <span className={styles.hero__statsDivider} />
            <SavedStat />
          </div>

          <div className={styles.hero__photos}>
            <div className={`${styles.hero__photo} ${styles.hero__photoLeft}`} style={delay(800)}>
              <img className={styles.hero__img} src="/images/home/arch-left.jpg" alt="A small dog looking at the camera" />
              <div className={styles.hero__overlay} style={delay(1100)}>
                <RegisteredStat />
              </div>
            </div>

            <div className={`${styles.hero__photo} ${styles.hero__photoCenter}`} style={delay(600)}>
              <img className={styles.hero__img} src="/images/home/arch-center.jpg" alt="A happy beagle" />
              <div className={styles.hero__overlay} style={delay(1000)}>
                <div className={styles.hero__overlayTitle}>Turn your pet into a lifesaver</div>
                <PrimaryAction auth={auth} onSignInClick={onSignInClick} className={styles.hero__cta} />
              </div>
            </div>

            <div className={`${styles.hero__photo} ${styles.hero__photoRight}`} style={delay(900)}>
              <img className={styles.hero__img} src="/images/home/arch-right.jpg" alt="A white rabbit" />
              <div className={styles.hero__overlay} style={delay(1200)}>
                <SavedStat />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
