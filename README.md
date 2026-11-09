# dsh-pr-emoji

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web plugin. It puts a live state emoji in front of every GitHub pull request link in the chat:

> see 🟪 [rc-keeper#24](https://github.com/tupe12334/rc-keeper/pull/24)

If the agent already typed an emoji before the link, the plugin replaces it with the live one.

## Emoji

| Emoji | State |
|---|---|
| 🟪 | merged |
| 🟥 | closed, not merged |
| ⬜️ | draft |
| ✳️ | open, changes requested on the current head |
| ❎ | open, a check fails |
| ✅ | open, checks green and approved on the current head |
| ❇️ | open, no reviews or comments yet |
| 🟩 | open, any other state (for example, checks pending) |

For an open PR, the first match in this order wins: ✳️, ❎, ✅, ❇️, 🟩. Only reviews on the current head commit count. A later push makes older reviews stale.

The rules live in [`marker.js`](marker.js).

## Requirements

- The [GitHub CLI](https://cli.github.com/) (`gh`), logged in (`gh auth login`). The plugin reads PR state through `gh api graphql`, so private repositories work with your own login.
- Node.js 20 or later.

## Install

The package is not on npm yet. Install it from a local clone:

```sh
git clone https://github.com/tupe12334/dsh-pr-emoji.git
dsh plugin --profile <profile> add link:$PWD/dsh-pr-emoji
```

After a release is published (tag `v*`, see `.github/workflows/release.yml`), `dsh plugin --profile <profile> add dsh-pr-emoji` works too.

dsh loads the plugin live. You do not need to restart dsh.

## How it works

- The Node half registers `GET /api/pr-state?refs=owner/repo#1,owner/repo#2` on the dsh connection. It returns `{ "owner/repo#1": "🟪" }`. Results are cached for 60 seconds, and one request takes up to 50 refs.
- The browser half watches the page for links to `https://github.com/<owner>/<repo>/pull/<n>`, asks the route for their states and adds the emoji.

## Known limits

- An emoji is set once per link. It changes when the chat re-renders the link or the page reloads.
- The plugin looks for `gh` on `PATH`, `/opt/homebrew/bin` and `/usr/local/bin`.

## Development

```sh
npm test
```

## License

MIT
