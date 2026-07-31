# AI_NOTES.md

## How I built this project

I used an AI assistant (Claude) heavily on this project. I want to be upfront about
that, because pretending otherwise would be both dishonest and pretty easy to spot.

The way I worked was: decide what I wanted, ask the AI to draft it, read what came back,
push back on the parts I disagreed with, then run it and see if it actually worked. The
AI wrote most of the lines of code. I picked the stack, made the design calls, rejected
a fair amount of what it produced, and found the bugs by running things rather than
trusting the output.

I had roughly three hours, so I spent them getting the core right rather than adding
features. Every claim in the README is backed by a test I ran (`44 passed`).

---

## 1. What the AI wrote vs. what I did

| Part | Who | Notes |
| --- | --- | --- |
| Choice of Python + FastAPI, and the four-layer split (`models` / `storage` / `service` / `api`) | **Me** | The AI's first suggestion was one big `main.py`. I asked for the split because I wanted the totals logic testable without going through HTTP. |
| `src/models.py` | AI draft, I changed the money type | See §2.1. |
| `src/storage.py` | AI draft, I rewrote the write path | See §2.3. |
| `src/service.py` | Mostly AI | I asked for plain functions that take a list of expenses and return numbers, so the aggregation isn't tangled up in the routes. |
| `src/api.py` | AI wrote the routes, I fixed the ordering | See §2.4. |
| `src/dependencies.py` | **Me** | The AI used a global repository object. I swapped it for a `Depends()` factory so the tests can inject a temp file instead of hitting real data. |
| `tests/conftest.py` | **Me** | The temp-file + `dependency_overrides` setup. |
| `tests/` test cases | Split, roughly 60/40 AI/me | The AI knocked out the happy paths fast. I added the awkward ones: empty store, blank title, `amount: 0`, filtering by a category that doesn't exist, deleting twice, per-category totals adding up to the overall total, and the decimal test. |
| `README.md` | AI draft, I corrected and re-ordered it | See §2.5. |
| This file | **Me** | |

Short version: **the AI did the typing, I did the deciding.**

---

## 2. What I checked, tested, or changed — and why

### 2.1 Money was a `float`. I changed it to `Decimal`.

The AI's first model had `amount: float = Field(gt=0)`. That's fine until you start
adding numbers up, which is the entire point of a totals endpoint. Floats can't represent
`0.1` exactly, so the errors pile up.

I switched `amount` to `Decimal`, rounded to two decimal places on the way in. Then I
wrote a test that adds `0.1` and `0.2` and checks the total is exactly `0.30`. With
floats you get `0.30000000000000004`. That test
(`test_amount_is_not_subject_to_float_drift`) is there to stop anyone undoing the fix.

This is the change I'd defend hardest. It isn't a style preference — a money API that
drifts is just wrong.

### 2.2 The `Decimal` change broke nine tests, and I only found out by running them

Straight after switching, nine tests failed with `assert '12.50' == 12.50`. It turns out
Pydantic v2 writes `Decimal` out as a JSON *string*, not a number, so I'd quietly changed
the shape of every response.

I fixed it in two places rather than one, because the right answer is different in each:

* **In the HTTP response**, amounts go out as JSON numbers (`12.5`), because that's what a
  client expects to receive.
* **In the data file**, they're saved as exact strings (`"40.00"`), so loading and saving
  repeatedly doesn't slowly reintroduce the float problem I'd just removed.

I opened the JSON file and looked at it afterwards rather than assuming.

Worth calling out as a lesson: if I'd read the AI's code and nodded along instead of
running the tests, this would have shipped.

### 2.3 I rewrote the file save so a crash can't destroy the data

The AI wrote `path.write_text(json.dumps(...))`. If the process dies halfway through
that, the file is left as unreadable garbage and every expense is gone.

I changed it to write to a temporary file first, flush it to disk, then rename it into
place. Renaming is atomic on Linux and macOS, so the file is either the old version or
the new one, never half of each. I also put a lock around the read-modify-write, because
uvicorn runs these endpoints on a thread pool and two requests really can overlap.

I also made a corrupt data file raise an error on startup instead of being ignored.
Silently starting with zero expenses because the file was malformed is a much worse
outcome than refusing to start.

### 2.4 I spotted a routing bug by reading the code

The AI had put `GET /expenses/{expense_id}` above `GET /expenses/totals`. FastAPI matches
routes in the order they're declared, so `/expenses/totals` would have been read as an id
called "totals" and returned 404 forever.

I moved the literal paths above the parameterised one and left a comment explaining why
the order isn't arbitrary, so nobody reshuffles it later.

