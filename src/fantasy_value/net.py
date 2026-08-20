from __future__ import annotations

import gzip
import json
import time
import urllib.error
import urllib.request
from typing import Any

from fantasy_value.errors import FetchError

USER_AGENT = "fantasy-football-value/0.1 (data pipeline)"
DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_BACKOFF_SECONDS = 1.0


def get_json(
    url: str,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_backoff: float = DEFAULT_RETRY_BACKOFF_SECONDS,
) -> Any:
    """GET `url`, requesting gzip, and return the parsed JSON body.

    Raises FetchError on a non-200 status, a network/timeout failure that
    survives retries, or a response body that isn't valid JSON.
    """
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip", "Accept": "application/json"},
    )

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                status = response.status
                raw = response.read()
                encoding = response.headers.get("Content-Encoding", "")
        except urllib.error.HTTPError as exc:
            raise FetchError(f"GET {url} returned HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < max_retries:
                time.sleep(retry_backoff * attempt)
                continue
            raise FetchError(f"GET {url} failed after {max_retries} attempts: {exc}") from exc
        else:
            break
    else:  # pragma: no cover - unreachable, loop always returns or raises
        raise FetchError(f"GET {url} failed: {last_error}")

    if status != 200:
        raise FetchError(f"GET {url} returned HTTP {status}")

    if encoding == "gzip":
        raw = gzip.decompress(raw)

    try:
        return json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise FetchError(f"GET {url} returned invalid JSON: {exc}") from exc
