/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  createSignal,
  type Component,
  For,
  createEffect,
  onCleanup,
  Show,
  createMemo,
} from "solid-js";
import { BsX } from "solid-icons/bs";
import { FiExternalLink, FiGithub } from "solid-icons/fi";
import { FaSolidDice } from "solid-icons/fa";
import { VsGlobe } from "solid-icons/vs";

interface SearchAbortController {
  abortController?: AbortController;
  timeout?: NodeJS.Timeout;
}

const demoSearchQueries = [
  "email campaign SaaS",
  "serverless postgresql database",
  "ruby gem management",
  "open source patreon",
  "short term rental management",
  "WYSIWYG editor",
  "nextjs vercel",
  "what should I use as as a starter for my Astro project?",
];

const defaultSearchQuery = demoSearchQueries[0];

type SearchType = "semantic" | "hybrid" | "fulltext";

const App: Component = () => {
  const apiUrl = import.meta.env.VITE_API_URL as string;
  const datasetId = import.meta.env.VITE_DATASET_ID as string;
  const apiKey = import.meta.env.VITE_API_KEY as string;

  const urlParams = new URLSearchParams(window.location.search);

  const [searchQuery, setSearchQuery] = createSignal(
    urlParams.get("q") ?? defaultSearchQuery,
  );
  const [resultChunks, setResultChunks] = createSignal<any>();
  // eslint-disable-next-line solid/reactivity
  const [fetching, setFetching] = createSignal(true);
  const [searchType, setSearchType] = createSignal<SearchType>(
    (urlParams.get("search_type") as SearchType) ?? "hybrid",
  );
  const [starCount, setStarCount] = createSignal(275);
  const [sortBy, setSortBy] = createSignal(
    urlParams.get("sort_by") ?? "relevance",
  );
  const [currentPage, setCurrentPage] = createSignal(1);

  const searchCompanies = async (
    curSortBy: string,
    curPage: number,
    abortController: AbortController,
  ) => {
    setFetching(true);

    const response = await fetch(`${apiUrl}/chunk/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TR-Dataset": datasetId,
        Authorization: apiKey,
      },
      body: JSON.stringify({
        page: curPage,
        query: searchQuery(),
        search_type: searchType(),
        highlight_results: false,
        get_collisions: false,
      }),
      signal: abortController.signal,
    });

    const data = await response.json();
    const scoreChunks = data.score_chunks;

    if (curPage > 1) {
      setResultChunks((prevChunks) => {
        // filter out duplicates
        const newChunks = scoreChunks.filter(
          (newChunk: any) =>
            !prevChunks.some(
              (prevChunk: any) =>
                prevChunk.metadata[0].metadata.slug ===
                newChunk.metadata[0].metadata.slug,
            ),
        );

        return prevChunks.concat(newChunks);
      });
    } else {
      setResultChunks(scoreChunks);
    }
    setFetching(false);
  };

  // create a debounced version of the search function
  createEffect(
    (prevController: SearchAbortController | undefined) => {
      const curSearchQuery = searchQuery();
      const curPage = currentPage();
      if (!curSearchQuery) return;

      urlParams.set("q", curSearchQuery);
      urlParams.set("search_type", searchType());
      urlParams.set("sort_by", sortBy());

      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${urlParams.toString()}`,
      );

      clearTimeout(prevController?.timeout ?? 0);
      prevController?.abortController?.abort();

      const newController = new AbortController();

      const timeout = setTimeout(
        () => void searchCompanies(sortBy(), curPage, newController),
        20,
      );

      onCleanup(() => clearTimeout(timeout));

      return { abortController: newController, timeout };
    },
    { abortController: undefined, timeout: undefined },
  );

  createEffect(() => {
    void fetch("https://api.github.com/repos/devflowinc/trieve").then(
      (response) => {
        if (response.ok) {
          void response.json().then((data) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            setStarCount(data.stargazers_count);
          });
        }
      },
    );
  });

  createEffect((previousSortType) => {
    const sortType = sortBy();
    if (previousSortType === sortType) return;

    const originalResultChunks = resultChunks();
    const newResultChunks = [...originalResultChunks];
    if (sortType === "recency") {
      newResultChunks.sort((a: any, b: any) => {
        return (
          parseInt(b.metadata[0].metadata.batch.slice(-2)) -
          parseInt(a.metadata[0].metadata.batch.slice(-2))
        );
      });
    } else {
      newResultChunks.sort(
        (a: any, b: any) => parseFloat(b.score) - parseFloat(a.score),
      );
    }

    setResultChunks(newResultChunks);

    return sortType;
  }, "relevance");

  createEffect((prevSearchQuery) => {
    const curSearchQuery = searchQuery();
    if (prevSearchQuery === curSearchQuery) return curSearchQuery;
    setCurrentPage(0);
  }, defaultSearchQuery);

  createEffect((prevSearchType) => {
    const curSearchType = searchType();
    if (prevSearchType === curSearchType) return curSearchType;
    setCurrentPage(0);
  }, "hybrid");

  // infinite scroll effect to check if the user has scrolled to the bottom of the page and increment the page number to fetch more results
  createEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop + 1000 >
        document.documentElement.offsetHeight
      ) {
        if (fetching()) return;

        setCurrentPage((prevPage) => prevPage + 1);
        setFetching(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    onCleanup(() => window.removeEventListener("scroll", handleScroll));
  });

  const tryCurrentUrl = createMemo(() => {
    const query = encodeURIComponent(searchQuery());
    const ret = `https://www.producthunt.com/search?q=${query}`;
    return ret;
  });

  return (
    <main class="min-h-screen bg-[#F5F5EE] px-[13px]">
      <div class="border-b pb-6 pt-6 sm:pr-[13px] lg:pb-9 lg:pt-9">
        <div class="prose prose-sm sm:prose-base flex max-w-full flex-col space-y-5">
          <h1 class="text-3xl">Trieve Search for ProductHunt</h1>
          <p>
            <a
              href="https://github.com/devflowinc/trieve"
              class="text-[#268bd2] underline"
            >
              Trieve
            </a>{" "}
            offers a new and better way to build search. Compare to current
            search on the official Directory at{" "}
            <a
              href="https://www.producthunt.com/search"
              class="text-[#268bd2] underline"
            >
              producthunt.com/search
            </a>
            .
          </p>
        </div>
      </div>
      <section class="relative isolate z-0 border-b pb-6 pt-6 sm:pr-[13px] lg:pb-9 lg:pt-9">
        <div class="flex flex-wrap justify-end gap-x-3 gap-y-2">
          <div class="flex items-center space-x-2 text-base">
            <label class="whitespace-nowrap">Search Type</label>
            <select
              id="location"
              name="location"
              class="block w-fit min-w-[130px] rounded-md border border-neutral-300 bg-white px-3 py-2"
              onChange={(e) =>
                setSearchType(e.currentTarget.value.toLowerCase() as SearchType)
              }
              value={searchType()}
            >
              <option selected value="hybrid">
                Hybrid
              </option>
              <option value="semantic">Semantic</option>
              <option value="fulltext">Fulltext</option>
            </select>
          </div>
          <div class="flex items-center space-x-2 text-base">
            <label class="whitespace-nowrap">Sort by</label>
            <select
              id="location"
              name="location"
              class="block w-fit min-w-[130px] rounded-md border border-neutral-300 bg-white px-3 py-2"
              onChange={(e) => setSortBy(e.currentTarget.value.toLowerCase())}
              value={sortBy()}
            >
              <option selected value="relevance">
                Relevance
              </option>
            </select>
          </div>
        </div>
        <div class="mb-6 mt-2 w-full rounded-md border border-neutral-300 bg-[#FDFDF8] p-5">
          <input
            class="w-full rounded-md border border-neutral-300 bg-white p-[10px]"
            placeholder="Search..."
            autofocus
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            value={searchQuery()}
          />
          <div class="flex flex-wrap items-center gap-x-2">
            <Show when={searchQuery()}>
              <div class="mt-2 flex w-fit items-center space-x-2 rounded-full border px-3 py-1">
                <p class="text-sm">{searchQuery()}</p>
                <button
                  aria-label="clear search query"
                  onClick={() => setSearchQuery("")}
                >
                  <BsX class="h-3 w-3" />
                </button>
              </div>
            </Show>
            <Show when={searchQuery()}>
              <a
                class="mt-2 flex w-fit items-center space-x-2 rounded-full border px-3 py-1"
                href={tryCurrentUrl()}
                target="_blank"
                aria-label="try search with Current"
              >
                <p class="text-sm">Try With Current</p>
                <FiExternalLink
                  class="h-3 w-3"
                  onClick={() => setSearchQuery("")}
                />
              </a>
            </Show>
            <button
              class="mt-2 flex w-fit items-center space-x-2 rounded-full border px-3 py-1"
              onClick={() =>
                setSearchQuery((prevQuery) => {
                  let randomQuery = prevQuery;
                  while (randomQuery === prevQuery) {
                    randomQuery =
                      demoSearchQueries[
                        Math.floor(Math.random() * demoSearchQueries.length)
                      ];
                  }
                  return randomQuery;
                })
              }
            >
              <p class="text-sm">Random Search</p>
              <FaSolidDice class="h-3 w-3" />
            </button>
            <a
              class="mt-2 flex w-fit items-center space-x-2 rounded-full border px-3 py-1"
              href="https://github.com/devflowinc/trieve"
              target="_blank"
              aria-label="trieve github"
            >
              <p class="text-sm">Star Trieve | {starCount()}</p>
              <FiGithub class="h-3 w-3" onClick={() => setSearchQuery("")} />
            </a>
          </div>
        </div>
        <p
          classList={{
            "text-sm font-extralight text-[##4E4E4E]": true,
            "animate-pulse": fetching(),
          }}
        >
          Showing {fetching() ? "..." : resultChunks()?.length ?? 0} results
        </p>
        <div
          classList={{
            "mt-2 overflow-hidden rounded-md": true,
            "border border-neutral-300": resultChunks()?.length ?? 0 > 0,
          }}
        >
          <For each={resultChunks()}>
            {(chunk, idx) => {
              return (
                <a
                  classList={{
                    "p-5 flex space-x-4 bg-[#FDFDF8] hover:bg-white": true,
                    "border-t border-neutral-300": idx() > 0,
                  }}
                  href={`https://www.producthunt.com/products/${chunk.metadata[0].metadata.slug}`}
                  target="_blank"
                >
                  <img
                    class="block h-16 w-16 rounded bg-gray-100 object-contain"
                    src={
                      chunk.metadata[0].metadata.logo_url ||
                      "https://cdn.iconscout.com/icon/free/png-256/free-404-error-1-529717.png?f=webp"
                    }
                  />
                  <div class="flex flex-col space-y-1">
                    <div class="flex items-end space-x-2">
                      <p class="text-lg font-bold">
                        {chunk.metadata[0].metadata.name}
                      </p>
                    </div>
                    <p>{chunk.metadata[0].metadata.tagline}</p>
                    <div>
                      <div class="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                        <Show when={chunk.metadata[0].metadata.website_url}>
                          {(website) => (
                            <a href={website()} target="_blank">
                              <VsGlobe class="h-5 w-5 fill-current text-blue-500" />
                            </a>
                          )}
                        </Show>
                      </div>
                    </div>
                  </div>
                </a>
              );
            }}
          </For>
        </div>
      </section>
    </main>
  );
};

export default App;
