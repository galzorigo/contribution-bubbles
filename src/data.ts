/*
  Data loading, shared by the component and the server entry.
  No React and no "use client", so it can run anywhere.
*/

export type ContributionDay = {
  /** Calendar day as YYYY-MM-DD */
  date: string;
  /** How many contributions happened that day */
  count: number;
};

const API = "https://github-contributions-api.jogruber.de/v4";
const TTL = 60 * 60 * 1000; // reuse a user's data for an hour within the same page or server

const cache = new Map<string, { at: number; promise: Promise<ContributionDay[]> }>();

/**
 * Loads a GitHub user's past year of contributions.
 *
 * Uses the free, open source GitHub Contributions API, since GitHub doesn't let browsers
 * read the calendar directly. Results are cached in memory for an hour, and parallel calls
 * for the same user share one request.
 *
 * @param username GitHub username, e.g. "octocat"
 * @param init Extra fetch options, e.g. `{ next: { revalidate: 3600 } }` in Next.js
 *
 * @example
 * const days = await fetchContributions("octocat");
 */
export function fetchContributions(username: string, init?: RequestInit): Promise<ContributionDay[]> {
  const key = username.trim().toLowerCase();
  if (!key) return Promise.reject(new Error("contribution-bubbles: username is empty"));

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;

  const promise = fetch(`${API}/${encodeURIComponent(key)}?y=last`, init)
    .then(async (res) => {
      if (res.status === 404) throw new Error(`contribution-bubbles: GitHub user "${username}" not found`);
      if (!res.ok) throw new Error(`contribution-bubbles: could not load "${username}" (HTTP ${res.status})`);
      const json = (await res.json()) as { contributions?: ContributionDay[] };
      if (!Array.isArray(json.contributions)) {
        throw new Error(`contribution-bubbles: unexpected response for "${username}"`);
      }
      return json.contributions.map(({ date, count }) => ({ date, count }));
    })
    .catch((error: unknown) => {
      cache.delete(key); // don't keep failures, so the next try can succeed
      throw error instanceof Error ? error : new Error(String(error));
    });

  cache.set(key, { at: Date.now(), promise });
  return promise;
}
