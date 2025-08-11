// LinkedIn: Auto-Unfollow companies on listing pages
// Usage: Paste into Console on a company listing page → Enter.
// Stop: Press Esc (graceful stop).

(async () => {
  const cfg = {
    maxScrolls: 60,              // maximum scroll cycles
    clickDelay: [300, 800],      // delay between clicks (ms)
    pageDelay:  [800, 1500],     // delay after scroll/batch (ms)
    waitChange: 7000,            // wait for button state change (ms)
    dryRun: false                // true -> log only, no clicks
  };

  const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
  const jitter = (min, max) => min + Math.random() * (max - min);

  // Global stop: Esc
  window.__liStopUnfollow = false;
  const onKey = (e) => { if (e.key === 'Escape') {
      window.__liStopUnfollow = true;
      console.warn('[LI] Stop requested (Esc). Finishing current step…');
  }};
  window.addEventListener('keydown', onKey, { once: false });

  const hasCompanyAnchor = (node) =>
    !!node.querySelector('a[href*="/company/"]');

  const isSubscribedBtn = (btn) => {
    if (!(btn instanceof HTMLButtonElement)) return false;
    if (btn.disabled) return false;
    const t = (btn.innerText || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    // examples: "Subscribed", "Subscribed Acme Inc"
    return t.includes('subscribed') || aria.startsWith('subscribed ');
  };

  const companyName = (card) => {
    // smartly try to extract the company name for logs
    const a = card.querySelector('a[href*="/company/"]');
    const text =
      (a?.innerText || '') ||
      card.querySelector('.hoverable-link-text, .artdeco-entity-lockup__title')?.innerText ||
      '';
    return text.trim().replace(/\s+/g, ' ').slice(0, 120);
  };

  const cardSelector = [
    '.pvs-entity', '.entity-result', '.reusable-search__result-container',
    '.artdeco-entity-lockup', 'li', '.display-flex'
  ].join(',');

  const uniqueByNode = (arr) => [...new Set(arr)];

  const collectCompanyCards = () => {
    // find containers with a /company/ link inside
    const all = [...document.querySelectorAll(cardSelector)]
      .filter(el => hasCompanyAnchor(el));
    // filter out small nested containers
    const pruned = all.filter(el => !all.some(other => other !== el && other.contains(el)));
    return uniqueByNode(pruned);
  };

  const buttonsFromCards = (cards) => {
    const res = [];
    for (const card of cards) {
      // button within the card
      const btns = [...card.querySelectorAll('button')].filter(isSubscribedBtn);
      if (btns.length) {
        // pick the button closest in the DOM tree to the company link, if possible
        const anchor = card.querySelector('a[href*="/company/"]');
        const sorted = anchor
          ? btns.sort((a, b) => a.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_CONTAINED_BY ? -1 : 1)
          : btns;
        res.push({ card, btn: sorted[0] });
      }
    }
    return res;
  };

  const waitStateChange = async (btn, timeoutMs) => {
    return new Promise((resolve) => {
      let done = false;
      const stop = () => { if (!done) { done = true; obs.disconnect(); resolve(); } };
      const obs = new MutationObserver(() => {
        // consider changed if button disappeared OR text is no longer "Subscribed"
        const exists = document.body.contains(btn);
        const t = (btn?.innerText || '').toLowerCase();
        if (!exists || !t.includes('subscribed')) stop();
      });
      if (btn && document.body.contains(btn)) {
        obs.observe(btn, { subtree: true, childList: true, characterData: true });
      } else {
        stop(); // already gone
      }
      setTimeout(stop, timeoutMs);
    });
  };

  const getTargets = () => buttonsFromCards(collectCompanyCards());

  // Main loop
  let totalClicked = 0;
  const seen = new WeakSet();

  for (let s = 0; s < cfg.maxScrolls; s++) {
    if (window.__liStopUnfollow) break;

    const targets = getTargets().filter(({ btn }) => !seen.has(btn));
    if (targets.length === 0) {
      // try to load more by scrolling
    } else {
      for (const { card, btn } of targets) {
        if (window.__liStopUnfollow) break;
        seen.add(btn);

        const name = companyName(card) || '(company)';
        btn.scrollIntoView({ block: 'center' });
        await sleep(jitter(...cfg.clickDelay));

        if (cfg.dryRun) {
          console.log(`[dry] Would unfollow: ${name}`);
        } else {
          btn.click();
          totalClicked++;
          console.log(`[LI] Unfollow → ${name}`);
          await waitStateChange(btn, cfg.waitChange);
          await sleep(jitter(180, 500));
        }
      }
    }

    // scroll to load more cards
    const before = document.scrollingElement.scrollHeight;
    window.scrollBy(0, Math.round(window.innerHeight * 0.92));
    await sleep(jitter(...cfg.pageDelay));
    const after = document.scrollingElement.scrollHeight;

    // if nothing changes and no new buttons, finish
    const remaining = getTargets().some(({ btn }) => !seen.has(btn));
    if (!remaining && after === before) break;
  }

  // final pass (in case some appeared without height change)
  const leftovers = getTargets().filter(({ btn }) => !seen.has(btn));
  for (const { card, btn } of leftovers) {
    if (window.__liStopUnfollow) break;
    const name = companyName(card) || '(company)';
    btn.scrollIntoView({ block: 'center' });
    await sleep(jitter(...cfg.clickDelay));
    if (!cfg.dryRun) {
      btn.click(); totalClicked++;
      console.log(`[LI] Unfollow → ${name}`);
      await waitStateChange(btn, cfg.waitChange);
    } else {
      console.log(`[dry] Would unfollow: ${name}`);
    }
  }

  window.removeEventListener('keydown', onKey);
  console.log(`[LI] Done. Clicked ${totalClicked} "Subscribed" buttons on company cards.`);
})();