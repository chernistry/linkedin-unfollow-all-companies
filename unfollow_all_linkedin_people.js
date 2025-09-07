// LinkedIn: Auto-Unfollow on PEOPLE listing pages
// Usage: open a people list (e.g., "Manage Follows" → People), paste in Console → Enter.
// Stop anytime: press Esc (graceful stop).

(async () => {
    const cfg = {
      target: 'people',            // 'people' | 'companies' | 'auto'
      maxScrolls: 60,              // max scroll cycles
      clickDelay: [300, 800],      // delay before click (ms)
      pageDelay:  [800, 1500],     // delay after scroll/batch (ms)
      waitChange: 7000,            // wait btn state change (ms)
      dryRun: false                // true -> log only, no clicks
    };
  
    const TARGETS = {
      people: {
        anchorTest: (href) => href && href.includes('/in/'),
        stateWord: 'following'
      },
      companies: {
        anchorTest: (href) => href && href.includes('/company/'),
        stateWord: 'subscribed'
      }
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
  
    const detectTargetKind = () => {
      if (cfg.target !== 'auto') return cfg.target;
      // Heuristic: count anchors for each kind on the page and pick the dominant one
      const anchors = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
      const cnt = {
        people: anchors.filter(TARGETS.people.anchorTest).length,
        companies: anchors.filter(TARGETS.companies.anchorTest).length,
      };
      return cnt.people >= cnt.companies ? 'people' : 'companies';
    };
  
    const hasTargetAnchor = (node, kind) =>
      !!node.querySelector('a[href]') &&
      !![...node.querySelectorAll('a[href]')]
        .some(a => TARGETS[kind].anchorTest(a.getAttribute('href')));
  
    const isActiveFollowBtn = (btn) => {
      if (!(btn instanceof HTMLButtonElement)) return false;
      if (btn.disabled) return false;
      const t = (btn.innerText || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const pressed = (btn.getAttribute('aria-pressed') || '').toLowerCase();
      const isPressed = pressed === 'true';
      // consider “followed” if aria-pressed=true OR text/aria includes "following" or "subscribed"
      return isPressed || t.includes('following') || aria.includes('following') ||
             t.includes('subscribed') || aria.includes('subscribed');
    };
  
    const getBtnStateWord = (btn) => {
      const t = (btn?.innerText || '').toLowerCase();
      const aria = (btn?.getAttribute('aria-label') || '').toLowerCase();
      if ((btn?.getAttribute('aria-pressed') || '').toLowerCase() === 'true') return 'following';
      if (t.includes('following') || aria.includes('following')) return 'following';
      if (t.includes('subscribed') || aria.includes('subscribed')) return 'subscribed';
      return null;
    };
  
    const entityName = (card, kind) => {
      const a = [...card.querySelectorAll('a[href]')]
        .find(a => TARGETS[kind].anchorTest(a.getAttribute('href')));
      const text =
        (a?.innerText || '') ||
        card.querySelector('.hoverable-link-text, .artdeco-entity-lockup__title, .entity-result__title-text')?.innerText ||
        '';
      return (text || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    };
  
    const cardSelector = [
      '.pvs-entity',
      '.entity-result',
      '.reusable-search__result-container',
      '.artdeco-entity-lockup',
      'li',
      '.display-flex'
    ].join(',');
  
    const uniqueByNode = (arr) => [...new Set(arr)];
  
    const collectCards = (kind) => {
      // find containers with a target anchor inside
      const all = [...document.querySelectorAll(cardSelector)]
        .filter(el => hasTargetAnchor(el, kind));
      // filter out nested
      const pruned = all.filter(el => !all.some(other => other !== el && other.contains(el)));
      return uniqueByNode(pruned);
    };
  
    const buttonsFromCards = (cards) => {
      const res = [];
      for (const card of cards) {
        const btns = [...card.querySelectorAll('button')].filter(isActiveFollowBtn);
        if (btns.length) {
          // choose the button closest to the target anchor
          const anchor = card.querySelector('a[href]');
          const sorted = anchor
            ? btns.sort((a, b) => (a.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) -
                                   (b.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING))
            : btns;
          res.push({ card, btn: sorted[0] });
        }
      }
      return res;
    };
  
    const waitStateChange = async (btn, timeoutMs, prevWord) => {
      return new Promise((resolve) => {
        let done = false;
        const stop = () => { if (!done) { done = true; obs.disconnect(); resolve(); } };
        const obs = new MutationObserver(() => {
          const exists = document.body.contains(btn);
          const word = getBtnStateWord(btn);
          const pressedNow = (btn?.getAttribute('aria-pressed') || '').toLowerCase() === 'true';
          // changed if button disappeared OR no longer "followed"/"subscribed" OR aria-pressed turned false
          if (!exists || !pressedNow || (prevWord && word !== prevWord)) stop();
        });
        if (btn && document.body.contains(btn)) {
          obs.observe(btn, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-label'] });
        } else {
          stop();
        }
        setTimeout(stop, timeoutMs);
      });
    };
  
    const getTargets = (kind) => buttonsFromCards(collectCards(kind));
  
    // Main loop
    const kind = detectTargetKind(); // 'people' expected
    console.log(`[LI] Mode: ${kind}. Starting auto-unfollow…`);
    let totalClicked = 0;
    const seen = new WeakSet();
  
    for (let s = 0; s < cfg.maxScrolls; s++) {
      if (window.__liStopUnfollow) break;
  
      const targets = getTargets(kind).filter(({ btn }) => !seen.has(btn));
      if (targets.length) {
        for (const { card, btn } of targets) {
          if (window.__liStopUnfollow) break;
          seen.add(btn);
  
          const name = entityName(card, kind) || (kind === 'people' ? '(person)' : '(entity)');
          btn.scrollIntoView({ block: 'center' });
          await sleep(jitter(...cfg.clickDelay));
  
          if (cfg.dryRun) {
            console.log(`[dry] Would unfollow: ${name}`);
          } else {
            const prevWord = getBtnStateWord(btn);
            btn.click();
            totalClicked++;
            console.log(`[LI] Unfollow → ${name}`);
            await waitStateChange(btn, cfg.waitChange, prevWord);
            await sleep(jitter(180, 500));
          }
        }
      }
  
      // scroll to load more
      const before = document.scrollingElement.scrollHeight;
      window.scrollBy(0, Math.round(window.innerHeight * 0.92));
      await sleep(jitter(...cfg.pageDelay));
      const after = document.scrollingElement.scrollHeight;
  
      // if nothing changes and no new buttons, finish
      const remaining = getTargets(kind).some(({ btn }) => !seen.has(btn));
      if (!remaining && after === before) break;
    }
  
    // final pass
    const leftovers = getTargets(kind).filter(({ btn }) => !seen.has(btn));
    for (const { card, btn } of leftovers) {
      if (window.__liStopUnfollow) break;
      const name = entityName(card, kind) || (kind === 'people' ? '(person)' : '(entity)');
      btn.scrollIntoView({ block: 'center' });
      await sleep(jitter(...cfg.clickDelay));
      if (!cfg.dryRun) {
        const prevWord = getBtnStateWord(btn);
        btn.click(); totalClicked++;
        console.log(`[LI] Unfollow → ${name}`);
        await waitStateChange(btn, cfg.waitChange, prevWord);
      } else {
        console.log(`[dry] Would unfollow: ${name}`);
      }
    }
  
    window.removeEventListener('keydown', onKey);
    console.log(`[LI] Done. Clicked ${totalClicked} active "Following/Subscribed" buttons on ${kind} cards.`);
  })();
  