"""BI source "by link": Google Sheets, Yandex Disk public files and direct CSV/XLSX URLs.

Downloads go through the same public-address resolver as the other sources (checked on every
redirect hop), with a size cap. Only publicly shared files work: no OAuth, nothing is stored.
"""

import asyncio
import re
from urllib.parse import parse_qs, quote, unquote, urlsplit

import aiohttp

from app.exceptions import BadRequestError, ServiceUnavailableError
from app.services.bi import MAX_BYTES, parse_dataset
from app.services.bi_sources import TIMEOUT_S, _PublicResolver

_GSHEET = re.compile(r"^/spreadsheets/d/(?:e/)?([A-Za-z0-9_-]+)")
_YADISK_HOSTS = {"disk.yandex.ru", "disk.yandex.com", "yadi.sk", "disk.360.yandex.ru"}


def resolve_link(url: str) -> tuple[str, str]:
    """Returns (download URL, filename with the format extension)."""
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower()
    if host == "docs.google.com":
        m = _GSHEET.match(parts.path)
        if not m:
            raise BadRequestError("Это не ссылка на Google Таблицу")
        gid = (
            parse_qs(parts.query).get("gid", [None])[0]
            or parse_qs(parts.fragment).get("gid", [None])[0]
        )
        if "/d/e/" in parts.path:  # «Опубликовать в интернете»
            base = f"https://docs.google.com/spreadsheets/d/e/{m.group(1)}/pub?output=csv"
        else:
            base = f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv"
        if gid and gid.isdigit():
            base += f"&gid={gid}"
        return base, "google-sheet.csv"
    if host in _YADISK_HOSTS:
        return f"yadisk:{url.strip()}", ""
    name = parts.path.rsplit("/", 1)[-1] or "data.csv"
    return url.strip(), name


async def _download(http: aiohttp.ClientSession, url: str) -> tuple[bytes, str, str]:
    async with http.get(url, max_redirects=5) as r:
        if r.status in (401, 403):
            raise BadRequestError("Доступ закрыт: откройте файл по ссылке для всех")
        if r.status == 404:
            raise BadRequestError("Файл по ссылке не найден")
        if r.status != 200:
            raise BadRequestError(f"Сервер по ссылке ответил кодом {r.status}")
        if (r.content_length or 0) > MAX_BYTES:
            raise BadRequestError("Файл больше 5 МБ")
        data = bytearray()
        async for chunk in r.content.iter_chunked(64 * 1024):
            data.extend(chunk)
            if len(data) > MAX_BYTES:
                raise BadRequestError("Файл больше 5 МБ")
        disposition = r.headers.get("Content-Disposition", "")
        return bytes(data), r.headers.get("Content-Type", ""), disposition


def _filename(disposition: str, fallback: str, content_type: str) -> str:
    m = re.search(r"filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)", disposition)
    name = unquote(m.group(1) or m.group(2)).strip() if m else fallback
    if not re.search(r"\.(csv|xlsx|txt)$", name, re.I):
        if "spreadsheetml" in content_type:
            name += ".xlsx"
        elif "csv" in content_type or "text/plain" in content_type:
            name += ".csv"
    return name


async def load_url(url: str) -> dict:
    target, fallback = resolve_link(url)
    connector = aiohttp.TCPConnector(resolver=_PublicResolver())
    try:
        async with aiohttp.ClientSession(
            connector=connector, timeout=aiohttp.ClientTimeout(total=TIMEOUT_S)
        ) as http:
            if target.startswith("yadisk:"):
                public = target[len("yadisk:") :]
                api = f"https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key={quote(public, safe='')}"
                async with http.get(api) as r:
                    if r.status != 200:
                        raise BadRequestError(
                            "Яндекс Диск не отдал файл: проверьте, что ссылка публичная"
                        )
                    target = (await r.json(content_type=None)).get("href") or ""
                if not target:
                    raise BadRequestError("Яндекс Диск не отдал файл")
            data, content_type, disposition = await _download(http, target)
    except aiohttp.TooManyRedirects as exc:
        raise BadRequestError("Слишком много перенаправлений по ссылке") from exc
    except aiohttp.ClientConnectorError as exc:
        raise BadRequestError("Нет соединения с сервером по ссылке (или адрес внутренний)") from exc
    except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
        raise ServiceUnavailableError("Сервер по ссылке не ответил вовремя") from exc

    if "text/html" in content_type.lower() or data[:200].lstrip().lower().startswith(
        (b"<!doctype html", b"<html")
    ):
        raise BadRequestError(
            "По ссылке открылась веб-страница, а не таблица: откройте доступ «всем, у кого есть ссылка»"
        )
    name = _filename(disposition, fallback, content_type)
    if not re.search(r"\.(csv|xlsx|txt)$", name, re.I):
        name = "data.xlsx" if data[:2] == b"PK" else "data.csv"
    return parse_dataset(name, data)
