/*
  contribution-bubbles/server
  Data only, safe to import in server code such as Next.js server components and route
  handlers. Fetch here, then pass the result to <ContributionBubbles data={...} />.
*/

export { fetchContributions, type ContributionDay } from "./data";
