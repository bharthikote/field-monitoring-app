---
name: field-app-ui
description: UI/UX design system for the Field Monitoring Android app (Kotlin + Jetpack Compose) - colours, type, layout, buttons, tabs, forms, cards, dialogs, pickers and the drawer menu, modelled on the East-West Seed Knowledge Transfer (KT) app. Load before building or changing any mobile screen.
---

# Field Monitoring app - UI/UX design system

The look is modelled on the East-West Seed **Knowledge Transfer (KT)** field app, which field
staff already know, and tidied up into a consistent, professional system. Build every screen
from the tokens and components below; do not invent one-off colours, sizes or button styles.

Implement the tokens once, as a Compose `MaterialTheme` (colour scheme, typography, shapes) plus
a small `ui/components/` package. Screens use only those components.

## 1. Design tokens

### Colours
| Token | Hex | Used for |
| --- | --- | --- |
| `primary` | `#00664A` | Headings, values, primary buttons (Edit), dialog header, dropdown carets |
| `primaryContainer` | `#E3EFE8` | Tonal buttons and chips (Show more, Activity Update, secondary actions) |
| `leaf` | `#5BAF2E` | Create/Add/Save buttons, active tab on green screens, form labels |
| `leafContainer` | `#EAF5E3` | Light-green drawer tiles, success tint |
| `accent` | `#F47A2A` | "Ongoing" status, active tab on money screens, selected segment |
| `accentContainer` | `#FDF0E4` | Orange drawer tiles (Trainings, Field Days) |
| `danger` | `#C23A1E` | Cancel on forms, destructive confirm |
| `dangerContainer` | `#FBE3E5` | Deactivate chip background (text in `danger`) |
| `background` | `#E8EEEA` | Screen background below the header card |
| `surface` | `#FFFFFF` | Cards, top bar, dialogs |
| `field` | `#EEF4F0` | Filled input and dropdown background |
| `labelMuted` | `#9DB5A8` | Read-only labels in detail grids, inactive tabs |
| `onSurface` | `#1F2A24` | Body text |
| `divider` | `#D5DDD8` | List dividers, tab underline |

Status pills: Ongoing = `accent`, Completed = `primary`, Draft/Pending sync = `labelMuted` text
on `field`, Deactivated = `danger` on `dangerContainer`.

### Type
- Font: **Ubuntu** (bundle Regular, Medium, Bold as `res/font`). Fall back to the system sans.
- Title (screen heading, farmer name): 22sp Bold, `primary`.
- Section heading ("Crop Detail - Tomato", "Crop*"): 20sp Bold, `leaf` or `primary`.
- Value: 16sp Bold, `onSurface`/`primary`. Label above a value: 14sp Regular, `labelMuted`.
- Form label: 15sp Medium, `leaf`; a required field ends with `*`.
- Button text: 16sp Bold. Placeholder: 14sp Italic, `labelMuted`.

### Shape and spacing
- Spacing scale: 4, 8, 12, 16, 24, 32 dp. Screen side padding 16 dp.
- Radius: cards 20 dp, buttons/inputs/chips 10 dp, status pills fully rounded, dialogs 24 dp.
- Cards: white with a soft shadow (elevation 2-3 dp).
- Minimum touch target 48 dp for everything tappable.

## 2. App chrome

- **Top bar** (white): back arrow left, organisation logo centred, notification bell right.
  Add a small **sync status icon** next to the bell: a checkmark when everything is synced, or
  a badge with the number of pending items. Tapping it runs a sync (PRD section 10).
- **Drawer menu** (from the home screen): full-width rounded tiles, 72 dp tall, module name
  bold on the left and a line-art icon on the right, tinted by module group:
  - Records (Farmers, Knowledge Acquisitions, Market Surveys): `primaryContainer`, text `primary`
  - Plots (Demos, Homegardens): `leafContainer`, text `leaf`
  - Events (Trainings, Field Days): `accentContainer`, text `accent`
  - Footer row of four icon + label actions: Profile, Support, Sync, Log Out (Log Out in
    `danger` on a `dangerContainer` pill).
- **Home dashboard**: count cards per module (big number + label) behind the drawer.

## 3. Components

### Buttons (one hierarchy everywhere)
| Kind | Style | Examples |
| --- | --- | --- |
| Primary | Filled `primary`, white text | Edit, Confirm in dialogs |
| Create | Filled `leaf`, white text | Create Demo, Add Cost, Add crop, Save |
| Tonal | `primaryContainer` fill, `primary` text | Show more, Activity Update, Process |
| Destructive | `dangerContainer` fill, `danger` text (chip), or filled `danger` for the final confirm | Deactivate |
| Cancel on forms | Filled `danger`, white text, placed right of Save | Cancel |

Rules: one filled primary/create action per area; Save always left of Cancel on forms;
buttons hug their text (min width 120 dp) rather than stretching full width, except in dialogs.

