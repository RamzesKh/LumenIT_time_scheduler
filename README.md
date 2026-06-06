# Availability Matcher

A small React app that helps four people find a shared meeting time during the week.

## How it works

Each member enters a daily start and end time for Monday through Sunday. The app computes any day where all four schedules overlap and shows the available meeting window.

## Scripts

- `npm run dev` - start the local dev server
- `npm run build` - type-check and build the app
- `npm run preview` - preview the production build

## Notes

- Enter times in 24-hour format.
- A meeting slot appears only when all four members have valid overlapping availability for the same day.
