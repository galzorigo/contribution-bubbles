/*
  contribution-dots/server
  Data only, safe to import in server code such as Next.js server components and route
  handlers. Fetch here, then pass the result to <ContributionDots data={...} />.
*/

export { fetchContributions, type ContributionDay } from "./data";
