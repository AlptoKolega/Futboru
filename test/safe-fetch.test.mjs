import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicHttpsUrl,
  fetchPublicHttps,
  isPublicIpAddress,
  publicHttpsUrl,
  readBoundedResponse,
} from "../scripts/safe-fetch.mjs";

const PUBLIC_LOOKUP = async () => [{ address: "93.184.216.34", family: 4 }];

test("network guard accepts only public HTTPS domain targets on the default port", async () => {
  assert.equal(publicHttpsUrl("https://club.example/news")?.hostname, "club.example");
  for (const unsafe of [
    "http://club.example/news",
    "https://user:secret@club.example/news",
    "https://club.example:8443/news",
    "https://localhost/news",
    "https://club.local/news",
    "https://127.0.0.1/news",
    "https://[::1]/news",
  ]) assert.equal(publicHttpsUrl(unsafe), null);

  assert.equal(isPublicIpAddress("93.184.216.34"), true);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("169.254.169.254"), false);
  assert.equal(isPublicIpAddress("fc00::1"), false);

  await assert.rejects(
    assertPublicHttpsUrl("https://club.example/news", {
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    }),
    /non-public address/,
  );
});

test("manual redirects are checked before the next request", async () => {
  const requests = [];
  await assert.rejects(
    fetchPublicHttps("https://club.example/news", {
      lookup: PUBLIC_LOOKUP,
      fetchImpl: async (url) => {
        requests.push(url);
        return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } });
      },
    }),
    /public HTTPS URL/,
  );
  assert.deepEqual(requests, ["https://club.example/news"]);

  const parentDomainRequests = [];
  await assert.rejects(
    fetchPublicHttps("https://club.github.io/news", {
      lookup: PUBLIC_LOOKUP,
      fetchImpl: async (url) => {
        parentDomainRequests.push(url);
        return new Response(null, { status: 302, headers: { location: "https://github.io/private" } });
      },
    }),
    /hostname boundary/,
  );
  assert.deepEqual(parentDomainRequests, ["https://club.github.io/news"]);

  const safeRequests = [];
  const fetched = await fetchPublicHttps("https://club.example/news", {
    lookup: PUBLIC_LOOKUP,
    fetchImpl: async (url) => {
      safeRequests.push(url);
      return safeRequests.length === 1
        ? new Response(null, { status: 301, headers: { location: "https://www.club.example/news" } })
        : new Response("ok", { status: 200 });
    },
  });
  assert.equal(fetched.url, "https://www.club.example/news");
  assert.deepEqual(safeRequests, ["https://club.example/news", "https://www.club.example/news"]);
});

test("bounded response reader stops bodies whose streamed size exceeds the cap", async () => {
  const accepted = await readBoundedResponse(new Response("1234"), 4);
  assert.equal(new TextDecoder().decode(accepted), "1234");
  await assert.rejects(readBoundedResponse(new Response("12345"), 4), /too large/);
  await assert.rejects(
    readBoundedResponse(new Response("x", { headers: { "content-length": "500" } }), 4),
    /too large/,
  );
});
