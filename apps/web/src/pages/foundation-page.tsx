import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/site-header';
import { RecommendationSection } from '../components/recommendation-section';

export const FoundationPage = () => {
  const reduceMotion = useReducedMotion();
  return (
    <main className="bg-porcelain relative flex min-h-screen overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <div
        className="bg-champagne/15 pointer-events-none absolute -top-48 right-[-12rem] size-[36rem] rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col">
        <SiteHeader />

        <section className="grid flex-1 items-center gap-14 py-20 lg:grid-cols-[1.35fr_0.65fr]">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-champagne mb-8 text-xs font-semibold tracking-[0.28em] uppercase">
              New season · everyday essentials
            </p>
            <h1 className="font-display max-w-4xl text-6xl leading-[0.98] tracking-[-0.025em] sm:text-7xl lg:text-[7.5rem]">
              Wear what moves you.
            </h1>
            <p className="text-ink/60 mt-9 max-w-xl text-base leading-7 sm:text-lg">
              Discover elevated streetwear, relaxed layers, and statement pieces designed for real
              days and late nights.
            </p>
            <Link
              className="bg-ink mt-10 inline-block rounded-full px-7 py-3.5 text-xs font-semibold tracking-[0.14em] text-white uppercase"
              to="/products"
            >
              Explore the collection
            </Link>
          </motion.div>

          <motion.aside
            className="rounded-[2rem] border border-white/80 bg-white/55 p-8 shadow-[0_24px_80px_rgba(65,50,30,0.09)] backdrop-blur-xl"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            <span className="text-ink/45 block text-xs tracking-[0.22em] uppercase">
              The Veyora edit
            </span>
            <p className="font-display mt-12 text-3xl leading-tight">
              Fresh drops. Confident fits.
            </p>
            <div className="bg-ink/10 mt-10 h-px" />
            <p className="text-ink/55 mt-6 text-sm leading-6">
              Shop without an account, check out securely, and follow every order from payment to
              delivery.
            </p>
          </motion.aside>
        </section>
        <RecommendationSection title="Featured pieces" type="featured" />
        <RecommendationSection title="New arrivals" type="newest" />
        <RecommendationSection title="Trending now" type="trending" />
      </div>
    </main>
  );
};
