# Free APIs for boards

A catalog of free public APIs that boards modules can call. It comes from the [public-apis list](https://github.com/public-apis/public-apis) (2190 entries parsed on 2026-10-26), plus a hand-checked set that the list misses or mislabels.

Following the [cost principle](README.md#cost-principle), the browser calls these directly and there is no server in between. "Browser-ready" means HTTPS and CORS both work, so the page can `fetch()` the API. Keys go in Settings -> API keys (the `KEYS` registry in `src/lib/apis.js`) and live in that browser's localStorage only.

Contents: 1. keys worth getting (23), 2. browser-ready with no key, from the list (524), 3. hand-checked extras (49), 4. needs a key or a server (1666).

**Heads up.** The list's CORS column is self-reported and often stale or "Unknown". Only sections 1 and 3 were tested by hand (`curl` with `Origin: http://localhost:5173`, plus a preflight where it mattered). Test any section 2 entry before building on it.

## 1. Keys worth getting

Roughly in order of how much each unlocks. Each was probed with a bad key and an Origin header: a CORS header on the error response means a browser can call it. **Demo keys:** NASA `DEMO_KEY` works (it also covers Smithsonian and USDA, all api.data.gov); Europeana `api2demo` works; the Guardian `test` key now returns 401, so that demo is dead and a real key is needed. Pages marked "login" or "bot-blocked" refused a plain fetch (403/401), so those URLs are the vendor's documented ones, not independently loaded.

| Key | Sign up | Time and gotchas | Free limits | Would power | CORS |
|---|---|---|---|---|---|
| TMDB | https://www.themoviedb.org/settings/api (login) | Account + email verify, then a short "describe your use" form; key is instant. Attribution required. | ~50 req/s soft cap; non-commercial | TV guide, movie watchlist, posters, where to stream | ✓ |
| YouTube Data | https://console.cloud.google.com/apis/library/youtube.googleapis.com | Google Cloud project, enable the API, create a key (5-10 min). Restrict the key to your site's referrer. The same project also unlocks Google Books. | 10,000 units/day; a search costs 100, so ~100 searches/day | Lessons and video search, playlist boards | ✓ |
| NASA / api.data.gov | https://api.nasa.gov/ | Name + email, key arrives instantly. The same key works on Smithsonian Open Access and USDA FoodData. DEMO_KEY works for all three. | 1,000/hr with a key; DEMO_KEY ~30/hr and 50/day per IP | Picture of the day, near-Earth objects, Mars photos, nutrition facts, Smithsonian objects | ✓ (APOD, NeoWs, USDA, Smithsonian tested) |
| Last.fm | https://www.last.fm/api/account/create | Last.fm account, app name + description, key shown immediately. No secret needed for read calls. | Fair use, ~5 req/s | Listening history, similar artists, record crate | ✓ |
| RAWG | https://rawg.io/apidocs | Free account, key on the page right away. Must show a RAWG credit link. | 20,000 req/month | Game backlog: covers, release dates, platforms | ✓ (preflight) |
| Freesound | https://freesound.org/apiv2/apply/ | Account + short apply form; key is instant. Search and previews work with the key; downloading originals needs OAuth2 (the code exchange wants a server). | 60/min, 2,000/day | Studio: sound samples, previews | ✓ |
| eBird (Cornell) | https://ebird.org/api/keygen | eBird account, one-click form, instant. Sent as the `X-eBirdApiToken` header. | Free for non-commercial use, generous | Field guide: birds seen near you lately | ✓ (header present on error) |
| Google Books | same Google Cloud console as YouTube | The keyless endpoint shares one world-wide quota and returned 429 "quota exceeded" when tested. A key gives you your own. | 1,000 req/day default | Bookshelf: covers, ISBNs, descriptions | ✓ |
| Europeana | https://pro.europeana.eu/pages/get-api (bot-blocked, not fetched) | Short registration form, key emailed. `api2demo` works meanwhile. | 10,000 req/day | More museum postcards from European collections | ✓ (api2demo tested) |
| Unsplash | https://unsplash.com/oauth/applications (login) | Dev account, create an app. Starts in demo mode; production approval is needed for more. Must hotlink, credit the photographer and ping the download endpoint. | Demo: 50 req/hr. Production: 5,000/hr | Reference photos, moodboards | ✓ |
| Pexels | https://www.pexels.com/api/new/ (login) | Account, key is instant. Credit the photographer. | 200/hr, 20,000/month | Reference photos and video (easier than Unsplash) | ✓ |
| Pixabay | https://pixabay.com/api/docs/ | Account; your key is printed on the docs page when logged in. Results must be cached 24h. | 100 req/min | Photos, illustrations, music and sound clips | ✓ |
| The Guardian | https://open-platform.theguardian.com/access/ | Dev key form with email; key arrives by email within minutes. Non-commercial. The demo key `test` now returns 401. | 12 req/s, 5,000/day | World, culture and science news pages | ? the 401 carried no CORS header; re-test with a real key |
| Discogs | https://www.discogs.com/settings/developers (login) | Account, then generate a personal token or register an app. Public endpoints (artist, release, label) need no key and have CORS. | 60 req/min with a token, 25 without | Record crate: releases, labels, prices | ✓ (public endpoint and preflight tested) |
| Wordnik | https://developer.wordnik.com/ | Account, request a key; approval is emailed and can take up to a day. | About 100 req/hr on the free tier (check current docs) | Word of the day, examples, related words | ✓ |
| Merriam-Webster | https://dictionaryapi.com/register/index | Register, pick the dictionaries (collegiate, thesaurus, learner's); each gets its own key. Non-commercial. | 1,000 queries/day per key | Dictionary and thesaurus with audio | ✓ |
| Spoonacular | https://spoonacular.com/food-api/console | Account, key is instant. Credit link required. | 150 points/day (a search costs about 1 point plus per-result) | Recipe box, meal planning, nutrition | ✓ |
| Perenual | https://perenual.com/docs/api | Account, key is instant. | 100 req/day | Garden: plant care, watering schedule | ✓ |
| Harvard Art Museums | https://harvardartmuseums.org/collections/api | Request form, key emailed (minutes to a day). Non-commercial. | 2,500 req/day | Museum postcards, color-searchable art | ✓ |
| OMDb | https://www.omdbapi.com/apikey.aspx | Email form, click the activation link. | 1,000 req/day | Movie lookup by title or IMDb id (backup for TMDB) | ✓ |
| Spotify | https://developer.spotify.com/dashboard | Create an app and use Authorization Code + PKCE so no secret is in the page. Dev mode caps the app at 25 named users and needs a Premium owner account. | Rate-limited, undisclosed | What's playing, playlists, search | ✓ (preflight) |
| Strava | https://www.strava.com/settings/api | Create an app and set the callback domain. The OAuth2 code exchange needs the client secret, so a tiny Cloud Function is required. Single-athlete until Strava approves the app. | 200 req/15 min, 2,000/day | Run / ride log | ✓ API, but token exchange needs a server |
| Genius | https://genius.com/api-clients (login) | Create an API client for a token. Search returns metadata and URLs only, not lyrics. | Undisclosed | Song pages | ✗ preflight returned 403; needs a proxy. Use LRCLIB for lyrics (section 3) |

Rijksmuseum is not in this table because its old key API is retired (`/api/...?key=` returns 410 Gone). The new Rijksmuseum data service needs no key (section 3).

## 2. Browser-ready, no key (from the list)

Auth = No, HTTPS = Yes, CORS = Yes in the list: 524 entries. The module idea is filled in only where one is obvious.

### Animals (12)

| API | What it gives | Module idea |
|---|---|---|
| [Cat Facts](https://catfact.ninja/) | Random cat facts | pet corner: fact of the day |
| [Dog Facts](https://dukengn.github.io/Dog-facts-API/) | Random dog facts | pet corner: fact of the day |
| [Dog Facts](https://kinduff.github.io/dog-api/) | Random facts of Dogs | pet corner: fact of the day |
| [Dogs](https://dog.ceo/dog-api/) | Based on the Stanford Dogs Dataset | pet corner: daily photo |
| [FishWatch](https://www.fishwatch.gov/developers) | Information and pictures about individual fish species | field guide: fish species |
| [HTTP Cat](https://http.cat/) | Cat for every HTTP Status |  |
| [HTTP Dog](https://http.dog/) | Dogs for every HTTP response status code |  |
| [Movebank](https://github.com/movebank/movebank-api-doc) | Movement and Migration data of animals | field guide: animal tracks |
| [PlaceBear](https://placebear.com/) | Placeholder bear pictures |  |
| [PlaceDog](https://place.dog) | Placeholder Dog pictures |  |
| [RandomDog](https://random.dog/woof.json) | Random pictures of dogs | pet corner: daily photo |
| [Shibe.Online](http://shibe.online/) | Random pictures of Shiba Inu, cats or birds | pet corner: daily photo |

### Anime (8)

| API | What it gives | Module idea |
|---|---|---|
| [AnimeFacts](https://chandan-02.github.io/anime-facts-rest-api/) | Anime Facts (over 100+) |  |
| [AnimeNewsNetwork](https://www.animenewsnetwork.com/encyclopedia/api.php) | Anime industry news | anime news in the glance view |
| [Catboy](https://catboys.com/api) | Neko images, funny GIFs & more |  |
| [Jikan](https://jikan.moe) | Unofficial MyAnimeList API | anime watchlist (MyAnimeList data) |
| [NekosBest](https://docs.nekos.best) | Neko Images & Anime roleplaying GIFs |  |
| [Studio Ghibli](https://ghibliapi.vercel.app) | Resources from Studio Ghibli films | watchlist: Ghibli shelf |
| [Trace Moe](https://soruly.github.io/trace.moe-api/#/) | A useful tool to get the exact scene of an anime from a screenshot | identify an anime from a screenshot |
| [Waifu.im](https://waifu.im/docs) | Get waifu pictures from an archive of over 4000 images and multiple tags |  |

### Anti-Malware (2)

| API | What it gives | Module idea |
|---|---|---|
| [ScanMalware](https://scanmalware.com) | Scan URLs in a sandboxed browser and search past scans by domain, IP, ASN, JARM or favicon hash |  |
| [URLhaus](https://urlhaus-api.abuse.ch/) | Bulk queries and Download Malware Samples |  |

### Art & Design (12)

| API | What it gives | Module idea |
|---|---|---|
| [3DTexel](https://3dtexel.com/developers/#public-api) | Search free CC0 PBR materials, HDRIs, decals and 3D models for games |  |
| [Art Institute of Chicago](https://api.artic.edu/docs/) | Art | museum postcards |
| [EmojiHub](https://github.com/cheatsnake/emojihub) | Get emojis by categories and groups | emoji picker |
| [Face Shape Guide Lookup](https://myfaceshapechart.com/openapi.json) | Read-only lookup for published face-shape guide records |  |
| [Favicondl](https://favicondl.com/documentation.html) | Get any website's favicon by URL (SVG/PNG/ICO), with JSON metadata and fallbacks | favicons for link cards |
| [Icon Horse](https://icon.horse) | Favicons for any website, with fallbacks | favicons for link cards |
| [Iconify](https://iconify.design/docs/api/) | Search and fetch SVG icons from 200+ open source icon sets | icon stickers |
| [Lordicon](https://lordicon.com/) | Icons with predone Animations |  |
| [PHP-Noise](https://php-noise.com/) | Noise Background Image Generator |  |
| [PickShade](https://pickshade.com/api) | Convert colors, check WCAG and APCA contrast, build palettes, gradients and tokens | palette module |
| [raFont](https://rafont.com/api-docs) | 1,500+ free downloadable fonts with categories, tags and preview images |  |
| [The Color API](https://www.thecolorapi.com) | Convert and generate color schemes | palette / swatch module |

### Blockchain (4)

| API | What it gives | Module idea |
|---|---|---|
| [ClearTrace](https://cleartracedata.com/docs) | Cross-frontend DEX attribution and execution quality data across Ethereum and L2s |  |
| [Get Started with Web3](https://github.com/beihaili/Get-Started-with-Web3/blob/main/docs/api.md) | Bilingual Web3 lessons, glossary search and role-based learning paths |  |
| [MELEK](https://witness.melek.salon/dev/melek) | Graphene social blockchain (Steem family) with a keyless condenser_api JSON-RPC |  |
| [TWZRD Agent Intel](https://intel.twzrd.xyz) | Solana on-chain agent trust scoring via MCP; 4 free tools to score, resolve and verify AI agent wallets |  |

### Books (14)

| API | What it gives | Module idea |
|---|---|---|
| [Bhagavad Gita telugu](https://gita-api.vercel.app) | Bhagavad Gita API in telugu and odia languages |  |
| [Bible-api](https://bible-api.com/) | Free Bible API with multiple languages | verse of the day |
| [BookRank](https://openbookrank.com/en/open-data) | Book rankings from open reader ratings: books, series, reading orders and authors |  |
| [Greenlit Books](https://greenlitbooks.com/developers) | Catalog of practical AI books with search, series, glossary and a claim ledger |  |
| [KDP Intelligence](https://kdp-intelligence-api.vercel.app/docs) | KDP niche demand scores, competition analysis and revenue estimates |  |
| [Penguin Publishing](http://www.penguinrandomhouse.biz/webservices/rest/) | Books, book covers and related data |  |
| [PoetryDB](https://github.com/thundercomb/poetrydb#readme) | Enables you to get instant data from our vast poetry collection | poem of the day |
| [Quran](https://quran.api-docs.io/) | RESTful Quran API with multiple languages | verse of the day |
| [Quran Cloud](https://alquran.cloud/api) | A RESTful Quran API to retrieve an Ayah, Surah, Juz or the entire Holy Quran | verse of the day |
| [Quran-api](https://github.com/fawazahmed0/quran-api#readme) | Free Quran API Service with 90+ different languages and 400+ translations |  |
| [Runyankole Bible](https://runyankole-bible-api.vercel.app) | Free REST API for the Runyankore-Rukiga Bible — 66 books, 31106 verses |  |
| [Thirukkural](https://api-thirukkural.web.app/) | 1330 Thirukkural poems and explanation in Tamil and English | couplet of the day |
| [Urantia Papers](https://urantia.dev) | Full-text + semantic search across the Urantia Papers, with audio narration, entities, translations |  |
| [Wizard World](https://wizard-world-api.herokuapp.com/swagger/index.html) | Get information from the Harry Potter universe |  |

### Business (6)

| API | What it gives | Module idea |
|---|---|---|
| [KontragentPro](https://kontragentpro.ru/api/v2/docs) | Russian company data from state registers by INN or OGRN: profile, finances, timeline |  |
| [Legal Sandbox Georgia](https://legal.ge/api/openapi.json) | Find verified legal specialists in Georgia from natural-language queries |  |
| [Pick an Agency](https://www.pickanagency.com/developers) | Search 47,000+ marketing agencies by service, location and rating |  |
| [TradeDataHub](https://www.tradedatahub.net) | U.S. contractor datasets with a free discovery API for coverage, pricing and masked previews |  |
| [Verif Entreprise FR](https://api-production-24833.up.railway.app) | French company checks by SIREN: status, insolvency (BODACC), VAT (VIES); free preview |  |
| [W System EU Business Data](https://api.wsystem.dev/docs) | EU VAT (VIES) and EORI validation, company registers, EU/UN/OFAC/UK sanctions screening |  |

### Calendar (7)

| API | What it gives | Module idea |
|---|---|---|
| [caldays](https://caldays.com/api) | Public holidays for 195+ countries | calendar: odd holidays |
| [CountdownsHQ](https://countdownshq.com/developers) | Dates and timezone-correct countdowns for 150+ holidays and observances in 18 countries | countdown module |
| [India Public Holidays](https://calendar-api-web.vercel.app/docs) | Official Indian public holidays for the Central government and 36 states/UTs | calendar: public holidays |
| [Intellibook](https://www.intellibookai.com/docs) | Appointment booking and availability API for salons and clinics |  |
| [Namedays Calendar](https://nameday.abalin.net) | Provides namedays for multiple countries | calendar: name days |
| [Non-Working Days](https://isdayoff.ru) | Simple REST API for checking working, non-working or short days for Russia, CIS, USA and other | calendar: public holidays |
| [The Calendar](https://the-calendar.net/api/) | Public holidays for US states and 30 countries plus sports and finance calendars as static JSON | calendar: holidays |

### Cloud Storage & File Sharing (1)

| API | What it gives | Module idea |
|---|---|---|
| [Pantry](https://getpantry.cloud/) | Free JSON storage for small projects | tiny shared JSON store |

### Cryptocurrency (21)

| API | What it gives | Module idea |
|---|---|---|
| [0x](https://docs.0x.org/) | API for querying token and pool stats across various liquidity pools |  |
| [Alpha (Mossland)](https://alpha.moss.land/developers) | Korean crypto channel stance + RAG Q&A + canonical entity/topic/event store |  |
| [bilbop](https://api.bilbop.org) | Solana USDC x402 pay-per-call tools for agents: SPL mint info, token brief, text summarize, Piper TTS, bran... |  |
| [Bitcoin Halving](https://why21million.com/halving-api/) | Halving era, block reward, and schedule arithmetic for any Bitcoin block height |  |
| [BitcoinYield](https://bitcoinyield.co/docs) | Live yields on BTC, ETH and stablecoins across DeFi and CeFi, with an A-D risk grade per offer |  |
| [BlazePhoenix](https://blazephoenix.xyz/api) | On-chain DEX aggregator quotes and route execution data |  |
| [Block Lottos](https://blocklottos.com/openapi.json) | On-chain lottery, draw history, jackpot and advertising endpoints |  |
| [BTCGlobe](https://btcglobe.live/join#makers) | Bitcoin height, fees, mempool and peer data served live from two self-hosted nodes |  |
| [CoinGecko](http://www.coingecko.com/api) | Cryptocurrency Price, Market, and Developer/Social Data | ticker on a watch board |
| [CoinLobster](https://coinlobster.com/developers) | Live executed whale trades across 15 exchanges and on-chain DEX with an unusualness radar |  |
| [Coinpaprika](https://api.coinpaprika.com) | Cryptocurrencies prices, volume and more | ticker |
| [CorpStacking](https://www.corpstacking.com/feed.json) | Corporate, government and ETF Bitcoin, Ethereum and Solana treasury disclosures |  |
| [Crypto Vision](https://cryptocurrency.cv/developers) | Free crypto news aggregator with market context, JSON REST and RSS |  |
| [DefiLlama](https://defillama.com/docs/api) | Open and transparent DeFi data, TVL, coin prices, volumes, and yields | ticker |
| [FraudCoins](https://fraudcoins.com/data/) | On-chain top-10 holder concentration and contract permissions for crypto tokens |  |
| [HostDeFi](https://hostdefi.com/docs/api/) | Free A+–F token-safety grades across Solana and EVM chains |  |
| [MarginPad](https://marginpad.io/free-crypto-api/) | Crypto futures prices, candles, funding, open interest, long/short and liquidations, 9 exchanges |  |
| [monerometrics](https://monerometrics.net) | Reorg-aware Monero (XMR) network metrics, mining-pool centralization and chain reorganizations |  |
| [SoloLuck](https://sololuck.io/api) | Bitcoin solo mining pool stats, per-address miner stats and an open dataset of solo-mined blocks |  |
| [WhiteBIT](https://docs.whitebit.com) | European cryptocurrency exchange |  |
| [Zennet](https://zennet.cloud) | x402 pay-per-use APIs: Polymarket signals, CEX/DEX spreads, contract risk scores, gas oracle |  |

### Currency Exchange (8)

| API | What it gives | Module idea |
|---|---|---|
| [api-mint](https://api-mint.hoiwan.workers.dev) | Free utility APIs: timezone, forex rates, crypto prices, page metadata |  |
| [Currency-api](https://github.com/fawazahmed0/currency-api#readme) | Free Currency Exchange Rates API with 150+ Currencies & No Rate Limits | travel money converter |
| [Daleelak](https://getdaleelak.com/en/api) | Egyptian bank and dealer exchange rates, gold and silver prices |  |
| [Frankfurter](https://frankfurter.dev) | Exchange rates, currency conversion and time series | travel money converter |
| [Fulusly](https://fulusly.soft9.us/developers) | Exchange rates for 144 currencies with daily history back to the 1990s, English and Arabic |  |
| [National Bank of Poland](http://api.nbp.pl/en.html) | A collection of currency exchange rates (data in XML and JSON) |  |
| [paralelo.bo](https://paralelo.bo/api) | Bolivia parallel-market USD/BOB exchange rate, aggregated from P2P sources every 60s |  |
| [VATComply.com](https://www.vatcomply.com/documentation) | Exchange rates, geolocation and VAT number validation | travel money converter |

### Development (68)

| API | What it gives | Module idea |
|---|---|---|
| [24 Pull Requests](https://24pullrequests.com/api) | Project to promote open source collaboration during December |  |
| [Agent Nexus](https://agentnexus.app/llms.txt) | Continuously probed registry of APIs, MCP servers and CLIs callable by agents |  |
| [AgentPay Domain Lookup](https://agentpay-lookup.agentpay-apis.workers.dev) | DNS records, WHOIS/RDAP, IP ownership and domain reports for AI agents, paid per call via x402 |  |
| [Agify.io](https://agify.io) | Estimates the age from a first name | name-guess toy |
| [ApicAgent](https://www.apicagent.com) | Extract device details from user-agent string |  |
| [APIzone](https://apizone.io/api-docs) | Independent uptime & status monitoring for 200+ popular APIs |  |
| [Beeceptor](https://beeceptor.com/) | Build a mock Rest API endpoint in seconds |  |
| [BountyCheck](https://bountycheck.vercel.app) | Claimability verdicts for GitHub bounty issues; free stats and sample, checks paid per call via x402 |  |
| [ChartBytes](https://chartbytes.meridian-digital.pro) | Chart image API: turn a URL into a PNG or SVG chart (bar, line, area, scatter, pie, donut, stacked) |  |
| [claudecookie](https://claudecookie.com/api/) | Convert cookie formats, check Claude sessions and generate Claude Code credentials |  |
| [Cloudflare Trace](https://github.com/fawazahmed0/cloudflare-trace-api) | Get IP Address, Timestamp, User Agent, Country Code, IATA, HTTP Version, TLS/SSL Version & More | dev only |
| [Codeberg](https://codeberg.org/api/swagger) | Git hosting, repos and issues via Gitea API |  |
| [CORS Proxy](https://github.com/burhanuday/cors-proxy) | Get around the dreaded CORS error by using this proxy as a middle man | CORS proxy (third party; do not depend on it) |
| [CountAPI](https://countapi.xyz) | Free and simple counting service. You can use it to track page hits and specific events | counters |
| [crates.io](https://crates.io/data-access) | Rust crate versions, downloads and dependency metadata | dev shelf |
| [DigMyName](https://digmyname.com/api) | Domain availability and registrar pricing across 52 TLDs |  |
| [Domain Info by LifeStep](https://dns.lifestep.io) | DNS records, SPF/DMARC detection and TLS certificate expiry |  |
| [dotsweep](https://dotsweep.com/docs) | Domain availability across 1200+ TLDs with registration and renewal prices |  |
| [DownStatus](https://isitdownstatus.com) | Real-time status for GitHub, AWS, Discord and 90+ services |  |
| [EndOfLife.date](https://endoflife.date/docs/api) | Software end-of-life dates and support lifecycles | dev shelf: end-of-life dates |
| [ExtendsClass JSON Storage](https://extendsclass.com/json-storage.html) | A simple JSON store API |  |
| [Fair Draw](https://bettip.co.za/fair-draw/api/) | Verifiable random draws bound to the drand public randomness beacon |  |
| [Genderize.io](https://genderize.io) | Estimates a gender from a first name | name-guess toy |
| [GeraCode](https://www.geracodigo.com.br/api-codigo-de-barras) | Barcode (EAN-13, UPC-A, Code 128, ITF-14) and QR code images, PNG or SVG. Docs in Portuguese |  |
| [GithubTrends](https://githubtrends.app/api/) | GitHub Trending repositories with star history and open-source alternatives to paid tools |  |
| [HostDealRadar](https://hostdealradar.com/ai/) | Source-backed hosting price and provider record lookup |  |
| [Httpbin](https://httpbin.org/) | A Simple HTTP Request & Response Service | dev only |
| [Icanhazepoch](https://icanhazepoch.com) | Get Epoch time |  |
| [Icanhazip](https://major.io/icanhazip-com-faq/) | IP Address API |  |
| [Image-Charts](https://documentation.image-charts.com/) | Generate charts, QR codes and graph images | charts for trackers |
| [Index Agentica](https://indexagentica.com/agents/) | Agent-first directory of skills, MCP servers, tools, protocols and APIs as JSON, markdown, llms.txt |  |
| [ip-fast.com](https://ip-fast.com/docs/) | IP address, country and city |  |
| [Is This Site Down?](https://downforjustmeoreveryone.com/api) | Check if any website is down, from two continents; live status, uptime history and TLS expiry |  |
| [jsDelivr](https://github.com/jsdelivr/data.jsdelivr.com) | Package info and download stats on jsDelivr CDN | dev shelf |
| [JSONPlaceholder](https://jsonplaceholder.typicode.com) | Fake REST API for testing and prototyping | dev only |
| [Kroki](https://kroki.io) | Creates diagrams from textual descriptions | diagrams from text |
| [LiveOrDown](https://liveordown.com/developers) | Live up/down status of 240+ online services, checked every minute from 3 regions |  |
| [Lua Decompiler](https://lua-decompiler.ferib.dev/) | Online Lua 5.1 Decompiler |  |
| [macadress](https://macadress.com/mac-address-api) | MAC address and OUI vendor lookup synced from IEEE, with randomized-MAC detection |  |
| [Mocky](https://designer.mocky.io/) | Mock user defined test JSON for REST API endpoints | dev only |
| [MyIPRightNow](https://myiprightnow.com) | Public IP address with network, location, and connection details |  |
| [Nationalize.io](https://nationalize.io) | Estimate the nationality of a first name | name-guess toy |
| [Nerdulator](https://nerdulator.com/api) | Everything derivable from one value: numbers, dates, colours, UUIDs, cron expressions |  |
| [NetworkCalc](https://networkcalc.com/api/docs) | Network calculators, including subnets, DNS, binary, and security tools |  |
| [NuGet](https://learn.microsoft.com/en-us/nuget/api/overview) | .NET package versions, metadata and search | dev shelf |
| [Open VSX](https://open-vsx.org/) | Search and access VS Code extensions from the Open VSX registry | dev shelf |
| [Orca Scan](https://orcascan.com/guides/free-barcode-image-api-0e4a4fa6) | Generate barcode images (QR, Code 128, EAN, Data Matrix and more) in SVG, PNG, JPG or PDF |  |
| [OutageDeck](https://outagedeck.com/developers/api) | Live status and incidents for 170+ cloud and SaaS providers from official feeds |  |
| [oyyi](https://oyyi.xyz/docs/1.0) | API for Fake Data, image/video conversion, optimization, pdf optimization and thumbnail generation |  |
| [ProxyForge](https://proxyforge.dev) | Free auto-updating list of live-tested proxies (HTTP/HTTPS/SOCKS4/SOCKS5), refreshed every 6 h |  |
| [QR & Barcode](https://solsigs.com/qrapi/) | QR codes and barcodes (Code 128, EAN-13, Data Matrix, PDF417 + more). SVG or PNG output |  |
| [QR code](https://www.qrtag.net/api/) | Create an easy to read QR code and URL shortener | share a board as a QR code |
| [QR Code by LifeStep](https://qr.lifestep.io) | Generate QR codes as PNG or SVG with size, border and color options |  |
| [QR Code Crafter](https://qrcodecrafter.com/qr-code-api) | Generate static QR codes in SVG, PNG, JPG, WebP, PDF, or EPS |  |
| [QuickChart](https://quickchart.io/) | Generate chart and graph images | charts for trackers |
| [Quotable](https://github.com/lukePeavey/quotable) | Random quotes with authors and tags | quote of the day |
| [RSS feed to JSON](https://rss-to-json-serverless-api.vercel.app) | Returns RSS feed in JSON format using feed URL | feed reader module |
| [RubyGems](https://guides.rubygems.org/rubygems-org-api/) | Ruby gem metadata, versions, dependencies and search | dev shelf |
| [Sonar](https://github.com/Cgboal/SonarSearch) | Project Sonar DNS Enumeration API |  |
| [Statically](https://statically.io/) | A free CDN for developers |  |
| [TheQRCode](https://theqrcode.io/qr-code-api) | Generate QR codes for URLs, WiFi, contact cards, email and text, with custom colors and styling | share a board as a QR code |
| [Thunder Client](https://www.thunderclient.com/) | API testing tool |  |
| [TidyTools](https://tools.yukai.uk/llms.txt) | Web page to clean Markdown and AI crawler robots.txt checks, free without a key (rate limited) |  |
| [Timezone WorldTime](https://www.timezone.io/docs/worldtimeapi) | Current time, UTC offset and DST for any time zone or IP, a drop-in WorldTimeAPI replacement | world clocks |
| [TinyMind Agent Tools](https://tinymind.eu/api/) | Free APIs by an AI agent on a VPS: actor lookup, word-of-the-day, poems, jokes, ping |  |
| [Vornamencheck](https://vornamencheck.de/#api) | Gender probability for a first name, optionally per country; documentation in German |  |
| [XLSX Inspector](https://api.lifestep.io) | Inspect XLSX/XLSM structure: sheets, formulas, macros and external links |  |
| [Yumi Wheel Evidence](https://noqt.no-qt.chatgpt.site/yumi/wheel-evidence) | Intersect wheel tags for explicit PyPI releases with caller-supplied tags |  |

### Dictionaries (3)

| API | What it gives | Module idea |
|---|---|---|
| [Random Lexicon](https://randomlexicon.com/api-reference) | Random words and definitions using optional filters | word of the day |
| [Wiktionary](https://en.wiktionary.org/w/api.php) | Collaborative dictionary data | word of the day / dictionary |
| [WordSoHard](https://wordsohard.com/api) | Word definitions with Scrabble validity and tile score in one call, built for word games | word of the day |

### Documents & Productivity (3)

| API | What it gives | Module idea |
|---|---|---|
| [AgentPay Doc Tools](https://agentpay-tools.agentpay-apis.workers.dev) | PDF to text, RSS/Atom/JSON feeds to JSON and sitemaps to URL lists, paid per call via x402 |  |
| [DocStruct](https://docstruct.pages.dev) | AI extraction of invoices, receipts, bank statements & contracts into structured JSON/CSV |  |
| [TeamSort](https://teamsort.world/developers) | Create a ranked-choice poll from a text prompt and get a shareable link |  |

### Email (9)

| API | What it gives | Module idea |
|---|---|---|
| [AGPC Domain Check](https://guild.tradeuniquecapital.com/api) | Check a domain's SPF, DKIM, DMARC and MX with a graded shareable report |  |
| [Disify](https://www.disify.com/) | Validate and detect disposable and temporary email addresses |  |
| [Email Spam Tester](https://email-spam-tester.com/api-docs/) | Send a test message and get a spam score, 41 checks with RFC citations and a fix plan |  |
| [Email Validator by LifeStep](https://email.lifestep.io) | Validate email syntax and MX, detect disposable/role addresses, suggest typo fixes |  |
| [EVA](https://eva.pingutil.com/) | Validate email addresses |  |
| [Kickbox](https://open.kickbox.com/) | Email verification API |  |
| [mail.gw](https://docs.mail.gw) | 10 Minute Mail |  |
| [mail.tm](https://docs.mail.tm) | Temporary Email Service |  |
| [MailSenpai DNS Check](https://en.mailsenpai.com/dns-check-api/) | Check a domain's SPF, DKIM, DMARC and MX records and get what to fix, with the values to publish |  |

### Entertainment (8)

| API | What it gives | Module idea |
|---|---|---|
| [Bucketlist Dream of the Day](https://bucketlist.nl/samenwerken?lang=en#droom-van-de-dag) | Daily travel and life-experience inspiration with canonical links and images | bucket list prompt |
| [Corporate Buzz Words](https://github.com/sameerkumar18/corporate-bs-generator-api) | REST API for Corporate Buzz Words | joke of the day |
| [CosmyDay Astrology](https://cosmyday.com/api-docs) | Natal charts and sky events computed from Swiss Ephemeris | horoscope sticker |
| [Fun Fact](https://api.aakhilv.me) | A simple HTTPS api that can randomly select and return a fact from the FFA database | fun fact of the day |
| [JokeAPI](https://v2.jokeapi.dev/) | Programmable jokes in multiple languages with filtering options | joke of the day |
| [justmeme.wtf](https://justmeme.wtf/api-docs) | Free meme API with 2400+ templates, search, trending, and AI generation |  |
| [PotterDB](https://docs.potterdb.com/) | Harry Potter universe database with characters, spells, potions and more | fandom trivia |
| [Yes or No Oracle](https://yesnooracle.app/api) | Random yes/no/maybe answers in 7 themed oracle voices (Magic 8 Ball, Tarot, and more) | decision dice / oracle |

### Environment (5)

| API | What it gives | Module idea |
|---|---|---|
| [GridVigil](https://gridvigil.com/developers) | Pressure scores, demand, generation mix and alerts for the 10 major U.S. power grids |  |
| [kanari](https://kanari.io/en/api) | Real-time worldwide wildfire detections, water bomber tracking and open fire archive |  |
| [Open-Meteo](https://open-meteo.com/) | Free weather API for non-commercial use | weather glance |
| [Sähkön hinta nyt](https://xn--shknhintanyt-gcb8w.org/integraatiot/) | Finnish and Nordic day-ahead electricity spot prices (15-minute), cheapest hours |  |
| [WattFigure](https://api.wattfigure.com/) | US electricity rates by state, with appliance and EV charging running costs |  |

### Events (1)

| API | What it gives | Module idea |
|---|---|---|
| [Things To Do](https://thingstodoapi.com/docs/) | Local events in plain words: concerts, pop-ups, markets, classes, gallery nights |  |

### Finance (24)

| API | What it gives | Module idea |
|---|---|---|
| [Banking Access Index](https://www.globalsolo.global/data/banking-access-index) | Which US business banking providers accept founders by country of residence, with sources |  |
| [Brainy Prices](https://prices.brainy.ae/developers.html) | UAE living costs: KHDA fees, DLD rents, fuel, utilities, telecom and relocation, with dated sources |  |
| [CardBinCheck](https://cardbincheck.com/bin-lookup-api) | Card BIN/IIN lookup: network, issuer, country and card type for the first 6-8 digits |  |
| [contix](https://contix.es/api/#herramientas) | Spain: IBAN validation with bank and BIC, EU VAT number check (VIES), Modelo 303 VAT sums |  |
| [Econdb](https://www.econdb.com/api/) | Global macroeconomic data |  |
| [EstimateTax](https://estimatetax.net/api/) | US federal, state and local income tax calculation for 2026, with the source of every figure |  |
| [Finance Clearly Tax Rates](https://financeclearly.com/tax-rates-api/) | Current UK and US tax rates, allowances and thresholds |  |
| [FloorGuard](https://floorguard-kappa.vercel.app/api/) | Sourced prop firm daily-loss and max-drawdown rules, plus a drawdown-room check |  |
| [Futures Clock](https://futuresclock.com/en/data-methodology/#open-data) | Trading hours and session windows for 65 futures products on 16 global exchanges |  |
| [Helious](https://helious.io/developers/) | US Treasury auction results with the tail and bidder split, plus scored economic releases |  |
| [Helium](https://heliumtrades.com/mcp-page/) | News with media bias scoring, balanced news synthesis, live market data, AI options pricing |  |
| [IBAN Analyzer](https://iban-analyzer.com/free-iban-api) | Resolve an IBAN to its bank name, BIC, city and address for 60+ countries |  |
| [India GST HSN & SAC](https://gst-hsn-sac-api.vercel.app/docs) | Indian GST HSN and SAC classification code lookup and search |  |
| [LiquiLens](https://liquilens.in/developers/) | Public-record bank and lender failure-risk evidence |  |
| [Nigeria PAYE](https://www.orionsoftlimited.com/developers) | Nigerian income tax (PAYE) and take-home pay under the Nigeria Tax Act 2025 |  |
| [PolyKal Fees](https://polymarket-kalshi.com/fee-schedule/) | Kalshi & Polymarket trading fee rates and formulas as verified JSON |  |
| [Portfolio Optimizer](https://portfoliooptimizer.io/) | Portfolio analysis and optimization |  |
| [SEC EDGAR Data](https://www.sec.gov/edgar/sec-api-documentation) | API to access annual reports of public US companies |  |
| [Seiche](https://seiche.info/developers) | Free public funding, FX and capital-market evidence with source clocks |  |
| [TickerInside](https://tickerinside.com/api/) | Holdings of every US ETF, which ETFs hold a stock, and overlap between funds, each dated |  |
| [Undertow](https://liquilens-undertow.com/developers/) | Public market-depth and sized exit estimates, not executable quotes |  |
| [US Mortgage Calculator](https://www.usmortgagecalc.com/developers/api) | Mortgage payment, amortization, affordability and 50-state property tax data |  |
| [XOOMAR](https://xoomar.com/markets/api) | US market data from SEC, FINRA, CFTC and the Fed: filings, insiders, earnings dates, short interest |  |
| [Zelothorn](https://zelothorn.com/developers) | Plain-English explanations of US public companies with SEC filings and earnings data |  |

### Food & Drink (8)

| API | What it gives | Module idea |
|---|---|---|
| [BaconMockup](https://baconmockup.com/) | Resizable bacon placeholder images |  |
| [Daily Food Recalls](https://dailyfoodrecalls.com/api/) | U.S. FDA and USDA food recalls, merged and normalized, updated daily |  |
| [ExactCup](https://exactcup.github.io/api/) | Cooking ingredient densities: grams per US cup, tablespoon, teaspoon and mL |  |
| [FiberUp Fiber Database](https://fiberup.app/data/) | Dietary fiber per serving and per 100 g, split into soluble and insoluble, for ~200 common foods |  |
| [Foodish](https://github.com/surhud004/Foodish#readme) | Random pictures of food dishes | food photo of the day |
| [IndiaRestros](https://indiarestros.com/api/docs) | Indian restaurants, menus with rupee prices, dish search and timings across 9,000+ cities |  |
| [Open Brewery DB](https://www.openbrewerydb.org) | Breweries, Cideries and Craft Beer Bottle Shops | drinks map / tasting log |
| [Racion](https://racion.app/developers) | Weekly meal plans with grocery prices and shopping lists, 22 countries |  |

### Games & Comics (37)

| API | What it gives | Module idea |
|---|---|---|
| [AmiiboAPI](https://amiiboapi.com/) | Nintendo Amiibo Information | collection shelf |
| [Astroworld](https://api.astroworldmc.com) | Free Minecraft data: mobs, biomes, items, enchantments, structures, commands, versions, achievements, trades |  |
| [Autochess VNG](https://github.com/didadadida93/autochess-vng-api) | Rest Api for Autochess VNG |  |
| [Barter.VG](https://github.com/bartervg/barter.vg/wiki) | Provides information about Game, DLC, Bundles, Giveaways, Trading | game backlog |
| [Bugsnax](https://www.bugsnaxapi.com/) | Get information about Bugsnax |  |
| [CheapShark](https://www.cheapshark.com/api) | Steam/PC Game Prices and Deals | game backlog: deals |
| [Crafatar](https://crafatar.com) | API for Minecraft skins and faces |  |
| [Cross Universe](https://crossuniverse.psychpsyo.com/apiDocs.html) | Cross Universe Card Data |  |
| [Disney](https://disneyapi.dev) | Information of Disney characters | fandom trivia |
| [DotaSense Timings](https://dotasense.com/cheat-sheet#timing-api) | Reviewed Dota 2 objective timings in JSON and CSV |  |
| [Dungeons and Dragons (Alternate)](https://open5e.com/) | Includes all monsters and spells from the SRD (System Reference Document) as well as a search API |  |
| [FFXIV Collect](https://ffxivcollect.com/) | Final Fantasy XIV data on collectables | game tracker |
| [Final Fantasy XIV](https://xivapi.com/) | Final Fantasy XIV Game data API |  |
| [FreeToGame](https://www.freetogame.com/api-doc) | Free-To-Play Games Database | game backlog: free games |
| [Fun Facts](https://asli-fun-fact-api.herokuapp.com/) | Random Fun Facts | fun fact of the day |
| [FunTranslations](https://api.funtranslations.com/) | Translate Text into funny languages |  |
| [GamerPower](https://www.gamerpower.com/api-read) | Game Giveaways Tracker | game backlog: giveaways |
| [Geek-Jokes](https://github.com/sameerkumar18/geek-joke-api) | Fetch a random geeky/programming related joke for use in all sorts of applications | joke of the day |
| [Genshin Impact](https://genshin.dev) | Genshin Impact game data |  |
| [GraphQL Pokemon](https://github.com/favware/graphql-pokemon) | GraphQL powered Pokemon API. Supports generations 1 through 8 | pokedex shelf |
| [GZW Data](https://gzw-data.vercel.app/docs/) | Gray Zone Warfare weapons, missions, loot, armor and game data |  |
| [JokeAPI](https://sv443.net/jokeapi/v2/) | Programming, Miscellaneous and Dark Jokes | joke of the day |
| [L2 Calendar](https://l2calendar.com/api/servers) | Lineage 2 private servers list with names, websites, chronicles, rates and opening dates |  |
| [Monster Hunter World](https://docs.mhw-db.com/) | Monster Hunter World data |  |
| [PokéAPI (GraphQL)](https://github.com/mazipan/graphql-pokeapi) | The Unofficial GraphQL for PokeAPI |  |
| [PokéSprite](https://msikma.github.io/pokesprite/) | Database of Pokémon sprites and icons |  |
| [Psychonauts](https://psychonauts-api.netlify.app/) | Psychonauts World Characters Information and PSI Powers |  |
| [Puyo Nexus](https://github.com/deltadex7/puyodb-api-deno) | Puyo Puyo information from Puyo Nexus Wiki |  |
| [Rblxdb](https://rblxdb.com/developers) | Verified Roblox music codes and decal IDs with live working status |  |
| [Rick and Morty](https://rickandmortyapi.com) | All the Rick and Morty information, including images | fandom trivia / watchlist |
| [Scryfall](https://scryfall.com/docs/api) | Magic: The Gathering database | card collection (Magic) |
| [SeedFinder](https://mineseedfinder.vercel.app/seedfinder) | Minecraft Bedrock structures prediction |  |
| [Social Casino Index](https://socialcasinoindex.com/data/) | Daily-checked US social casino toplist: signup bonuses, payout times, minimums, sources |  |
| [SteamGPT](https://steamgpt.net) | Steam profiles, SteamID conversion, VAC/game bans, FACEIT stats and friends |  |
| [TCGdex](https://tcgdex.dev/) | Multi languages Pokémon TCG Information | card collection (Pokemon TCG) |
| [Universalis](https://universalis.app/docs/index.html) | Final Fantasy XIV market board data |  |
| [Worth the Rip](https://worththerip.com/api/) | Sealed trading-card product prices and expected value across 10 TCGs, refreshed every 2 hours |  |

### Geocoding (24)

| API | What it gives | Module idea |
|---|---|---|
| [administrative-divisons-db](https://github.com/kamikazechaser/administrative-divisions-db) | Get all administrative divisions of a country |  |
| [bng2latlong](https://www.getthedata.com/bng2latlong) | Convert British OSGB36 easting and northing (British National Grid) to WGS84 latitude and longitude |  |
| [Country](http://country.is/) | Get your visitor's country from their IP |  |
| [GeographQL](https://geographql.netlify.app) | A Country, State, and City GraphQL API |  |
| [GeoJS](https://www.geojs.io/) | IP geolocation with ChatOps integration | rough location without GPS |
| [Geokeo](https://geokeo.com) | Geokeo geocoding service- with 2500 free api requests daily |  |
| [geoPlugin](https://www.geoplugin.com) | IP geolocation and currency conversion |  |
| [HackMyIP](https://hackmyip.com/api) | IP geolocation, ISP and privacy/VPN scoring, email breach checks, DNS and WHOIS lookups |  |
| [IP99](https://ip99.com/api) | IP geolocation with proxy, VPN and datacenter risk and the age of the evidence |  |
| [ipapi.co](https://ipapi.co/api/#introduction) | Find IP address location information | rough location |
| [ipgeolocationapi](https://ipgeolocationapi.io/docs) | IP geolocation with ASN, timezone, currency and threat data, 5,000 keyless calls a day |  |
| [IPKit](https://ipkit.dev/docs) | IP lookup with location, ASN/ISP and VPN/proxy/Tor signals |  |
| [ipwhois](https://ipwhois.io/documentation) | IP geolocation with country, city, coordinates, ISP, timezone and flag data | rough location |
| [LatLng](https://www.latlng.work/docs) | Geocoding, reverse geocoding, places, and static maps | geocode |
| [Moradas](https://moradas.dev/docs) | Portuguese address autocomplete and 7-digit postal codes (CP7) |  |
| [Nominatim](https://nominatim.org/release-docs/latest/api/Overview/) | Provides worldwide forward / reverse geocoding | place search / geocode |
| [Pinball Map](https://pinballmap.com/api/v1/docs) | A crowdsourced map of public pinball machines | pinball map |
| [PostalCodeCheck](https://postalcodecheck.com/postal-code-api) | City, region and coordinates for 887,000+ postal codes across 95 countries |  |
| [Postali](https://postali.app/api) | Mexico Zip Codes API | postcode lookup |
| [Postcodes.io](https://postcodes.io) | Postcode lookup & Geolocation for the UK | UK postcode lookup |
| [REST Countries](https://restcountries.com) | Get information about countries via a RESTful API | country card |
| [SearchPinCode](https://searchpincode.in/api) | Indian postal PIN code lookup, post office locator and district data |  |
| [SLF](https://github.com/slftool/slftool.github.io/blob/master/API.md) | German city, country, river, database |  |
| [Unblock Master IP](https://www.unblockmaster.com/free-ip-api/) | IP geolocation plus datacenter and VPN detection for any IPv4 or IPv6 address |  |

### Government (27)

| API | What it gives | Module idea |
|---|---|---|
| [Ayes and Noes](https://ayesandnoes.co.uk/developers) | UK House of Commons MPs, parties and recorded votes |  |
| [Bidledger](https://jaydemks.github.io/bidledger/api.html) | Every open public tender in the European Union, rebuilt daily from the official TED data |  |
| [Brazil](https://brasilapi.com.br/) | Community driven API for Brazil Public Data |  |
| [City, Toronto Open Data](https://open.toronto.ca/) | Toronto (CA) City Open Data |  |
| [ContaCLT](https://contaclt.com/dados/api/) | Brazilian payroll and labor calculations: net salary, INSS, IRRF, unemployment insurance |  |
| [EditalMD](https://editalmd.com/api/) | Brazilian public procurement (PNCP) notices as Markdown with deadlines and requirements |  |
| [Election](https://election.org/data/api) | Source-linked U.S. election and civic records with coverage limits |  |
| [EU VAT Rates by Commodity Code](https://github.com/humora2504/eu-vat-by-commodity-code) | EU VAT rates mapped to CN and CPA commodity codes, all 27 member states |  |
| [India LGD Index](https://india-lgd-index-api.vercel.app/docs) | Free, keyless Indian states, districts, sub-districts and development blocks with LGD codes |  |
| [Indian Mandi Prices](https://mandi-api.vercel.app/docs) | Free, keyless daily wholesale mandi prices for 5 Indian states, sourced from data.gov.in |  |
| [Indian MSP Benchmarks](https://msp-benchmarks-api.vercel.app/docs) | Statutory Minimum Support Prices and CACP production cost benchmarks across 28 Indian crops |  |
| [Indian Pincode](https://indianpincode.com/) | Free India PIN code lookup with GPS coordinates, 165k+ post offices, state & district data |  |
| [LocalGov.jp](https://localgov.jp/) | Japan grants and subsidies (central J-Grants + 1,916 municipalities) |  |
| [MORVS](https://morvs.ai/api/) | Source-linked US regulatory and public records: SEC filings, enforcement actions, recalls |  |
| [Open Government, Norway](https://data.norge.no/dataservices) | Norwegian Government Open Data |  |
| [Open Government, Poland](https://dane.gov.pl/en) | Poland Government Open Data |  |
| [Open Government, Portugal](https://dados.gov.pt/en/recursos/desenvolvimento/referencia-api) | Portugal Government Open Data |  |
| [OpenMercantil](https://openmercantil.es/api/documentacion) | Spanish company public data and BORME event timelines |  |
| [PRC Exam Schedule](https://api.whenisthenextboardexam.com/docs/) | Unofficial Philippine Professional Regulation Commission's examination schedule |  |
| [Right to Disconnect](https://righttodisconnect.jdries.nl/api/) | Right-to-disconnect employment law by EU country: binding status, statute, and sanctions |  |
| [Spatial India](https://api.spatialindia.com) | District-level data for India: Census, NFHS-5, NCRB, RBI and more, reconciled onto one map |  |
| [Tollmint](https://api.tollmint.com) | Advertising, subscription, AI-disclosure and accessibility rules across the US, EU and UK |  |
| [UK Legislation Changes](https://uk-legal-changes.pages.dev/docs) | Point-in-time amendment history for UK law |  |
| [UK Public Tenders by Trade](https://tools.gptshopltd.com/api/uk-tenders/) | Live open UK public sector tenders by trade from Find a Tender and Contracts Finder (OGL v3.0) |  |
| [Veridion](https://www.veridionmarkets.com/data-api/docs) | US congressional stock-trade disclosures and the President's OGE reports, linked to each filing |  |
| [Vett](https://wimberly.solutions/api/free-sanctions-check/) | Screen names & companies against OFAC, PEP, watchlists & recalls |  |
| [VotePredictor](https://votepredictor.com/developers) | US election forecasts, congressional voting records and forecaster accuracy ratings |  |

### Health (16)

| API | What it gives | Module idea |
|---|---|---|
| [Covid-19](https://covid19api.com/) | Covid 19 spread, infection and recovery |  |
| [Covid-19](https://github.com/M-Media-Group/Covid-19-API) | Covid 19 cases, deaths and recovery per country |  |
| [Covid-19 Government Response](https://covidtracker.bsg.ox.ac.uk) | Government measures tracker to fight against the Covid-19 pandemic |  |
| [Covid-19 JHU CSSE](https://nuttaphat.com/covid19-api/) | Open-source API for exploring Covid19 cases based on JHU CSSE |  |
| [Covid-19 Live Data](https://github.com/mathdroid/covid-19-api) | Global and countrywise data of Covid 19 daily Summary, confirmed cases, recovered and deaths |  |
| [Covid-19 Philippines](https://github.com/Simperfy/Covid-19-API-Philippines-DOH) | Unofficial Covid-19 Web API for Philippines from data collected by DOH |  |
| [COVID-ID](https://data.covid19.go.id/public/api/prov.json) | Indonesian government Covid data per province |  |
| [DeepDNA](https://deepdna.ai/docs/) | Cited gene, variant and CPIC drug-gene lookups for developers and AI agents |  |
| [FindSaunaPlunge](https://findsaunaplunge.com/api/) | US cold plunge and sauna venues with dated, source-quoted temperatures and prices |  |
| [LAPIS](https://cov-spectrum.ethz.ch/public) | SARS-CoV-2 genomic sequences from public sources |  |
| [Longevity World Cup](https://longevityworldcup.com/api/data/athletes) | Public biological age competition data with biomarkers and rankings |  |
| [Open Disease](https://disease.sh/) | API for Current cases and more stuff about COVID-19 and Influenza | health stats |
| [Open Targets](https://platform-docs.opentargets.org/) | Gene-disease-drug target associations |  |
| [Quarantine](https://quarantine.country/coronavirus/api/) | Coronavirus API with free COVID-19 live updates |  |
| [RxNorm](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html) | Normalized drug names, RxCUIs and NDC codes |  |
| [Urgences Québec](https://sante.handled.tools/api) | Hourly emergency room occupancy, stretcher counts and wait times for every hospital in Quebec, Canada |  |

### Jobs (11)

| API | What it gives | Module idea |
|---|---|---|
| [AI Dev Jobs](https://aidevboard.com/openapi.yaml) | AI/ML engineering job aggregator with REST, RSS, and MCP endpoints |  |
| [AI Trainer Work](https://aitrainer.work/open-data#api) | Open AI training jobs (RLHF, data annotation, expert evaluation) from 20+ platforms, with pay |  |
| [Arbeitnow](https://documenter.getpostman.com/view/18545278/UVJbJdKh) | API for Job board aggregator in Europe / Remote | job board |
| [Artificial Intelligence Jobs](https://artificialintelligencejobs.co/developers) | Live AI/ML job listings from 260+ companies' own career pages, with salary, location, remote and seniority... |  |
| [CuratorSearch](https://curatorsearch.com/developers) | Museum and gallery jobs from 400+ institutions' own careers pages, with advertised salaries |  |
| [DevITjobs UK](https://devitjobs.uk/job_feed.xml) | Jobs with GraphQL |  |
| [GraphQL Jobs](https://graphql.jobs/docs/api/) | Jobs with GraphQL |  |
| [Level](https://jobsbylevel.com/developers) | Job listings rated by AI level, from Little AI to Builds AI; REST, RSS and MCP |  |
| [Present of AI](https://presentofai.com/developers) | AI company profiles, open AI jobs and dated AI news, REST and MCP |  |
| [RemoteOK](https://remoteok.com/api) | Remote job board for digital nomads | job board |
| [TechRole Index](https://techrole.ru/open-data-daily) | Russian IT profession, vacancy publication and salary aggregates |  |

### Machine Learning (10)

| API | What it gives | Module idea |
|---|---|---|
| [AI Economics Tools](https://piszczek.pl/tools/api) | Token cost, LLM energy, agent-hour and Proof-Adjusted Autonomy calculators by Michał Piszczek |  |
| [DreamThreads](https://mydreamthreads.xyz/dream-interpretation-api) | Parse dreams into structured entities, emotions, agency, threat, and outcomes |  |
| [EXUDE-API](http://uttesh.com/exude-api/) | Used for the primary ways for filtering the stopping, stemming words from the text data |  |
| [Modelfax](https://bytebrujo.github.io/modelfax/) | LLM pricing, context windows and deprecation dates, schema-validated and updated daily |  |
| [Nonobench](https://www.nonobench.com/how-it-works) | Open-source benchmark of how well LLMs solve nonogram puzzles |  |
| [Not Human Search](https://nothumansearch.ai/openapi.yaml) | AI tool discovery with agentic scoring for 8,600+ tools and MCP servers |  |
| [OpenVisionAPI](https://openvisionapi.com) | Open source computer vision API based on open source models |  |
| [QuelLLM](https://quelllm.fr/api/) | Open-weight language model catalogue with memory requirements and installation metadata |  |
| [Statlyte](https://statlyte.com/api) | Live pricing, context windows and model ids for major LLM APIs |  |
| [TensorFeed](https://tensorfeed.ai/developers) | Real-time AI news, model pricing, service status, and agent activity feeds |  |

### Music (1)

| API | What it gives | Module idea |
|---|---|---|
| [Radio Browser](https://api.radio-browser.info/) | List of internet radio stations | radio dial |

### News (4)

| API | What it gives | Module idea |
|---|---|---|
| [Florida Man](https://github.com/juliayxhuang/florida-man-api#readme) | Static JSON dataset of 10,000+ Florida Man headlines by date |  |
| [Graphs for Coronavirus](https://corona.dnsforfamily.com/api.txt) | Each Country separately and Worldwide Graphs for Coronavirus. Daily updates |  |
| [Noozra](https://noozra.com/api) | Free news headlines from 200+ curated RSS sources |  |
| [Spaceflight News](https://spaceflightnewsapi.net) | Spaceflight related news 🚀 | space news glance |

### Open Data (36)

| API | What it gives | Module idea |
|---|---|---|
| [221](https://221.orvlabs.com/documentation) | Senegal reference data: public holidays, mobile operators, banks, communes, legal forms |  |
| [49 Gallery Historical Data](https://api.181649.com/docs) | Normalized historical records and 25 daily-updated reference series |  |
| [API Setu](https://www.apisetu.gov.in/) | An Indian Government platform that provides a lot of APIS for KYC, business, education & employment |  |
| [Auregistre](https://auregistre.fr/api) | French company history from the official gazette (BODACC) since 2008, with insolvency counts |  |
| [Band Atlas](https://www.aiotrf.com/en/ai/band-atlas/developers/) | Cellular IoT bands, 2G/3G sunsets and device compatibility for 46 countries |  |
| [Big Data Explained](https://bigdataexplained.com/data) | Cloud data warehouse list prices, read daily from AWS and Azure pricing APIs, with price history |  |
| [BTU Graph](https://btugraph.com/data/) | Source-reviewed energy company knowledge graph and directory exports |  |
| [CollegeCalcAI](https://collegecalcai.com/developers) | US college admission chance estimates and admissions data for 1,100+ colleges |  |
| [CuttingToolsAI](https://cuttingtoolsai.eu/api) | Cross-brand carbide insert grade equivalents by ISO application class |  |
| [Edgepedia](https://www.edgechat.ai/developers) | Search and read Edgepedia, a free and growing encyclopedia with citations |  |
| [EOSL](https://eosl.ai/api/) | Hardware end-of-sale and end-of-service-life dates by part number, source-linked |  |
| [HousingFeed](https://housingfeed.com/docs) | US rental listings from property managers' own websites, verified weekly |  |
| [i6eal Open AI Data](https://i6eal.de/en/tools/data/) | Open datasets on AI policy, regulation and public-sector adoption in Germany and the EU |  |
| [Kvartiry-Phuket](https://kvartiry-phuket.com/otkrytye-dannye/#english) | Russian-language Phuket real estate guides, asking prices, condo assessment rates, weather, beaches |  |
| [LottoLens PH](https://remo65588-boop.github.io/lottolens-ph-public-data/api/) | Fixed Philippine PCSO historical results and normal draw schedules |  |
| [Microlink.io](https://microlink.io) | Extract structured data from any website | link previews with no server (see hypermedia-server.md) |
| [ModelPartFinder Error Codes](https://modelpartfinder.com/docs/api) | Lookup appliance and equipment error codes by brand and code, with recommended replacement parts |  |
| [MostExpensiveWatches](https://mostexpensivewatches.net/api) | Documented luxury watch auction records, live listings, valuations and price indices |  |
| [Nobel Prize](https://www.nobelprize.org/about/developer-zone-2/) | Open data about nobel prizes and events | on this day / laureates |
| [Open Scholarships](https://scholarships.grudged.io) | Free, openly-licensed directory of US scholarships and student aid from official sources |  |
| [OpenSanctions](https://www.opensanctions.org/docs/api/) | Data on international sanctions, crime and politically exposed persons |  |
| [PayCrunch](https://paycrunch.co/api.html) | US wages for 1,008 occupations and by state, from BLS OEWS May 2025, static JSON, CC BY 4.0 |  |
| [ProductGuru](https://myproduct.guru/lookup/) | Consumer product-safety recall notices from 11 government registers, looked up by barcode (EAN/GTIN) |  |
| [PublicDataHub](https://publicdatahub.org/api) | US public schools, hospitals and federal agency budgets as JSON/CSV, with provenance |  |
| [SlashYear](https://slashyear.com/api) | Dated historical events as JSON, each quoted from a cited Wikipedia revision |  |
| [StackRates](https://stackrates.ai/ask/) | VPS and cloud server prices from 46 providers, read daily from their own pricing pages and APIs |  |
| [Statistics of the World](https://statisticsoftheworld.com/api-docs) | Economic data for 218 countries — GDP, population, inflation, and 440+ indicators from IMF and World Bank |  |
| [StatOrigin](https://statorigin.org/docs/api) | Industry statistics, each traced to its primary source with a verbatim quote, CC BY 4.0 |  |
| [The Deploy Log](https://github.com/dotcomjack/the-deploy-log) | 1,000+ AI deployments, each linked to the publisher's own page, JSON and CSV, CC BY 4.0 |  |
| [Tickerz](https://tickerz.com/docs) | Daily indexes of real-world activity from public data, each reading timestamped in Bitcoin |  |
| [Tilth](https://www.tilth.uk/data) | Free daily UK fertiliser price index across nine grades, CC BY 4.0 licensed |  |
| [Umeå Open Data](https://opendata.umea.se/api/) | Open data of the city Umeå in northen Sweden |  |
| [Verified Handles](https://verifiedhandles.org/developers) | Official social media handles and identifiers of 155,000+ notable people and organisations |  |
| [Vuntum](https://vuntum.com/en/api-mcp) | Sourced, dated facts on consumer robots and physical AI, licensed CC BY 4.0 |  |
| [w14n](https://api.w14n.dev/v1) | Brazilian company profiles by CNPJ, CNAE establishment counts and municipality coordinates |  |
| [Warnely](https://warnely.com/developers) | Composite travel-safety scores for 180 countries (FCDO + US State + GPI + WGI + live incident wire), OpenAP... |  |

### Open Source Projects (5)

| API | What it gives | Module idea |
|---|---|---|
| [Evil Insult Generator](https://evilinsult.com/api) | Evil Insults |  |
| [GitHub Contribution Chart Generator](https://github-contributions.vercel.app) | Create an image of your GitHub contributions |  |
| [GitHub ReadMe Stats](https://github.com/anuraghazra/github-readme-stats) | Add dynamically generated statistics to your GitHub profile ReadMe |  |
| [Metabase](https://www.metabase.com/) | An open source Business Intelligence server to share data and analytics inside your company |  |
| [Neuronto ARD Registry](https://neuronto.com/api-docs) | Search index of MCP servers, agents and APIs, with the tools each server actually exposes |  |

### Personality (8)

| API | What it gives | Module idea |
|---|---|---|
| [Astro Agents](https://astro-agent.dev/llms.txt) | Deterministic Western and Vedic astrology: natal charts, transits, kundli, dashas, panchang |  |
| [Inspiration](https://inspiration.goprogram.ai/docs/) | Motivational and Inspirational quotes | quote of the day |
| [kanye.rest](https://kanye.rest) | REST API for random Kanye West quotes | quote of the day (joke) |
| [kimiquotes](https://kimiquotes.herokuapp.com/doc) | Team radio and interview quotes by Finnish F1 legend Kimi Räikkönen |  |
| [Personality.fyi](https://personality.fyi/api) | Free MBTI personality types and OEJTS test scoring |  |
| [PositiveQuotation](https://positivequotation.com/developers/public-domain-quotes-api) | Source-verified public-domain English proverbs with provenance | quote of the day |
| [quoteclear](https://quoteclear.web.app/) | Ever-growing list of James Clear quotes from the 3-2-1 Newsletter |  |
| [Zen Quotes](https://zenquotes.io/) | Large collection of Zen quotes for inspiration | quote of the day |

### Phone (1)

| API | What it gives | Module idea |
|---|---|---|
| [Phone Specification](https://github.com/azharimm/phone-specs-api) | Rest Api for Phone specifications |  |

### Science & Math (22)

| API | What it gives | Module idea |
|---|---|---|
| [Botlero](https://botlero.com/api/robots) | Sourced, quoted specs for humanoid robots |  |
| [Chempirical](https://chempirical.com/api/) | Chemical compounds with physical data, reactions and substructure search |  |
| [CycleCalcs](https://www.cyclecalcs.com/api.html) | Interpreted astronomy: sun and moon times, moon phases, planets, eclipses, seasons |  |
| [DataCite](https://support.datacite.org/docs/rest-api) | Search and retrieve DOI metadata for research datasets and publications | reading list: datasets |
| [ENA](https://www.ebi.ac.uk/ena/browser/api/swagger-ui/index.html) | Nucleotide sequences, genomes and raw reads archive |  |
| [Europe PMC](https://europepmc.org/RestfulWebService) | Life-science literature search with abstracts, citations and full-text links | reading list: papers |
| [GBIF](https://www.gbif.org/developer/summary) | Global Biodiversity Information Facility | field guide: species records |
| [iNaturalist](https://api.inaturalist.org/v1/docs/) | Citizen-science wildlife observations with species identification and mapping | field guide: observations |
| [Launch Library 2](https://thespacedevs.com/llapi) | Spaceflight launches and events database | launch countdown |
| [Macrostrat](https://macrostrat.org/api) | Geologic maps, rock columns and stratigraphy data | rocks & maps |
| [MathJS](https://api.mathjs.org/) | Evaluate math expressions via GET or POST as JSON | calculator module |
| [MyGene.info](https://docs.mygene.info/) | Gene annotation queries and ID lookup |  |
| [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) | Biomedical literature, sequences and gene databases | reading list: biomedical papers |
| [OBIS](https://manual.obis.org/access) | Global marine species occurrence and distribution data | field guide: marine species |
| [Oliver's mTOR Atlas](https://mtor-atlas.org/api/) | Curated mTOR research: studies by evidence type, pathway claims, open questions |  |
| [OpenAlex](https://docs.openalex.org/) | Open catalog of scholarly works, authors, institutions, sources, and concepts | reading list: papers |
| [RCSB PDB](https://data.rcsb.org/) | 3D structures of proteins and nucleic acids | protein viewer |
| [Remote Calc](https://github.com/elizabethadegbaju/remotecalc) | Decodes base64 encoding and parses it to return a solution to the calculation in JSON |  |
| [Solar System OpenData](https://api.le-systeme-solaire.net) | Data and facts on solar system bodies and planets | sky / planets module |
| [Tallytopia](https://tallytopia.com/api-docs) | Calculators for finance, health, math, space and sports with step-by-step results |  |
| [Unpaywall](https://unpaywall.org/products/api) | Open-access status and legal full-text links for scholarly articles | reading list: open-access PDFs |
| [xMath](https://x-math.herokuapp.com/) | Random mathematical expressions |  |

### Security (11)

| API | What it gives | Module idea |
|---|---|---|
| [Classify](https://classify-web.herokuapp.com/#/api) | Encrypting & decrypting text messages |  |
| [CSR.plus](https://csr.plus/docs/api) | Generate certificate signing requests and private keys without OpenSSL |  |
| [dead-drop](https://api.dead-drop.xyz/api/v1/docs) | Ephemeral zero-knowledge encrypted data sharing |  |
| [Hashable](https://hashable.space/pages/api/) | A REST API to access high level cryptographic functions and methods |  |
| [IPGuardian](https://ipguardian.net/docs) | Check IP addresses against 140+ public threat intelligence blocklists |  |
| [IPLogs](https://iplogs.com/docs) | Free VPN, proxy, Tor and datacenter IP detection. 13 sources, active probing |  |
| [OSV](https://google.github.io/osv.dev/api/) | Open source vulnerability database and distributed triage infrastructure |  |
| [Passwordinator](https://github.com/fawazsullia/password-generator/) | Generate random passwords of varying complexities |  |
| [Presend](https://presend.pages.dev/api) | Security and developer utility API -- malware, vulnerability, and domain checks, no signup |  |
| [Virushee](https://api.virushee.com/) | Virushee file/data scanning |  |
| [VPNDetection](https://docs.vpndetection.io/api) | Check whether an IPv4 or IPv6 address belongs to VPN infrastructure, no key needed |  |

### Shopping (6)

| API | What it gives | Module idea |
|---|---|---|
| [ARC](https://www.arcreport.ai/developers) | Open data on whether AI shopping agents can reach checkout at specific online stores |  |
| [BirkinBagStock](https://birkinbagstock.com/.well-known/openapi.json) | Independent Hermès resale index: inventory, market prices, auction calendar and results |  |
| [Marketplace Fee Data](https://www.sellerscalc.com/data) | Seller fee schedules for 21 e-commerce marketplaces and payment processors as JSON |  |
| [Nuvinty](https://nuvinty.com/api-docs) | UK luxury list prices, price history, increases and partner pre-owned asking prices |  |
| [OneFindMe](https://onefindme.com/mcp) | Search AliExpress in any language: price, rating and orders for the delivery country |  |
| [Profitvana](https://www.profitvana.com/developers) | Seller fees for 31 marketplaces and payment processors, verified monthly |  |

### Social (5)

| API | What it gives | Module idea |
|---|---|---|
| [4chan](https://github.com/4chan/4chan-API) | Simple image-based bulletin board dedicated to a variety of topics |  |
| [Bluesky](https://docs.bsky.app/) | Decentralized social networking via the AT protocol | feed reader |
| [Doge-Meme](https://api.doge-meme.lol/docs) | Top meme posts from r/dogecoin which include 'Meme' flair |  |
| [Lanyard](https://github.com/Phineas/lanyard) | Retrieve your presence on Discord through an HTTP REST API or WebSocket |  |
| [SwarmMemo](https://swarmmemo.com/protocol.md) | Public bulletin board where AI agents and humans read, post and reply, no account or key needed |  |

### Sports & Fitness (18)

| API | What it gives | Module idea |
|---|---|---|
| [Ball Ranks](https://ballranks.com/developers) | NFL and NBA fantasy rankings and player projections |  |
| [balldontlie](https://www.balldontlie.io) | Balldontlie provides access to stats data from the NBA | NBA scoreboard |
| [Bet Better](https://betbetter.world/api/) | Sports model win probabilities and fair odds across 13 leagues |  |
| [DiscGolf](https://discgolfapi.com/docs/) | Structured disc golf course data |  |
| [FanLine Wire](https://fanlinewire.com/docs) | Real-time FanDuel Sportsbook odds — live & in-play and pre-match, with a keyless public snapshot |  |
| [Football (Soccer) Videos](https://www.scorebat.com/video-api/) | Embed codes for goals and highlights from Premier League, Bundesliga, Serie A and many more |  |
| [Football Standings](https://github.com/azharimm/football-standings-api) | Display football standings e.g epl, la liga, serie a etc. The data is based on espn site | football table |
| [MoviOdds](https://moviodds.com/doc) | Real-time bet365 soccer odds, every market, pre-match and in-play, over REST and WebSocket |  |
| [NoPunt](https://www.nopunt.com/api/picks.json) | Weekly NFL game picks with model win probability, confidence tier and spread |  |
| [OddsBench](https://oddsbench.xyz/api/) | Independent monthly latency benchmark of sports odds APIs, with free JSON and CSV data |  |
| [Oddsmagnet](https://data.oddsmagnet.com) | Odds history from multiple UK bookmakers |  |
| [OpenF1](https://openf1.org/) | Real-time and historical Formula 1 data including laps, car telemetry and positions | F1 scoreboard |
| [OpenLigaDB](https://www.openligadb.de) | Crowd sourced sports league results | football scoreboard |
| [Padel Snipe](https://padelsnipe.com/fr/world/api) | 4,000+ mapped padel clubs across 9 European countries with GPS and courts |  |
| [Sport List & Data](https://developers.decathlon.com/products/sports) | List of and resources related to sports |  |
| [SportScore](https://sportscore.com/developers/) | Live scores, fixtures, standings and stats for football, basketball, cricket and tennis | sports scoreboard |
| [Squiggle](https://api.squiggle.com.au) | Fixtures, results and predictions for Australian Football League matches | AFL fixtures |
| [WhensTheRace](https://whenstherace.com/f1-schedule-json/) | F1 season schedule with UTC session start times as JSON, RSS and iCal | race calendar |

### Test Data (12)

| API | What it gives | Module idea |
|---|---|---|
| [AddressMock](https://addressmock.com/api) | Random US, Hong Kong and Cape Verde addresses with matched city, state and ZIP |  |
| [DummyJSON](https://dummyjson.com/) | Fake REST API with products, users, posts, comments, todos and more | dev only |
| [FakerAPI](https://fakerapi.it/en) | APIs collection to get fake data | dev only |
| [flaky](https://flakyapi.dev) | Fake REST API with chaos controls: force any status code, add latency, or a failure rate |  |
| [loremfile](https://loremfile.dev/docs/manifest) | Hotlinkable CC0 sample files in 78 formats, each with a SHA-256 in a JSON manifest |  |
| [NovaFortix Dev](https://public-dev-apis.surge.sh) | Zero-auth REST endpoints for mock user profiles, UUIDs and HTTP status codes |  |
| [QuickMocker](https://quickmocker.com) | API mocking tool to generate contextual, fake or random data |  |
| [Sampuli](https://sampuli.site/api) | Format-true synthetic test data for 90 countries: IDs, IBANs, cards, addresses |  |
| [Supercrontab Mock Endpoints](https://supercrontab.com/mock) | Mock endpoints in 8 formats, each returning any of 14 HTTP status codes |  |
| [TestingAPIs](https://testingapis.com/docs/) | Free fake REST API with products, posts, todos, any HTTP status code and request echo |  |
| [TotalShiftLeft Sandbox](https://demo.totalshiftleft.ai/) | Free multi-protocol sandbox: REST, GraphQL & SOAP with OAuth2/JWT auth and OpenAPI 3.0 spec |  |
| [Waldrand Avatar](https://avatar.waldrand.dev) | Deterministic SVG/PNG/WebP avatars from any string, four styles |  |

### Transportation (14)

| API | What it gives | Module idea |
|---|---|---|
| [AirportMiles](https://airportmiles.com/api) | Airport codes, distances, routes and passenger numbers as static JSON files |  |
| [Apimetro](https://apimetro.dev/swagger/index.html) | Geospatial data for Mexico City public transport system (Metro, Metrobús, Cablebús, RTP, etc.) |  |
| [ArcNautical](https://arcnautical.com/developers/) | Screen any ship by IMO for OFAC/EU/UN/UK sanctions, ownership opacity and a vetting grade |  |
| [Aviation Safety Data](https://himaxym.com/developers) | 164,068 aircraft accident narratives from 128 official investigation authorities, plus FAA data |  |
| [BC Ferries](https://www.bcferriesapi.ca) | Sailing times and capacities for BC Ferries | ferry times |
| [Can I enter](https://canienter.com) | Visa and entry requirements for 199 passports, cited to official sources, verified daily |  |
| [ChargeAlong](https://chargealong.io/docs/) | EV charging sites in AU, NZ, US, UK and Canada, with nearby search and trip planning |  |
| [ConnectMeGuru](https://www.connectmeguru.com/api/mcp) | Search and purchase prepaid travel eSIM data plans across 190+ countries |  |
| [GTFS Scorecard](https://github.com/ChelseaKR/gtfs-scorecard/blob/main/docs/api.md) | Data-quality grades and prioritized fixes for 2,400+ public transit GTFS feed records |  |
| [India EV Charging Stations](https://ev-charging-stations-api.vercel.app/docs) | Directory of public EV charging stations across India with connector and power specs |  |
| [OpenVan](https://openvan.camp/docs) | Fuel prices for 121 countries, food cost index & vanlife weather scores for RV travel |  |
| [Railworks](https://railworks.paddez.com/docs) | Irish Rail planned engineering works: affected stations, DART closures, change log and ICS feeds |  |
| [Transport for Belgium](https://docs.irail.be/) | The iRail API is a third-party API for Belgian public transport by train | transit times (BE) |
| [transport.rest](https://transport.rest) | Community maintained, developer-friendly public transport API | transit times (DE) |

### URL Shorteners (4)

| API | What it gives | Module idea |
|---|---|---|
| [1pt](https://github.com/1pt-co/api/blob/main/README.md) | A simple URL shortener |  |
| [CleanURI](https://cleanuri.com/docs) | URL shortener service |  |
| [GoTiny](https://github.com/robvanbakel/gotiny-api) | A lightweight URL shortener, focused on ease-of-use for the developer and end-user |  |
| [Shrtcode](https://shrtco.de/docs) | URl Shortener with multiple Domains |  |

### Vehicle (3)

| API | What it gives | Module idea |
|---|---|---|
| [Bike Reliability](https://bikereliability.co.uk/developers) | UK motorcycle reliability ranked by first-time MOT pass rates |  |
| [ProblemsByVin](https://problemsbyvin.com/data/) | Owner complaints, recalls and failure-mileage statistics by vehicle make, model and year |  |
| [TransparentCars](https://transparent.pt/en/api) | Fair-price valuation and yearly road tax (IUC) for used cars in Portugal |  |

### Video (12)

| API | What it gives | Module idea |
|---|---|---|
| [Bob's Burgers](https://bobs-burgers-api-ui.herokuapp.com) | Bob's Burgers API | fandom trivia |
| [Dune](https://github.com/ywalia01/dune-api) | A simple API which provides you with book, character, movie and quotes JSON data | fandom trivia |
| [Final Space](https://finalspaceapi.com/docs/) | Final Space API | fandom trivia |
| [IMDbOT](https://github.com/SpEcHiDe/IMDbOT) | Unofficial IMDb Movie / Series Information |  |
| [MCU Countdown](https://github.com/DiljotSG/MCU-Countdown) | A Countdown to the next MCU Film | countdown to the next Marvel release |
| [Movie Quote](https://github.com/F4R4N/movie-quote/) | Random Movie and Series Quotes | quote of the day |
| [Owen Wilson Wow](https://owen-wilson-wow-api.herokuapp.com) | API for actor Owen Wilson's "wow" exclamations in movies |  |
| [SWAPI](https://swapi.dev/) | All the Star Wars data you've ever wanted | fandom trivia |
| [SWAPI](https://www.swapi.tech) | All things Star Wars | fandom trivia |
| [UGCdrop](https://ugcdrop.com/api) | Search real UGC video clips (reactions, hooks, b-roll) by emotion, niche, age and setting |  |
| [Video to Markdown](https://video-to-markdown.com/api) | Turn a YouTube URL into a markdown thumbnail image link |  |
| [Web Series Quotes Generator](https://github.com/yogeshwaran01/web-series-quotes) | API generates various Web Series Quote Images |  |

### Weather (13)

| API | What it gives | Module idea |
|---|---|---|
| [FMI Open Data](https://en.ilmatieteenlaitos.fi/open-data) | Finnish weather, sea, climate and radar observations via open WFS | weather (Finland) |
| [Hail History](https://hail-history-noaa.netlify.app/api-docs.html) | Radar-detected hail history for any US address from NOAA NEXRAD Level-III hail detections, by year |  |
| [NASA POWER](https://power.larc.nasa.gov/docs/) | Global solar and weather data for energy and agriculture | sun / climate tracker |
| [Open-Meteo](https://open-meteo.com/) | Global weather forecast API for non-commercial use | weather glance |
| [Open-Meteo Ensemble](https://open-meteo.com/en/docs/ensemble-api) | Weather ensemble forecasts from multiple models | weather glance |
| [openSenseMap](https://api.opensensemap.org/) | Data from Personal Weather Stations called senseBoxes | sensor map |
| [Pirate Weather](https://pirateweather.readthedocs.io/en/latest/) | Free weather API with forecast data similar to Dark Sky | weather glance |
| [Terrace Weather](https://terrace.javiermateo.dev/swagger-ui.html) | Terrace open/closed verdict for restaurants, from the weather forecast |  |
| [US Weather](https://www.weather.gov/documentation/services-web-api) | US National Weather Service |  |
| [Veabird](https://veabird.com/api/v1) | Beach (sargassum, waves, hurricanes) and ski snow forecasts for 1,900+ resorts, no key |  |
| [WeatherTotals](https://weathertotals.com/api) | Measured US snow, rain, hail and aurora totals by state and city |  |
| [World Time & Weather](https://worldtimeweather.com/api.html) | Current weather, local time, UTC offset and DST rules for 400 cities as static JSON | world clocks + weather |
| [wttr.in](https://wttr.in/:help) | Weather in your terminal, supports JSON output | weather one-liner |

## 3. Also good, outside that list

Spot-checked on 2026-10-26 with `curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" <url>`. A tick means the response carried `Access-Control-Allow-Origin` (a `*` or an echo of the origin). Quota notes are from memory.

| API | CORS | What it gives | Module idea |
|---|---|---|---|
| [Open-Meteo forecast](https://open-meteo.com/en/docs) | ✓ | Hourly and daily forecast; no key, non-commercial | Weather glance |
| [Open-Meteo air quality](https://open-meteo.com/en/docs/air-quality-api) | ✓ | PM, pollen, UV | Garden / outdoor glance |
| [Open-Meteo marine](https://open-meteo.com/en/docs/marine-weather-api) | ✓ | Wave height, swell | Surf / sail glance |
| [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) | ✓ | City name to lat/lon | Place picker for weather |
| [Datamuse](https://www.datamuse.com/api/) | ✓ (echoes the origin) | Rhymes, synonyms, "sounds like", words by meaning | Songwriting / rhyme helper |
| [dictionaryapi.dev](https://dictionaryapi.dev/) | ✓ | English definitions, phonetics, audio | Dictionary lookup |
| [Wiktionary REST](https://en.wiktionary.org/api/rest_v1/) | ✓ (one 429 on a burst, then 200) | Definitions in many languages | Language notebook |
| [MyMemory translate](https://mymemory.translated.net/doc/spec.php) | ✓ | Free translation, about 5,000 chars/day anonymous | Phrasebook |
| [kanjiapi.dev](https://kanjiapi.dev/) | ✓ | Kanji readings, meanings, stroke counts | Flashcards: kanji deck |
| [PoetryDB](https://poetrydb.org/) | ✓ | Public-domain poems by author or title | Poem of the day |
| [LRCLIB](https://lrclib.net/docs) | ✓ | Synced and plain lyrics by title / artist | Lyrics under Tuner or Tape |
| [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) | ✓ | Artists, releases, recordings, IDs; 1 req/s | Record crate metadata |
| [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive/API) | ✓ (redirects to archive.org, still CORS) | Album cover images by MusicBrainz ID | Record crate covers |
| [TVMaze](https://www.tvmaze.com/api) | ✓ | Shows, episodes, schedules, cast | TV guide with no key |
| [Gutendex](https://gutendex.com/) | ✓ (slow to answer once) | Project Gutenberg catalog and text links | Reading shelf: free classics |
| [Open Library](https://openlibrary.org/developers/api) | ✓ | Books, ISBNs, covers, editions | Bookshelf |
| [Open Trivia DB](https://opentdb.com/api_config.php) | ✓ | Multiple-choice trivia | Quiz module |
| [Lichess](https://lichess.org/api) | ✓ (echoes the origin) | Games, puzzles, user stats | Chess board / daily puzzle |
| [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/) | ✓ | Page summaries, thumbnails | Link cards, glossary |
| [Wikimedia featured feed](https://en.wikipedia.org/api/rest_v1/#/Feed) | ✓ | Today's featured article, picture, on this day, most read | Home glance: on this day |
| [Wikipedia action API](https://www.mediawiki.org/wiki/API:Main_page) | ✓ only with `&origin=*` | Search, extracts, images, geosearch | Search box, nearby places |
| [Met Museum](https://metmuseum.github.io/) | ✓ | 470k objects, many public-domain images | Museum postcards |
| [Art Institute of Chicago](https://api.artic.edu/docs/) | ✓ | Artworks with IIIF images | Museum postcards |
| [Cleveland Museum of Art](https://openaccess-api.clevelandart.org/) | ✗ no CORS header | Open-access artworks | Needs a proxy; use Met / AIC instead |
| [Rijksmuseum data service](https://data.rijksmuseum.nl/) | ✓ | New keyless linked-data search (the old key API is gone) | Museum postcards |
| [Smithsonian Open Access](https://api.si.edu/openaccess/api/v1.0/search) | ✓ with `DEMO_KEY` | Millions of CC0 objects | Museum postcards |
| [iNaturalist](https://api.inaturalist.org/v1/docs/) | ✓ | Taxa, observations, photos | Field guide |
| [GBIF](https://techdocs.gbif.org/en/openapi/) | ✓ | Species and occurrence records | Field guide |
| [NOAA tides & currents](https://api.tidesandcurrents.noaa.gov/api/prod/) | ✓ | Tide predictions and water levels (US stations) | Tide glance |
| [USGS earthquakes](https://earthquake.usgs.gov/fdsnws/event/1/) | ✓ | Live GeoJSON quake feeds | Planet glance |
| [wheretheiss.at](https://wheretheiss.at/w/developer) | ✓ | ISS position now | Sky glance |
| [Launch Library 2](https://ll.thespacedevs.com/docs/) | ✓ | Upcoming launches; the free tier is limited to about 15 req/hr | Launch countdown |
| [Spaceflight News](https://api.spaceflightnewsapi.net/v4/docs/) | ✓ | Space news articles | Space news glance |
| [Nager.Date](https://date.nager.at/Api) | ✓ | Public holidays for about 100 countries | Calendar |
| [Frankfurter](https://frankfurter.dev/) | ✓ at `api.frankfurter.dev/v1/` (the old `.app` host 301s there) | ECB exchange rates, history | Travel money |
| [REST Countries](https://restcountries.com/) | ⚠ v3.1 URLs now 301 to a static `legacy.json`; CORS is `*` on it but query filters may be ignored | Country facts, flags | Country card (consider bundling the JSON) |
| [Nominatim](https://nominatim.org/release-docs/latest/api/Overview/) | ✓ | Geocoding; 1 req/s, no autocomplete | Place search |
| [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | ✓ header seen (the public server returned 502 while busy) | Query OpenStreetMap features | Nearby cafes / parks |
| [CityBikes](https://api.citybik.es/v2/) | ✓ | Bike-share stations worldwide | Bike glance |
| [Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) | ✓ | Barcode lookup, ingredients, Nutri-Score | Pantry scanner |
| [TheMealDB](https://www.themealdb.com/api.php) | ✓ | Recipes; test key `1` | Recipe box |
| [TheCocktailDB](https://www.thecocktaildb.com/api.php) | ✓ | Cocktails; test key `1` | Drinks shelf |
| [wger](https://wger.de/en/software/api) | ✓ | Exercises, muscles, images | Workout log |
| [Crossref](https://api.crossref.org/swagger-ui/index.html) | ✓ | Paper metadata by DOI or search | Reading list |
| [OpenAlex](https://docs.openalex.org/) | ✓ | Papers, authors, citations (a better browser fit than arXiv) | Reading list |
| [Semantic Scholar](https://api.semanticscholar.org/api-docs/) | ✓ on preflight, but the shared anonymous pool returned 429 every time | Papers, citations | Needs a free key in practice |
| [arXiv](https://info.arxiv.org/help/api/index.html) | ✗ no CORS header | Preprint search (Atom XML) | Use OpenAlex or Crossref instead |
| [Hacker News](https://github.com/HackerNews/API) | ✓ (echoes the origin) | Top stories, items (Firebase) | Feed glance |
| [radio-browser](https://api.radio-browser.info/) | ✓ | 30k+ internet radio stations | Radio dial; use a mirror such as `de1.api.radio-browser.info` |

Two moved (Frankfurter, REST Countries) and two really have no CORS (Cleveland, arXiv).

## 4. Needs a key or a server

Everything else in the list: the auth is apiKey / OAuth / a header token, or CORS is No / Unknown, or there is no HTTPS. 1666 entries. Format: name - what it is - auth, CORS. Auth: `k` apiKey, `o` OAuth, `h` header token, `-` none. CORS: Y / N / ? (unknown). The `k, Y` lines are the ones to look at first, since they work from the browser once you have a key.

### Animals (12)

- [Axolotl](https://theaxolotlapi.netlify.app/) - Collection of axolotl pictures and facts - -, N
- [Breed Health Score](https://breedhealthscore.com/developers/) - Dog breed health scores, median lifespans and conditions - -, N
- [Cat Facts](https://alexwohlbruck.github.io/cat-facts/) - Daily cat facts - -, N
- [Cats](https://docs.thecatapi.com/) - Pictures of cats from Tumblr - k, N
- [eBird](https://documenter.getpostman.com/view/664302/S1ENwy59) - Retrieve recent or notable birding observations within a region - k, N
- [IUCN](https://www.iucnredlist.org/en) - IUCN Red List of Threatened Species - k, N
- [MeowFacts](https://github.com/wh-iterabb-it/meowfacts) - Get random cat facts - -, N
- [RandomDuck](https://random-d.uk/api) - Random pictures of ducks - -, N
- [RandomFox](https://randomfox.ca/floof/) - Random pictures of foxes - -, N
- [RescueGroups](https://userguide.rescuegroups.org/display/APIDG/API+Developers+Guide+Home) - Adoption - -, ?
- [The Dog](https://thedogapi.com/) - A public service all about Dogs, free to use when making your fancy... - k, N
- [xeno-canto](https://xeno-canto.org/explore/api) - Bird recordings - -, ?

### Anime (12)

- [AniAPI](https://aniapi.com/docs/) - Anime discovery, streaming & syncing with trackers - o, Y
- [AniDB](https://wiki.anidb.net/HTTP_API_Definition) - Anime Database - k, ?, no HTTPS
- [AniList](https://github.com/AniList/ApiV2-GraphQL-Docs) - Anime discovery & tracking - o, ?
- [AnimeChan](https://github.com/RocktimSaikia/anime-chan) - Anime quotes (over 10k+) - -, N
- [Danbooru Anime](https://danbooru.donmai.us/wiki_pages/help:api) - Thousands of anime artist database to find good anime art - k, Y
- [Kitsu](https://kitsu.docs.apiary.io/) - Anime discovery platform - o, Y
- [MangaDex](https://api.mangadex.org/docs/) - Manga Database and Community - k, ?
- [Mangapi](https://rapidapi.com/pierre.carcellermeunier/api/mangapi3/) - Translate manga pages from one language to another - k, ?
- [MangaUpdates](https://api.mangaupdates.com/) - Manga database: series, releases, groups and reading lists - -, ?
- [MyAnimeList](https://myanimelist.net/clubs.php?cid=13727) - Anime and Manga Database and Community - o, ?
- [Shikimori](https://shikimori.one/api/doc) - Anime discovery, tracking, forum, rates - o, ?
- [Waifu.pics](https://waifu.pics/docs) - Image sharing platform for anime images - -, N

### Anti-Malware (15)

- [AbuseIPDB](https://docs.abuseipdb.com/) - IP/domain/URL reputation - k, ?
- [AlienVault Open Threat Exchange (OTX)](https://otx.alienvault.com/api) - IP/domain/URL reputation - k, ?
- [CAPEsandbox](https://capev2.readthedocs.io/en/latest/usage/api.html) - Malware execution and analysis - k, ?
- [Google Safe Browsing](https://developers.google.com/safe-browsing/) - Google Link/Domain Flagging - k, ?
- [IPWhois.net Blacklist](https://ipwhois.net/blacklist/docs) - Community IP blacklist to check and report abusive IP addresses - -, ?
- [MalDatabase](https://maldatabase.com/api-doc.html) - Provide malware datasets and threat intelligence feeds - k, ?
- [MalShare](https://malshare.com/doc.php) - Malware Archive / file sourcing - k, N
- [Malwagon](https://malwagon.com/docs/api) - Detonates files and URLs in instrumented VMs and returns behaviour,... - k, ?
- [MalwareBazaar](https://bazaar.abuse.ch/api/) - Collect and share malware samples - k, ?
- [NoPhishy](https://rapidapi.com/Amiichu/api/exerra-phishing-check/) - Check links to see if they're known phishing attempts - k, Y
- [Phisherman](https://phisherman.gg/) - IP/domain/URL reputation - k, ?
- [Scanii](https://docs.scanii.com/) - Simple REST API that can scan submitted documents/files for the pre... - k, Y
- [URLScan.io](https://urlscan.io/about-api/) - Scan and Analyse URLs - k, ?
- [VirusTotal](https://docs.virustotal.com/reference/overview) - VirusTotal File/URL Analysis - k, ?
- [Web of Trust](https://support.mywot.com/hc/en-us/sections/360004477734-API-) - IP/domain/URL reputation - k, ?

### Art & Design (19)

- [Améthyste](https://api.amethyste.moe/) - Generate images for Discord users - k, ?
- [Colormind](http://colormind.io/api-access/) - Color scheme generator - -, ?, no HTTPS
- [ColourLovers](http://www.colourlovers.com/api) - Get various patterns, palettes and images - -, ?, no HTTPS
- [Cooper Hewitt](https://collection.cooperhewitt.org/api) - Smithsonian Design Museum - k, ?
- [Dribbble](https://developer.dribbble.com) - Discover the world’s top designers & creatives - o, ?
- [DummyImage](https://dummyimage.com/) - Generate placeholder images with custom size, colors and text - -, ?
- [Europeana](https://pro.europeana.eu/resources/apis/search) - European Museum and Galleries content - k, ?
- [Harvard Art Museums](https://github.com/harvardartmuseums/api-docs) - Art - k, ?, no HTTPS
- [Iconfinder](https://developer.iconfinder.com) - Icons - k, ?
- [Icons8](https://img.icons8.com/) - Icons (find "search icon" hyperlink in page) - -, ?
- [Metropolitan Museum of Art](https://metmuseum.github.io/) - Met Museum of Art - -, N
- [Noun Project](http://api.thenounproject.com/index.html) - Icons - o, ?, no HTTPS
- [Pixel Encounter](https://pixelencounter.com/api) - SVG Icon Generator - -, N
- [Rijksmuseum](https://data.rijksmuseum.nl/) - RijksMuseum Data - k, ?
- [Smithsonian Open Access](https://github.com/Smithsonian/smithsonian-openaccess) - Smithsonian collection metadata and open-access digital media - k, ?
- [Text-till-Kladdesign](https://text-till-klad-design.gracestack.se/api/v1/openapi.json) - AI fashion design generator — transform Swedish text into clothing... - k, Y
- [Thisispaper](https://www.thisispaper.com/intelligence/api-docs) - Curated architecture, design, photography and art projects with vis... - k, Y
- [UpRes](https://upres.ai/docs/api) - AI image upscaling to 8K with 18 models (Real-ESRGAN, SeedVR2, AuraSR) - k, Y
- [Word Cloud](https://wordcloudapi.com/) - Easily create word clouds - k, ?

### Authentication & Authorization (7)

- [Auth0](https://auth0.com) - Easy to implement, adaptable authentication and authorization platform - k, Y
- [GetOTP](https://otp.dev/en/docs/) - Implement OTP flow quickly - k, N
- [Micro User Service](https://m3o.com/user) - User management and authentication - k, N
- [MojoAuth](https://mojoauth.com) - Secure and modern passwordless authentication platform - k, Y
- [SAWO Labs](https://sawolabs.com) - Simplify login and improve user experience by integrating passwordl... - k, Y
- [Stytch](https://stytch.com/) - User infrastructure for modern applications - k, N
- [Warrant](https://warrant.dev/) - APIs for authorization and access control - k, Y

### Blockchain (14)

- [Bitquery](https://graphql.bitquery.io/ide) - Onchain GraphQL APIs & DEX APIs - k, Y
- [Blockscout](https://dev.blockscout.com/) - Multichain block explorer REST API (with Etherscan-compatible JSON-... - k, N
- [Chainlink](https://chain.link/developer-resources) - Build hybrid smart contracts with Chainlink - -, ?
- [Chainpoint](https://tierion.com/chainpoint/) - Chainpoint is a global network for anchoring data to the Bitcoin bl... - -, ?
- [Covalent](https://www.covalenthq.com/docs/) - Multi-blockchain data aggregator platform - k, ?
- [Dwellir](https://www.dwellir.com/docs) - RPC endpoints for 150+ blockchain networks, including Ethereum, Sol... - k, Y
- [Etherscan](https://etherscan.io/apis) - Ethereum explorer API - k, Y
- [Helium](https://docs.helium.com/api/blockchain/introduction/) - Helium is a global, distributed network of Hotspots that create pub... - -, ?
- [Nownodes](https://nownodes.io/) - Blockchain-as-a-service solution that provides high-quality connect... - k, ?
- [Steem](https://developers.steem.io/) - Blockchain-based blogging and social media website - -, N, no HTTPS
- [SwiftNodes](https://swiftnodes.io) - Multi-chain blockchain RPC nodes (Ethereum, Solana and 75+ networks) - k, Y
- [The Graph](https://thegraph.com) - Indexing protocol for querying networks like Ethereum with GraphQL - k, ?
- [Walltime](https://walltime.info/api.html) - To retrieve Walltime's market info - -, ?
- [Watchdata](https://docs.watchdata.io) - Provide simple and reliable API access to Ethereum blockchain - k, ?

### Books (12)

- [A Bíblia Digital](https://www.abibliadigital.com.br/en) - Do not worry about managing the multiple versions of the Bible - k, N
- [Amanah Sunnah](https://sunnah.amanahagent.cloud/developers) - Semantic search across Quran, Hadith, Tafsir & 18K+ Rijal narrators - k, Y
- [Bhagavad Gita](https://docs.bhagavadgitaapi.in) - Open Source Shrimad Bhagavad Gita API including 21+ authors transla... - k, Y
- [British National Bibliography](http://bnb.data.bl.uk/) - Books - -, ?, no HTTPS
- [Crossref Metadata Search](https://github.com/CrossRef/rest-api-doc) - Books & Articles Metadata - -, ?
- [Ganjoor](https://api.ganjoor.net) - Classic Persian poetry works including access to related manuscript... - o, Y
- [Google Books](https://developers.google.com/books/) - Books - o, ?
- [GurbaniNow](https://github.com/GurbaniNow/api) - Fast and Accurate Gurbani RESTful API - -, ?
- [Gutendex](https://gutendex.com/) - Web-API for fetching data from Project Gutenberg Books Library - -, ?
- [Open Library](https://openlibrary.org/developers/api) - Books, book covers and related data - -, N
- [The Bible](https://docs.api.bible) - Everything you need from the Bible in one discoverable place - k, ?
- [Wolne Lektury](https://wolnelektury.pl/api/) - API for obtaining information about e-books available on the WolneL... - -, ?

### Business (41)

- [Apache Superset](https://superset.apache.org/docs/api) - API to manage your BI dashboards and data sources on Superset - k, Y
- [Charity Search](http://charityapi.orghunter.com/) - Non-profit charity data - k, ?, no HTTPS
- [Clearbit Logo](https://clearbit.com/docs#logo-api) - Search for company logos and embed them in your projects - k, ?
- [Compabase](https://compabase.com/docs/) - Polish company data: 3M+ KRS and CEIDG entities with financial stat... - k, ?
- [Crustdata](https://docs.crustdata.com) - People and company data covering profiles, headcount, funding and c... - k, ?
- [Domainsdb.info](https://domainsdb.info/) - Registered Domain Names Search - -, N
- [EuroValidate](https://eurovalidate.com) - EU VAT (VIES), IBAN and EORI validation with company name & address... - k, Y
- [Freelancer](https://developers.freelancer.com) - Hire freelancers to get work done - o, ?
- [Funding Signals](https://fundingsignals.net/docs) - Companies that just raised funding, scored as sales leads, from pub... - k, N
- [GlobalEntity](https://www.globalentityapi.com/docs) - Official company data from 56 European business registers as normal... - k, Y
- [Gmail](https://developers.google.com/gmail/api/) - Flexible, RESTful access to the user's inbox - o, ?
- [Google Analytics](https://developers.google.com/analytics/) - Collect, configure and analyze your data to reach the right audience - o, ?
- [gstinapi](https://www.gstinapi.in/docs) - Verify Indian GST numbers (GSTIN): legal name, status, address and... - k, N
- [Instatus](https://instatus.com/help/api) - Post to and update maintenance and incidents on your status page th... - k, ?
- [InvoiceIn](https://invoicein.peculiar.systems/) - Parse and validate received e-invoices: XRechnung, ZUGFeRD, Peppol,... - k, Y
- [Invovate](https://invovate.com/api) - Generate PDF, JSON & UBL invoices in 11 languages from one JSON POST - k, N
- [Katalis](https://meetkatalis.com/apis) - UK company checks: payment practices, contracts won, registers, fil... - k, N
- [Leadgen Romania](https://leadgen.adrianhomelab.com/docs) - Romanian company registry, ANAF tax status and financial statements - k, Y
- [Mailchimp](https://mailchimp.com/developer/) - Send marketing campaigns and transactional mails - k, ?
- [mailjet](https://www.mailjet.com/) - Marketing email can be sent and mail templates made in MJML or HTML... - k, ?
- [markerapi](https://markerapi.com) - Trademark Search - -, ?, no HTTPS
- [Meirra](https://meirra.com/api) - SEO monitoring, email verification, lead generation, and marketing... - k, Y
- [ORB Intelligence](https://api.orb-intelligence.com/docs/) - Company lookup - k, ?
- [PeopleSearch](https://peoplesearch.im/developers) - People and company search in plain English, with verified work emai... - k, N
- [RankFabrik Places](https://rankfabrik.com/produits/etablissements) - Search businesses and points of interest by city, deduplicated with... - k, ?
- [Redash](https://redash.io/help/user-guide/integrations-and-api/api) - Access your queries and dashboards on Redash - k, Y
- [RegisterWire](https://www.registerwire.uk/docs/index.html) - Real-time alerts on UK company register changes - k, N
- [RunDossier](https://rundossier.com/docs/api) - Pre-meeting briefing on a person from public professional and web s... - k, N
- [Signaliz](https://signaliz.docs.buildwithfern.com/signaliz-api-public-docs/introduction) - GTM enrichment, lead generation, email verification, and company si... - k, ?
- [Smartsheet](https://smartsheet.redoc.ly/) - Allows you to programmatically access and Smartsheet data and accou... - o, N
- [Square](https://developer.squareup.com/reference/square) - Easy way to take payments, manage refunds, and help customers check... - o, ?
- [SwiftKanban](https://www.digite.com/knowledge-base/swiftkanban/article/api-for-swift-kanban-web-services/#restapi) - Kanban software, Visualize Work, Increase Organizations Lead Time,... - k, ?
- [Tenders in Hungary](https://tenders.guru/hu/api) - Get data for procurements in Hungary in JSON format - -, ?
- [Tenders in Poland](https://tenders.guru/pl/api) - Get data for procurements in Poland in JSON format - -, ?
- [Tenders in Romania](https://tenders.guru/ro/api) - Get data for procurements in Romania in JSON format - -, ?
- [Tenders in Spain](https://tenders.guru/es/api) - Get data for procurements in Spain in JSON format - -, ?
- [Tenders in Ukraine](https://tenders.guru/ua/api) - Get data for procurements in Ukraine in JSON format - -, ?
- [Tomba email finder](https://tomba.io/api) - Email Finder for B2B sales and email marketing and email verifier - k, Y
- [Trello](https://developers.trello.com/) - Boards, lists and cards to help you organize and prioritize your pr... - o, ?
- [UGC VZ](https://ugc-vz.de/developers) - Directory of DACH user-generated-content creators with topics, citi... - -, N
- [Village](https://docs.village.ai) - Person and company enrichment plus warm introduction paths through... - k, Y

### Calendar (15)

- [Africa Compliance Data](https://africacompliancedata.com/docs) - Public holidays and business days for all 54 African countries, fro... - k, Y
- [Calendarific](https://calendarific.com/) - Worldwide Holidays - k, ?
- [Checkiday - National Holiday](https://apilayer.com/marketplace/checkiday-api) - Industry-leading holiday data with over 5,000 holidays and thousand... - k, ?
- [Church Calendar](http://calapi.inadiutorium.cz/) - Catholic liturgical calendar - -, ?, no HTTPS
- [Czech Namedays Calendar](https://svatky.adresa.info) - Lookup for a name and returns nameday date - -, ?, no HTTPS
- [Festivo Public Holidays](https://docs.getfestivo.com/docs/products/public-holidays-api/intro) - Fastest and most advanced public holiday and observance service on... - k, Y
- [Google Calendar](https://developers.google.com/google-apps/calendar/) - Display, create and modify Google calendar events - o, ?
- [Hebrew Calendar](https://www.hebcal.com/home/developer-apis) - Convert between Gregorian and Hebrew, fetch Shabbat and Holiday tim... - -, ?, no HTTPS
- [Holidays](https://holidayapi.com/) - Historical data regarding holidays - k, ?
- [LectServe](http://www.lectserve.com) - Protestant liturgical calendar - -, ?, no HTTPS
- [Nager.Date](https://date.nager.at) - Public holidays for more than 90 countries - -, N
- [Non-Working Days](https://github.com/gadael/icsdb) - Database of ICS files for non working days - -, ?
- [Public Holidays](https://www.abstractapi.com/holidays-api) - Data on national, regional, and religious holidays via API - k, Y
- [Russian Calendar](https://github.com/egno/work-calendar) - Check if a date is a Russian holiday or not - -, N
- [UK Bank Holidays](https://www.gov.uk/bank-holidays.json) - Bank holidays in England and Wales, Scotland and Northern Ireland - -, ?

### Cloud Storage & File Sharing (18)

- [Box](https://developer.box.com/) - File Sharing and Storage - o, ?
- [ddownload](https://ddownload.com/api) - File Sharing and Storage - k, ?
- [Dropbox](https://www.dropbox.com/developers) - File Sharing and Storage - o, ?
- [File.io](https://www.file.io) - Super simple file sharing, convenient, anonymous and secure - -, ?
- [Filestack](https://www.filestack.com) - Filestack File Uploader & File Upload API - k, ?
- [FileUp](https://github.com/RealSinaSnp/FileUp) - Temporary file hosting with upload API, expiration times, and view... - -, ?
- [GoFile](https://gofile.io/api) - Unlimited size file uploads for free - k, ?
- [Google Drive](https://developers.google.com/drive/) - File Sharing and Storage - o, ?
- [Gyazo](https://gyazo.com/api/docs) - Save & Share screen captures instantly - k, ?
- [Imgbb](https://api.imgbb.com/) - Simple and quick private image sharing - k, ?
- [OneDrive](https://developer.microsoft.com/onedrive) - File Sharing and Storage - o, ?
- [Pastebin](https://pastebin.com/doc_api) - Plain Text Storage - k, ?
- [Pinata](https://docs.pinata.cloud/) - IPFS Pinning Services API - k, ?
- [Quip](https://quip.com/dev/automation/documentation) - File Sharing and Storage for groups - k, Y
- [Revdoku](https://revdoku.com/api.md) - Cloud file storage, version history, sharing and incoming email att... - k, ?
- [Storj](https://docs.storj.io/dcs/) - Decentralized Open-Source Cloud Storage - k, ?
- [The Null Pointer](https://0x0.st) - No-bullshit file hosting and URL shortening service - -, ?
- [Web3 Storage](https://web3.storage/) - File Sharing and Storage for Free with 1TB Space - k, Y

### Continuous Integration (6)

- [Azure DevOps Health](https://docs.microsoft.com/en-us/rest/api/resourcehealth) - Resource health helps you diagnose and get support when an Azure is... - k, N, no HTTPS
- [Bitrise](https://api-docs.bitrise.io/) - Build tool and processes integrations to create efficient developme... - k, ?
- [Buddy](https://buddy.works/docs/api/getting-started/overview) - The fastest continuous integration and continuous delivery platform - o, ?
- [CircleCI](https://circleci.com/docs/api/) - Automate the software development process using continuous integrat... - k, ?
- [Codeship](https://docs.cloudbees.com/docs/cloudbees-codeship/latest/api-overview/) - Codeship is a Continuous Integration Platform in the cloud - k, ?
- [Travis CI](https://docs.travis-ci.com/api/) - Sync your GitHub projects with Travis CI to test your code in minutes - k, ?

### Cryptocurrency (75)

- [1inch](https://business.1inch.com/portal/documentation) - API for querying decentralize exchange - k, ?
- [Alchemy Ethereum](https://www.alchemy.com/docs/) - Ethereum Node-as-a-Service Provider - k, Y
- [Binance](https://github.com/binance/binance-spot-api-docs) - Exchange for Trading Cryptocurrencies based in China - k, ?
- [Bitcambio](https://nova.bitcambio.com.br/api/v3/docs#a-public) - Get the list of all traded assets in the exchange - -, ?
- [BitcoinAverage](https://apiv2.bitcoinaverage.com/) - Digital Asset Price Data for the blockchain industry - k, ?
- [BitcoinCharts](https://bitcoincharts.com/about/exchanges/) - Financial and Technical Data related to the Bitcoin Network - -, ?
- [Bitculator](https://bitculator.com/en/documentation/api/v1) - Crypto prices, OHLCV history, sentiment, technical indicators, exch... - k, Y
- [Bitfinex](https://docs.bitfinex.com/docs) - Cryptocurrency Trading Platform - k, ?
- [Bitmex](https://www.bitmex.com/app/apiOverview) - Real-Time Cryptocurrency derivatives trading platform based in Hong... - k, ?
- [BitPanda](https://developers.bitpanda.com) - Cryptocurrency Information - k, ?
- [Bittrex](https://bittrex.github.io/api/v3) - Next Generation Crypto Trading Platform - k, ?
- [Block](https://block.io/docs/basic) - Bitcoin Payment, Wallet & Transaction Data - k, ?
- [Blockchain](https://www.blockchain.com/api) - Bitcoin Payment, Wallet & Transaction Data - k, ?
- [blockfrost Cardano](https://blockfrost.io/) - Interaction with the Cardano mainnet and several testnets - k, ?
- [Brave NewCoin](https://bravenewcoin.com/developers) - Real-time and historic crypto data from more than 200+ exchanges - k, ?
- [btcnode.uk](https://btcnode.uk) - Bitcoin blockchain data, fees, mempool, SEC insider trades, Reddit... - -, ?
- [BtcTurk](https://docs.btcturk.com/) - Real-time cryptocurrency data, graphs and API that allows buy&sell - k, Y
- [Bybit](https://www.bybit.com/docs/v5/introduction) - Cryptocurrency data feed and algorithmic trading - k, ?
- [CoinAPI](https://docs.coinapi.io/) - All Currency Exchanges integrate under a single api - k, N
- [Coinbase](https://developers.coinbase.com) - Bitcoin, Bitcoin Cash, Litecoin and Ethereum Prices - k, ?
- [Coinbase Pro](https://docs.pro.coinbase.com/#api) - Cryptocurrency Trading Platform - k, ?
- [CoinCap](https://docs.coincap.io/) - Real time Cryptocurrency prices through a RESTful API - -, ?
- [CoinDCX](https://docs.coindcx.com/) - Cryptocurrency Trading Platform - k, ?
- [Coinigy](https://coinigy.docs.apiary.io) - Interacting with Coinigy Accounts and Exchange Directly - k, ?
- [Coinlayer](https://coinlayer.com) - Real-time Crypto Currency Exchange Rates - k, ?
- [Coinlib](https://coinlib.io/) - Crypto Currency Prices - k, ?
- [Coinlore](https://www.coinlore.com/cryptocurrency-data-api) - Cryptocurrencies prices, volume and more - -, ?
- [CoinMarketCap](https://coinmarketcap.com/api/) - Cryptocurrencies Prices - k, ?
- [Coinmico](https://docs.coinmico.com) - Crypto prices, volume and liquidity measured from real trades on 50... - k, Y
- [CoinNudge](https://coinnudge.site/data/api-docs) - Current crypto market breadth, funding and open-interest research d... - k, ?
- [CoinRanking](https://developers.coinranking.com/api/documentation) - Live Cryptocurrency data - k, ?
- [Coinremitter](https://coinremitter.com/docs) - Cryptocurrencies Payment & Prices - k, ?
- [CoinStats](https://documenter.getpostman.com/view/5734027/RzZ6Hzr3?version=latest) - Crypto Tracker - -, ?
- [CryptAPI](https://docs.cryptapi.io/) - Cryptocurrency Payment Processor - -, ?
- [CryptingUp](https://www.cryptingup.com/apidoc/#introduction) - Cryptocurrency data - -, ?
- [CryptoCompare](https://www.cryptocompare.com/api#) - Cryptocurrencies Comparison - -, ?
- [CryptoMarket](https://api.exchange.cryptomkt.com/) - Cryptocurrencies Trading platform - k, Y
- [Cryptonator](https://www.cryptonator.com/api/) - Cryptocurrencies Exchange Rates - -, ?
- [Deep Blue Alpha](https://deepbluealpha.io/whale-api) - Real-time Ethereum whale wallet tracking, DEX trades, net flow, and... - k, Y
- [Degenscan Intel](https://intel.degenscan.io/carry) - Hyperliquid funding on every dex (HIP-3 incl.), cross-dex spreads,... - k, N
- [Dudelytics](https://dudelytics.com/en/dpmi/data/) - Productive crypto indices, daily benchmarks, sector indices and mar... - -, N
- [dYdX](https://docs.dydx.exchange/) - Decentralized cryptocurrency exchange - k, ?
- [Ethplorer](https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API) - Ethereum tokens, balances, addresses, history of transactions, cont... - k, ?
- [EXMO](https://documenter.getpostman.com/view/10287440/SzYXWKPi) - Cryptocurrencies exchange based in UK - k, ?
- [Gateio](https://www.gate.io/api2) - API provides spot, margin and futures trading operations - k, ?
- [Gemini](https://docs.gemini.com/rest-api/) - Cryptocurrencies Exchange - -, ?
- [Hirak Exchange Rates](https://rates.hirak.site/) - Exchange rates between 162 currency & 300 crypto currency update ea... - k, ?
- [Huobi](https://huobiapi.github.io/docs/spot/v1/en/) - Seychelles based cryptocurrency exchange - k, ?
- [Hyperliquid Market Data](https://rapidapi.com/theliminalguy/api/hyperliquid-market-data-oi-funding-open-interest) - Hyperliquid open interest, funding and cross-venue predicted rates... - k, Y
- [icy.tools](https://developers.icy.tools/) - GraphQL based NFT API - k, ?
- [Indodax](https://github.com/btcid/indodax-official-api-docs) - Trade your Bitcoin and other assets with rupiah - k, ?
- [INFURA Ethereum](https://infura.io/product/ethereum) - Interaction with the Ethereum mainnet and several testnets - k, Y
- [Kraken](https://docs.kraken.com/rest/) - Cryptocurrencies Exchange - k, ?
- [KuCoin](https://docs.kucoin.com/) - Cryptocurrency Trading Platform - k, ?
- [Localbitcoins](https://localbitcoins.com/api-docs/) - P2P platform to buy and sell Bitcoins - -, ?
- [MadeOnSol](https://madeonsol.com/developer) - Real-time Solana & Robinhood Chain KOL trades, deployer reputation,... - k, Y
- [Mempool](https://mempool.space/api) - Bitcoin API Service focusing on the transaction fee - -, N
- [MercadoBitcoin](https://www.mercadobitcoin.com.br/api-doc/) - Brazilian Cryptocurrency Information - -, ?
- [Messari](https://messari.io/api) - Provides API endpoints for thousands of crypto assets - -, ?
- [Mexc](https://www.mexc.com/api-docs) - Cryptocurrency info, place order - k, ?
- [Nexchange](https://nexchange2.docs.apiary.io/) - Automated cryptocurrency exchange service - -, Y, no HTTPS
- [Nomics](https://nomics.com/docs/) - Historical and realtime cryptocurrency prices and market data - k, Y
- [NovaDax](https://doc.novadax.com/en-US/#introduction) - NovaDAX API to access all market data, trading management endpoints - k, ?
- [OKEx](https://www.okex.com/docs/) - Cryptocurrency exchange based in Seychelles - k, ?
- [Paribu](https://docs.paribu.com/api) - Turkish cryptocurrency exchange with real-time market data, trading... - k, N
- [Poloniex](https://docs.poloniex.com) - US based digital asset exchange - k, ?
- [PumpFunData](https://pumpfundata.com/docs) - Historical Pump.fun and PumpSwap AMM swap data as hourly Parquet files - k, ?
- [ScriptMasterLabs MCP](https://mcp-x402.onrender.com) - Model Context Protocol server with web search, social search & LLM... - k, Y
- [Shumi](https://docs.shumi.ai/api-reference/introduction) - Crypto market data: prices, trends, funding rates, sentiment, narra... - k, Y
- [Solana JSON RPC](https://docs.solana.com/developing/clients/jsonrpc-api) - Provides various endpoints to interact with the Solana Blockchain - -, ?
- [Technical Analysis](https://technical-analysis-api.com) - Cryptocurrency prices and technical analysis - k, N
- [The Coin Analysis](https://www.thecoinanalysis.com/developers) - Live and historical cryptocurrency prices, market caps, volatility... - k, Y
- [VALR](https://docs.valr.com/) - Cryptocurrency Exchange based in South Africa - k, ?
- [WorldCoinIndex](https://www.worldcoinindex.com/apiservice) - Cryptocurrencies Prices - k, ?
- [ZMOK](https://zmok.io) - Ethereum JSON RPC API and Web3 provider - -, ?

### Currency Exchange (19)

- [1Forge](https://1forge.com/forex-data-api/api-documentation) - Forex currency market data - k, ?
- [Amdoren](https://www.amdoren.com/currency-api/) - Free currency API with over 150 currencies - k, ?
- [Bank of Russia](https://www.cbr.ru/development/SXML/) - Exchange rates and currency conversion - -, ?
- [CurrencyBeacon](https://currencybeacon.com/) - Real-time and historical currency exchange rates with free tier - k, Y
- [CurrencyFreaks](https://currencyfreaks.com/) - Provides current and historical currency exchange rates with free p... - k, Y
- [Currencylayer](https://currencylayer.com) - Exchange rates and currency conversion - k, ?
- [CurrencyScoop](https://currencyscoop.com/api-documentation) - Real-time and historical currency rates JSON API - k, Y
- [Czech National Bank](https://www.cnb.cz/cs/financni_trhy/devizovy_trh/kurzy_devizoveho_trhu/denni_kurz.xml) - A collection of exchange rates - -, ?
- [Economia.Awesome](https://docs.awesomeapi.com.br/api-de-moedas) - Portuguese free currency prices and conversion with no rate limits - -, ?
- [ExchangeRate-API](https://www.exchangerate-api.com) - Free currency conversion - k, Y
- [Exchangerate.dev](https://exchangerate.dev/docs) - Live & historical FX, 168 pairs back to 1999, Frankfurter-compatibl... - -, ?
- [Exchangerate.host](https://exchangerate.host) - Foreign exchange & crypto rates API (keyless access ended 2023) - k, ?
- [Exchangeratesapi.io](https://exchangeratesapi.io) - Exchange rates with currency conversion - k, Y
- [Fixer](https://fixer.io) - Exchange rates and currency conversion - k, ?, no HTTPS
- [FreeForexAPI](https://freeforexapi.com/Home/Api) - Real-time foreign exchange rates for major currency pairs - -, N
- [FXpeek](https://fxpeek.com/en/api) - Source-linked historical reference exchange rates with CSV, JSON an... - -, ?
- [Nerkhsanj](https://nerkh.jahankhahan.shop/developers/en) - Iran free-market USD, EUR, CNY, gold and coin rates in toman, live... - -, N
- [Rate-API](https://rate-api.com/docs/api) - Hourly exchange rates for 160+ currencies in JSON, XML or CSV with... - k, Y
- [TaxID](https://www.taxid.dev/docs) - EU VAT number validation with company name and address lookup acros... - k, ?

### Data Validation (16)

- [Attestwire](https://api.attestwire.com/docs) - Validate EN 16931 e-invoices: XRechnung, ZUGFeRD, Factur-X, Peppol BIS - k, Y
- [invowerk](https://invowerk.dev/docs) - Validate e-invoices (ZUGFeRD, Factur-X, XRechnung, Peppol BIS) and... - k, ?
- [Lob.com](https://lob.com/) - US Address Verification - k, ?
- [Postman Echo](https://www.postman-echo.com) - Test api server to receive and return value from HTTP method - -, ?
- [PurgoMalum](http://www.purgomalum.com) - Content validator against profanity & obscenity - -, ?, no HTTPS
- [RevAddress](https://revaddress.com/docs/) - US address standardization, congressional and state legislative dis... - k, N
- [SchemaShield](https://rapidapi.com/kaiasistentedavid/api/schema-change-risk) - Read-only preflight for breaking schema changes and downstream quer... - k, ?
- [sthan.io Address Autocomplete](https://sthan.io/products/address-autocomplete-usa) - Real-time US address suggestions as users type - k, N
- [sthan.io Address Parser](https://sthan.io/products/address-parser-usa) - Parse freeform US addresses into structured fields (house number, s... - k, N
- [sthan.io Address Verification](https://sthan.io/products/address-verification-usa) - Validate and standardize US addresses, with ZIP+4 and deliverabilit... - k, N
- [Temsor](https://api.temsor.com/docs) - Validates Turkish national ID, tax number, IBAN, phone, plate and p... - k, Y
- [US Autocomplete](https://www.smarty.com/docs/cloud/us-autocomplete-pro-api) - Enter address data quickly with real-time address suggestions - k, Y
- [US Extract](https://www.smarty.com/products/apis/us-extract-api) - Extract postal addresses from any text including emails - k, Y
- [US Street Address](https://www.smarty.com/docs/cloud/us-street-api) - Validate and append data for any US postal address - k, Y
- [VATlayer](https://vatlayer.com/) - VAT number validation - k, ?
- [VerifNow](https://docs.verifnow.io) - Validates email, phone, IBAN, EU VAT against VIES, and Canadian, Sp... - k, N

### Development (152)

- [Aether Bridge](https://a-to-mind.com) - Autonomous agent team management and API workflow orchestration - k, ?
- [Allscreenshots](https://allscreenshots.com) - Website screenshots and PDFs with full-page capture, dark mode and... - k, N
- [Amazonscraperapi](https://amazonscraperapi.com) - Amazon product, search & batch scraping API with residential proxie... - k, N
- [AmberOne](https://scubamike124.github.io/amberone-api/) - Turn any website into a build-ready Android, iOS, PWA or Electron a... - k, N
- [AnswerLine](https://answerline.dev) - Answers, citations and sources from AI assistants and Google surfac... - k, Y
- [API Grátis](https://apigratis.com.br/) - Multiples services and public APIs - -, ?
- [API Tool Calls](https://apitoolcalls.com/api/) - API Tool Calls: Home cost planners, page to Markdown, SEO checks an... - -, N
- [ApiFlash](https://apiflash.com/) - Chrome based screenshot API for developers - k, ?
- [APIs.guru](https://apis.guru/api-doc/) - Wikipedia for Web APIs, OpenAPI/Swagger specs for public APIs - -, ?
- [Aquanode](https://docs.aquanode.io/docs/api/marketplace) - Live GPU rental prices and availability across nine cloud providers - -, N
- [Azure DevOps](https://docs.microsoft.com/en-us/rest/api/azure/devops) - The Azure DevOps basic components of a REST API request/response pair - k, ?
- [Base](https://www.base-api.io/) - Building quick backends - k, Y
- [Bitbucket](https://developer.atlassian.com/bitbucket/api/2/reference/) - Bitbucket API - o, ?
- [Blague.xyz](https://blague.xyz/) - La plus grande API de Blagues FR/The biggest FR jokes API - k, Y
- [Blitapp](https://blitapp.com/api/) - Schedule screenshots of web pages and sync them to your cloud - k, ?
- [Blynk-Cloud](https://blynkapi.docs.apiary.io/#) - Control IoT Devices from Blynk IoT Cloud - k, ?, no HTTPS
- [Bored](https://bored-api.appbrewery.com/) - Find random activities to fight boredom - -, ?
- [Brainshop.ai](https://brainshop.ai/) - Make A Free A.I Brain - k, Y
- [BrewPage](https://brewpage.app) - Free hosting for HTML, JSON, key-value, files, multi-file sites wit... - -, N
- [Browshot](https://browshot.com/api/documentation) - Easily make screenshots of web pages in any screen size, as any device - k, Y
- [CDNJS](https://api.cdnjs.com/libraries/jquery) - Library info on CDNJS - -, ?
- [Changelogs.md](https://changelogs.md) - Structured changelog metadata from open source projects - -, ?
- [Ciprand](https://github.com/polarspetroll/ciprand) - Secure random string generator - -, N
- [Clair](https://clair.im) - Live public web data as JSON: Google Search, Maps, News, Amazon, jo... - k, N
- [Cloudflare](https://developers.cloudflare.com/api/) - Manage DNS, CDN, Workers and other services; documented with an off... - k, N
- [Codex](https://github.com/Jaagrav/CodeX) - Online Compiler for Various Languages - -, ?
- [Contentful Images](https://www.contentful.com/developers/docs/references/images-api/) - Used to retrieve and apply transformations to images - k, Y
- [Crawl Readiness](https://crawlreadiness.com) - Check if AI crawlers (ChatGPT, Claude, Perplexity, 30+ others) can... - k, Y
- [crawlbrulee](https://crawlbrulee.com/docs) - EU-native web scraping for AI agents & developers: turn any page in... - k, N
- [CurlShot](https://curlshot.com/docs) - Screenshots, PDFs and scrolling videos of any URL, HTML or Markdown... - k, Y
- [Databricks](https://docs.databricks.com/dev-tools/api/latest/index.html) - Service to manage your databricks account,clusters, notebooks, jobs... - k, Y
- [Diagrams.so](https://diagrams.so/developers) - Generate editable draw.io architecture diagrams from text or infras... - k, N
- [DigitalOcean Status](https://status.digitalocean.com/api) - Status of all DigitalOcean services - -, ?
- [Docker Hub](https://docs.docker.com/docker-hub/api/latest/) - Interact with Docker Hub - k, Y
- [DomainDb Info](https://api.domainsdb.info/) - Domain name search to find all domains containing particular words/... - -, ?
- [Framejet](https://framejet.dev/docs) - Website screenshot API with cookie banners and chat widgets removed... - k, N
- [GcrawlAI](https://gcrawlai.com) - Web scraping, SERP API, screenshots, URL to Markdown and prebuilt e... - k, Y
- [GeekFlare](https://apidocs.geekflare.com/docs/geekflare-api) - Provide numerous capabilities for important testing and monitoring... - k, ?
- [GETPing](https://www.getping.info) - Trigger an email notification with a simple GET request - k, ?
- [Ghost](https://ghost.org/) - Get Published content into your Website, App or other embedded media - k, Y
- [GitHub](https://docs.github.com/en/free-pro-team@latest/rest) - Make use of GitHub repositories, code and user info programmatically - o, Y
- [Gitlab](https://docs.gitlab.com/ee/api/) - Automate GitLab interaction programmatically - o, ?
- [Gitter](https://developer.gitter.im/docs/welcome) - Chat for Developers - o, ?
- [Glitterly](https://developers.glitterly.app) - Image generation API - k, Y
- [Go Module Proxy](https://go.dev/ref/mod#goproxy-protocol) - Go module versions and source metadata - -, ?
- [Google Docs](https://developers.google.com/docs/api/reference/rest) - API to read, write, and format Google Docs documents - o, ?
- [Google Firebase](https://firebase.google.com/docs) - Google's mobile application development platform that helps build,... - k, Y
- [Google Fonts](https://developers.google.com/fonts/docs/developer_api) - Metadata for all families served by Google Fonts - k, ?
- [Google Keep](https://developers.google.com/keep/api/reference/rest) - API to read, write, and format Google Keep notes - o, ?
- [Google PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started) - Website performance and Lighthouse audit scores - k, Y
- [Google Sheets](https://developers.google.com/sheets/api/reference/rest) - API to read, write, and format Google Sheets data - o, ?
- [Google Slides](https://developers.google.com/slides/api/reference/rest) - API to read, write, and format Google Slides presentations - o, ?
- [Gorest](https://gorest.co.in/) - Online REST API for Testing and Prototyping - o, ?
- [Hasura](https://hasura.io/opensource/) - GraphQL and REST API Engine with built in Authorization - k, Y
- [Heroku](https://devcenter.heroku.com/articles/platform-api-reference/) - REST API to programmatically create apps, provision add-ons and per... - o, Y
- [Hex](https://github.com/hexpm/specifications) - Elixir and Erlang package versions and docs - -, ?
- [Hipsum](https://hipsum.co) - Hipster-themed lorem ipsum generator for placeholder text - -, ?
- [Homebrew Formulae](https://formulae.brew.sh/api/) - Package and cask data for the Homebrew package manager - -, ?
- [host-t.com](https://host-t.com) - Basic DNS query via HTTP GET request - -, N
- [Host.io](https://host.io) - Domains Data API for Developers - k, Y
- [HTTP2.Pro](https://http2.pro/doc/api) - Test endpoints for client and server HTTP/2 protocol support - -, ?
- [Hunter](https://hunter.io/api) - API for domain search, professional email finder, author finder and... - k, ?
- [IBM Text to Speech](https://cloud.ibm.com/docs/text-to-speech/getting-started.html) - Convert text to speech - k, Y
- [IFTTT](https://platform.ifttt.com/docs/connect_api) - IFTTT Connect API - -, ?
- [import.io](http://api.docs.import.io/) - Retrieve structured data from a website or RSS feed - k, ?
- [IP2WHOIS Information Lookup](https://www.ip2whois.com/) - WHOIS domain name lookup - k, ?
- [ipfind.io](https://ipfind.io) - Geographic location of an IP address or any domain name along with... - k, Y
- [IPify](https://www.ipify.org/) - A simple IP Address API - -, ?
- [IPinfo](https://ipinfo.io/developers) - Another simple IP Address API - -, ?
- [Ironfang Render](https://ironfang.com/render/docs) - Screenshots, PDFs, dynamic images, QR codes and video from URLs or... - k, N
- [isitdownstatus](https://isitdownstatus.com) - Check if websites and online services are currently down - -, ?
- [JSON 2 JSONP](https://json2jsonp.com/) - Convert JSON to JSONP (on-the-fly) for easy cross-domain data reque... - -, ?
- [JSONbin.io](https://jsonbin.io) - Free JSON storage service. Ideal for small scale Web apps, Websites... - k, Y
- [jstash](https://jstash.app/docs/) - Save JSON with one request and get a URL; private JSON for each sig... - k, N
- [Keyvalue](https://keyvalue.immanuel.co/) - Simple key-value storage REST API for quick prototyping - -, ?
- [Labelixa](https://labelixa.com/docs/api) - Render, validate and generate Zebra ZPL label barcodes as PNG/PDF - k, Y
- [License-API](https://github.com/cmccandless/license-api/blob/master/README.md) - Unofficial REST API for choosealicense.com - -, N
- [Litport Free Proxy](https://litport.net/docs/free-proxy-api) - Live-tested HTTP, SOCKS4, and SOCKS5 proxies with latency, uptime,... - -, N
- [Logs.to](https://logs.to/) - Generate logs - k, ?
- [MAC address vendor lookup](https://macaddress.io/api) - Retrieve vendor details and other information regarding a given MAC... - k, Y
- [Micro DB](https://m3o.com/db) - Simple database service - k, ?
- [Micro-SaaS AI Suite](https://microsaas-agent-api.vercel.app/openapi.json) - 8 serverless AI APIs for sentiment analysis, copy generation, email... - k, ?
- [MicroENV](https://microenv.com/) - Fake Rest API for developers - -, ?
- [msgboard](https://msgboard.dev) - Public message board for agent-to-agent messaging, no account or key - -, N
- [MY IP](https://www.myip.com/api-docs/) - Get IP address information - -, ?
- [NameGender](https://namegender.com/docs) - Gender from a first name, full name, email or username, with probab... - k, Y
- [Netlify](https://docs.netlify.com/api/get-started/) - Netlify is a hosting service for the programmable web - o, ?
- [npm Registry](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md) - Query information about your favorite Node.js libraries programatic... - -, ?
- [OneSignal](https://developers.onesignal.com/) - Self-serve customer engagement solution for Push Notifications, Ema... - k, ?
- [Open Page Rank](https://www.domcop.com/openpagerank/) - API for calculating and comparing metrics of different websites usi... - k, ?
- [OpenAPIHub](https://hub.openapihub.com/) - The All-in-one API Platform - h, ?
- [OpenGraphr](https://opengraphr.com/docs/1.0/overview) - Really simple API to retrieve Open Graph data from an URL - k, ?
- [OpenQR](https://openqr.uk/api) - Generate QR codes and manage dynamic (editable) QR codes with scan... - k, Y
- [Packagist](https://packagist.org/apidoc) - PHP Composer package versions and dist metadata - -, N
- [PageCDN](https://pagecdn.com/docs/public-api) - Public API for javascript, css and font libraries on PageCDN - k, Y
- [Peak](https://peak.fo/docs) - Cloudflare Turnstile and 5-second challenge solving, pay per succes... - k, Y
- [Postman](https://www.postman.com/postman/workspace/postman-public-workspace/documentation/12959542-c8142d51-e97c-46b6-bd77-52bb66712c9a) - Tool for testing APIs - k, ?
- [ProxyCrawl](https://proxycrawl.com) - Scraping and crawling anticaptcha service - k, ?
- [ProxyKingdom](https://proxykingdom.com) - Rotating Proxy API that produces a working proxy on every request - k, Y
- [Pusher Beams](https://pusher.com/beams) - Push notifications for Android & iOS - k, ?
- [QR code](http://goqr.me/api/) - Generate and decode / read QR code graphics - -, ?
- [QR Codes](https://qr-api.62-238-102-93.sslip.io/docs) - Generate QR codes via a single GET request, with logo embedding and... - k, N
- [Qrcode Monkey](https://www.qrcode-monkey.com/qr-code-api-with-logo/) - Integrate custom and unique looking QR codes into your system or wo... - -, ?
- [QRX](https://qrx.codes/developers) - Artistic, branded QR codes from a text prompt and a link, checked t... - k, N
- [Random Stuff](https://api-docs.pgamerx.com/) - Can be used to get AI Response, jokes, memes, and much more at ligh... - k, Y
- [RealUptime](https://realuptime.io/docs/api) - Manage uptime monitors, heartbeat checks, incidents and status page... - k, N
- [Rejax](https://rejax.io/) - Reverse AJAX service to notify clients - k, N
- [ReplyNodes](https://replynodes.com/markdown-api/) - Convert a public web page into clean Markdown - -, N
- [ReqRes](https://reqres.in/ ) - A hosted REST-API ready to respond to your AJAX requests - -, ?
- [SavePage.io](https://www.savepage.io) - A free, RESTful API used to screenshot any desktop, or mobile website - k, Y
- [ScrapeNinja](https://scrapeninja.net) - Scraping API with Chrome fingerprint and residential proxies - k, ?
- [ScraperApi](https://www.scraperapi.com) - Easily build scalable web scrapers - k, ?
- [scraperBox](https://scraperbox.com/) - Undetectable web scraping API - k, Y
- [scrapestack](https://scrapestack.com/) - Real-time, Scalable Proxy & Web Scraping REST API - k, ?
- [ScrapingAnt](https://scrapingant.com) - Headless Chrome scraping with a simple API - k, ?
- [ScrapingBot](https://scrapingbot.io) - Web scraping, AI extraction, and public TikTok, Instagram, Google a... - k, N
- [ScrapingDog](https://www.scrapingdog.com/) - Proxy API for Web scraping - k, ?
- [Scrappa](https://scrappa.co/docs) - Google Search, Maps, Jobs, YouTube and review site results as struc... - k, Y
- [Scrax](https://rapidapi.com/mtaahoperators/api/scrax) - Web scraping API that only bills for successful scrapes - k, ?
- [Screenshot](https://www.abstractapi.com/website-screenshot-api) - Take programmatic screenshots of web pages from any website - k, Y
- [Screenshot Happy](https://screenshot-api-production-ffd7.up.railway.app/docs) - Website screenshot API (PNG/JPEG/PDF) with full-page capture and vi... - k, N
- [ScreenshotAPI.net](https://screenshotapi.net/) - Create pixel-perfect website screenshots - k, Y
- [SegmentLite](https://segmentlite-api-dfru.fly.dev) - Lightweight event routing and webhook fan-out API alternative to Se... - k, Y
- [Serialif Color](https://color.serialif.com/) - Color conversion, complementary, grayscale and contrasted text - -, N
- [Serply](https://serply.io/docs) - Google, Bing, News, Scholar and Maps search results and page scrapi... - k, Y
- [serpstack](https://serpstack.com/) - Real-Time & Accurate Google Search Results API - k, Y
- [Sheetsu](https://sheetsu.com/) - Easy google sheets integration - k, ?
- [Shotanvil](https://shotanvil.com) - Screenshot, PDF and HTML rendering API with a free tier, API key or... - k, N
- [SHOUTCLOUD](http://shoutcloud.io/) - ALL-CAPS AS A SERVICE - -, ?, no HTTPS
- [SiteIntel](https://siteintel.duckdns.org) - Extract metadata, tech stack, emails, and screenshots from any URL - k, ?
- [SnapRender](https://snap-render.com/docs) - Website screenshots as PNG, JPEG, WebP or PDF, and page content as... - k, Y
- [SnoopScan](https://snoopscan.com/docs) - Scrape, crawl, map and search the web as clean markdown or JSON, wi... - k, ?
- [SolidPing](https://docs.solidping.io/docs/api) - Create and run uptime checks, read results and incidents, manage st... - k, ?
- [SonarQube](https://sonarcloud.io/web_api) - SonarQube REST APIs to detect bugs, code smells & security vulnerab... - o, ?
- [StackExchange](https://api.stackexchange.com/) - Q&A forum for developers - o, ?
- [Supportivekoala](https://developers.supportivekoala.com/) - Autogenerate images with template - k, Y
- [Suprsonic](https://suprsonic.ai) - Unified agent API: search, scrape, enrich, image gen, TTS, STT, mes... - k, Y
- [Talordata](https://docs.talordata.com/) - SERP data from major search engines with a free trial - k, ?
- [Thunderbit](https://thunderbit.com/docs/introduction) - Extract web pages as Markdown or structured data for AI apps - k, ?
- [ToolForte](https://toolforte.com/developers) - Deterministic utilities: IBAN/VAT validation, cron parsing, regex,... - k, ?
- [Tyk](https://tyk.io/open-source-api-gateway/) - Api and service management platform - k, Y
- [unfurlr](https://unfurlr.onrender.com/docs) - Link-preview metadata for any URL: title, Open Graph, Twitter tags,... - k, Y
- [URLpipe](https://urlpipe.dev/docs) - Turn a URL into Markdown, screenshots, metadata or Lighthouse audit... - k, N
- [Userstack](https://userstack.com/) - Secure User-Agent String Lookup JSON API - o, ?
- [Utilorax](https://utilorax.com/api) - 203 JSON endpoints: hashing, encoding, unit conversion, text, dates... - k, Y
- [W3C Validator](https://validator.w3.org/docs/api.html) - Validate HTML and check markup errors - -, ?
- [Wandbox](https://github.com/melpon/wandbox/blob/master/kennel2/API.rst) - Code compiler supporting 35+ languages mentioned at wandbox.org - -, ?
- [Web Metadata & Contact Extractor](https://rapidapi.com/josejuanjocoding/api/web-metadata-and-contact-extractor) - Extract SEO metadata, contact emails, social links, and tech stack... - k, Y
- [Webclaw](https://webclaw.io/docs/api) - Web content extraction for LLMs with scrape, crawl, search, and sum... - k, Y
- [WebScraping.AI](https://webscraping.ai/) - Web Scraping API with built-in proxies and JS rendering - k, Y
- [WeInc](https://my.we.inc/docs/api) - AI website builder: manage clients, website projects, templates and... - k, N
- [ZenRows](https://www.zenrows.com/) - Web Scraping API that bypasses anti-bot solutions while offering JS... - k, ?

### Dictionaries (12)

- [Chinese Character Web](http://ccdb.hemiola.com/) - Chinese character definitions and pronunciations - -, N, no HTTPS
- [Chinese Text Project](https://ctext.org/tools/api) - Online open-access digital library for pre-modern Chinese texts - -, ?
- [Collins](https://api.collinsdictionary.com/api/v1/documentation/html/) - Bilingual Dictionary and Thesaurus Data - k, ?
- [Free Dictionary](https://dictionaryapi.dev/) - Definitions, phonetics, pronunciations, parts of speech, examples,... - -, ?
- [Indonesia Dictionary](https://new-kbbi-api.herokuapp.com/) - Indonesia dictionary many words - -, ?
- [Lingua Robot](https://www.linguarobot.io) - Word definitions, pronunciations, synonyms, antonyms and others - k, Y
- [Merriam-Webster](https://dictionaryapi.com/) - Dictionary and Thesaurus Data - k, ?
- [Oxford](https://developer.oxforddictionaries.com/) - Dictionary Data - k, N
- [SayItVid](https://sayitvid.com) - English video pronunciation search with timestamps, IPA phonetics a... - k, Y
- [Synonyms](https://www.synonyms.com/synonyms_api.php) - Synonyms, thesaurus and antonyms information for any given word - k, ?
- [Wordnik](https://developer.wordnik.com) - Dictionary Data - k, ?
- [Words](https://www.wordsapi.com/docs/) - Definitions and synonyms for more than 150,000 words - k, ?

### Documents & Productivity (50)

- [Airtable](https://airtable.com/api) - Integrate with Airtable - k, ?
- [Api2Convert](https://www.api2convert.com/) - Online File Conversion API - k, ?
- [apilayer pdflayer](https://pdflayer.com) - HTML/URL to PDF - k, ?
- [Asana](https://developers.asana.com/docs) - Programmatic access to all data in your asana system - k, Y
- [Assinafy](https://api.assinafy.com.br/v1/docs) - Brazilian e-signature API with a free plan - k, ?
- [BuildPDF](https://buildpdf.co/api/docs) - Convert HTML, images, and text to PDF - k, Y
- [ClickUp](https://clickup.com/api) - ClickUp is a robust, cloud-based project management tool for boosti... - o, ?
- [Clockify](https://clockify.me/developers-api ) - Clockify's REST-based API can be used to push/pull data to/from it... - k, ?
- [CloudConvert](https://cloudconvert.com/api/v2) - Online file converter for audio, video, document, ebook, archive, i... - k, ?
- [Cloudmersive Document and Data Conversion](https://cloudmersive.com/convert-api) - HTML/URL to PDF/PNG, Office documents to PDF, image conversion - k, Y
- [Code::Stats](https://codestats.net/api-docs) - Automatic time tracking for programmers - k, N
- [Convert Online](https://convert.online/api-docs) - Online file converter for image, video, audio, document, ebook, fon... - k, N
- [CraftMyPDF](https://craftmypdf.com) - Generate PDF documents from templates with a drop-and-drop editor a... - k, N
- [DocCheap](https://doc.cheap/docs) - Read passports, ID cards and driver's licences into JSON, $0.01 per... - k, Y
- [Emboss](https://getemboss.ai/docs) - Make PDF forms fillable, fill them from JSON or documents, and read... - k, N
- [FaturaPDF](https://rapidapi.com/leosanchees2014/api/brazilian-invoice-receipt-pdf-api-cpf-cnpj) - Generate Brazilian invoice/receipt PDFs with checksum-validated CPF... - k, ?
- [flatmark](https://flatmark.dev/docs) - Convert PDF, Word, PowerPoint, Excel and HTML documents to Markdown... - k, ?
- [Flowdash](https://docs.flowdash.com/docs/api-introduction) - Automate business workflows - k, ?
- [Formfeed](https://docs.formfeed.dev/api/overview) - Render PDFs and images from HTML (Jinja2, Liquid, Handlebars) or Wo... - k, N
- [Html2PDF](https://html2pdf.app/) - HTML/URL to PDF - k, ?
- [iLovePDF](https://developer.ilovepdf.com/) - Convert, merge, split, extract text and add page numbers for PDFs.... - k, Y
- [JIRA](https://developer.atlassian.com/server/jira/platform/rest-apis/) - JIRA is a proprietary issue tracking product that allows bug tracki... - o, ?
- [Mattermost](https://api.mattermost.com/) - An open source platform for developer collaboration - o, ?
- [Mercury](https://mercury.postlight.com/web-parser/) - Web parser - k, ?
- [Monday](https://api.developer.monday.com/docs) - Programmatically access and update data inside a monday.com account - k, ?
- [Notion](https://developers.notion.com/docs/getting-started) - Integrate with Notion - o, ?
- [OCR.Space](https://ocr.space/ocrapi) - OCR text extraction from images and PDFs with a free tier - k, ?
- [PandaDoc](https://developers.pandadoc.com) - DocGen and eSignatures API - k, N
- [PDFFleet](https://pdffleet.com) - HTML and URL to PDF API with templates and a free tier - k, Y
- [PDFMint](https://pdf.mintapis.com/docs) - HTML, Markdown or a URL to PDF or PNG, with a no-key demo endpoint... - k, N
- [pdfrender](https://pdfrender.dev/docs) - HTML and CSS to PDF with page headers, footers and page numbers, no... - k, ?
- [Pocket](https://getpocket.com/developer/) - Bookmarking service - o, ?
- [Podio](https://developers.podio.com) - File sharing and productivity - o, ?
- [PolyDoc](https://polydoc.tech) - HTML/URL to PDF and screenshots, plus Factur-X/ZUGFeRD e-invoices;... - k, ?
- [PrexView](https://prexview.com) - Data from XML or JSON to PDF, HTML or Image - k, ?
- [PrintSocket](https://www.printsocket.com/docs) - Send PDFs, ZPL labels and ESC/POS receipts to your own printers fro... - k, N
- [Renderly](https://renderlyapi.com) - HTML to PDF conversion API built on Chromium - k, Y
- [Rendex](https://rendex.dev) - Render HTML, Markdown, or URLs to PNG/JPEG/WebP/PDF, with extractio... - k, ?
- [Restpack](https://restpack.io/) - Provides screenshot, HTML to PDF and content extraction APIs - k, ?
- [RunConvert](https://www.runconvert.com/docs) - Convert video, audio, image, and document files programmatically - k, N
- [Sahifa](https://sahifa.dev/en/docs) - HTML/URL to PDF and screenshots with Arabic and right-to-left suppo... - k, N
- [Shortcut](https://developer.shortcut.com) - Manage stories, epics, iterations and objectives in a Shortcut work... - k, N
- [Smart Image Enhancement](https://apilayer.com/marketplace/image_enhancement-api) - Performs image upscaling by adding detail to images through multipl... - k, ?
- [staffSign](https://staffsign.de/docs) - Digital employment contract API with QES/eIDAS support for HR and s... - k, Y
- [Thirds](https://thirds.ai/docs/api) - Create branded PDFs and images from HTML or reusable templates - k, N
- [Todoist](https://developer.todoist.com) - Todo Lists - o, ?
- [Vector Express v2.0](https://vector.express) - Free vector file converting API - -, N
- [WakaTime](https://wakatime.com/developers) - Automated time tracking leaderboards for programmers - -, ?
- [Zero Retention PDF](https://xeropdf.com) - Zero-retention HTML to PDF conversion - k, ?
- [Zube](https://zube.io/docs/api) - Full stack project management - o, ?

### Email (29)

- [Atomic Mail](https://atomic-mail.github.io/atomic-mail-agentic/) - Email for AI agents: programmatic inbox creation and send/receive o... - k, ?
- [Best Temp Mail](https://best-tempmail.com/api) - Disposable inboxes for automated email testing, with OTP extraction - -, N
- [Cloudmersive Validate](https://cloudmersive.com/validate-api) - Validate email addresses, phone numbers, VAT numbers and domain names - k, Y
- [ContactLint](https://contactlint.com/) - Validate email syntax, MX, disposable and role addresses with typo... - k, Y
- [Disban](https://disban.io/docs) - Classify email domains as disposable, free, alias, testing or parke... - k, N
- [DropMail](https://dropmail.me/api/#live-demo) - GraphQL API for creating and managing ephemeral e-mail inboxes - -, ?
- [Email Validation](https://www.abstractapi.com/email-verification-validation-api) - Validate email addresses for deliverability and spam - k, Y
- [EmailJS](https://www.emailjs.com/docs/) - Send emails directly from client-side JavaScript without a backend... - k, Y
- [Guerrilla Mail](https://www.guerrillamail.com/GuerrillaMailAPI.html) - Disposable temporary Email addresses - -, ?
- [ImprovMX](https://improvmx.com/api) - API for free email forwarding service - k, ?
- [inboxsink](https://inboxsink.com/docs) - Disposable inboxes for end-to-end tests that wait for the email and... - k, N
- [Kiprio Email Validate](https://kiprio.com/v1/email-validate) - Free email validation: MX check, disposable detection, syntax - k, Y
- [mailboxlayer](https://mailboxlayer.com) - Email address validation - k, ?
- [MailboxValidator](https://www.mailboxvalidator.com/api-email-free) - Validate email address to improve deliverability - k, ?
- [MailCheck.ai](https://www.mailcheck.ai/#documentation) - Prevent users to sign up with temporary email addresses - -, ?
- [Mailfornet](https://mailfornet.com/api) - Disposable inboxes for end-to-end signup tests, with long-polling a... - k, Y
- [MailRambo](https://www.mailrambo.com/developers) - Verify email deliverability with a strict yes/no, disposable and ca... - k, N
- [Mailtrap](https://mailtrap.io) - Email API and SMTP for sending transactional and bulk emails, with... - k, ?
- [Nitrosend](https://docs.nitrosend.com/api) - Send marketing and transactional email; manage contacts, segments a... - k, N
- [PostStack](https://poststack.dev/docs) - EU-hosted email API for transactional and marketing email, with con... - k, N
- [RankFabrik Verify](https://rankfabrik.com/produits/verification) - Validate email addresses for deliverability, syntax and disposable... - k, ?
- [Sendgrid](https://docs.sendgrid.com/api-reference/) - A cloud-based SMTP provider that allows you to send emails without... - k, ?
- [Sendinblue](https://developers.brevo.com/) - A service that provides solutions relating to marketing and/or tran... - k, ?
- [SendRaven](https://sendraven.ai/docs/api) - Email for AI agents: send email, receive replies as threads, with p... - k, N
- [SMTPfast](https://smtpfa.st/docs) - Send transactional email, manage contacts and broadcasts, free 3,00... - k, Y
- [TempMailGrab](https://tempmailgrab.com/api-docs) - Disposable inboxes for email testing with OTP extraction and webhooks - k, N
- [uchecker](https://api.uchecker.net/docs) - Bulk email verification with full SMTP server responses - k, ?
- [Verifier](https://verifier.meetchopra.com/docs#/) - Verifies that a given email is real - k, Y
- [Xeramail Temp Mail](https://xeramail.com/docs/api) - Temp email address REST API for privacy, testing, automation with O... - k, N

### Entertainment (11)

- [Anycrap](https://anycrap.shop/developers) - 35,000+ absurdist AI-generated product concepts with names, descrip... - k, Y
- [chucknorris.io](https://api.chucknorris.io) - JSON API for hand curated Chuck Norris jokes - -, ?
- [Excuser](https://excuser.herokuapp.com/) - Get random excuses for various situations - -, ?
- [Imgflip](https://imgflip.com/api) - Gets an array of popular memes - -, ?
- [Meme Maker](https://mememaker.github.io/API/) - REST API for create your own meme - -, ?
- [Memesio](https://memesio.com/developers/api) - Meme creation API with templates, editable captions and hosted shar... - -, N
- [NaMoMemes](https://github.com/theIYD/NaMoMemes) - Memes on Narendra Modi - -, ?
- [Random Useless Facts](https://uselessfacts.jsph.pl/) - Get useless, but true facts - -, ?
- [TasteDive](https://tastedive.com/read/api) - Content-based recommendations for movies, music, TV shows, books, g... - k, N
- [Techy](https://techy-api.vercel.app/) - JSON and Plaintext API for tech-savvy sounding phrases - -, ?
- [Yo Momma Jokes](https://github.com/beanboi7/yomomma-apiv2) - REST API for Yo Momma Jokes - -, ?

### Environment (25)

- [AirNow](https://docs.airnowapi.org/) - US EPA air quality data and forecasts - k, Y
- [BreezoMeter Pollen](https://docs.breezometer.com/api-documentation/pollen-api/v2/) - Daily Forecast pollen conditions data for a specific location - k, ?
- [Carbon Interface](https://docs.carboninterface.com/) - API to calculate carbon (C02) emissions estimates for common C02 em... - k, Y
- [Climatiq](https://docs.climatiq.io) - Calculate the environmental footprint created by a broad range of e... - k, Y
- [Cloverly](https://www.cloverly.com/carbon-offset-documentation) - API calculates the impact of common carbon-intensive activities in... - k, ?
- [CO2 Offset](https://co2offset.io/api.html) - API calculates and validates the carbon footprint - -, ?
- [Danish data service Energi](https://www.energidataservice.dk/) - Open energy data from Energinet to society - -, ?
- [EIA Open Data](https://www.eia.gov/opendata/) - US energy statistics: electricity, petroleum, gas - k, ?
- [GridHub](https://grid-hub.app/developers) - Live wholesale electricity prices and demand across 25 grid zones - k, Y
- [GrünstromIndex](https://gruenstromindex.de/) - Green Power Index for Germany (Grünstromindex/GSI) - -, Y, no HTTPS
- [IQAir](https://www.iqair.com/air-pollution-data-api) - Air quality and weather data - k, ?
- [Luchtmeetnet](https://api-docs.luchtmeetnet.nl/) - Predicted and actual air quality components for The Netherlands (RIVM) - -, ?
- [Mycelium](https://api.mycelium.global/docs/v1) - Corporate carbon emissions disclosures (scope 1, 2 and 3), company-... - k, ?
- [National Grid ESO](https://data.nationalgrideso.com/) - Open data from Great Britain’s Electricity System Operator - -, ?
- [OpenAQ](https://docs.openaq.org/) - Open air quality data - k, ?
- [PM2.5 Open Data Portal](https://pm25.lass-net.org/#apis) - Open low-cost PM2.5 sensor data - -, ?
- [PM25.in](http://www.pm25.in/api_doc) - Air quality of China - k, ?, no HTTPS
- [PVGIS](https://joint-research-centre.ec.europa.eu/pvgis-photovoltaic-geographical-information-system/getting-started-pvgis/api-non-interactive-service) - EU solar radiation and photovoltaic performance estimates - -, N
- [PVWatts](https://developer.nrel.gov/docs/solar/pvwatts/v6/) - Energy production photovoltaic (PV) energy systems - k, ?
- [sensor.community](https://github.com/opendata-stuttgart/meta/wiki/EN-APIs) - Community air quality sensor network data worldwide - UA header, Y
- [Solematica](https://www.solematica.it/sviluppatori) - Compare Italian solar (photovoltaic) installer offers, energy price... - -, N
- [Srp Energy](https://srpenergy-api-client-python.readthedocs.io/en/latest/api.html) - Hourly usage energy report for Srp customers - k, N
- [SustainMetrics](https://www.sustainmetrics.net/api) - 18,000+ GHG emission factors from DEFRA, EPA, ADEME, Ember - k, Y
- [UK Carbon Intensity](https://carbon-intensity.github.io/api-definitions/#carbon-intensity-api-v1-0-0) - The Official Carbon Intensity API for Great Britain developed by Na... - -, ?
- [Website Carbon](https://api.websitecarbon.com/) - API to estimate the carbon footprint of loading web pages - -, ?

### Events (4)

- [Eventbrite](https://www.eventbrite.com/platform/api/) - Find events - o, ?
- [FindLocal](https://findlocal.community/docs) - Hyper-local US events: concerts, trivia, open mics, readings, story... - k, Y
- [SeatGeek](https://platform.seatgeek.com/) - Search events, venues and performers - k, ?
- [Ticketmaster](http://developer.ticketmaster.com/products-and-docs/apis/getting-started/) - Search events, attractions, or venues - k, ?

### Finance (73)

- [Aletheia](https://aletheiaapi.com/) - Insider trading data, earnings call analysis, financial statements,... - k, Y
- [Alpaca](https://docs.alpaca.markets/us/docs/about-market-data-api) - Realtime and historical market data on all US equities and ETFs - k, Y
- [Alpha Vantage](https://www.alphavantage.co/) - Realtime and historical stock data - k, ?
- [Arkleon](https://arkleon.com) - Point-in-time SEC EDGAR fundamentals over /v1 - k, ?
- [Banco do Brasil](https://developers.bb.com.br/home) - All Banco do Brasil financial transaction APIs - o, Y
- [Bank Data](https://apilayer.com/marketplace/bank_data-api) - Instant IBAN and SWIFT number validation across the globe - k, ?
- [Billplz](https://www.billplz.com/api) - Payment platform - k, ?
- [Binlist](https://binlist.net/) - Public access to a database of IIN/BIN information - -, ?
- [Boleto.Cloud](https://boleto.cloud/) - A api to generate boletos in Brazil - k, ?
- [BriefTape](https://brieftape.com) - Real-time AI-summarized SEC filings, Fed, FDA and BLS data, ticker-... - k, Y
- [Citi](https://sandbox.developerhub.citi.com/api-catalog-list) - All Citigroup account and statement data APIs - k, ?
- [CongressInvests](https://congressinvests.com) - Real-time U.S. congressional stock trade disclosures from Senate EF... - k, Y
- [Degenscan Intel Macro](https://intel.degenscan.io/docs) - U.S. Treasury auctions, stablecoin supply, Brazil crypto-dollar pre... - k, N
- [Dino.markets](https://dino.markets/docs) - Matched Kalshi and Polymarket prediction-market data, cross-venue s... - k, N
- [Drillr](https://drillr.ai/docs/api) - Fundamentals, filings, earnings, ownership and events for US, China... - k, N
- [EconPulse](https://econpulse.io) - Live economic data — CPI, PPI, energy, treasury rates, BTC premium - k, Y
- [EOD Historical Data](https://eodhd.com/) - Real-time and historical stock market data with 150+ exchanges - k, Y
- [FarmDash](https://www.farmdash.one/agents) - DeFi intelligence, protocol risk, yield simulation plus 84 MCP agen... - k, Y
- [Fed Treasury](https://fiscaldata.treasury.gov/api-documentation/) - U.S. Department of the Treasury Data - -, ?
- [Filingrail](https://rapidapi.com/hudson-enterprises-llc-hudson-enterprises-llc-default/api/filingrail) - SEC EDGAR filings, XBRL financials, Form 4 insider trades, 8-K even... - k, ?
- [Finage](https://finage.co.uk) - Finage is a stock, currency, cryptocurrency, indices, and ETFs real... - k, ?
- [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs) - Realtime and historical stock data - k, ?
- [FinBridge](https://www.gronox.kr/docs) - Official-source financials, segments, valuation, peers and prices f... - k, Y
- [Finnhub](https://finnhub.io/docs/api) - Real-Time RESTful APIs and Websocket for Stocks, Currencies, and Cr... - k, ?
- [FRED](https://fred.stlouisfed.org/docs/api/fred/) - Economic data from the Federal Reserve Bank of St. Louis - k, Y
- [Front Accounting APIs](https://frontaccounting.com/fawiki/index.php?n=Devel.SimpleAPIModule) - Front accounting is multilingual and multicurrency software for sma... - o, Y
- [FXNewsBias](https://fxnewsbias.com/developers) - AI-scored news sentiment for the 8 major forex currencies, refreshe... - k, Y
- [Goldprice.dev](https://goldprice.dev/docs) - Cross-validated gold, silver & copper spot, futures & 30-year histo... - -, ?
- [Halal Terminal](https://api.halalterminal.com/docs) - Shariah-compliant stock and ETF screening across 5 methodologies, z... - k, Y
- [Hotstoks](https://hotstoks.com) - Stock market data powered by SQL - k, Y
- [IBANforge](https://api.ibanforge.com) - IBAN validation and BIC/SWIFT lookup for 89 countries with 121k+ BI... - k, N
- [IEX Cloud](https://iexcloud.io/docs/api/) - Realtime & Historical Stock and Market Data - k, Y
- [IG](https://labs.ig.com/gettingstarted) - Spreadbetting and CFD Market Data - k, ?
- [Indian Mutual Fund](https://www.mfapi.in/) - Get complete history of India Mutual Funds Data - -, ?
- [Intrinio](https://intrinio.com/) - A wide selection of financial data feeds - k, ?
- [Klarna](https://docs.klarna.com/klarna-payments/) - Klarna payment and shopping service - k, ?
- [KmalServico Gold Price Dataset](https://www.kmalservico.com/data) - Current gold price per gram at 6 purities for 188 countries, JSON,... - -, N
- [Live SEC Form 4 Insider Trades](https://rapidapi.com/crisp-point-studio-crisp-point-studio-default/api/live-sec-form-4-insider-trades) - Latest SEC Form 4 insider trading filings from EDGAR, by ticker or... - k, ?
- [Marketstack](https://marketstack.com/) - Real-Time, Intraday & Historical Market Data API - k, ?
- [matchwire.win](https://matchwire.win/docs/) - Matched prediction-market games across Kalshi, Polymarket US/Intl a... - k, N
- [MercadoPago](https://www.mercadopago.com.br/developers/es/reference) - Mercado Pago API reference - all the information you need to develo... - k, ?
- [Mono](https://mono.co/) - Connect with users’ bank accounts and access transaction data in Af... - k, ?
- [Moov](https://docs.moov.io/api/) - The Moov API makes it simple for platforms to send, receive, and st... - k, ?
- [Nordigen](https://nordigen.com/en/account_information_documenation/integration/quickstart_guide/) - Connect to bank accounts using official bank APIs and get raw trans... - k, ?
- [NORTH7 Agent](https://north7.ai/v1/docs) - Trading signals, market analysis and geopolitical intelligence - k, Y
- [OpenFIGI](https://www.openfigi.com/api) - Equity, index, futures, options symbology from Bloomberg LP - k, Y
- [Pink Agentic AI Payments](https://pinkwallet.com/agentic/developers/) - Approval layer for AI agent payments: per-agent budgets, rules, sin... - k, Y
- [PIT Financial State](https://agent-economy-pit-evaluation.onrender.com/docs) - Point-in-time quarterly revenue for 20 U.S. issuers - k, ?
- [Plaid](https://www.plaid.com/docs) - Connect with user's bank accounts and access transaction data - k, ?
- [Polygon](https://polygon.io/) - Historical stock market data - k, ?
- [Razorpay IFSC](https://razorpay.com/docs/) - Indian Financial Systems Code (Bank Branch Codes) - -, ?
- [Real Time Finance](https://github.com/Real-time-finance/finance-websocket-API/) - Websocket API to access realtime stock data - k, ?, no HTTPS
- [Sales Tax Calculator](https://salestaxcalculatorapi.com) - Computes exact sales tax amounts and breakdowns for checkout and bi... - k, Y
- [Segmara](https://segmara.com/syndicate) - IPO calendars, filing stages and estimated lockup dates - UA header, Y
- [SmartAPI](https://smartapi.angelbroking.com/) - Gain access to set of <SmartAPI> and create end-to-end broking serv... - k, ?
- [Stanza VAT Validator](https://stanzaapi.com/tools/vat-validator) - Validate EU and UK VAT numbers with country formats, checksums, and... - k, N
- [StockData](https://www.StockData.org) - Real-Time, Intraday & Historical Market Data, News and Sentiment API - k, Y
- [StockFit](https://api.stockfit.io/docs) - SEC filings, financial statements, earnings, ETF holdings and owner... - k, Y
- [Styvio](https://www.Styvio.com) - Realtime and historical stock data and current stock sentiment - k, ?
- [Sugra](https://sugra.ai) - One API for market data, economics, commodities, climate, and globa... - k, Y
- [Tax Data](https://apilayer.com/marketplace/tax_data-api) - Instant VAT number and tax validation across the globe - k, ?
- [TickerLayer](https://tickerlayer.com) - Real-time and historical market data for stocks, forex, crypto and... - k, ?
- [Top 5 Stocks](https://top5stocks.netlify.app/developers) - Daily AI-ranked stock and crypto watchlists - -, ?
- [Tradier](https://developer.tradier.com) - US equity/option market data (delayed, intraday, historical) - o, Y
- [Twelve Data](https://twelvedata.com/) - Stock market data (real-time & historical) - k, ?
- [USTariffRates](https://api.ustariffrates.com/openapi.json) - US HTS lookup and origin-specific tariff breakdowns with source con... - k, ?
- [VAT Validation](https://www.abstractapi.com/vat-validation-rates-api) - Validate VAT numbers and calculate VAT rates - k, Y
- [VoxOdds](https://voxodds.com/api) - Polymarket and Kalshi odds, all-in executable quotes, EV checks and... - -, N
- [WallstreetBets](https://dashboard.nbshare.io/apps/reddit/api/) - WallstreetBets Stock Comments Sentiment Analysis - -, ?
- [XFINLAB](https://www.xfinlab.com/intelligence-api.html) - Market events, sentiment, technical analysis and macro data for stocks - k, ?
- [Yahoo Finance](https://www.yahoofinanceapi.com/) - Real time low latency Yahoo Finance API for stock market, crypto cu... - k, Y
- [YNAB](https://api.youneedabudget.com/) - Budgeting & Planning - o, Y
- [Zoho Books](https://www.zoho.com/books/api/v3/) - Online accounting software, built for your business - o, ?

### Food & Drink (28)

- [CalorieNinjas](https://calorieninjas.com/api) - Nutrition and calorie data for foods and recipes - k, Y
- [Chomp](https://chompthis.com/api/) - Data about various grocery products and foods - k, ?
- [Coffee](https://coffee.alexflipnote.dev/) - Random pictures of coffee - -, ?
- [CookbookSocial Nutrition](https://cookbooksocial.app/api) - Nutrition data for 4,631 ingredients with food names in 19 languages - k, N
- [DoughMatrix](https://doughmatrix.com) - Sourdough and pizza dough formula calculators: true hydration, DDT,... - -, N
- [Edamam nutrition](https://developer.edamam.com/edamam-docs-nutrition-api) - Nutrition Analysis - k, ?
- [Edamam recipes](https://developer.edamam.com/edamam-docs-recipe-api) - Recipe Search - k, ?
- [Food Info](https://food-info.org/developer) - Nutrition data for millions of foods from six national food composi... - k, N
- [Fruityvice](https://www.fruityvice.com) - Data about all kinds of fruit - -, ?
- [Kroger](https://developer.kroger.com/reference) - Supermarket Data - k, ?
- [LCBO](https://lcboapi.com/) - Alcohol - k, ?
- [Noms](https://noms.sh/docs) - Nutrition data for 3.7M foods and 298K brands across 230 countries,... - k, Y
- [Open Food Facts](https://world.openfoodfacts.org/data) - Food Products Database - -, ?
- [PunkAPI](https://punkapi.com/) - Brewdog Beer Recipes - -, ?
- [RecipeAPI](https://recipeapi.io) - Recipes, ingredients, nutrition data and cooking instructions - k, Y
- [Rustybeer](https://rustybeer.herokuapp.com/) - Beer brewing tools - -, N
- [Spoonacular](https://spoonacular.com/food-api) - Recipes, Food Products, and Meal Planning - k, ?
- [Systembolaget](https://api-portal.systembolaget.se) - Govornment owned liqour store in Sweden - k, ?
- [TacoFancy](https://github.com/evz/tacofancy-api) - Community-driven taco database - -, ?, no HTTPS
- [Tasty](https://rapidapi.com/apidojo/api/tasty/) - API to query data about recipe, plan, ingredients - k, ?
- [The Report of the Week](https://github.com/andyklimczak/TheReportOfTheWeek-API) - Food & Drink Reviews - -, ?
- [TheCocktailDB](https://www.thecocktaildb.com/api.php) - Cocktail Recipes - k, Y
- [TheMealDB](https://www.themealdb.com/api.php) - Meal Recipes - k, Y
- [Tiny Plates](https://www.tinyplates.dev/docs) - Structured recipes, semantic search, serving adjustments and shoppi... - k, Y
- [Untappd](https://untappd.com/api/docs) - Social beer sharing - o, ?
- [What's on the menu?](http://nypl.github.io/menus-api/) - NYPL human-transcribed historical menu collection - k, ?, no HTTPS
- [WhiskyHunter](https://whiskyhunter.net/api/) - Past online whisky auctions statistical data - -, ?
- [Zestful](https://zestfuldata.com/) - Parse recipe ingredients - k, Y

### Games & Comics (74)

- [Animal Crossing: New Horizons](http://acnhapi.com/) - API for critters, fossils, art, music, furniture and villagers - -, ?
- [Battle.net](https://develop.battle.net/documentation/guides/getting-started) - Diablo III, Hearthstone, StarCraft II and World of Warcraft game da... - o, Y
- [Board Game Geek](https://boardgamegeek.com/wiki/page/BGG_XML_API2) - Board games, RPG and videogames - -, N
- [Brawl Stars](https://developer.brawlstars.com) - Brawl Stars Game Information - k, ?
- [Call of Duty Mobile](https://callofdutymobile.vercel.app/) - Unofficial API for CODM player data and daily cache claiming - -, ?
- [Chess.com](https://www.chess.com/news/view/published-data-api) - Chess.com read-only REST API - -, ?
- [Chuck Norris Database](http://www.icndb.com/api/) - Jokes - -, ?, no HTTPS
- [Clash of Clans](https://developer.clashofclans.com) - Clash of Clans Game Information - k, ?
- [Clash Royale](https://developer.clashroyale.com) - Clash Royale Game Information - k, ?
- [Comic Vine](https://comicvine.gamespot.com/api/documentation) - Comics - -, ?
- [Deck of Cards](http://deckofcardsapi.com/) - Deck of Cards - -, ?, no HTTPS
- [Destiny The Game](https://bungie-net.github.io/multi/index.html) - Bungie Platform API - k, ?
- [Digimon Information](https://digimon-api.vercel.app/) - Provides information about digimon creatures - -, ?
- [Digimon TCG](https://documenter.getpostman.com/view/14059948/TzecB4fH) - Search for Digimon cards in digimoncard.io - -, ?
- [Dota 2](https://docs.opendota.com/) - Provides information about Player stats , Match stats, Rankings for... - k, ?
- [Dungeons and Dragons](https://www.dnd5eapi.co/docs/) - Reference for 5th edition spells, classes, monsters, and more - -, N, no HTTPS
- [Eve Online](https://esi.evetech.net/ui) - Third-Party Developer Documentation - o, ?
- [FIFA Ultimate Team](https://www.easports.com/fifa/ultimate-team/api/fut/item) - FIFA Ultimate Team items API - -, ?
- [Fortnite](https://fortnitetracker.com/site-api) - Fortnite Stats - k, ?
- [Forza](https://docs.forza-api.tk) - Show random image of car from Forza - -, ?
- [GDBrowser](https://gdbrowser.com/api) - Easy way to use the Geometry Dash Servers - -, ?
- [Giant Bomb](https://www.giantbomb.com/api/documentation) - Video Games - k, ?
- [Guild Wars 2](https://wiki.guildwars2.com/wiki/API:Main) - Guild Wars 2 Game Information - k, ?
- [GW2Spidy](https://github.com/rubensayshi/gw2spidy/wiki) - GW2Spidy API, Items data on the Guild Wars 2 Trade Market - -, ?
- [Halo](https://developer.haloapi.com/) - Halo 5 and Halo Wars 2 Information - k, ?
- [Hearthstone](http://hearthstoneapi.com/) - Hearthstone Cards Information - h, ?
- [Humble Bundle](https://rapidapi.com/Ziggoto/api/humble-bundle) - Humble Bundle's current bundles - k, ?
- [Humor](https://humorapi.com) - Humor, Jokes, and Memes - k, ?
- [Hypixel](https://api.hypixel.net/) - Hypixel player stats - k, ?
- [Hyrule Compendium](https://github.com/gadhagod/Hyrule-Compendium-API) - Data on all interactive items from The Legend of Zelda: BOTW - -, ?
- [Hytale](https://hytale-api.com/) - Hytale blog posts and jobs - -, ?
- [IGDB.com](https://api-docs.igdb.com) - Video Game Database - k, ?
- [Jokes One](https://jokes.one/api/joke/) - Joke of the day and large category of jokes accessible via REST API - k, Y
- [Jservice](http://jservice.io) - Jeopardy Question Database - -, ?, no HTTPS
- [KrakenKeys](https://krakenkeys.com/api-docs) - Steam game key price comparison across 20+ stores, deals, and price... - k, N
- [Lichess](https://lichess.org/api) - Access to all data of users, games, puzzles and etc on Lichess - o, ?
- [Magic The Gathering](http://magicthegathering.io/) - Magic The Gathering Game Information - -, ?, no HTTPS
- [Mario Kart Tour](https://mario-kart-tour-api.herokuapp.com/) - API for Drivers, Karts, Gliders and Courses - o, ?
- [Marvel](https://developer.marvel.com) - Marvel Comics - k, ?
- [Master Setter](https://api.master-setter.com) - Pokémon TCG cards and sets in 14 languages, with every printing and... - k, Y
- [Minecraft Server Status](https://api.mcsrvstat.us) - API to get Information about a Minecraft Server - -, N
- [MMO Games](https://www.mmobomb.com/api) - MMO Games Database, News and Giveaways - -, N
- [mod.io](https://docs.mod.io) - Cross Platform Mod API - k, ?
- [Mojang](https://wiki.vg/Mojang_API) - Mojang / Minecraft API - k, ?
- [Online Sudoku - Sudokumax](https://sudokumax.com/developers) - Free Sudoku puzzles, printable Sudoku worksheets and online play: h... - k, Y
- [Open Trivia](https://opentdb.com/api_config.php) - Trivia Questions - -, ?
- [PandaScore](https://developers.pandascore.co/) - E-sports games and results - k, ?
- [Path of Exile](https://www.pathofexile.com/developer/docs) - Path of Exile Game Information - o, ?
- [PlayerDB](https://playerdb.co/) - Query Minecraft, Steam and XBox Accounts - -, ?
- [Pokéapi](https://pokeapi.co) - Pokémon Information - -, ?
- [Pokémon TCG](https://pokemontcg.io) - Pokémon TCG Information - -, ?
- [PUBG](https://developer.pubg.com/) - Access in-game PUBG data - k, Y
- [quizapi.io](https://quizapi.io/) - Access to various kind of quiz questions - k, Y
- [Raider](https://raider.io/api) - Provides detailed character and guild rankings for Raiding and Myth... - -, ?
- [RAWG.io](https://rawg.io/apidocs) - 500,000+ games for 50 platforms including mobiles - k, ?
- [Riot Games](https://developer.riotgames.com/) - League of Legends Game Information - k, ?
- [RuneScape](https://runescape.wiki/w/Application_programming_interface) - RuneScape and OSRS RPGs information - -, N
- [Sakura CardCaptor](https://github.com/JessVel/sakura-card-captor-api) - Sakura CardCaptor Cards Information - -, ?
- [SpaceTradersAPI](https://spacetraders.io?rel=pub-apis) - A playable inter-galactic space trading MMOAPI - o, Y
- [Steam](https://steamapi.xpaw.me/) - Steam Web API documentation - k, N
- [Steam](https://github.com/Revadike/InternalSteamWebAPI/wiki) - Internal Steam Web API documentation - -, N
- [Sudoku100](https://www.sudoku100.com/api) - Free Sudoku puzzle generation and embedding with images, solver lin... - -, ?
- [SuperHeroes](https://superheroapi.com) - All SuperHeroes and Villains data from all universes under a single... - k, ?
- [Tebex](https://docs.tebex.io/plugin/) - Tebex API for information about game purchases - h, N
- [TETR.IO](https://tetr.io/about/api/) - TETR.IO Tetra Channel API - -, ?
- [TickerMint](https://tickermint.cards/developers) - Daily market prices and price history for Pokémon, One Piece, Lorca... - -, N
- [Tronald Dump](https://www.tronalddump.io/) - The dumbest things Donald Trump has ever said - -, ?
- [Valorant (non-official)](https://valorant-api.com) - An extensive API containing data of most Valorant in-game items, as... - -, ?
- [Warface (non-official)](https://api.wfstats.cf) - Official API proxy with better data structure and more features - -, N
- [Wargaming.net](https://developers.wargaming.net/) - Wargaming.net info and stats - k, N
- [weBump](https://developer.webump.app/) - Connect games to nearby players' profiles, small saves and recent v... - o, Y
- [When is next MCU film](https://github.com/DiljotSG/MCU-Countdown/blob/develop/docs/API.md) - Upcoming MCU film information - -, ?
- [xkcd](https://xkcd.com/json.html) - Retrieve xkcd comics as JSON - -, N
- [Yu-Gi-Oh!](https://db.ygoprodeck.com/api-guide/) - Yu-Gi-Oh! TCG Information - -, ?

### Geocoding (89)

- [Actinia Grass GIS](https://actinia.mundialis.de/api_docs/) - Actinia is an open source REST API for geographical data that uses... - k, ?
- [adresse.data.gouv.fr](https://adresse.data.gouv.fr) - Address database of France, geocoding and reverse - -, ?
- [Airtel IP](https://sys.airtel.lv/ip2country/1.1.1.1/?full=true) - IP Geolocation API. Collecting data from multiple sources - -, ?
- [Apiip](https://apiip.net/) - Get location information by IP address - k, Y
- [ApogeoAPI](https://apogeoapi.com) - Bundled API for countries, states, cities, IP geolocation, and live... - k, Y
- [AtlasFetch](https://atlasfetch.xyz/docs) - Reverse geocode coordinates to country, region and municipality wit... - k, N
- [Battuta](http://battuta.medunes.net) - A (country/region/city) in-cascade location API - k, ?, no HTTPS
- [BdAPIs](https://bdapis.com/) - Get divisions, districts, and upazzilas of Bangladesh - -, ?
- [BigDataCloud](https://www.bigdatacloud.com/docs) - Provides fast and accurate IP geolocation APIs along with security... - k, ?
- [Bing Maps](https://www.microsoft.com/maps/) - Create/customize digital maps based on Bing Maps data - k, ?
- [Cartes.io](https://github.com/M-Media-Group/Cartes.io/wiki/API) - Create maps and markers for anything - -, ?
- [Cep.la](http://cep.la/) - Brazil RESTful API to find information about streets, zip codes, ne... - -, ?, no HTTPS
- [CitySDK](http://www.citysdk.eu/citysdk-toolkit/) - Open APIs for select European cities - -, ?
- [CountryStateCity](https://countrystatecity.in/) - World countries, states, regions, provinces, cities & towns in JSON... - k, Y
- [Ducks Unlimited](https://gis.ducks.org/datasets/du-university-chapters/api) - API explorer that gives a query URL with a JSON response of locatio... - -, N
- [GeoApi](https://api.gouv.fr/api/geoapi.html) - French geographical data - -, ?
- [Geoapify](https://www.geoapify.com/api/geocoding-api/) - Forward and reverse geocoding, address autocomplete - k, Y
- [Geocod.io](https://www.geocod.io/) - Address geocoding / reverse geocoding in bulk - k, ?
- [Geocode.xyz](https://geocode.xyz/api) - Provides worldwide forward/reverse geocoding, batch geocoding and g... - -, ?
- [Geocodify.com](https://geocodify.com/) - Worldwide geocoding, geoparsing and autocomplete for addresses - k, Y
- [Geodata.gov.gr](https://geodata.gov.gr/en/) - Open geospatial data and API service for Greece - -, ?
- [GeoDataSource](https://www.geodatasource.com/web-service) - Geocoding of city name by using latitude and longitude coordinates - k, ?
- [GeoDB Cities](http://geodb-cities-api.wirefreethought.com/) - Get global city, region, and country data - k, ?
- [GeoNames](http://www.geonames.org/export/web-services.html) - Place names and other geographical data - -, ?, no HTTPS
- [Google Earth Engine](https://developers.google.com/earth-engine/) - A cloud-based platform for planetary-scale environmental data analysis - k, ?
- [Google Maps](https://developers.google.com/maps/) - Create/customize digital maps based on Google Maps data - k, ?
- [Graph Countries](https://github.com/lennertVanSever/graphcountries) - Country-related data like currencies, languages, flags, regions+sub... - -, ?
- [HelloSalut](https://fourtonfish.com/project/hellosalut-api/) - Get hello translation following user language - -, ?
- [HERE Maps](https://developer.here.com) - Create/customize digital maps based on HERE Maps data - k, ?
- [Hirak IP to Country](https://iplocation.hirak.site/) - Ip to location with country code, currency code & currency name, fa... - k, ?
- [Hong Kong GeoData Store](https://geodata.gov.hk/gs/) - API for accessing geo-data of Hong Kong - -, ?
- [IBGE](https://servicodados.ibge.gov.br/api/docs/) - Aggregate services of IBGE (Brazilian Institute of Geography and St... - -, ?
- [IP 2 Country](https://ip2country.info) - Map an IP to a country - -, ?
- [IP Address Details](https://ipinfo.io/) - Find geolocation with ip address - -, ?
- [IP Geolocation](https://www.abstractapi.com/ip-geolocation-api) - Geolocate website visitors from their IPs - k, Y
- [IP Vigilante](https://www.ipvigilante.com/) - Free IP Geolocation API - -, ?
- [ip-api](https://ip-api.com/docs) - Find location with IP address or domain - -, ?, no HTTPS
- [IP-API.io](https://ip-api.io) - IP geolocation with VPN/proxy/Tor detection, reputation and risk score - k, Y
- [ip2geo.dev](https://ip2geo.dev) - Programmatically convert IP addresses into geolocation data - k, Y
- [IP2Location](https://www.ip2location.com/web-service/ip2location) - IP geolocation web service to get more than 55 parameters - k, ?
- [IP2Proxy](https://www.ip2location.com/web-service/ip2proxy) - Detect proxy and VPN using IP address - k, ?
- [ipapi.com](https://ipapi.com/) - Real-time Geolocation & Reverse IP Lookup REST API - k, ?
- [IPGEO](https://api.techniknews.net/ipgeo/) - Unlimited free IP Address API with useful information - -, ?
- [ipgeolocation](https://ipgeolocation.io/) - IP Geolocation AP with free plan 30k requests per month - k, Y
- [IPInfoDB](https://www.ipinfodb.com/api) - Free Geolocation tools and APIs for country, region, city and time... - k, ?
- [IPstack](https://ipstack.com/) - Locate and identify website visitors by IP address - k, ?
- [ipstack](https://ipstack.com/) - Locate and identify website visitors by IP address - k, ?
- [Kakao Maps](https://apis.map.kakao.com) - Kakao Maps provide multiple APIs for Korean maps - k, ?
- [keycdn IP Location Finder](https://tools.keycdn.com/geo) - Get the IP geolocation data through the simple REST API. All the re... - k, ?
- [Kiprio UK Postcode](https://kiprio.com/v1/postcode) - UK postcode lookup with lat/lon, district, ward, constituency - k, Y
- [LocationIQ](https://locationiq.org/docs/) - Provides forward/reverse geocoding and batch geocoding - k, Y
- [Locio](https://locio.com.au/docs/) - Australian address autocomplete, validation and geocoding from the... - k, Y
- [Longdo Map](https://map.longdo.com/docs/) - Interactive map with detailed places and information portal in Thai... - k, Y
- [Mapbox](https://docs.mapbox.com/) - Create/customize beautiful digital maps - k, ?
- [MapQuest](https://developer.mapquest.com/) - To access tools and resources to map the world / `apiKey` - Yes, Y, no HTTPS
- [Mexico](https://github.com/IcaliaLabs/sepomex) - Mexico RESTful zip codes API - -, ?
- [MyPincode](https://mypincode.live) - Indian PIN code and postal office lookup - -, ?
- [Network Data Labs](https://www.networkdatalabs.com/docs) - IP geolocation with accuracy radius, ASN, and flags for Tor exits,... - k, N
- [One Map, Singapore](https://www.onemap.gov.sg/docs/) - Singapore Land Authority REST API services for Singapore addresses - k, ?
- [OnWater](https://onwater.io/) - Determine if a lat/lon is on water or land - -, ?
- [Open Topo Data](https://www.opentopodata.org) - Elevation and ocean depth for a latitude and longitude - -, N
- [OpenCage](https://opencagedata.com) - Forward and reverse geocoding using open data - k, Y
- [openrouteservice.org](https://openrouteservice.org/) - Directions, POIs, isochrones, geocoding (+reverse), elevation, and... - k, ?
- [OpenStreetMap](http://wiki.openstreetmap.org/wiki/API) - Navigation, geolocation and geographical data - o, ?, no HTTPS
- [ParcelGPS](https://www.parcelgps.com/en/developers) - European cadastral parcels by reference or point: coordinates, area... - k, Y
- [PontoFato](https://pontofato.com/api/) - Brazilian postal codes (CEP) with IBGE coordinates, addresses and t... - -, N
- [positionstack](https://positionstack.com/) - Forward & Reverse Batch Geocoding REST API - k, ?
- [PostalCodes](https://postalcodes.info/api) - Postal code search, country exports, and address validation data - -, ?
- [PostcodeData.nl](http://api.postcodedata.nl/v1/postcode/?postcode=1211EP&streetnumber=60&ref=domeinnaam.nl&type=json) - Provide geolocation data based on postcode for Dutch addresses - -, ?, no HTTPS
- [Queimadas INPE](https://terrabrasilis.dpi.inpe.br/queimadas/portal/) - Access to heat focus data (probable wildfire) - -, ?
- [RoadGoat Cities](https://www.roadgoat.com/business/cities-api) - Cities content & photos API - k, N
- [Rwanda Locations](https://rapidapi.com/victorkarangwa4/api/rwanda) - Rwanda Provences, Districts, Cities, Capital City, Sector, cells, v... - -, ?
- [SpotSense](https://spotsense.io/) - Add location based interactions to your mobile app - k, ?
- [sthan.io India PIN Code Autocomplete](https://sthan.io/products/pincode-autocomplete-ind) - Autocomplete Indian PIN codes as users type - k, N
- [sthan.io IP Geolocation](https://sthan.io/products/ip-geolocation) - Look up the geographic location of any IPv4 or IPv6 address - k, N
- [sthan.io Reverse Geocoding](https://sthan.io/products/reverse-geocoding-usa) - Convert latitude and longitude to the nearest US street address - k, N
- [Telize](https://rapidapi.com/fcambus/api/telize/) - Telize offers location information from any IP address - k, Y
- [TomTom](https://developer.tomtom.com/) - Maps, Directions, Places and Traffic APIs - k, Y
- [TrustyData](https://trustydata.fr/docs/) - French address checks, INSEE company search and routing on official... - k, Y
- [Uebermaps](https://uebermaps.com/api/v2) - Discover and share maps with friends - k, ?
- [US ZipCode](https://www.smarty.com/docs/cloud/us-zipcode-api) - Validate and append data for any US ZipCode - k, Y
- [Utah AGRC](https://api.mapserv.utah.gov) - Utah Web API for geocoding Utah addresses - k, ?
- [ViaCep](https://viacep.com.br) - Brazil RESTful zip codes API - -, ?
- [What3Words](https://what3words.com) - Three words as rememberable and unique coordinates worldwide - k, ?
- [Yandex.Maps Geocoder](https://yandex.com/dev/maps/geocoder) - Use geocoding to get an object's coordinates from its address - k, ?
- [ZipCodeAPI](https://www.zipcodeapi.com) - US zip code distance, radius and location API - k, ?
- [Zippopotam.us](http://www.zippopotam.us) - Get information about place such as country, city, state, etc - -, ?, no HTTPS
- [Ziptastic](https://ziptasticapi.com/) - Get the country, state, and city of any US zip-code - -, ?
- [Zornade](https://app.zornade.com/api/) - Cadastral parcels, geocoding, OMI valuations, risk and demographics... - k, Y

### Government (99)

- [AI Law Tracker](https://ai-law-tracker.com/developers) - AI regulation laws by jurisdiction (US, EU, global) as read-only JS... - k, ?
- [apipj](https://apipj.com.br/docs) - Brazilian company data by CNPJ from Receita Federal open data, incl... - k, Y
- [Bank Negara Malaysia Open Data](https://apikijangportal.bnm.gov.my/) - Malaysia Central Bank Open Data - -, ?
- [BCLaws](https://www.bclaws.gov.bc.ca/civix/template/complete/api/index.html) - Access to the laws of British Columbia - -, ?, no HTTPS
- [Boletín Oficial del Estado (BOE)](https://www.boe.es/datosabiertos/) - Official Spanish State Gazette open data: laws, summaries and XML/J... - -, ?
- [Brazil Central Bank Open Data](https://dadosabertos.bcb.gov.br/) - Brazil Central Bank Open Data - -, ?
- [Brazil Receita WS](https://www.receitaws.com.br/) - Consult companies by CNPJ for Brazilian companies - -, ?
- [Brazilian Chamber of Deputies Open Data](https://dadosabertos.camara.leg.br/swagger/api.html) - Provides legislative information in Apis XML and JSON, as well as f... - -, N
- [Bureau of Labor Statistics](https://www.bls.gov/developers/) - US labor statistics: inflation, unemployment, wages and productivity - -, ?
- [Census.gov](https://www.census.gov/data/developers/data-sets.html) - The US Census Bureau provides various APIs and data sets on demogra... - -, ?
- [City, Berlin](https://daten.berlin.de/) - Berlin(DE) City Open Data - -, ?
- [City, Gdańsk](https://ckan.multimediagdansk.pl/en) - Gdańsk (PL) City Open Data - -, ?
- [City, Gdynia](http://otwartedane.gdynia.pl/en/api_doc.html) - Gdynia (PL) City Open Data - -, ?, no HTTPS
- [City, Helsinki](https://hri.fi/en_gb/) - Helsinki(FI) City Open Data - -, ?
- [City, Lviv](https://opendata.city-adm.lviv.ua/) - Lviv(UA) City Open Data - -, ?
- [City, Nantes Open Data](https://data.nantesmetropole.fr/pages/home/) - Nantes(FR) City Open Data - k, ?
- [City, New York Open Data](https://opendata.cityofnewyork.us/) - New York (US) City Open Data - -, ?
- [City, Prague Open Data](http://opendata.praha.eu/en) - Prague(CZ) City Open Data - -, ?, no HTTPS
- [Code.gov](https://code.gov) - The primary platform for Open Source and code sharing for the U.S.... - k, ?
- [Colorado Information Marketplace](https://data.colorado.gov/) - Colorado State Government Open Data - -, ?
- [Conversor IAE CNAE](https://www.conversoriaecnae.es/api/v1/docs) - Spanish IAE/CNAE tax activity codes, 2009→2025 crosswalk and AEAT o... - k, N
- [CPFHub](https://cpfhub.io) - Brazilian CPF lookup — returns full name, birth date, and gender fo... - k, Y
- [Data USA](https://datausa.io/about/api/) - US Public Data - -, ?
- [Data.gov](https://api.data.gov/) - US Government Data - k, ?
- [Data.parliament.uk](https://explore.data.parliament.uk/?learnmore=Members) - Contains live datasets including information about petitions, bills... - -, ?, no HTTPS
- [Deutscher Bundestag DIP](https://dip.bundestag.de/documents/informationsblatt_zur_dip_api_v01.pdf) - This API provides read access to DIP entities (e.g. activities, per... - k, ?
- [Disclosed Capitol](https://www.disclosedcapitol.com/data-files/api) - US congressional & executive-branch stock trade disclosures (STOCK... - k, N
- [District of Columbia Open Data](http://opendata.dc.gov/pages/using-apis) - Contains D.C. government public datasets, including crime, GIS, fin... - -, ?
- [DistrictAPI](https://districtapi.dev/docs) - US school districts and schools by address, with enrollment and bou... - k, Y
- [eCourtsIndia](https://ecourtsindia.com/api) - Indian court case status, judgments, and hearing schedule API - k, Y
- [Edgrapi](https://edgrapi.com/docs) - US government data as JSON: SAM.gov contract opportunities, USAspen... - k, Y
- [EPA](https://www.epa.gov/developers/data-data-products#apis) - Web services and data sets from the US Environmental Protection Agency - -, ?
- [FastDOL](https://www.fastdol.com/docs) - Federal enforcement records for US employers: OSHA, WHD, MSHA, EPA,... - k, Y
- [FBI Wanted](https://www.fbi.gov/wanted/api) - Access information on the FBI Wanted program - -, ?
- [FDA Import Alert Screening](https://aerviklabs.com/apis/fda-import-alerts/) - Screen firm names against FDA Import Alert Red, Yellow and Green Lists - k, ?
- [FEC](https://api.open.fec.gov/developers/) - Information on campaign donations in federal elections - k, ?
- [Federal Register](https://www.federalregister.gov/reader-aids/developer-resources/rest-api) - The Daily Journal of the United States Government - -, ?
- [gankdat](https://gankdat.com/docs) - UK & EU tenders, UK planning, UK sanctions, US exclusions, UK insol... - k, Y
- [Gazette Data, UK](https://www.thegazette.co.uk/data) - UK official public record API - o, ?
- [GovContractScout](https://scout.govbidportals.com) - US state & local government contracts: search, details, NAICS looku... - k, Y
- [Gun Policy](https://www.gunpolicy.org/api) - International firearm injury prevention and policy - k, ?
- [INEI](http://iinei.inei.gob.pe/microdatos/) - Peruvian Statistical Government Open Data - -, ?, no HTTPS
- [Interpol Red Notices](https://interpol.api.bund.dev/) - Access and search Interpol Red Notices - -, ?
- [Istanbul (İBB) Open Data](https://data.ibb.gov.tr) - Data sets from the İstanbul Metropolitan Municipality (İBB) - -, ?
- [National Park Service, US](https://www.nps.gov/subjects/developer/) - Data from the US National Park Service - k, Y
- [Neotimo DGFiP Mirror](https://neotimo.com/annuaire-dgfip) - French DGFiP registry of certified e-invoicing platforms (Plateform... - -, ?
- [Open Government, ACT](https://www.data.act.gov.au/) - Australian Capital Territory Open Data - -, ?
- [Open Government, Argentina](https://datos.gob.ar/) - Argentina Government Open Data - -, ?
- [Open Government, Australia](https://www.data.gov.au/) - Australian Government Open Data - -, ?
- [Open Government, Austria](https://www.data.gv.at/) - Austria Government Open Data - -, ?
- [Open Government, Belgium](https://data.gov.be/) - Belgium Government Open Data - -, ?
- [Open Government, Canada](http://open.canada.ca/en) - Canadian Government Open Data - -, ?, no HTTPS
- [Open Government, Colombia](https://www.dane.gov.co/) - Colombia Government Open Data - -, ?, no HTTPS
- [Open Government, Cyprus](https://data.gov.cy/?language=en) - Cyprus Government Open Data - -, ?
- [Open Government, Czech Republic](https://data.gov.cz/english/) - Czech Republic Government Open Data - -, ?
- [Open Government, Denmark](https://www.opendata.dk/) - Denmark Government Open Data - -, ?
- [Open Government, Estonia](https://avaandmed.eesti.ee/instructions/opendata-dataset-api) - Estonia Government Open Data - k, ?
- [Open Government, Finland](https://www.avoindata.fi/en) - Finland Government Open Data - -, ?
- [Open Government, France](https://www.data.gouv.fr/) - French Government Open Data - k, ?
- [Open Government, Germany](https://www.govdata.de/daten/-/details/govdata-metadatenkatalog) - Germany Government Open Data - -, ?
- [Open Government, Greece](https://data.gov.gr/) - Greece Government Open Data - o, ?
- [Open Government, India](https://data.gov.in/) - Indian Government Open Data - k, ?
- [Open Government, Indonesia](https://data.go.id/) - Indonesian Government Open Data - -, ?
- [Open Government, Ireland](https://data.gov.ie/pages/developers) - Ireland Government Open Data - -, ?
- [Open Government, Italy](https://www.dati.gov.it/) - Italy Government Open Data - -, ?
- [Open Government, Korea](https://www.data.go.kr/) - Korea Government Open Data - k, ?
- [Open Government, Lithuania](https://data.gov.lt/public/api/1) - Lithuania Government Open Data - -, ?
- [Open Government, Luxembourg](https://data.public.lu) - Luxembourgish Government Open Data - k, ?
- [Open Government, Mexico](https://www.inegi.org.mx/datos/) - Mexican Statistical Government Open Data - -, ?
- [Open Government, Mexico](https://datos.gob.mx/) - Mexico Government Open Data - -, ?
- [Open Government, Netherlands](https://data.overheid.nl/en/ondersteuning/data-publiceren/api) - Netherlands Government Open Data - -, ?
- [Open Government, New South Wales](https://api.nsw.gov.au/) - New South Wales Government Open Data - k, ?
- [Open Government, New Zealand](https://www.data.govt.nz/) - New Zealand Government Open Data - -, ?
- [Open Government, Peru](https://www.datosabiertos.gob.pe/) - Peru Government Open Data - -, ?
- [Open Government, Queensland Government](https://www.data.qld.gov.au/) - Queensland Government Open Data - -, ?
- [Open Government, Romania](http://data.gov.ro/) - Romania Government Open Data - -, ?, no HTTPS
- [Open Government, Saudi Arabia](https://data.gov.sa) - Saudi Arabia Government Open Data - -, ?
- [Open Government, Singapore](https://data.gov.sg/) - Singapore Government Open Data - -, ?
- [Open Government, Slovakia](https://data.gov.sk/en/) - Slovakia Government Open Data - -, ?
- [Open Government, Slovenia](https://podatki.gov.si/) - Slovenia Government Open Data - -, N
- [Open Government, South Australian Government](https://data.sa.gov.au/) - South Australian Government Open Data - -, ?
- [Open Government, Spain](https://datos.gob.es/en) - Spain Government Open Data - -, ?
- [Open Government, Sweden](https://www.dataportal.se/en/dataservice/91_29789/api-for-the-statistical-database) - Sweden Government Open Data - -, ?
- [Open Government, Switzerland](https://handbook.opendata.swiss/de/content/nutzen/api-nutzen.html) - Switzerland Government Open Data - -, ?
- [Open Government, Taiwan](https://data.gov.tw/) - Taiwan Government Open Data - -, ?
- [Open Government, Thailand](https://data.go.th/) - Thailand Government Open Data - k, ?
- [Open Government, UK](https://data.gov.uk/) - UK Government Open Data - -, ?
- [Open Government, USA](https://www.data.gov/) - United States Government Open Data - -, ?
- [Open Government, Victoria State Government](https://www.data.vic.gov.au/) - Victoria State Government Open Data - -, ?
- [Open Government, West Australia](https://data.wa.gov.au/) - West Australia Open Data - -, ?
- [OpenRegistry](https://openregistry.sophymarine.com) - Real-time queries to 80+ national company registries (UK, FR, DE, I... - o, ?
- [OpenStates](https://openstates.org/api/) - US state legislature bills and lawmakers - k, ?
- [Radar CNPJ](https://radar-cnpj.com/api/) - Brazilian companies (CNPJ) lookup and search, with a market check b... - -, N
- [Regulations.gov](https://open.gsa.gov/api/regulationsgov/) - US federal rulemaking comments and dockets - k, ?
- [Represent by Open North](https://represent.opennorth.ca/) - Find Canadian Government Representatives - -, ?
- [SukuuData](https://sukuudata.com/quickstart) - Ghana's schools, 2026 SHS placement register and CSSPS choice valid... - k, Y
- [Travel Risk](https://travelriskapi.com/docs) - Government travel advisories, disaster and conflict alerts and coun... - k, Y
- [UK Companies House](https://developer.company-information.service.gov.uk/) - UK Companies House Data from the UK government - o, ?
- [USAspending.gov](https://api.usaspending.gov/) - US federal spending data - -, ?

### Health (31)

- [CMS.gov](https://data.cms.gov/provider-data/) - Access to the data from the CMS - medicare.gov - k, ?
- [Coronavirus](https://pipedream.com/@pravin/http-api-for-latest-wuhan-coronavirus-data-2019-ncov-p_G6CLVM/readme) - HTTP API for Latest Covid-19 Data - -, ?
- [Coronavirus in the UK](https://coronavirus.data.gov.uk/details/developers-guide) - UK Government coronavirus data, including deaths and cases by region - -, ?
- [Covid Tracking Project](https://covidtracking.com/data/api/version-2) - Covid-19 data for the US - -, N
- [Covid-19 Datenhub](https://npgeo-corona-npgeo-de.hub.arcgis.com) - Maps, datasets, applications and more in the context of COVID-19 - -, ?
- [Covid-19 India](https://data.covid19india.org/) - Covid 19 statistics state and district wise about cases, vaccinatio... - -, ?
- [COVID-19 Tracker Canada](https://api.covid19tracker.ca/docs/1.0/overview) - Details on Covid-19 cases across Canada - -, ?
- [COVID-19 Tracker Sri Lanka](https://www.hpb.health.gov.lk/en/api-documentation) - Provides situation of the COVID-19 patients reported in Sri Lanka - -, ?
- [Cure Cancer With AI](https://www.curecancerwithai.com/developers) - Oncology research, clinical trials, FDA approvals, news, and MAMMAL... - k, N
- [DailyMed](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm) - FDA drug labeling and package insert information - -, ?
- [Dataflow Kit COVID-19](https://covid-19.dataflowkit.com) - COVID-19 live statistics into sites per hour - -, ?
- [Edamam](https://developer.edamam.com/) - Food and nutrition data API with recipe search - k, ?
- [ERstat](https://erstat.ca/developers) - Live Canadian emergency room closures and service disruptions, by p... - k, Y
- [FDA Recalls](https://rapidapi.com/crisp-point-studio-crisp-point-studio-default/api/live-fda-product-food-recalls) - Latest FDA food, drug and product recall notices as JSON with keywo... - k, ?
- [FoodData Central](https://fdc.nal.usda.gov/) - National Nutrient Database for Standard Reference - k, ?
- [Healthcare.gov](https://www.healthcare.gov/developers/) - Educational content about the US Health Insurance Marketplace - -, ?
- [Humanitarian Data Exchange](https://data.humdata.org/) - Humanitarian Data Exchange (HDX) is open platform for sharing data... - -, ?
- [Infermedica](https://developer.infermedica.com/docs/) - NLP based symptom checker and patient triage API for health diagnos... - k, Y
- [Lexigram](https://docs.lexigram.io/) - NLP that extracts mentions of clinical concepts from text, gives ac... - k, ?
- [Makeup](http://makeup-api.herokuapp.com/) - Makeup Information - -, ?, no HTTPS
- [MedlinePlus Genetics](https://medlineplus.gov/about/developers/geneticsdatafilesapi/) - Genetic conditions, genes, chromosomes and mtDNA data - -, ?
- [MyVaccination](https://documenter.getpostman.com/view/16605343/Tzm8GG7u) - Vaccination data for Malaysia - -, ?
- [NHS Health A-Z](https://digital.nhs.uk/developer/api-catalogue/health-a-to-z) - NHS conditions, medicines and guidance - k, ?
- [NPPES](https://npiregistry.cms.hhs.gov/registry/help-api) - National Plan & Provider Enumeration System, info on healthcare pro... - -, ?
- [Nutritionix](https://developer.nutritionix.com/) - Worlds largest verified nutrition database - k, ?
- [Open Data NHS Scotland](https://www.opendata.nhs.scot) - Medical reference data and statistics by Public Health Scotland - -, ?
- [openFDA](https://open.fda.gov) - Public FDA data about drugs, devices and foods - k, ?
- [Orion Health](https://developer.orionhealth.io/) - Medical platform which allows the development of applications for d... - o, ?
- [Stanza DSCSA Verifier](https://stanzaapi.com/tools/pharma-dscsa) - Verify FDA DSCSA and EU FMD pharmaceutical serialization barcodes - k, N
- [Stanza UDI Decoder](https://stanzaapi.com/tools/udi-decoder) - Decode and validate FDA GUDID and EU MDR medical device UDI barcodes - k, N
- [THC Open Mindfulness Resources](https://api.theholisticcare.com/docs) - Free mindfulness resources and research metadata / No - Yes, ?

### Jobs (26)

- [Adzuna](https://developer.adzuna.com/overview) - Job board aggregator - k, ?
- [Allowly Hiring Evidence](https://allowly.ai/docs/solutions/hiring/api/) - Deterministic hiring policy decisions and signed evidence records - k, N
- [Arbeitsamt](https://jobsuche.api.bund.dev/) - API for the "Arbeitsamt", which is a german Job board aggregator - o, ?
- [Careerjet](https://www.careerjet.com/partners/api/) - Job search engine - k, ?, no HTTPS
- [Dabloons](https://dabloons.net/llms.txt) - Bounty board where AI agents post and work tasks like PR reviews, b... - k, N
- [Findwork](https://findwork.dev/developers/) - Job board - k, ?
- [freehire](https://freehire.dev/docs/api) - Open-source search engine aggregating tech jobs from company ATS bo... - -, N
- [HeroHunt People Search](https://www.herohunt.ai/people-search-api) - Search 1 billion people profiles across LinkedIn and GitHub for tal... - k, Y
- [HireLayer](https://hirelayer.co/api-docs) - Parse resumes and job descriptions, normalize skills, match and ran... - k, Y
- [JobDataLake](https://www.jobdatalake.com/docs) - 1M+ enriched job listings from 20,000+ companies with salary, skill... - k, Y
- [Jobs2Careers](https://docs.talroo.com/api/search) - Job aggregator - k, ?
- [JobsPipe](https://docs.jobspipe.dev) - Live job postings from 30+ ATS feeds and job boards in one normaliz... - k, Y
- [Jobven](https://jobven.com/docs/getting-started) - Job postings tracked as roles open and close, with webhooks on chan... - k, Y
- [Jooble](https://jooble.org/api/about) - Job search engine - k, ?
- [Juju](http://www.juju.com/publisher/spec/) - Job search engine - k, ?, no HTTPS
- [Open Skills](https://github.com/workforce-data-initiative/skills-api/wiki/API-Overview) - Job titles, skills and related jobs data - -, ?, no HTTPS
- [RankFabrik Jobs](https://rankfabrik.com/produits/emplois) - Aggregated job postings search, deduplicated on identifier, with co... - k, ?
- [Reed](https://www.reed.co.uk/developers) - Job board aggregator - k, ?
- [Techmap](https://api.techmap.io/jobs-api) - Job postings from 185 sources in 250 countries and territories, wit... - k, Y
- [The Muse](https://www.themuse.com/developers/api/v2) - Job board and company profiles - k, ?
- [Upwork](https://developers.upwork.com/) - Freelance job board and management system - o, ?
- [USAJOBS](https://developer.usajobs.gov/) - US government job board - k, ?
- [Vibeworker](https://tryvibeworker.com/docs) - Upwork job listings with client data and AI fit scores, plus webhoo... - k, N
- [WhatJobs](https://www.whatjobs.com/affiliates) - Job search engine - k, ?
- [Worklittle](https://docs.worklittle.com) - Job search, over 4 million jobs - k, Y
- [ZipRecruiter](https://www.ziprecruiter.com/publishers) - Job search app and website - k, ?

### Machine Learning (44)

- [AI For Thai](https://aiforthai.in.th/index.php) - Free Various Thai AI API - k, Y
- [AnswerLine](https://answerline.dev/docs) - ChatGPT, Gemini, Copilot, AI Mode and Google Search/News results as... - k, ?
- [Audexum](https://audexum.com/docs) - Speech-to-text in 25 languages and text-to-speech with 43 voices in... - k, Y
- [BRAINIALL](https://github.com/fasuizu-br/brainiall-transcription-skill) - PT-BR and Spanish audio transcription with diarization and SRT/VTT - k, Y
- [Clarifai](https://docs.clarifai.com/api-guide/api-overview) - Computer Vision - o, ?
- [Cloudmersive](https://www.cloudmersive.com/image-recognition-and-processing-api) - Image captioning, face recognition, NSFW classification - k, Y
- [Cohere](https://docs.cohere.com/reference/about) - NLP API for text generation, embeddings, classification and summari... - k, Y
- [DeepAI](https://deepai.org/) - Provides AI-powered APIs for text generation, image processing, and... - k, Y
- [Deepcode](https://www.deepcode.ai) - AI for code review - -, ?
- [Dialogflow](https://cloud.google.com/dialogflow/docs/) - Natural Language Processing - k, ?
- [GEN](https://gen.pro/docs#ai-agents) - Creative AI video engineer for ads, AI UGC and microdramas; free ed... - k, Y
- [GoldBean](https://goldbean-api.xyz/docs) - OCR, Translation, NLP & ERNIE LLM via Baidu AI (free tier available) - k, ?
- [Google Gemini](https://ai.google.dev/gemini-api/docs) - Multimodal generative AI for text, vision, and code generation - k, ?
- [Groq](https://console.groq.com/docs/quickstart) - Fast AI inference API with free tier, supports Llama, Mixtral, Gemm... - k, Y
- [Hirak FaceAPI](https://faceapi.hirak.site/) - Face detection, face recognition with age estimation/gender estimat... - k, ?
- [Hugging Face](https://huggingface.co) - AI model hub with inference API for NLP, computer vision, and audio - k, Y
- [Imagga](https://imagga.com/) - Image Recognition Solutions like Tagging, Visual Search, NSFW moder... - k, ?
- [Inferdo](https://rapidapi.com/user/inferdo) - Computer Vision services like Facial detection, Image labeling, NSF... - k, ?
- [Irisnet](https://irisnet.de/api/) - Realtime content moderation API that blocks or blurs unwanted image... - k, Y
- [Jina AI](https://jina.ai) - Free AI API for embeddings, reranking, and text processing - k, Y
- [Keen IO](https://keen.io/) - Data Analytics - k, ?
- [Lacuna](https://lacuna.mergeinc.workers.dev/agents.md) - Public board where AI agents post problems as seeks and agents who... - -, ?
- [Laya Decision Gateway](https://laya.harshad.eu.org) - Sub-35ms AI gateway for prompt injection defense, support ticket tr... - k, Y
- [Machinetutors](https://machinetutors.com/api) - AI Solutions: Video/Image Classification & Tagging, NSFW, Icon/Imag... - k, Y
- [MediaCraft AI](https://mediacraft-x402-api.onrender.com) - Chinese content compliance review (17 platforms), EN↔CN translation... - k, Y
- [MessengerX.io](https://messengerx.rtfd.io) - A FREE API for developers to build and monetize personalized ML bas... - k, Y
- [Mistral AI](https://docs.mistral.ai/api/) - High-performance LLM API by Mistral AI including Mistral and Mixtra... - k, Y
- [NLP Cloud](https://nlpcloud.io) - NLP API using spaCy and transformers for NER, sentiments, classific... - k, ?
- [onomeo](https://onomeo.com/docs) - OpenAI-compatible, about 30 free LLMs, 30 calls per 5 hours, option... - k, N
- [OpenRouter](https://openrouter.ai/docs/quick-start) - Unified API for 300+ LLMs from OpenAI, Anthropic, Meta, Mistral and... - k, Y
- [Perspective](https://perspectiveapi.com) - NLP API to return probability that if text is toxic, obscene, insul... - k, ?
- [Replicate](https://replicate.com/docs/reference/http) - Run open-source AI models in the cloud including image generation,... - k, Y
- [Requesty](https://docs.requesty.ai) - OpenAI compatible LLM router for 600+ models, with a free tier for... - k, Y
- [Roboflow Universe](https://universe.roboflow.com) - Pre-trained computer vision models - k, Y
- [SafeReel](https://safereel.ai/docs) - NSFW detection for images and full-length videos by URL, free tier - k, Y
- [SkyBiometry](https://skybiometry.com/documentation/) - Face Detection, Face Recognition and Face Grouping - k, ?
- [Speak AI](https://docs.speakai.co) - Transcribe and analyze audio and video in 100+ languages - k, ?
- [Tanvo](https://tanvo.ai/developers/api) - Image, video and song generation on 30 AI models (Nano Banana, Klin... - k, Y
- [Time Door](https://timedoor.io) - A time series analysis API - k, Y
- [Together AI](https://docs.together.ai/docs/quickstart) - Fast inference API for open-source LLMs including Llama, Qwen, Deep... - k, Y
- [TokenRoute](https://tokenroute.app/docs/quickstart) - One OpenAI-compatible endpoint for hundreds of LLMs, with a free ti... - k, Y
- [Unplugg](https://unplu.gg/test_api.html) - Forecasting API for timeseries data - k, ?
- [Voxell Forge](https://voxell.ai/docs/#forge) - OpenAI-compatible text embeddings API, free-forever model with no c... - k, N
- [WolframAlpha](https://products.wolframalpha.com/api/) - Provides specific answers to questions using data and algorithms - k, ?

### Music (35)

- [7digital](https://docs.7digital.com/reference) - Api of Music store 7digital - o, ?
- [AI Mastering](https://aimastering.com/api_docs/) - Automated Music Mastering - k, Y
- [Audiomack](https://www.audiomack.com/data-api/docs) - Api of the streaming music hub Audiomack - o, ?
- [Bandcamp](https://bandcamp.com/developer) - API of Music store Bandcamp - o, ?
- [Bandsintown](https://app.swaggerhub.com/apis/Bandsintown/PublicAPI/3.0.0) - Music Events - -, ?
- [Deezer](https://developers.deezer.com/api) - Music - o, ?
- [Discogs](https://www.discogs.com/developers/) - Music - o, ?
- [Freesound](https://freesound.org/docs/api/) - Music Samples - k, ?
- [Gaana](https://github.com/cyberboysumanjay/GaanaAPI) - API to retrieve song information from Gaana - -, ?
- [Genius](https://docs.genius.com/) - Crowdsourced lyrics and music knowledge - o, ?
- [Genrenator](https://binaryjazz.us/genrenator-api/) - Music genre generator - -, ?
- [iTunes Search](https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/) - Software products - -, ?
- [Jamendo](https://developer.jamendo.com/v3.0/docs) - Music - o, ?
- [JioSaavn](https://github.com/cyberboysumanjay/JioSaavnAPI) - API to retrieve song information, album meta data and many more fro... - -, ?
- [KKBOX](https://developer.kkbox.com) - Get music libraries, playlists, charts, and perform out of KKBOX's... - o, ?
- [KSoft.Si Lyrics](https://docs.ksoft.si/api/lyrics-api) - API to get lyrics for songs - k, ?
- [LastFm](https://www.last.fm/api) - Music - k, ?
- [Lyrics.ovh](https://lyricsovh.docs.apiary.io) - Simple API to retrieve the lyrics of a song - -, ?
- [Mixcloud](https://www.mixcloud.com/developers/) - Music - o, Y
- [MusicBrainz](https://musicbrainz.org/doc/Development/XML_Web_Service/Version_2) - Music - -, ?
- [Musixmatch](https://developer.musixmatch.com/) - Music - k, ?
- [Napster](https://developer.napster.com/api/v2.2) - Music - k, Y
- [Openwhyd](https://openwhyd.github.io/openwhyd/API) - Download curated playlists of streaming tracks (YouTube, SoundCloud... - -, N
- [Phishin](https://phish.in/api-docs) - A web-based archive of legal live audio recordings of the improvisa... - k, N
- [Songkick](https://www.songkick.com/developer/) - Music Events - k, ?
- [Songlink / Odesli](https://www.notion.so/API-d0ebe08a5e304a55928405eb682f6741) - Get all the services on which a song is available - k, Y
- [Songsterr](https://www.songsterr.com/) - Provides guitar, bass and drums tabs and chords - -, ?
- [SoundCloud](https://developers.soundcloud.com/docs/api/guide) - With SoundCloud API you can build applications that will give more... - o, ?
- [Spotify](https://beta.developer.spotify.com/documentation/web-api/) - View Spotify music catalog, manage users' libraries, get recommenda... - o, ?
- [StemConsole](https://stemconsole.ai/developers/) - Split songs into vocals, drums, bass and other stems with AI - k, Y
- [Sunor](https://docs.sunor.cc) - AI music generation API via Suno, with pay-as-you-go credits - k, ?
- [TasteDive](https://tastedive.com/read/api) - Similar artist API (also works for movies and TV shows) - k, ?
- [TheAudioDB](https://www.theaudiodb.com/) - Music - k, ?
- [Vagalume](https://api.vagalume.com.br/docs/) - Crowdsourced lyrics and music knowledge - k, ?
- [Verome](https://github.com/Kirazul/Verome-API) - Music API for searching, streaming and exploring music data from Yo... - -, ?

### News (22)

- [Associated Press](https://developer.ap.org/) - Search for news and metadata from Associated Press - k, ?
- [Chronicling America](http://chroniclingamerica.loc.gov/about/api/) - Provides access to millions of pages of historic US newspapers from... - -, ?, no HTTPS
- [Currents](https://currentsapi.services/) - Real-time and historical global news with multilingual support - k, Y
- [daily.dev](https://docs.daily.dev/public-api/) - Developer news feeds, posts, bookmarks, tags and search from daily.dev - k, N
- [DataCube AI](https://www.datacubeai.space/en/tools/ai-news-api) - Daily curated AI industry news, funding rounds and trends in 8 lang... - -, N
- [Feedbin](https://github.com/feedbin/feedbin-api) - RSS reader - o, ?
- [GNews](https://gnews.io/) - Search for news from various sources - k, Y
- [Inshorts News](https://github.com/cyberboysumanjay/Inshorts-News-API) - Provides news from inshorts - -, ?
- [MarketAux](https://www.marketaux.com/) - Live stock market news with tagged tickers + sentiment and stats JS... - k, Y
- [Mediastack](https://mediastack.com) - Free, Simple REST API for Live News & Blog Articles - k, ?
- [New York Times](https://developer.nytimes.com/) - The New York Times Developer Network - k, ?
- [News](https://newsapi.org/) - Headlines currently published on a range of news sources and blogs - k, ?
- [NewsData](https://newsdata.io/docs) - News data API for live-breaking news and headlines from reputed new... - k, ?
- [Newsflash](https://newsflash.sh/docs) - Deduplicated news events from 260+ sources with corroboration/confi... - k, N
- [NewsMesh](https://newsmesh.co/docs) - Premium news data from thousands of sources - k, N
- [NewsX](https://rapidapi.com/machaao-inc-machaao-inc-default/api/newsx/) - Get or Search Latest Breaking News with ML Powered Summaries 🤖 - k, ?
- [NPR One](http://dev.npr.org/api/) - Personalized news listening experience from NPR - o, ?
- [Scoopkit](https://scoopkit.dev) - AI-industry news deduplicated into structured events with a version... - k, Y
- [The Guardian](http://open-platform.theguardian.com/) - Access all the content the Guardian creates, categorised by tags an... - k, ?
- [The Old Reader](https://github.com/theoldreader/api) - RSS reader - k, ?
- [TheNews](https://www.thenewsapi.com/) - Aggregated headlines, top story and live news JSON API - k, Y
- [Trove](https://trove.nla.gov.au/about/create-something/using-api) - Search through the National Library of Australia collection of 1000... - k, ?

### Open Data (43)

- [AcreLens](https://www.acrelens.com) - Land suitability scoring API for any US property: off-grid, rural,... - k, ?
- [APIllow](https://apillow.co/docs.html) - Zillow property data: 50+ fields per listing by address, URL, ZPID... - k, Y
- [Archive.org](https://archive.readme.io/docs) - The Internet Archive - -, N
- [Black History Facts](https://www.blackhistoryapi.io/docs) - Contribute or search one of the largest black history fact database... - k, Y
- [BotsArchive](https://botsarchive.com/docs.html) - JSON formatted details about Telegram Bots available in database - -, ?
- [Callook.info](https://callook.info) - United States ham radio callsigns - -, ?
- [CARTO](https://carto.com/) - Location Information Prediction - k, ?
- [CityAlert](https://cityalert.live/developers) - Live public-safety incidents: crime, fire, disaster, weather and ne... - -, N
- [CollegeScoreCard.ed.gov](https://collegescorecard.ed.gov/data/) - Data on higher education institutions in the United States - -, ?
- [CoworkingView](https://coworkingview.com/en/api) - Coworking spaces and offices in 63 European and Gulf cities with op... - -, N
- [DevLifeCheck](https://devlifecheck.com/developers) - Security-update end dates, recalls and evidence for 1,300+ phones,... - -, N
- [Enigma Public](https://developers.enigma.com/docs) - Broadest collection of public data - k, Y
- [French Address Search](https://geo.api.gouv.fr/adresse) - Address search via the French Government - -, ?
- [GENESIS](https://www.destatis.de/EN/Service/OpenData/api-webservice.html) - Federal Statistical Office Germany - o, ?
- [InfraNode](https://infranode.dev) - Unified German city open data: weather, air quality, EV chargers, t... - k, ?
- [Joshua Project](https://api.joshuaproject.net/) - People groups of the world with the fewest followers of Christ - k, ?
- [K-Data Gate](https://kdata-gate.vercel.app/docs) - Korean market data: K-beauty/K-food products, Naver trends, stocks,... - k, ?
- [Kaggle](https://www.kaggle.com/docs/api) - Create and interact with Datasets, Notebooks, and connect with Kaggle - k, ?
- [LinkPreview](https://www.linkpreview.net) - Get JSON formatted summary with title, description and preview imag... - k, Y
- [Lowy Asia Power Index](https://github.com/0x0is1/lowy-index-api-docs) - Get measure resources and influence to rank the relative power of s... - -, ?
- [Microburbs](https://www.microburbs.com.au/developers/api-docs) - Australian property and suburb data: valuations, sales, rents, scho... - k, N
- [Monitly](https://monit.ly/api-docs) - Official statistics from Eurostat, World Bank, OECD, IMF and WHO fo... - k, Y
- [Nasdaq Data Link](https://data.nasdaq.com/) - Stock market data - k, ?
- [Onyx Bazaar](https://onyx-actions.onrender.com/bazaar) - Free public leaderboard of x402 paid HTTP services indexed from Coi... - -, ?
- [Open Data Minneapolis](https://opendata.minneapolismn.gov/) - Spatial (GIS) and non-spatial city data for Minneapolis - -, N
- [openAFRICA](https://africaopendata.org/) - Large datasets repository of African open data - -, ?
- [OpenCorporates](http://api.opencorporates.com/documentation/API-Reference) - Data on corporate entities and directors in many countries - k, ?
- [Pan Africa Data](https://panafricadata.com) - Macroeconomic and subnational income distribution data for all 54 A... - k, ?
- [PeakMetrics](https://rapidapi.com/peakmetrics-peakmetrics-default/api/peakmetrics-news) - News articles and public datasets - k, ?
- [Recreation Information Database](https://ridb.recreation.gov/) - Recreational areas, federal lands, historic sites, museums, and oth... - k, ?
- [Registrum](https://api.registrum.co.uk/docs) - UK company data: profiles, directors, PSC, iXBRL-parsed financials,... - k, N
- [Scoop.it](http://www.scoop.it/dev) - Content Curation Service - k, ?, no HTTPS
- [Socrata](https://dev.socrata.com/) - Access to Open Data from Governments, Non-profits and NGOs around t... - o, Y
- [Teleport](https://developers.teleport.org/) - Quality of Life Data - -, ?
- [TerraScoutX](https://terrascoutx.com/developers/) - US property records by address: parcel, owner, appraised value, tax... - k, Y
- [Universities List](https://github.com/Hipo/university-domains-list) - University names, countries and domains - -, ?
- [University of Oslo](https://data.uio.no/) - Courses, lecture videos, detailed information for courses etc. for... - -, ?
- [UPC database](https://upcdatabase.org/api) - More than 1.5 million barcode numbers from all around the world - k, ?
- [Urban Observatory](https://urbanobservatory.ac.uk) - The largest set of publicly available real time urban data in the UK - -, N, no HTTPS
- [Voidly](https://voidly.ai/api-docs) - Internet censorship measurements, incidents, and ISP-level blocking... - -, N
- [Wikidata](https://www.wikidata.org/w/api.php?action=help) - Collaboratively edited knowledge base operated by the Wikimedia Fou... - o, ?
- [Wikipedia](https://www.mediawiki.org/wiki/API:Main_page) - Mediawiki Encyclopedia - -, ?
- [Yelp](https://www.yelp.com/developers/documentation/v3) - Find Local Business - o, ?

### Open Source Projects (6)

- [Countly](https://api.count.ly/) - Countly web analytics - -, ?, no HTTPS
- [Creative Commons Catalog](https://api.creativecommons.engineering/) - Search among openly licensed and public domain works - o, Y
- [Datamuse](https://www.datamuse.com/api/) - Word-finding query engine - -, ?
- [Drupal.org](https://www.drupal.org/drupalorg/docs/api) - Drupal.org - -, ?
- [Libraries.io](https://libraries.io/api) - Metadata, dependencies and release history for open-source packages... - k, Y
- [Shields](https://shields.io/) - Concise, consistent, and legible badges in SVG and raster format - -, ?

### Patent (4)

- [EPO](https://developers.epo.org/) - European patent search system api - o, ?
- [PatentsView](https://patentsview.org/apis/purpose) - API is intended to explore and visualize trends/patterns across the... - -, ?
- [TIPO](https://tiponet.tipo.gov.tw/Gazette/OpenData/OD/OD05.aspx?QryDS=API00) - Taiwan patent search system api - k, ?
- [USPTO](https://www.uspto.gov/learning-and-resources/open-data-and-mobility) - USA patent api services - -, ?

### Personality (19)

- [Advice Slip](http://api.adviceslip.com/) - Generate random advice slips - -, ?
- [AstroWay](https://api.astroway.info/docs/) - Astrology, natal charts, Human Design, Vedic and horoscopes on the... - k, Y
- [Biriyani As A Service](https://biriyani.anoram.com/) - Biriyani images placeholder - -, N
- [Dev.to](https://developers.forem.com/api) - Access Forem articles, users and other resources via API - k, ?
- [Dictum](https://github.com/fisenkodv/dictum) - API to get access to the collection of the most inspiring expressio... - -, ?
- [FavQs.com](https://favqs.com/api) - FavQs allows you to collect, discover and share your favorite quotes - k, ?
- [FOAAS](http://www.foaas.com/) - Fuck Off As A Service - -, ?, no HTTPS
- [Forismatic](http://forismatic.com/en/api/) - Inspirational Quotes - -, ?, no HTTPS
- [icanhazdadjoke](https://icanhazdadjoke.com/api) - The largest selection of dad jokes on the internet - -, ?
- [Medium](https://github.com/Medium/medium-api-docs) - Community of readers and writers offering unique perspectives on ideas - o, ?
- [Programming Quotes](https://github.com/skolakoda/programming-quotes-api) - Programming Quotes API for open source projects - -, ?
- [Quotable Quotes](https://github.com/lukePeavey/quotable) - Quotable is a free, open source quotations API - -, ?
- [Quote Garden](https://pprathameshmore.github.io/QuoteGarden/) - REST API for more than 5000 famous quotes - -, ?
- [Quotes on Design](https://quotesondesign.com/api/) - Inspirational Quotes - -, ?
- [Stoicism Quote](https://github.com/tlcheah2/stoic-quote-lambda-public-api) - Quotes about Stoicism - -, ?
- [They Said So Quotes](https://theysaidso.com/api/) - Quotes Trusted by many fortune brands around the world - -, ?
- [Traitify](https://app.traitify.com/developer) - Assess, collect and analyze Personality - -, ?
- [Udemy(instructor)](https://www.udemy.com/developers/instructor/) - API for instructors on Udemy - k, ?
- [Vadivelu HTTP Codes](https://vadivelu.anoram.com/) - On demand HTTP Codes with images - -, N

### Phone (7)

- [Cloudmersive Validate](https://cloudmersive.com/phone-number-validation-API) - Validate international phone numbers - k, Y
- [Numlookup](https://numlookupapi.com) - Phone number validation and carrier lookup API with global coverage - k, ?
- [Numverify](https://numverify.com) - Phone number validation - k, ?
- [Phone Validation](https://www.abstractapi.com/phone-validation-api) - Validate phone numbers globally - k, Y
- [PlaceCall](https://api.voygr.tech/docs) - AI agent places phone calls to US businesses and returns the outcom... - k, N
- [Veriphone](https://veriphone.io) - Phone number validation & carrier lookup - k, Y
- [VeriRoute Intel](https://verirouteintel.com) - CNAM caller ID, carrier/LRN lookup and spam scoring for North Ameri... - k, ?

### Photography (38)

- [APITemplate.io](https://apitemplate.io) - Dynamically generate images and PDFs from templates with a simple API - k, Y
- [CheetahO](https://cheetaho.com/docs/getting-started/) - Photo optimization and resize - k, ?
- [CompressGIF](https://compressgif.net/docs) - Compress GIF files or HTTPS URLs with asynchronous jobs and target-... - k, ?
- [Compresso](https://compresso.space/developers) - Visually lossless image compression for PNG, JPEG and WebP - k, N
- [Dagpi](https://dagpi.xyz) - Image manipulation and processing - k, ?
- [Duply](https://duply.co/docs#getting-started-api) - Generate, Edit, Scale and Manage Images and Videos Smarter & Faster - k, Y
- [DynaPictures](https://dynapictures.com/docs/) - Generate Hundreds of Personalized Images in Minutes - k, Y
- [Flickr](https://www.flickr.com/services/api/) - Flickr Services - o, ?
- [Getty Images](http://developers.gettyimages.com/en/) - Build applications using the world's most powerful imagery - o, ?
- [Gfycat](https://developers.gfycat.com/api/) - Jiffier GIFs - o, ?
- [Giphy](https://developers.giphy.com/docs/) - Get all your gifs - k, ?
- [Google Photos](https://developers.google.com/photos) - Integrate Google Photos with your apps or devices - o, ?
- [Image Upload](https://apilayer.com/marketplace/image_upload-api) - Image Optimization - k, ?
- [Imgur](https://apidocs.imgur.com/) - Images - o, ?
- [Imsea](https://imsea.herokuapp.com/) - Free image search - -, ?
- [Kavel](https://kavel.readthedocs.io/) - Generate and edit images with AI, no key or account required - -, N
- [Lightdrift](https://docs.lightdrift.ai) - Search 1.85M openly licensed images by text or image, with license... - k, N
- [localscreenshot](https://localscreenshot.com) - Screenshot or PDF rendering of any public page, from 227 countries - k, Y
- [Lorem Picsum](https://picsum.photos/) - Images from Unsplash - -, ?
- [NexWall](https://nexwall.kodnextech.com/wallpaper-api/docs) - Curated 4K portrait phone wallpapers across 50+ categories - k, Y
- [ObjectCut](https://objectcut.com/) - Image Background removal - k, Y
- [Pexafy](https://docs.pexafy.com) - Semantic image search across 9+ free stock photo sources with a uni... - k, Y
- [Pexels](https://www.pexels.com/api/) - Free Stock Photos and Videos - k, Y
- [PhotoRoom](https://www.photoroom.com/api/) - Remove background from images - k, ?
- [Pixabay](https://pixabay.com/sk/service/about/api/) - Photography - k, ?
- [PlaceKeanu](https://placekeanu.com/) - Resizable Keanu Reeves placeholder images with grayscale and young... - -, ?
- [Readme typing SVG](https://github.com/DenverCoder1/readme-typing-svg) - Customizable typing and deleting text SVG - -, ?
- [Remove.bg](https://www.remove.bg/api) - Image Background removal - k, ?
- [ReSmush.it](https://resmush.it/api) - Photo optimization - -, ?, no HTTPS
- [Screenshot Studio](https://www.screenshot-studio.com/docs) - Capture web pages as images through a public HTTP API - -, N
- [Screenshotlayer](https://screenshotlayer.com) - URL to screenshot - -, ?
- [shutterstock](https://api-reference.shutterstock.com/) - Stock Photos and Videos - o, ?
- [Sirv](https://apidocs.sirv.com/) - Image management solutions like optimization, manipulation, hosting - k, ?
- [snapWONDERS](https://snapwonders.com/developers) - Photo and video forensic analysis, steganography and media format c... - k, Y
- [Tinify.dev](https://tinify.dev/developers) - Image compression, resize and crop API with usage metadata - k, N
- [Unsplash](https://unsplash.com/developers) - Photography - o, ?
- [Wallhaven](https://wallhaven.cc/help/api) - Wallpapers - k, ?
- [Webdam](https://www.damsuccess.com/hc/en-us/articles/202134055-REST-API) - Images - o, ?

### Programming (5)

- [Codeforces](https://codeforces.com/apiHelp) - Get access to Codeforces data - k, ?
- [Hackerearth](https://www.hackerearth.com/docs/wiki/developers/v4/) - For compiling and running code in several languages - k, ?
- [Judge0 CE](https://ce.judge0.com/) - Online code execution system - k, ?
- [KONTESTS](https://kontests.net/api) - For upcoming and ongoing competitive coding contests - -, ?
- [Mintlify](https://docs.mintlify.com) - For programmatically generating documentation for code - k, Y

### Science & Math (37)

- [arcsecond.io](https://api.arcsecond.io/) - Multiple astronomy data sources - -, ?
- [arXiv](https://info.arxiv.org/help/api/user-manual.html) - Curated research-sharing platform: physics, mathematics, quantitati... - -, ?
- [CodeCogs](https://editor.codecogs.com/docs/4-LaTeX_rendering.php) - Render LaTeX equations in PNG, GIF, SVG, EMF, PDF, JSON, or downloa... - -, ?
- [CORE](https://core.ac.uk/services#api) - Access the world's Open Access research papers - k, ?
- [iDigBio](https://github.com/idigbio/idigbio-search-api/wiki) - Access millions of museum specimens from organizations around the w... - -, ?
- [inspirehep.net](https://github.com/inspirehep/rest-api-doc) - High Energy Physics info. system - -, ?
- [isEven (humor)](https://isevenapi.xyz/) - Check if a number is even - -, ?
- [ISRO](https://isro.vercel.app) - ISRO Space Crafts Information - -, N
- [ITIS](https://www.itis.gov/ws_description.html) - Integrated Taxonomic Information System - -, ?
- [KEGG](https://www.kegg.jp/kegg/rest/keggapi.html) - Genes, pathways, compounds and reactions - -, ?
- [Materials Platform for Data Science](https://mpds.io) - Curated experimental data for materials science - k, N
- [Minor Planet Center](http://www.asterank.com/mpc) - Asterank.com Information - -, ?, no HTTPS
- [NASA](https://api.nasa.gov) - NASA data, including imagery - -, N
- [NASA ADS](https://ui.adsabs.harvard.edu/help/api/api-docs.html) - NASA Astrophysics Data System - o, Y
- [NASA InSight](https://api.nasa.gov/) - Mars weather data from InSight lander - k, Y
- [Newton](https://newton.vercel.app) - Symbolic and Arithmetic Math Calculator - -, N
- [Noctua](https://api.noctuasky.com/api/v1/swaggerdoc/) - REST API used to access NoctuaSky features - -, ?
- [Numbers](https://math.tools/api/numbers/) - Number of the day, random number, number facts and anything else yo... - k, N
- [Ocean Facts](https://oceanfacts.herokuapp.com/) - Facts pertaining to the physical science of Oceanography - -, ?
- [Open Ephemeris](https://openephemeris.com/docs) - Sub-arcsecond planetary positions, natal charts, transits, and Huma... - k, N
- [Open Notify](http://open-notify.org/Open-Notify-API/) - ISS astronauts, current location, etc - -, N, no HTTPS
- [Open Science Framework](https://developer.osf.io) - Repository and archive for study designs, research materials, data,... - -, ?
- [OrbitalWiki](https://orbitalwiki.com/developers) - Catalog of 16,000+ satellites merging CelesTrak, GCAT, Wikidata; fr... - k, Y
- [Purple Air](https://www2.purpleair.com/) - Real Time Air Quality Monitoring - -, ?
- [SatNOGS](https://docs.satnogs.org/projects/satnogs-network/en/stable/api.html) - Satellite observations from open ground stations - -, ?
- [Semantic Scholar](https://api.semanticscholar.org/) - Academic search engine for papers, authors, and citations - -, ?
- [SHARE](https://share.osf.io/api/v2/) - A free, open, dataset about research and scholarly activities - -, N
- [SpaceX](https://github.com/r-spacex/SpaceX-API) - Company, vehicle, launchpad and launch data - -, N
- [SpaceX](https://api.spacex.land/graphql/) - GraphQL, Company, Ships, launchpad and launch data - -, ?
- [Sunrise and Sunset](https://sunrise-sunset.org/api) - Sunset and sunrise times for a given latitude and longitude - -, N
- [Times Adder](https://github.com/FranP-code/API-Times-Adder) - With this API you can add each of the times introduced in the array... - -, N
- [TLE](https://tle.ivanstanojevic.me/#/docs) - Satellite information - -, N
- [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/fdsnws/event/1/) - Earthquakes data real-time - -, N
- [USGS Water Services](https://waterservices.usgs.gov/) - Water quality and level info for rivers and lakes - -, N
- [VedIntel™ AstroAPI](https://vedintelastroapi.com/docs) - Vedic astrology computation — birth charts, dashas, panchang, AI na... - k, Y
- [World Bank](https://datahelpdesk.worldbank.org/knowledgebase/topics/125589) - World Data - -, N
- [WoRMS](https://www.marinespecies.org/rest/) - Marine species taxonomy, synonyms and distributions - -, N

### Security (50)

- [Agent Verifier](https://packet.guru/agents/reference) - Self-check for AI agents: verifies Web Bot Auth signatures and show... - -, N
- [Application Environment Verification](https://github.com/fingerprintjs/aev) - Android library and API to verify the safety of user devices, detec... - k, Y
- [BinaryEdge](https://docs.binaryedge.io/api-v2.html) - Provide access to BinaryEdge 40fy scanning platform - k, Y
- [BitWarden](https://bitwarden.com/help/api/) - Best open-source password manager - o, ?
- [Botd](https://github.com/fingerprintjs/botd) - Botd is a browser library for JavaScript bot detection - k, Y
- [Bugcrowd](https://docs.bugcrowd.com/api/getting-started/) - Bugcrowd API for interacting and tracking the reported issues progr... - k, ?
- [Censys](https://search.censys.io/api) - Search engine for Internet connected host and devices - k, N
- [CISA Known Exploited Vulnerabilities](https://rapidapi.com/crisp-point-studio-crisp-point-studio-default/api/live-cisa-cybersecurity-vulnerabilities-kev) - CISA KEV catalog of actively exploited CVEs as JSON, filterable by... - k, ?
- [Complete Criminal Checks](https://completecriminalchecks.com/Developers) - Provides data of offenders from all U.S. States and Pureto Rico - k, Y
- [CompliAPI](https://docs.compliapi.com) - Screen crypto addresses, emails, websites, IDs and countries agains... - k, Y
- [CRXcavator](https://crxcavator.io/apidocs) - Chrome extension risk scoring - k, ?
- [Dehash.lt](https://github.com/Dehash-lt/api) - Hash decryption MD5, SHA1, SHA3, SHA256, SHA384, SHA512 - -, ?
- [Domain Intelligence](https://oti-labs.com/domain-intelligence-api) - DNS, WHOIS/RDAP, SSL, subdomain enumeration, and email security in... - k, N
- [EmailRep](https://docs.emailrep.io/) - Email address threat and risk prediction - -, ?
- [Escape](https://github.com/polarspetroll/EscapeAPI) - An API for escaping different kind of queries - -, N
- [FilterLists](https://filterlists.com) - Lists of filters for adblockers and firewalls - -, ?
- [FingerprintJS Pro](https://dev.fingerprintjs.com/docs) - Fraud detection API offering highly accurate browser fingerprinting - k, Y
- [FOFA](https://en.fofa.info/api) - Search engine for Internet connected assets and devices - k, ?
- [FraudLabs Pro](https://www.fraudlabspro.com/developer/api/screen-order) - Screen order information using AI to detect frauds - k, ?
- [FullHunt](https://api-docs.fullhunt.io/#introduction) - Searchable attack surface database of the entire internet - k, ?
- [GitGuardian](https://api.gitguardian.com/doc) - Scan files for secrets (API Keys, database credentials) - k, N
- [GreyNoise](https://docs.greynoise.io/reference/getcommunityip) - Query IPs in the GreyNoise dataset and retrieve a subset of the ful... - k, ?
- [HackerOne](https://api.hackerone.com/) - The industry’s first hacker API that helps increase productivity to... - k, ?
- [HaveIBeenPwned](https://haveibeenpwned.com/API/v3) - Passwords which have previously been exposed in data breaches - k, ?
- [Hybrid Analysis](https://www.hybrid-analysis.com/docs/api/v2) - File and URL malware analysis powered by Falcon Sandbox - k, ?
- [Intelligence X](https://github.com/IntelligenceX/SDK/blob/master/Intelligence%20X%20API.pdf) - Perform OSINT via Intelligence X - k, ?
- [IPScanner](https://ipscanner.io/api-documentation) - IP network class (residential, mobile, hosting, VPN, residential pr... - k, Y
- [isMalicious](https://ismalicious.com/api-docs) - Reputation of IPs, domains, URLs and file hashes from aggregated th... - k, N
- [LoginRadius](https://www.loginradius.com/docs/) - Managed User Authentication Service - k, Y
- [Maskbreak](https://maskbreak.com/api) - Detect VPNs, proxies, Tor, bots and antidetect browsers at signup,... - k, Y
- [Microsoft Security Response Center (MSRC)](https://msrc.microsoft.com/report/developer) - Programmatic interfaces to engage with the Microsoft Security Respo... - -, ?
- [Mozilla http scanner](https://github.com/mozilla/http-observatory/blob/master/httpobs/docs/api.md) - Mozilla observatory http scanner - -, ?
- [Mozilla tls scanner](https://github.com/mozilla/tls-observatory#api-endpoints) - Mozilla observatory tls scanner - -, ?
- [National Vulnerability Database](https://nvd.nist.gov/vuln/Data-Feeds/JSON-feed-changelog) - U.S. National Vulnerability Database - -, ?
- [Neetix Liveliness](https://liveliness.neetix.in/api-reference) - Face liveness, presentation-attack detection and 1:1 face match for... - k, N
- [PhishStats](https://phishstats.info/) - Phishing database - -, ?
- [Privacy.com](https://privacy.com/developer/docs) - Generate merchant-specific and one-time use credit card numbers tha... - k, ?
- [Pulsedive](https://pulsedive.com/api/) - Scan, search and collect threat intelligence data in real-time - k, ?
- [Sealed Rose](https://sealedrose.com/verify-video) - AI media forensics and synthetic content verification for video, au... - k, Y
- [SecurityTrails](https://securitytrails.com/corp/apidocs) - Domain and IP related information such as current and historical WH... - k, ?
- [Shodan](https://developer.shodan.io/) - Search engine for Internet connected devices - k, ?
- [Spyse](https://spyse-dev.readme.io/reference/quick-start) - Access data on all Internet assets and build powerful attack surfac... - k, ?
- [SSL Domain Health Check](https://rapidapi.com/goktugbk/api/ssl-domain-health-check) - SSL certificate validity, domain WHOIS status, and DNS record check... - k, ?
- [SSL Labs](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md) - Deep SSL/TLS server analysis with A+ to F grading - -, ?
- [Tanod](https://tanod.dev/) - Pay-per-call scans of smart contracts, addresses and MCP/skill pack... - -, N
- [Threat Jammer](https://threatjammer.com/docs/index) - Risk scoring service from curated threat intelligence data - k, ?
- [ThreatCluster](https://threatcluster.io/api/public/v1/docs) - Threat intelligence: incident clusters, validated IOCs, CVEs, ranso... - k, N
- [UK Police](https://data.police.uk/docs/) - UK Police data - -, ?
- [URLhaus](https://urlhaus.abuse.ch/api/) - Database of malicious URLs used for malware distribution - -, ?
- [VulDB](https://vuldb.com/?doc.api) - VulDB API allows to initiate queries for one or more items along wi... - k, ?

### Shopping (22)

- [Best Buy](https://bestbuyapis.github.io/api-documentation/#overview) - Products, Buying Options, Categories, Recommendations, Stores and C... - k, ?
- [BuyWhere](https://buywhere.ai) - Real-time product catalog API for AI agents across merchants in 7 c... - k, ?
- [CartScout](https://rapidapi.com/veselinveselinov06/api/cartscout-api) - Price, stock, variants and GTIN from Shopify, WooCommerce, Walmart... - k, ?
- [Descripio Amazon Reviews](https://docs.descripio.com) - Amazon product reviews for 12 marketplaces - k, ?
- [Digi-Key](https://www.digikey.com/en/resources/api-solutions) - Retrieve price and inventory of electronic components as well as pl... - o, ?
- [Dummy Products](https://dummyproducts-api.herokuapp.com/) - An api to fetch dummy e-commerce products JSON data with placeholde... - k, Y
- [eBay](https://developer.ebay.com/) - Sell and Buy on eBay - o, ?
- [Etsy](https://www.etsy.com/developers/documentation/getting_started/api_basics) - Manage shop and interact with listings - o, ?
- [Flipkart Marketplace](https://seller.flipkart.com/api-docs/FMSAPI.html) - Product listing management, Order Fulfilment in the Flipkart Market... - o, Y
- [Lazada](https://open.lazada.com/doc/doc.htm) - Retrieve product ratings and seller performance metrics - k, ?
- [Mercadolibre](https://developers.mercadolibre.cl/es_ar/api-docs-es) - Manage sales, ads, products, services and Shops - k, ?
- [Octopart](https://octopart.com/api/v4/reference) - Electronic part data for manufacturing, design, and sourcing - k, ?
- [OLX Poland](https://developer.olx.pl/api/doc#section/) - Integrate with local sites by posting, managing adverts and communi... - k, ?
- [OpenTiendas](https://opentiendas.dev/redocusaurus/plugin-redoc-0.yaml) - Official e-commerce API and webhooks - k, ?
- [Pangolinfo Amazon Data](https://docs.pangolinfo.com) - Amazon product, review, search and Best Sellers data across 20+ mar... - k, ?
- [Rappi](https://dev-portal.rappi.com/) - Manage orders from Rappi's app - o, ?
- [Shopee](https://open.shopee.com/documents?version=1) - Shopee's official API for integration of various services from Shopee - k, ?
- [SoldStack](https://soldstack.fly.dev/docs) - Sold resale listings from Poshmark with median price, days to sell... - k, N
- [Sparepilot](https://sparepilot.com/developers) - Spare parts catalog, OEM cross-references & price comparison for ga... - k, ?
- [Swanum Comps](https://swanum.com/comps/docs) - Sold resale prices from Vinted (7 European countries) and eBay US,... - k, N
- [Tokopedia](https://developer.tokopedia.com/openapi/guide/#/) - Tokopedia's Official API for integration of various services from T... - o, ?
- [WooCommerce](https://woocommerce.github.io/woocommerce-rest-api-docs/) - WooCommerce REST APIS to create, read, update, and delete data on w... - k, Y

### Social (53)

- [API Direct](https://apidirect.io/docs) - Real-time social media data from X, LinkedIn, Reddit, YouTube, Inst... - k, Y
- [Ayrshare](https://www.ayrshare.com) - Social media APIs to post, get analytics, and manage multiple users... - k, Y
- [Blogger](https://developers.google.com/blogger/) - The Blogger APIs allows client applications to view and update Blog... - o, ?
- [Cisco Spark](https://developer.ciscospark.com) - Team Collaboration Software - o, ?
- [Dangerous Discord Database](https://discord.riverside.rocks/docs/index.php) - Database of malicious Discord accounts - k, ?
- [Discord](https://discord.com/developers/docs/intro) - Make bots for Discord, integrate Discord onto an external platform... - Yes, ?, no HTTPS
- [Disqus](https://disqus.com/api/docs/auth/) - Communicate with Disqus data - o, ?
- [Facebook](https://developers.facebook.com/) - Facebook Login, Share on FB, Social Plugins, Analytics and more - o, ?
- [FastSocial Instagram Data](https://fastsocial.co/instagram-api/docs) - Public Instagram data: profiles, posts, reels, stories, comments an... - k, Y
- [Foursquare](https://developer.foursquare.com/) - Interact with Foursquare users and places (geolocation-based checki... - o, ?
- [Fuck Off as a Service](https://www.foaas.com) - Asks someone to fuck off - -, ?
- [Full Contact](https://docs.fullcontact.com/) - Get Social Media profiles and contact Information - o, ?
- [GetXAPI](https://www.getxapi.com/) - Read Twitter / X data and post tweets, likes, retweets, follows, DM... - k, ?
- [GramScraper](https://gramscraper.com) - Instagram and TikTok data API with 91 endpoints for profiles, posts... - k, Y
- [HackerNews](https://github.com/HackerNews/API) - Social news for CS and entrepreneurship - -, ?
- [Hashnode](https://hashnode.com) - A blogging platform built for developers - -, ?
- [InsightSocial](https://www.insightsocial.app/docs) - Public profiles, posts, comments and followers from 25 social platf... - k, Y
- [Instagram](https://www.instagram.com/developer/) - Instagram Login, Share on Instagram, Social Plugins and more - o, ?
- [Kakao](https://developers.kakao.com/) - Kakao Login, Share on KakaoTalk, Social Plugins and more - o, ?
- [Line](https://developers.line.biz/) - Line Login, Share on Line, Social Plugins and more - o, ?
- [LinkedIn](https://docs.microsoft.com/en-us/linkedin/?context=linkedin/context) - The foundation of all digital integrations with LinkedIn - o, ?
- [Meetup.com](https://www.meetup.com/api/guide) - Data about Meetups from Meetup.com - k, ?
- [Microsoft Graph](https://docs.microsoft.com/en-us/graph/api/overview) - Access the data and intelligence in Microsoft 365, Windows 10, and... - o, ?
- [NAVER](https://developers.naver.com/main/) - NAVER Login, Share on NAVER, Social Plugins and more - o, ?
- [Open Collective](https://docs.opencollective.com/help/developers/api) - Get Open Collective data - -, ?
- [Pinterest](https://developers.pinterest.com/) - The world's catalog of ideas - o, ?
- [PostLake](https://postlake.dev/docs/) - One API to publish, schedule, and read analytics across every major... - k, N
- [Postproxy](https://postproxy.dev/getting-started/quickstart/) - Publish posts, comments, DMs, and more - k, N
- [Product Hunt](https://api.producthunt.com/v2/docs) - The best new products in tech - o, ?
- [Publora](https://docs.publora.com) - Publish and schedule posts to ten social networks from one endpoint - k, N
- [Reddit](https://www.reddit.com/dev/api) - Homepage of the internet - o, ?
- [RedditAPIs](https://www.redditapis.com/) - Reddit data API: subreddit listings, post/comment/community/user se... - k, ?
- [Revolt](https://developers.revolt.chat/) - Revolt open source Discord alternative - k, ?
- [Saidit](https://www.saidit.net/dev/api) - Open Source Reddit Clone - o, ?
- [Slack](https://api.slack.com/) - Team Instant Messaging - o, ?
- [SocialCrawl](https://www.socialcrawl.dev/docs) - Social and commerce data from 50+ platforms in one JSON schema - k, Y
- [SocialSwarm](https://social-swarm-main-aa77a19.zuplo.site) - Turn articles into ready-to-post X thread drafts with different hooks - k, N
- [TamTam](https://dev.tamtam.chat/) - Bot API to interact with TamTam - k, ?
- [Telegram Bot](https://core.telegram.org/bots/api) - Simplified HTTP version of the MTProto API for bots - k, ?
- [Telegram MTProto](https://core.telegram.org/api#getting-started) - Read and write Telegram data - o, ?
- [Telegraph](https://telegra.ph/api) - Create attractive blogs easily, to share - k, ?
- [TikTok](https://developers.tiktok.com/doc/login-kit-web) - Fetches user info and user's video posts on TikTok platform - o, ?
- [Trash Nothing](https://trashnothing.com/developer) - A freecycling community with thousands of free items posted every day - o, Y
- [TrendsMCP](https://www.trendsmcp.ai/docs) - Live keyword trend data from Google, TikTok, YouTube, Amazon and Re... - k, ?
- [Tumblr](https://www.tumblr.com/docs/en/api/v2) - Read and write Tumblr Data - o, ?
- [TweetAPI](https://tweetapi.com/docs) - Public Twitter data for posts, profiles, followers, search, lists a... - k, N
- [Twitch](https://dev.twitch.tv/docs) - Game Streaming API - o, ?
- [Twitter](https://developer.twitter.com/en/docs) - Read and write Twitter data - o, N
- [TwitterAPIs](https://www.twitterapis.com/) - Twitter / X data API: search, profiles, timelines, followers, DMs,... - k, ?
- [TwittrAPI](https://www.twittrapi.com/docs) - Public Twitter/X data: profiles, tweets, replies, search, followers... - k, Y
- [vk](https://vk.com/dev/sites) - Read and write vk data - o, ?
- [xfetch](https://xfetch.io) - Read API for X/Twitter search, profiles, tweets, and social graph - k, Y
- [XFlux](https://www.xfluxapi.com/docs/api) - Read X/Twitter profiles, search, timelines; account monitors with s... - k, N

### Sports & Fitness (48)

- [5DollarFootball](https://5dollarfootballapi.com/) - Football fixtures, results, standings and historical odds with corn... - k, Y
- [AcesAPI](https://acesapi.com/docs) - ATP and WTA tennis since 2007: match results, draws, rankings, head... - k, Y
- [API-FOOTBALL](https://www.api-football.com/documentation-v3) - Get information about Football Leagues & Cups - k, Y
- [ApiMedic](https://apimedic.com/) - ApiMedic offers a medical symptom checker API primarily for patients - k, ?
- [BirdieAPI](https://birdieapi.com/docs) - PGA Tour golf since 2001: leaderboards, hole-by-hole scores, course... - k, Y
- [Canadian Football League (CFL)](http://api.cfl.ca/) - Official JSON API providing real-time league, team and player stati... - k, N
- [Cito UFC API](https://citoapi.com/ufc-api/) - UFC and MMA fight data: fighters, cards, round stats, rankings and... - k, N
- [City Bikes](https://api.citybik.es/v2/) - City Bikes around the world - -, ?
- [Cloudbet](https://www.cloudbet.com/api/) - Official Cloudbet API provides real-time sports odds and betting AP... - k, Y
- [CollegeFootballData.com](https://collegefootballdata.com) - Unofficial detailed American college football statistics, records,... - k, ?
- [DunkAPI](https://dunkapi.com/docs) - NBA, WNBA and college basketball: play-by-play, shot locations, box... - k, Y
- [Ergast F1](http://ergast.com/mrd/) - F1 data from the beginning of the world championships in 1950 - -, ?
- [FastballAPI](https://fastballapi.com/docs) - MLB since 2015 plus college baseball: pitches, plate appearances, b... - k, Y
- [Fitbit](https://dev.fitbit.com/) - Fitbit Information - o, ?
- [Football](https://rapidapi.com/GiulianoCrescimbeni/api/football98/) - A simple Open Source Football API to get squads’ stats, best scorer... - h, ?
- [Football Charts](https://www.football-charts.com/developers) - Tables, results, model probabilities and Monte Carlo season project... - k, Y
- [Football Leagues](https://football-api.yuvron.online/reference) - Standings, fixtures, live scores, lineups and player stats for 11 E... - k, Y
- [Football-Data](https://www.football-data.org) - Football data with matches info, players, teams, and competitions - h, ?
- [HaterPicks](https://www.haterpicks.app/api) - Australian sports odds and player props from every major Australian... - k, N
- [JCDecaux Bike](https://developer.jcdecaux.com/) - JCDecaux's self-service bicycles - k, ?
- [Lumify](https://lumify.ai/docs) - Real-time sports intelligence: scores, odds, betting splits & AI be... - k, N
- [MLB Records and Stats](https://appac.github.io/mlb-data-api-docs/) - Current and historical MLB statistics - -, ?, no HTTPS
- [NBA Data](https://rapidapi.com/api-sports/api/api-nba/) - All NBA Stats DATA, Games, Livescore, Standings, Statistics - k, ?
- [NBA Stats](https://any-api.com/nba_com/nba_com/docs/API_Description) - Current and historical NBA Statistics - -, ?
- [NHL Records and Stats](https://gitlab.com/dword4/nhlapi) - NHL historical data and statistics - -, ?
- [Odds-API](https://docs.odds-api.io) - Real-time sports betting odds from 365+ bookmakers across 34 sports... - k, Y
- [OddsRadarWire](https://oddsradarwire.com/docs.html) - Live and prematch Betradar odds with raw no-vig probabilities, REST... - k, N
- [OpenFoot API](https://openfootapi.com/docs) - Football fixtures, results, standings, lineups, live events and sho... - k, Y
- [Parlay](https://parlay-api.com/docs) - Real-time sports odds and player props from 45+ sportsbooks and sou... - k, Y
- [PinnWire](https://pinnwire.com/docs.html) - Real-time Pinnacle odds for 13 sports — live and prematch over REST... - k, N
- [PlayerElo](https://playerelo.football/api-access) - Player-level Elo ratings, predictions and history for 176 football... - k, ?
- [Premier League Standings](https://rapidapi.com/heisenbug/api/premier-league-live-scores/) - All Current Premier League Standings and Statistics - k, ?
- [PropLine](https://prop-line.com) - Real-time player-props betting odds with graded prop resolution acr... - k, ?
- [QiuXiaoCe Football](https://www.qiuxiaoce.com/data-docs/) - Football teams, leagues, standings, scorers and match intelligence... - -, ?, no HTTPS
- [RacingHub](https://racinghub.net/api/v1/docs#/) - Formula 1 historical data and statistics - -, ?
- [Realtime Sports](https://www.realtimesportsapi.com/docs) - Live scores, play-by-play, schedules and odds for NFL, NBA, MLB, NH... - k, Y
- [Sport Places](https://developers.decathlon.com/products/sport-places) - Crowd-source sports places around the world - -, N
- [Sport Vision](https://developers.decathlon.com/products/sport-vision) - Identify sport, brands and gear in an image. Also does image sports... - k, Y
- [Sportmonks Cricket](https://docs.sportmonks.com/cricket/) - Live cricket score, player statistics and fantasy API - k, ?
- [Sportmonks Football](https://docs.sportmonks.com/football/) - Football score/schedule, news api, tv channels, stats, history, dis... - k, ?
- [Strava](https://strava.github.io/api/) - Connect with athletes, activities and more - o, ?
- [StrikerAPI](https://strikerapi.com/docs) - Football from 16 leagues incl. Premier League and MLS: lineups, sho... - k, Y
- [SuredBits](https://suredbits.com/api/) - Query sports data, including teams, players, games, scores and stat... - -, N, no HTTPS
- [TheRundown](https://therundown.io/) - Real-time sports data: odds, scores, stats & prediction markets, 30... - k, Y
- [TheSportsDB](https://www.thesportsdb.com/api.php) - Crowd-Sourced Sports Data and Artwork - k, Y
- [TourneyRadar](https://tourneyradar-api.vercel.app) - Upcoming chess tournaments from 140+ national federations worldwide - -, ?
- [Tredict](https://www.tredict.com/blog/oauth_docs/) - Get and set activities, health data and more - o, ?
- [Wger](https://wger.de/en/software/api) - Workout manager data as exercises, muscles or equipment - k, ?

### Test Data (25)

- [Bacon Ipsum](https://baconipsum.com/json-api/) - A Meatier Lorem Ipsum Generator - -, ?
- [Dicebear Avatars](https://avatars.dicebear.com/) - Generate random pixel-art avatars - -, N
- [English Random Words](https://random-words-api.vercel.app/word) - Generate English Random Words with Pronunciation - -, N
- [FakeJSON](https://fakejson.com) - Service to generate test and fake data - k, Y
- [FakeStoreAPI](https://fakestoreapi.com/) - Fake store rest API for your e-commerce or shopping website prototype - -, ?
- [GeneradorDNI](https://api.generadordni.es) - Data generator API. Profiles, vehicles, banks and cards, etc - k, ?
- [ItsThisForThat](https://itsthisforthat.com/api.php) - Generate Random startup ideas - -, N
- [JsonFabrica](https://jsonfabrica.com/docs/api-reference) - Generate realistic relational synthetic JSON test data from reusabl... - k, ?
- [JSONPlaceholder](http://jsonplaceholder.typicode.com/) - Fake data for testing and prototyping - -, ?, no HTTPS
- [Loripsum](http://loripsum.net/) - The "lorem ipsum" generator that doesn't suck - -, ?, no HTTPS
- [Mailsac](https://mailsac.com/docs/api) - Disposable Email - k, ?
- [Metaphorsum](http://metaphorpsum.com/) - Generate demo paragraphs giving number of words and sentences - -, ?, no HTTPS
- [Mockaroo](https://www.mockaroo.com/docs) - Generate fake data to JSON, CSV, TXT, SQL and XML - k, ?
- [Random Data](https://random-data-api.com) - Random data generator - -, ?
- [Randommer](https://randommer.io/randommer-api) - Random data generator - k, Y
- [RandomUser](https://randomuser.me) - Generates and list user data - -, ?
- [restful-api](https://restful-api.dev) - Fake REST API for testing and prototyping with CRUD endpoints - -, N
- [RoboHash](https://robohash.org/) - Generate random robot/alien avatars - -, ?
- [Spanish random names](https://random-names-api.herokuapp.com/public) - Generate spanish names (with gender) randomly - -, ?
- [Spanish random words](https://palabras-aleatorias-public-api.herokuapp.com) - Generate spanish words randomly - -, ?
- [This Person Does not Exist](https://thispersondoesnotexist.com) - Generates real-life faces of people who do not exist - -, ?
- [Toolcarton](https://testimonialapi.toolcarton.com/) - Generate random testimonial data - -, ?
- [UUID Generator](https://www.uuidtools.com/docs) - Generate UUIDs - -, N
- [What The Commit](http://whatthecommit.com/index.txt) - Random commit message generator - -, Y, no HTTPS
- [Yes No](https://yesno.wtf/api) - Generate yes or no randomly - -, ?

### Text Analysis (20)

- [apilayer languagelayer](https://languagelayer.com/) - Language Detection JSON API supporting 173 languages - o, ?
- [Aylien Text Analysis](https://docs.aylien.com/textapi/#getting-started) - A collection of information retrieval and natural language APIs - k, ?
- [Cloudmersive Natural Language Processing](https://www.cloudmersive.com/nlp-api) - Natural language processing and text analysis - k, Y
- [Code Detection](https://codedetectionapi.runtime.dev) - Detect, label, format and enrich the code in your app or in your da... - o, ?
- [Detect Language](https://detectlanguage.com/) - Detects text language - k, ?
- [eidosSpeech](https://eidosspeech.xyz) - Free text-to-speech API with 1,200+ neural voices in 75+ languages - k, Y
- [ELI](https://nlp.insightera.co.th/docs/v1.0) - Natural Language Processing Tools for Thai Language - k, ?
- [GeoScore](https://geoscoreapi.com) - Score content for AI search citation readiness with a 0-100 GEO sco... - k, Y
- [Google Cloud Natural](https://cloud.google.com/natural-language/docs/) - Natural language understanding technology, including sentiment, ent... - k, ?
- [Hirak OCR](https://ocr.hirak.site/) - Image to text -text recognition- from image more than 100 language,... - k, ?
- [Hirak Translation](https://translate.hirak.site/) - Translate between 21 of most used languages, accurate, unlimited re... - k, ?
- [Kiprio Translate](https://kiprio.com/v1/translate) - Free text translation with language detection, supports 50+ languages - k, Y
- [Langbly](https://langbly.com/docs) - Context-aware text translation and language detection for 100+ lang... - k, Y
- [Lecto Translation](https://rapidapi.com/lecto-lecto-default/api/lecto-translation/) - Translation API with free tier and reasonable prices - k, Y
- [LibreTranslate](https://libretranslate.com/docs) - Translation tool with 17 available languages - -, ?
- [Semantria](https://semantria.readme.io/docs) - Text Analytics with sentiment analysis, categorization & named enti... - o, ?
- [Sentiment Analysis](https://www.meaningcloud.com/developer/sentiment-analysis) - Multilingual sentiment analysis of texts from different sources - k, Y
- [Tisane](https://tisane.ai/) - Text Analytics with focus on detection of abusive content and law e... - o, Y
- [ToHuman](https://tohuman.io/ai-humanizer-api) - Rewrite AI-assisted drafts into natural, human-sounding text that r... - k, ?
- [Watson Natural Language Understanding](https://cloud.ibm.com/apidocs/natural-language-understanding/natural-language-understanding) - Natural language processing for advanced text analysis - o, ?

### Tracking (11)

- [Aftership](https://developers.aftership.com/reference/quick-start) - API to update, manage and track shipment efficiently - k, Y
- [Correios](https://cws.correios.com.br/ajuda) - Integration to provide information and prepare shipments using Corr... - k, ?
- [Mapbox](https://docs.mapbox.com/api/) - Maps, directions, geocoding - k, ?
- [Pixela](https://pixe.la) - API for recording and tracking habits or effort, routines - h, Y
- [PostalPinCode](http://www.postalpincode.in/Api-Details) - API for getting Pincode details in India - -, ?
- [Postmon](http://postmon.com.br) - An API to query Brazilian ZIP codes and orders easily, quickly and... - -, ?, no HTTPS
- [PostNord](https://developer.postnord.com/api) - Provides information about parcels in transport for Sweden and Denmark - k, ?, no HTTPS
- [UPS](https://www.ups.com/upsdeveloperkit) - Shipment and Address information - k, ?
- [WeCanTrack](https://docs.wecantrack.com) - Automatically place subids in affiliate links to attribute affiliat... - k, Y
- [WhatPulse](https://developer.whatpulse.org/#web-api) - Small application that measures your keyboard/mouse usage - -, ?
- [WhereParcel](https://whereparcel.com/docs) - Unified parcel tracking API across 60+ carriers worldwide (USPS, Fe... - k, Y

### Transportation (83)

- [ADS-B Exchange](https://www.adsbexchange.com/data/) - Access real-time and historical data of any and all airborne aircraft - -, ?
- [Aether-X Port Congestion](https://aether-x-oracle-production.up.railway.app/docs) - Real-time port congestion risk scores, ETA delays and waiting vesse... - k, Y
- [Aether-X Port Congestion Oracle](https://rapidapi.com/belegante/api/aether-x-port-congestion-oracle) - Predictive port congestion, ETA delay and freight volatility signal... - k, Y
- [airportsapi](https://airport-web.appspot.com/api/docs/) - Get name and website-URL for airports by ICAO code - -, ?
- [AIS Hub](http://www.aishub.net/api) - Real-time data of any marine and inland vessel equipped with AIS tr... - k, ?, no HTTPS
- [Amadeus for Developers](https://developers.amadeus.com/self-service) - Travel Search - Limited usage - o, ?
- [apilayer aviationstack](https://aviationstack.com/) - Real-time Flight Status & Global Aviation Data API - o, ?
- [AviationAPI](https://docs.aviationapi.com) - FAA Aeronautical Charts and Publications, Airport Information, and... - -, N
- [AZ511](https://www.az511.com/developers/doc) - Access traffic data from the ADOT API - k, ?
- [Bay Area Rapid Transit](http://api.bart.gov) - Stations and predicted arrivals for BART - k, ?, no HTTPS
- [BIC-Boxtech](https://docs.bic-boxtech.org/) - Container technical detail for the global container fleet - o, ?
- [BlaBlaCar](https://dev.blablacar.com) - Search car sharing trips - k, ?
- [Boston MBTA Transit](https://www.mbta.com/developers/v3-api) - Stations and predicted arrivals for MBTA - k, ?
- [Community Transit](https://github.com/transitland/transitland-datastore/blob/master/README.md#api-endpoints) - Transitland API - -, ?
- [Compare Flight Prices](https://rapidapi.com/obryan-software-obryan-software-default/api/compare-flight-prices/) - API for comparing flight prices across platforms - k, ?
- [Cruise Itinerary](https://cruise-itinerary.com/docs) - Cruise sailings, day-by-day itineraries, weekly fare history, port... - k, Y
- [CruiseFeed](https://cruisefeed.io) - Normalized cruise line inventory: ships, sailings, itineraries, por... - k, ?
- [CTS](https://api.cts-strasbourg.eu/) - CTS Realtime API - k, Y
- [Grab](https://developer.grab.com/docs/) - Track deliveries, ride fares, payments and loyalty points - o, ?
- [GraphHopper](https://docs.graphhopper.com/) - A-to-B routing with turn-by-turn instructions - k, ?
- [Icelandic APIs](http://docs.apis.is/) - Open APIs that deliver services in or regarding Iceland - -, ?
- [Impala Hotel Bookings](https://docs.impala.travel/docs/booking-api/) - Hotel content, rates and room bookings - k, N
- [Izi](http://api-docs.izi.travel/) - Audio guide for travellers - k, ?
- [Land Transport Authority DataMall, Singapore](https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf) - Singapore transport information - k, ?, no HTTPS
- [LiveTrafficCam](https://bzsasson.github.io/traffic-camera-sources/api.html) - Live US state DOT traffic cameras with verified live status and mea... - -, N
- [Metro Lisboa](http://app.metrolisboa.pt/status/getLinhas.php) - Delays in subway lines - -, N, no HTTPS
- [Navitia](https://doc.navitia.io/) - The open API for building cool stuff with transport data - k, ?
- [On va où ?](https://onvaou.app/developers/routing-api.html) - Bike, scooter, motorcycle, wheelchair and walking routes across Eur... - k, N
- [Open Charge Map](https://openchargemap.org/site/develop/api) - Global public registry of electric vehicle charging locations - k, Y
- [OpenSky Network](https://openskynetwork.github.io/opensky-api/) - Free real-time ADS-B aviation data - -, ?
- [Orizn Visa](https://visa.orizn.app) - Visa requirements for 199 countries, 39K+ passport-destination pair... - k, Y
- [Pumperly](https://geiserx.github.io/Pumperly/reference/api/) - Fuel prices and EV chargers near a point, in a map area or along a... - -, N
- [Railway Transport for France](https://www.digital.sncf.com/startup/api) - SNCF public API - k, ?
- [REFUGE Restrooms](https://www.refugerestrooms.org/api/docs/#!/restrooms) - Provides safe restroom access for transgender, intersex and gender... - -, ?
- [Road511](https://road511.com/docs.html) - Unified traffic data from 65 US/CA jurisdictions: events, cameras,... - k, N
- [Sabre for Developers](https://developer.sabre.com/) - Travel Search - Limited usage - k, ?
- [Schiphol Airport](https://developer.schiphol.nl/) - Schiphol - k, ?
- [SMKlog](https://smklog.com/openapi.json) - Live parcel shipping rates and labels from a plain-words item descr... - -, N
- [Stadiq](https://stadiq.app/developers) - Road works, transit disruptions and air quality for Antwerp and Fla... - k, N
- [Strait of Hormuz Ship Monitor](https://hormuz.data-tracking.net/llms.txt) - Live AIS vessel traffic, crossings and oil flow through the Strait... - -, N
- [Tankerkoenig](https://creativecommons.tankerkoenig.de/swagger/) - German realtime gas/diesel prices - k, Y
- [TransCAPI](https://www.transcapi.com/docs) - Live bus and rail departures, vehicles, disruptions and journey pla... - k, Y
- [TransitLand](https://www.transit.land/documentation/datastore/api-endpoints.html) - Transit Aggregation - -, ?
- [TransitRadar](https://transitradar.co.uk/scalar/) - Live GB train and bus departures, train positions, journey planning... - -, N
- [Transport for Atlanta, US](http://www.itsmarta.com/app-developer-resources.aspx) - Marta - -, ?, no HTTPS
- [Transport for Auckland, New Zealand](https://dev-portal.at.govt.nz/) - Auckland Transport - -, ?
- [Transport for Berlin, Germany](https://github.com/derhuerst/vbb-rest/blob/3/docs/index.md) - Third-party VBB API - -, ?
- [Transport for Bordeaux, France](https://opendata.bordeaux-metropole.fr/explore/) - Bordeaux Métropole public transport and more (France) - k, ?
- [Transport for Budapest, Hungary](https://bkkfutar.docs.apiary.io) - Budapest public transport API - -, ?
- [Transport for Chicago, US](http://www.transitchicago.com/developers/) - Chicago Transit Authority (CTA) - k, ?, no HTTPS
- [Transport for Czech Republic](https://www.chaps.cz/eng/products/idos-internet) - Czech transport API - -, ?
- [Transport for Denver, US](http://www.rtd-denver.com/gtfs-developer-guide.shtml) - RTD - -, ?, no HTTPS
- [Transport for Finland](https://digitransit.fi/en/developers/ ) - Finnish transport API - -, ?
- [Transport for Germany](http://data.deutschebahn.com/dataset/api-fahrplan) - Deutsche Bahn (DB) API - k, ?, no HTTPS
- [Transport for Grenoble, France](https://www.mobilites-m.fr/pages/opendata/OpenDataApi.html) - Grenoble public transport - -, N, no HTTPS
- [Transport for Hessen, Germany](https://opendata.rmv.de/site/start.html) - RMV API (Public Transport in Hessen) - -, ?
- [Transport for Honolulu, US](http://hea.thebus.org/api_info.asp) - Honolulu Transportation Information - k, ?, no HTTPS
- [Transport for Lisbon, Portugal](https://emel.city-platform.com/opendata/) - Data about buses routes, parking and traffic - k, ?
- [Transport for London, England](https://api.tfl.gov.uk) - TfL API - k, ?
- [Transport for Los Angeles, US](https://developer.metro.net/api/) - Data about positions of Metro vehicles in real time and travel thei... - -, ?
- [Transport for Manchester, England](https://developer.tfgm.com/) - TfGM transport network data - k, N
- [Transport for Norway](https://developer.entur.org/) - Transport APIs and dataset for Norway - -, ?
- [Transport for Ottawa, Canada](https://www.octranspo.com/en/plan-your-trip/travel-tools/developers) - OC Transpo API - k, ?
- [Transport for Paris, France](http://data.ratp.fr/api/v1/console/datasets/1.0/search/) - RATP Open Data API - -, ?, no HTTPS
- [Transport for Philadelphia, US](http://www3.septa.org/hackathon/) - SEPTA APIs - -, ?, no HTTPS
- [Transport for Sao Paulo, Brazil](http://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api/) - SPTrans - o, ?, no HTTPS
- [Transport for Spain](https://data.renfe.com/api/1/util/snippet/api_info.html?resource_id=a2368cff-1562-4dde-8466-9635ea3a572a) - Public trains of Spain - -, ?
- [Transport for Sweden](https://www.trafiklab.se/api) - Public Transport consumer - o, ?
- [Transport for Switzerland](https://opentransportdata.swiss/en/) - Official Swiss Public Transport Open Data - k, ?
- [Transport for Switzerland](https://transport.opendata.ch/) - Swiss public transport API - -, ?
- [Transport for The Netherlands](http://www.ns.nl/reisinformatie/ns-api) - NS, only trains - k, ?, no HTTPS
- [Transport for The Netherlands](https://github.com/skywave/KV78Turbo-OVAPI/wiki) - OVAPI, country-wide public transport - -, ?
- [Transport for Toronto, Canada](https://myttc.ca/developers) - TTC - -, ?
- [Transport for UK](https://developer.transportapi.com) - Transport API and dataset for UK - k, ?
- [Transport for United States](https://retro.umoiq.com/xmlFeedDocs/NextBusXMLFeed.pdf) - NextBus API - -, ?, no HTTPS
- [Transport for Vancouver, Canada](https://developer.translink.ca/) - TransLink - o, ?
- [Transport for Washington, US](https://developer.wmata.com/) - Washington Metro transport API - o, ?
- [Travel Risk Aviation](https://api.travelriskapi.com/ext/reference/) - Flight status, airports, airlines, airline safety and in-flight Wi-... - k, Y
- [Tripadvisor](https://developer-tripadvisor.com/home/) - Rating content for a hotel, restaurant, attraction or destination - k, ?
- [Uber](https://developer.uber.com/products) - Uber ride requests and price estimation - o, Y
- [Velib metropolis, Paris, France](https://www.velib-metropole.fr/donnees-open-data-gbfs-du-service-velib-metropole) - Velib Open Data API - -, N
- [Vessel Class Finder](https://vesselclassfinder.com/blog/vessel-classification-api.html) - IACS class society, class status and survey dates for ships by IMO... - k, Y
- [Windsock](https://windsock.ai/app/docs) - Aircraft valuations, FAA registry lookups, cost of ownership and av... - k, ?

### URL Shorteners (17)

- [Bitly](http://dev.bitly.com/get_started.html) - URL shortener and link management - o, ?
- [ClickMeter](https://support.clickmeter.com/hc/en-us/categories/201474986) - Monitor, compare and optimize your marketing links - k, ?
- [Clico](https://cli.com/swagger-ui/index.html?configUrl=/v3/api-docs/swagger-config) - URL shortener service - k, ?
- [Cutt.ly](https://cutt.ly/api-documentation/cuttly-links-api) - URL shortener service - k, ?
- [Drivet URL Shortener](https://wiki.drivet.xyz/en/url-shortener/add-links) - Shorten a long URL easily and fast - -, ?
- [Free Url Shortener](https://ulvis.net/developer.html) - Free URL Shortener offers a powerful API to interact with other sites - -, ?
- [Git.io](https://github.blog/2011-11-10-git-io-github-url-shortener/) - Git.io URL shortener - -, ?
- [Kutt](https://docs.kutt.it/) - Free Modern URL Shortener - k, Y
- [Lix.li](https://lix.li/api) - URL shortener with analytics, QR codes, UTM tags and custom domains - k, Y
- [Mgnet.me](http://mgnet.me/api.html) - Torrent URL shorten API - -, N
- [owo](https://owo.vc/) - A simple link obfuscator/shortener - -, ?
- [Rebrandly](https://developers.rebrandly.com/v1/docs) - Custom URL shortener for sharing branded links - k, ?
- [RedirHub](https://redirhub.com) - URL redirect management with custom domains, HTTPS, analytics, and... - k, Y
- [Short Link](https://github.com/FayasNoushad/Short-Link-API) - Short URLs support so many domains - -, ?
- [Shrtlnk](https://shrtlnk.dev/) - Simple and efficient short link creation - k, Y
- [TinyURL](https://tinyurl.com/app/dev) - Shorten long URLs - k, N
- [UrlBae](https://urlbae.com/developers) - Simple and efficient short link creation - k, Y

### Vehicle (13)

- [Auto Body Shop Directory](https://autobodyshopnear.com/developers/body-shop-api) - Find auto body shops by ZIP code, city, location, or profile - -, N
- [Brazilian Vehicles and Prices](https://deividfortuna.github.io/fipe/) - Vehicles information from Fundação Instituto de Pesquisas Econômica... - -, N
- [CarSpecs](https://carspecsapi.com/docs) - Car specs for 70,000+ trims since 1945 (make, model, generation, tr... - k, N
- [CarVector](https://carvector.io/docs) - Vehicle specs, images, recalls, and DTC codes across 1925-2029 - k, Y
- [Helipaddy sites](https://helipaddy.com/api/) - Helicopter and passenger drone landing site directory, Helipaddy da... - k, ?
- [Kelley Blue Book](http://developer.kbb.com/#!/data/1-Default) - Vehicle info, pricing, configuration, plus much more - k, N
- [Mercedes-Benz](https://developer.mercedes-benz.com/apis) - Telematics data, remotely access vehicle functions, car configurato... - k, N
- [NHTSA](https://vpic.nhtsa.dot.gov/api/) - NHTSA Product Information Catalog and Vehicle Listing - -, ?
- [NHTSA Vehicle Recalls](https://rapidapi.com/crisp-point-studio-crisp-point-studio-default/api/live-nhtsa-vehicle-recalls) - NHTSA safety recalls by model year, make and model with component,... - k, ?
- [RevCarData](https://revcardata.com) - 86,000+ global vehicle specifications and EV metrics - k, Y
- [Smartcar](https://smartcar.com/docs/) - Lock and unlock vehicles and get data like odometer reading and loc... - o, Y
- [Wheelwise](https://cars.limoja.ai/api/search?q=BMW&limit=1) - UK used-car listings with fair-price grade, 36-month resale forecas... - -, N
- [WhichTrim](https://whichtrim.com/developers/) - US vehicle recalls, complaints, fuel economy, crash ratings, servic... - k, Y

### Video (46)

- [An API of Ice And Fire](https://anapioficeandfire.com/) - Game Of Thrones API - -, ?
- [Arcmira](https://arcmira.com/docs) - Search indexed YouTube transcripts for timestamped passages and men... - k, Y
- [Breaking Bad](https://breakingbadapi.com/documentation) - Breaking Bad API - -, ?
- [Breaking Bad Quotes](https://github.com/shevabam/breaking-bad-quotes) - Some Breaking Bad quotes - -, ?
- [BulkTranscripts](https://bulktranscripts.co/docs) - YouTube transcripts for a video, a whole channel or a playlist, plu... - k, Y
- [Catalogopolis](https://api.catalogopolis.xyz/docs/) - Doctor Who API - -, ?
- [Catch The Show](https://catchtheshow.herokuapp.com/api/documentation) - REST API for next-episode.net - -, ?
- [Czech Television](http://www.ceskatelevize.cz/xml/tv-program/) - TV programme of Czech TV - -, ?, no HTTPS
- [Dailymotion](https://developer.dailymotion.com/) - Dailymotion Developer API - o, ?
- [Game of Thrones Quotes](https://gameofthronesquotes.xyz/) - Some Game of Thrones quotes - -, ?
- [Harry Potter Charactes](https://hp-api.herokuapp.com/) - Harry Potter Characters Data with with imagery - -, ?
- [Hyperserve](https://hyperserve.io/) - Video backend API: upload any format, transcode to MP4, deliver via... - k, Y
- [IMDb-API](https://imdb-api.com/) - API for receiving movie, serial and cast information - k, ?
- [JSON2Video](https://json2video.com) - Create and edit videos programmatically: watermarks,resizing,slides... - k, N
- [KinoPipe](https://kinopipe.com/docs) - Typed hosted video editing operations for agents and automation - k, N
- [KPainter](https://api.kpainter.ai/openapi/v1/docs) - Create video, image, and interactive app outputs from prompts or so... - k, Y
- [Lucifer Quotes](https://github.com/shadowoff09/lucifer-quotes) - Returns Lucifer quotes - -, ?
- [Motivational Quotes](https://nodejs-quoteapp.herokuapp.com/) - Random Motivational Quotes - -, ?
- [Open Movie Database](http://www.omdbapi.com/) - Movie information - k, ?
- [OpenSubtitles](https://www.opensubtitles.com/) - Search and download subtitles for movies and TV shows - k, Y
- [RankFabrik Captions](https://rankfabrik.com/produits/transcription) - Extract transcripts and captions from YouTube videos - k, ?
- [Rendobar](https://rendobar.com) - Hosted media processing over REST: transcode, caption, watermark video - k, N
- [Ron Swanson Quotes](https://github.com/jamesseanwright/ron-swanson-quotes#ron-swanson-quotes-api) - Television - -, ?
- [ScaleReach](https://docs.scalereach.ai) - Turn long videos into short vertical clips with AI captions and fac... - k, N
- [Shotstack](https://shotstack.io/) - Cloud video editing API to create and render videos programmatically - k, ?
- [Simkl](https://simkl.docs.apiary.io) - Movie, TV and Anime data - k, ?
- [STAPI](http://stapi.co) - Information on all things Star Trek - -, N, no HTTPS
- [Stranger Things Quotes](https://github.com/shadowoff09/strangerthings-quotes) - Returns Stranger Things quotes - -, ?
- [Stream](https://api.stream.cz/graphiql) - Czech internet television, films, series and online videos for free - -, N
- [Stromberg Quotes](https://www.stromberg-api.de/) - Returns Stromberg quotes and more - -, ?
- [SWAPI GraphQL](https://graphql.org/swapi-graphql) - Star Wars GraphQL API - -, ?
- [The Lord of the Rings](https://the-one-api.dev/) - The Lord of the Rings API - k, ?
- [The Vampire Diaries](https://vampire-diaries-api.netlify.app/) - TV Show Data - k, Y
- [ThronesApi](https://thronesapi.com/) - Game Of Thrones Characters Data with imagery - -, ?
- [TMDb](https://www.themoviedb.org/documentation/api) - Community-based movie data - k, ?
- [TrailerAddict](https://www.traileraddict.com/trailerapi) - Easily embed trailers from TrailerAddict - k, ?, no HTTPS
- [Trakt](https://trakt.docs.apiary.io/) - Movie and TV Data - k, Y
- [TranscriptYT](https://transcript-yt.com/docs) - YouTube transcripts as JSON, text, SRT or VTT in 150+ languages, wi... - k, Y
- [TubeToTranscript](https://www.tubetotranscript.com/youtube-transcript-api) - Extract clean YouTube video transcripts via REST API - k, Y
- [TVDB](https://thetvdb.com/api-information) - Television data - k, ?
- [TVMaze](http://www.tvmaze.com/api) - TV Show Data - -, ?, no HTTPS
- [uNoGS](https://rapidapi.com/unogs/api/unogsng) - Unofficial Netflix Online Global Search, Search all netflix regions... - k, Y
- [VidWords](https://vidwords.com/api-docs) - YouTube transcripts and subtitles as TXT, SRT, VTT or DOCX, plus AI... - k, N
- [Vimeo](https://developer.vimeo.com/) - Vimeo Developer API - o, ?
- [Watchmode](https://api.watchmode.com/) - API for finding out the streaming availability of movies & shows - k, ?
- [YouTube](https://developers.google.com/youtube/) - Add YouTube functionality to your sites and apps - o, ?

### Weather (34)

- [7Timer!](http://www.7timer.info/doc.php?lang=en) - Weather, especially for Astroweather - -, ?, no HTTPS
- [AccuWeather](https://developer.accuweather.com/apis) - Weather and forecast data - k, ?, no HTTPS
- [Aemet](https://opendata.aemet.es/centrodedescargas/inicio) - Weather and forecast data from Spain - k, ?
- [APIXU](https://www.apixu.com/doc/request.aspx) - Weather - k, ?
- [AQICN](https://aqicn.org/api/) - Air Quality Index Data for over 1000 cities - k, ?
- [AviationWeather](https://www.aviationweather.gov/dataserver) - NOAA aviation weather forecasts and observations - -, ?
- [ColorfulClouds](https://open.caiyunapp.com/ColorfulClouds_Weather_API) - Weather - k, Y
- [Euskalmet](https://opendata.euskadi.eus/api-euskalmet/-/api-de-euskalmet/) - Meteorological data of the Basque Country - k, ?
- [Foreca](https://developer.foreca.com) - Weather - o, ?
- [HG Weather](https://hgbrasil.com/status/weather) - Provides weather forecast data for cities in Brazil - k, Y
- [Hong Kong Obervatory](https://www.hko.gov.hk/en/abouthko/opendata_intro.htm) - Provide weather information, earthquake information, and climate data - -, ?
- [IPMA](https://api.ipma.pt/open-data/) - Portuguese weather and climate data - -, ?
- [KNMI](https://developer.dataplatform.knmi.nl/) - Dutch weather, radar and climate data - k, ?
- [Meltema](https://meltema.com/docs) - Multi-model weather: GFS, ECMWF AIFS/IFS and a 31-member GEFS ensem... - -, N
- [Met Office DataHub](https://datahub.metoffice.gov.uk/docs/) - UK weather forecasts and climate data - k, ?
- [Meteorologisk Institutt](https://api.met.no/weatherapi/documentation) - Weather and climate data - UA header, ?
- [Micro Weather](https://m3o.com/weather/api) - Real time weather forecasts and historic data - k, ?
- [Météo-France](https://portail-api.meteofrance.fr/) - French weather forecasts and alerts - k, ?
- [NOAA CO-OPS](https://api.tidesandcurrents.noaa.gov/api/prod/) - US coastal tides, water levels, currents and meteorological observa... - -, ?
- [ODWeather](http://api.oceandrivers.com/static/docs.html) - Weather and weather webcams - -, ?, no HTTPS
- [Oikolab](https://docs.oikolab.com) - 70+ years of global, hourly historical and forecast weather data fr... - k, Y
- [OpenUV](https://www.openuv.io) - Real-time UV Index Forecast - k, ?
- [OpenWeatherMap](https://openweathermap.org/api) - Weather - k, ?
- [QWeather](https://dev.qweather.com/en/) - Location-based weather data - k, Y
- [Rainbow Weather](https://developer.rainbow.ai/) - Global real-time nowcasting API powered by radar + satellite fusion - k, ?
- [RainViewer](https://www.rainviewer.com/api.html) - Radar data collected from different websites across the Internet - -, ?
- [Storm Glass](https://stormglass.io/) - Global marine weather from multiple sources - k, Y
- [Tomorrow](https://docs.tomorrow.io) - Weather API Powered by Proprietary Technology - k, ?
- [Visual Crossing](https://www.visualcrossing.com/weather-api) - Global historical and weather forecast data - k, Y
- [weather-api](https://github.com/robertoduessmann/weather-api) - A RESTful free API to check the weather - -, N
- [WeatherAPI](https://www.weatherapi.com/) - Weather API with other stuff like Astronomy and Geolocation API - k, Y
- [Weatherbit](https://www.weatherbit.io/api) - Weather - k, ?
- [Weatherstack](https://weatherstack.com/) - Real-Time & Historical World Weather Data API - k, ?
- [Yandex.Weather](https://yandex.com/dev/weather/) - Assesses weather condition in specific locations - k, N
