---
name: obsidian-iconic
type: reference
description: >-
  Configure icons and colors for notes, folders, and tags in an Obsidian vault
  through the Iconic community plugin. Covers the data.json layout, rule-based
  icons with the full condition vocabulary (name, path, extension, tags, links,
  headings, dates, the clock, and frontmatter properties, with per-type
  operators), Lucide icon ids, the named color palette, reloading the plugin
  after editing its config externally, and verifying the result through the
  Obsidian CLI. Use whenever the user asks to add or change icons in an
  Obsidian vault that uses Iconic.
metadata:
  author: Cedric Vidal
  version: "1.0.0"
---

# Obsidian Iconic Plugin

Reference for configuring the [Iconic](https://github.com/gfxholo/iconic) Obsidian plugin programmatically, without clicking through its UI.

## Where the configuration lives

Everything Iconic knows is one JSON file inside the vault:

```
<vault>/.obsidian/plugins/iconic/data.json
```

The file mixes plugin settings with icon assignments. The keys that matter for icon work:

| Key | What it holds |
|-----|---------------|
| `fileIcons` | Per-file icons, keyed by vault path |
| `folderRules` | Rules matching folders |
| `fileRules` | Rules matching files by name, extension, path, or frontmatter property |
| `tagIcons`, `propertyIcons`, `ribbonIcons`, `appIcons`, `tabIcons`, `bookmarkIcons` | Icons for other UI surfaces |

If the vault is tracked in git, `data.json` usually is too — commit it after changing it.

## Prefer rules over per-file icons

When a whole class of notes should share an icon (all notes with `type: account`, all meeting notes), add a **rule** instead of stamping each file into `fileIcons`. Rules cover future notes automatically and keep the config to one entry per class.

There are two rule pages: `fileRules` matches files, `folderRules` matches folders. A rule matching a frontmatter property looks like this:

```json
{
  "id": "b7Kd4",
  "name": "Account",
  "match": "all",
  "conditions": [
    {
      "source": "property:type",
      "operator": "is",
      "value": "account"
    }
  ],
  "enabled": true,
  "icon": "lucide-briefcase",
  "color": "purple"
}
```

Append it to the `fileRules` array. Field notes:

- `id` — short random alphanumeric string (5 characters in practice), unique among the rules. Invent one.
- `match` — `"all"` (AND), `"any"` (OR), or `"none"` (NOR) across the conditions.
- `icon` — a [Lucide](https://lucide.dev) icon id prefixed with `lucide-`, for example `lucide-briefcase`, `lucide-building-2`, `lucide-circle-user-round`, `lucide-file-terminal`. The plugin's picker also supports emoji.
- `color` — a named color from Obsidian's palette (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`), or omit for the default.

Rules earlier in the array win when several match. The icon shows everywhere the file appears: file explorer, tabs, note title, quick switcher, and Bases table rows via `file.name`.

## Condition sources

A condition's `source` picks what to test. File rules accept:

| Source | What it tests | Value type |
|--------|---------------|------------|
| `name` | File name without extension | text |
| `filename` | File name with extension | text |
| `extension` | File extension | text |
| `path` | Vault path | text |
| `tree` | Position in the folder tree | text |
| `icon` | The file's current icon | icon |
| `color` | The file's current color | color |
| `headings` | Headings in the note | list |
| `links` | Internal links in the note | list |
| `embeds` | Embeds in the note | list |
| `tags` | Tags in the note | list |
| `created` | File creation date | date |
| `modified` | File modification date | date |
| `clock` | The current date and time, so icons can change on a schedule | datetime |
| `property:<key>` | A frontmatter property, one source per key | the property's registered type |

Folder rules accept the subset that makes sense for folders: `name`, `path`, `tree`, `icon`, `color`, `created`, `modified`, and `clock`.

A `property:<key>` source takes its value type from the property's type in Obsidian's registry: text, multitext (list), number, checkbox, date, or datetime. Aliases and tags properties behave as lists.

## Operators by value type

Prefixing an operator with `!` negates it (`!is`, `!contains`, `!isToday`). Every source also accepts `hasValue` / `!hasValue`, and property sources accept `hasProperty` / `!hasProperty` to test mere presence.

| Value type | Operators |
|------------|-----------|
| text | `is`, `contains`, `startsWith`, `endsWith`, `matches` (regex) |
| list | `includes`, `allAre`, `allContain`, `allStartWith`, `allEndWith`, `allMatch`, `anyContain`, `anyStartWith`, `anyEndWith`, `anyMatch`, `noneContain`, `noneStartWith`, `noneEndWith`, `noneMatch`, `countIs`, `countIsLess`, `countIsMore` |
| number | `equals`, `isLess`, `isMore`, `isDivisible` |
| checkbox | `isTrue`, `isFalse` |
| date | `dateIs`, `dateIsBefore`, `dateIsAfter`, `isToday`, `isBeforeToday`, `isAfterToday`, `isLessDaysAgo`, `isMoreDaysAgo`, `isLessDaysAway`, `isMoreDaysAway`, `weekdayIs`, `weekdayIsBefore`, `weekdayIsAfter`, `monthdayIs`, `monthdayIsBefore`, `monthdayIsAfter`, `monthIs`, `monthIsBefore`, `monthIsAfter`, `yearIs`, `yearIsBefore`, `yearIsAfter` |
| datetime | Everything date supports, plus `datetimeIs`, `datetimeIsBefore`, `datetimeIsAfter`, `isNow`, `isBeforeNow`, `isAfterNow`, `timeIs`, `timeIsBefore`, `timeIsAfter`, `timeIsNow`, `timeIsBeforeNow`, `timeIsAfterNow` |
| icon | `iconIs`, `nameIs`, `nameContains`, `nameStartsWith`, `nameEndsWith`, `nameMatches` |
| color | `colorIs`, `hexIs` |

These vocabularies were extracted from the plugin's source (v1.x). When in doubt, build one rule through the Iconic settings UI and read what it wrote to `data.json`.

## Reload after editing the file externally

While Obsidian is running, Iconic holds its settings in memory and rewrites `data.json` on its next save, which would silently discard an external edit. Reload the plugin immediately after editing:

```bash
obsidian vault="<Vault Name>" plugin:reload id=iconic
```

This uses the [Obsidian CLI](https://help.obsidian.md/cli), which requires the app to be running. Then verify the rule actually loaded:

```bash
obsidian vault="<Vault Name>" eval code="app.plugins.plugins['iconic'].settings.fileRules.map(r => r.name).join(', ')"
```

## CLI gotchas

- The CLI prints Electron noise on stderr, such as `FATAL:electron/shell/app/electron_main_delegate_mac.mm Unable to find helper app`. It is harmless; check the actual command output and exit code instead.
- In a sandboxed agent terminal, the CLI may hang or fail with connection errors (`Connection invalid`, XPC failures) because it cannot reach the running app. Rerun the command outside the sandbox.
- If Obsidian is not running, the CLI cannot connect at all. Editing `data.json` while the app is closed is safe without a reload: the plugin reads the file on next launch.