### 2.5 I fixed the README, then found it was still wrong

The AI's draft listed endpoints in whatever order it had written them and was vague about
status codes. I rewrote it so the three commands come first, and added a status-code
table.

Then, near the end, I actually followed my own README from a clean copy of the repo in a
fresh virtualenv — and `pytest` failed with `ModuleNotFoundError: No module named 'src'`.
It had been working for me the whole time because I'd been typing `python -m pytest`,
which puts the current folder on the import path. The plain `pytest` command doesn't.

Fixed by adding `pythonpath = .` to `pytest.ini`. Annoying to find that late, but a good
reminder that "works on my machine" often just means "I've been typing a slightly
different command for two hours."

### 2.6 Other things I checked instead of assuming

* Ran the real server with `uvicorn` and hit every endpoint with `curl`, not just the test
  client. Confirmed `/docs` loads and `DELETE` really does return an empty `204`.
* Confirmed `extra="forbid"` works — send `catgory` by mistake and you get a `422`, not a
  silently ignored field. Added a test for it.
* Confirmed category normalisation happens on `PATCH` too, not just on create. It didn't
  at first, because the validator wasn't inherited the way I'd assumed.

---

## 3. Things the AI suggested that I didn't use

* **SQLite and SQLAlchemy.** Suggested twice. The brief says no database is needed, and an
  ORM would have been more setup than actual logic. A JSON file does the job in about 150
  lines.
* **A fixed `Category` enum** (`FOOD`, `TRANSPORT`, `OTHER`). This would reject perfectly
  reasonable categories I hadn't thought of. Normalising free text to lowercase gets the
  consistent grouping an enum would give, without telling users their category is invalid.
* **Making `DELETE` always return `204`, even for an unknown id.** There's a decent
  argument for it, but the brief describes deleting an expense, and a client sending the
  wrong id should be told. I went with `404` and named a test after the decision so it's
  obviously deliberate rather than accidental.
* **`async def` everywhere with `aiofiles`.** Pointless here. The work is a tiny write to a
  local file, and going async would have meant hand-rolling async locking for no real
  gain. Sync endpoints run on FastAPI's thread pool, which is the right fit.
* **A `PUT` endpoint alongside `PATCH`.** Not asked for, and two ways to update the same
  thing is just more to test.
* **Doing three bonuses (Docker, search and Swagger).** The brief says pick at most one, so
  I did the monthly summary and stopped. Swagger is in there, but only because FastAPI
  generates it for free — I'm not claiming it as the bonus.
* **Tests that just assert `status_code == 200` and check nothing else.** The AI produced a
  few of these. They look like coverage and prove nothing, so I replaced them with tests
  that check actual values.

---

## 4. About the demo front end in `web/`

There's an optional React UI in `web/`. It is **not** part of the deliverable — the API is.
I built it after the API was finished and passing, so it had no influence on the backend
design. It exists so the project can be shown to someone without them needing a REST
client.

The AI wrote the components. Two things I made it change:

* It stored amounts as ordinary floating-point rupees, which would have reintroduced the
  exact bug I'd just removed from the Python side. I made it use integer paise instead,
  and checked that `0.1 + 0.2` displays as `₹0.30`.
* I insisted the filtering and totalling be plain functions over an array rather than
  logic buried inside components, so they mirror `service.py` and could be pointed at the
  real API later without rewriting the UI.

The first design it produced was generic — rounded cards and a blue accent, the kind of
dashboard you've seen a hundred times. I threw it out, asked for something with more
character, and picked the fonts myself.

I also found two layout bugs by using it. The main content was being pushed off-screen,
because a CSS grid item defaults to `min-width: auto` and a wide child was stretching the
whole column. Then the fix for that broke the sticky sidebar, because `overflow: hidden`
turns an element into a scroll container and quietly disables `position: sticky` inside
it. Both are the sort of thing you only catch by actually looking at the page.

---

## 5. What this doesn't do

Being honest about the limits:

* Every write rewrites the entire file, and the whole dataset sits in memory. Fine for
  personal use, not fine at a hundred thousand records. The repository interface is
  deliberately small so it could be swapped for SQLite without touching the routes.
* There's no authentication and no separation between users. The brief describes a
  single-user personal tracker, so anyone who can reach the port can read and delete
  everything. That's acceptable on your own machine and would not be acceptable anywhere
  else.
* There's no request size limit and no rate limiting, so it isn't hardened against someone
  deliberately trying to overload it.
* Dates are plain dates with no timezone handling. Defaulting to "today" uses the server's
  local date.
