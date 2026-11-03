window.__ModuleLoader__.load({
  id: "dsh-pr-emoji",
  factory: () => {
    // Prefix every GitHub PR link in the page with its live state marker.
    // A marker the agent already typed before the link is replaced, so a stale one gets fixed.
    const LINK = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)(?:[/?#]|$)/
    const TYPED = /(?:🟪|🟥|⬜|✳|❎|✅|❇|🟩)️?\s*$/u
    const DONE = "dshPrEmoji"

    function refOf(a) {
      const m = LINK.exec(a.href)
      return m ? `${m[1]}/${m[2]}#${m[3]}` : null
    }

    function stripTyped(a) {
      const prev = a.previousSibling
      if (prev?.nodeType === Node.TEXT_NODE && TYPED.test(prev.data)) {
        prev.data = prev.data.replace(TYPED, "")
        // Keep the space between the preceding word and the new marker.
        if (prev.data && !/\s$/.test(prev.data)) prev.data += " "
      }
    }

    async function scan() {
      const links = [...document.querySelectorAll('a[href^="https://github.com/"]')]
        .filter(a => !a.dataset[DONE] && !a.closest("[contenteditable], textarea") && refOf(a))
      if (!links.length) return
      for (const a of links) a.dataset[DONE] = "pending"
      const refs = [...new Set(links.map(refOf))]
      let states = {}
      try {
        const url = new URL("api/pr-state", document.baseURI)
        url.searchParams.set("refs", refs.join(","))
        const res = await fetch(url, { credentials: "same-origin" })
        if (res.ok) states = await res.json()
      } catch {}
      for (const a of links) {
        const mark = states[refOf(a)]
        if (!mark || !a.isConnected) { delete a.dataset[DONE]; continue }
        stripTyped(a)
        const span = document.createElement("span")
        span.dataset.dshPrEmojiMark = ""
        span.textContent = `${mark} `
        a.before(span)
        a.dataset[DONE] = "done"
      }
    }

    function apply(ctx) {
      ctx.effect(() => {
        let timer
        // ponytail: debounce whole-page rescans; streamed text mutates constantly
        const kick = () => { clearTimeout(timer); timer = setTimeout(scan, 400) }
        const obs = new MutationObserver(kick)
        obs.observe(document.body, { childList: true, subtree: true })
        kick()
        return () => {
          clearTimeout(timer)
          obs.disconnect()
          document.querySelectorAll("[data-dsh-pr-emoji-mark]").forEach(s => s.remove())
          document.querySelectorAll("[data-dsh-pr-emoji]").forEach(a => delete a.dataset[DONE])
        }
      })
    }
    return { name: "pr-emoji", apply }
  }
})
