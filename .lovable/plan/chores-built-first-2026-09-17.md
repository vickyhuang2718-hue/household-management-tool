- Household Hub for a family of 4

A single shared app — no logins — that everyone in the house can open on any phone or tablet and see the same, up-to-date information. Four people are set up from the start: Husband, Wife, Father-in-law, and your 2-year-old.

## Chores (built first)

- A chore board showing today and the week ahead.
- Each chore has a name, who it's assigned to, and how often it repeats (daily, weekly, one-off).
- Tap to tick a chore done; it reappears on its next due date.
- Filter by person, so anyone can see just their list.
- Overdue chores are clearly highlighted.

## Meal planning (built first)

- A weekly meal calendar: breakfast, lunch, dinner for each day.
- Each meal can hold a simple ingredient list and short notes.
- Toddler rule built in: every meal has a "toddler portion" note field, pre-filled with a reminder to plate her portion before adding salt, spice, or other seasoning. Her food stays the same dish as the adults, just unseasoned.
- Mark a meal as cooked, and copy a past week forward when you want to repeat it.

## Household inventory

- Items grouped by place: pantry, fridge, freezer, cleaning, toiletries, baby.
- Each item has a quantity and a "running low" threshold.
- Anything at or below its threshold is flagged as low stock.

## Shopping trips

- You build the shopping list yourself by adding items — nothing is added automatically.
- A suggestions panel sits alongside it showing two groups you can tap to add:
  - items flagged as running low
  - ingredients in this week's meal plan that aren't in your inventory
- Tick items off as you shop; finishing a trip clears the ticked items.

## Design

Before building, I'll show you three visual directions for the app and you pick one.

## Technical notes

- Lovable Cloud provides the shared database so all devices see the same data; no sign-in required.
- Tables: `members`, `chores`, `chore_completions`, `meals`, `meal_ingredients`, `inventory_items`, `shopping_items`. Public read/write policies since the app is shared and unauthenticated.
- Seeded with the four family members and a starter set of pantry categories so the app isn't empty on first open.
- Pages: `/` (chore board), `/meals`, `/inventory`, `/shopping`, with bottom navigation on mobile.
- Mobile-first layout, TanStack Start routes, TanStack Query for data.