### Tabs
Text tabs in a horizontally scrollable row. Active tab: bold, coloured (`leaf` on record
screens, `accent` on money screens like Business Plan/Cost/Return), with a **filled dot**
centred under it sitting on a thin `divider` line. Inactive tabs: `labelMuted`. Two-line
labels are allowed ("Business Plan", "Knowledge Acquisition"). Keep inactive tab text at
least 4.5:1 contrast - darken `labelMuted` for tab text if needed.

### Segmented toggle
Two equal halves, 44 dp tall, radius 10 dp: selected = filled `accent` with white bold text,
unselected = `primaryContainer` with `primary` text (Expected Cost / Expected Return).

### Summary header card (demo/plot detail)
White card at the top of the screen:
- Row 1: record type in `leaf` ("Demo"), right-aligned tonal chip ("Activity Update").
- Row 2: name (title style) + crop dropdown chip, right-aligned status pill.
- Progress bar: full-width rounded outline track with a circular percentage badge on the bar.
- KPI row of four columns: label (`onSurface` 15sp) over bold `primary` value - Cost,
  Production, Return, Profit. Format numbers with thousands separators and the country's
  currency code (`10,000 THB`), units after quantities (`0 Kg`).
- "Show more" tonal chip expands extra fields in place.

### Profile header card (farmer)
Tinted top strip with "FARMER ID" and the ID; below it a photo (rounded 16 dp, grey
placeholder silhouette when empty), name, role with icon ("Key Farmer"), and
`gender, age | phone` in `leaf`. Action chips bottom-right: Edit (tonal), Deactivate
(destructive chip), Show more (tonal).

### Detail grid (read-only)
Three columns (four on wide cards), each cell = muted label over bold value, 12 dp row gap.
Section title above it ("Crop Detail - Tomato"), a single Edit button below. Dates as
`dd/MM/yy` consistently; percentages with `%`; areas with units (`250m²`).

### Forms
- Labels above fields, never inside. Up to three fields per row on a phone (Name/Type/Gender,
  Age/Birth Date/Phone), full width for long text (Address Details).
- Fields: `field` fill, no border, radius 10 dp, 48 dp tall. Read-only fields show a muted
  "read-only" hint at the right end.
- Dropdowns: same field style with a `primary` triangle caret and italic placeholder
  "Select option...". Tapping opens the **searchable picker** (below), not a native spinner.
- Date fields: calendar icon at the right end, opens the date picker.
- Photo: square 120 dp thumbnail top-left with an "Edit" overlay strip.
- Repeating groups (Crop + Variety + "Add crop" button) sit on one row; added items show as
  removable chips below.
- Footer: Save (create style) + Cancel (danger), then "* Required Fields" note in small text.
- Validate on Save: show the error under the field in `danger`, and scroll to the first error.

### Searchable picker (modal)
White rounded dialog over a dimmed screen: outlined search box (`primary` border) with a
close X to its right, then a list of options separated by `divider` lines, text in `primary`,
long options wrap. Filters as you type; multi-select shows a checkmark per row and a Done
button. Works fully offline from the local master lists.

### Expandable cost list (accordion)
Numbered section header ("1. Seedling Production") bold `primary`, total right-aligned with
currency, caret up/down, underline in `primary`. Child rows indented in `primaryContainer`
pills ("a. Seeds cost   10,000 THB") with their own caret for details.

### Confirmation dialog
Rounded dialog: `primary` header band with the bold white title ("Are you sure?"), white
body with one plain sentence, two buttons. Fix from the KT app: the **safe choice is
tonal and on the left (Cancel)**, the action is on the right and named for what it does
("Deactivate"), filled `danger` for destructive actions or `primary` otherwise. Never label
the action "Process".

### Lists and empty states
List rows are white cards (radius 16 dp) with the title in `leaf`/`primary`, a status pill on
the right, and a 4-column mini detail grid. When a list is empty, show a short sentence and
the create button instead of a blank screen. Show a skeleton while loading local data.

## 4. Offline and feedback
- Every saved record shows a small "Pending sync" pill until the server confirms it.
- Snackbars (bottom, `onSurface` background) for "Saved offline", "Synced 12 items",
  and errors with a Retry action. Never block the user with a dialog for routine saves.
- Notification after background sync completes (toggleable in Profile).

## 5. Professional polish checklist
- Same top bar, padding, radius and button order on every screen.
- Text contrast at least 4.5:1 (check `labelMuted` on white and on `background`).
- 48 dp touch targets; no text smaller than 12sp.
- Numbers, currency, dates and units formatted the same way app-wide, from one formatter.
- Every destructive action is confirmed, and none is the default button.
- Support the system font size setting without clipping (test at 130%).
- Strings in `strings.xml` so screens can be translated for the 11 countries.
