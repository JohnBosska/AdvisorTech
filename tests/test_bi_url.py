"""BI source by link: Google Sheets/Yandex Disk link rewriting and guarded downloads."""

import asyncio

import pytest
from aiohttp import web

from app.config.ai import ai
from app.exceptions import BadRequestError
from app.services import bi_url


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "https://docs.google.com/spreadsheets/d/AbC_123-x/edit#gid=0",
            "https://docs.google.com/spreadsheets/d/AbC_123-x/export?format=csv&gid=0",
        ),
        (
            "https://docs.google.com/spreadsheets/d/AbC/edit?usp=sharing",
            "https://docs.google.com/spreadsheets/d/AbC/export?format=csv",
        ),
        (
            "https://docs.google.com/spreadsheets/d/AbC/edit?gid=777#gid=777",
            "https://docs.google.com/spreadsheets/d/AbC/export?format=csv&gid=777",
        ),
        (
            "https://docs.google.com/spreadsheets/d/e/2PACX-1v/pubhtml",
            "https://docs.google.com/spreadsheets/d/e/2PACX-1v/pub?output=csv",
        ),
    ],
)
def test_google_sheet_links_become_csv_exports(url: str, expected: str) -> None:
    assert bi_url.resolve_link(url)[0] == expected


def test_yandex_disk_and_direct_links() -> None:
    assert (
        bi_url.resolve_link("https://disk.yandex.ru/i/abc")[0]
        == "yadisk:https://disk.yandex.ru/i/abc"
    )
    assert bi_url.resolve_link("https://example.com/files/sales.xlsx") == (
        "https://example.com/files/sales.xlsx",
        "sales.xlsx",
    )


def test_not_a_sheet_link_is_rejected() -> None:
    with pytest.raises(BadRequestError):
        bi_url.resolve_link("https://docs.google.com/document/d/abc/edit")


def test_loopback_url_is_refused_by_default(monkeypatch) -> None:
    monkeypatch.setattr(ai, "bi_allow_private_hosts", False)
    with pytest.raises(BadRequestError):
        asyncio.run(bi_url.load_url("http://127.0.0.1:9/data.csv"))


def _serve(handlers: dict, path: str, monkeypatch):
    monkeypatch.setattr(ai, "bi_allow_private_hosts", True)

    async def main():
        app = web.Application()
        for route, handler in handlers.items():
            app.router.add_get(route, handler)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 0)
        await site.start()
        port = site._server.sockets[0].getsockname()[1]
        try:
            return await bi_url.load_url(f"http://127.0.0.1:{port}{path}")
        finally:
            await runner.cleanup()

    return asyncio.run(main())


def test_downloads_csv_after_redirect_and_takes_the_name_from_headers(monkeypatch) -> None:
    async def redirect(request):
        raise web.HTTPFound("/real")

    async def real(request):
        body = "Группа,Выручка\nA,10\nB,20\n".encode()
        return web.Response(
            body=body,
            headers={
                "Content-Type": "text/csv",
                "Content-Disposition": "attachment; filename*=UTF-8''%D0%9F%D1%80%D0%BE%D0%B4%D0%B0%D0%B6%D0%B8.csv",
            },
        )

    data = _serve({"/start": redirect, "/real": real}, "/start", monkeypatch)
    assert data["filename"] == "Продажи.csv"
    assert [c.type for c in data["columns"]] == ["text", "number"] and data["total_rows"] == 2


def test_html_login_page_is_reported_as_closed_access(monkeypatch) -> None:
    async def page(request):
        return web.Response(text="<!DOCTYPE html><html>Sign in</html>", content_type="text/html")

    with pytest.raises(BadRequestError, match="веб-страница"):
        _serve({"/sheet": page}, "/sheet", monkeypatch)


def test_oversized_download_is_cut_off(monkeypatch) -> None:
    async def big(request):
        return web.Response(
            body=b"a,b\n" + b"1,2\n" * (bi_url.MAX_BYTES // 4 + 10), content_type="text/csv"
        )

    with pytest.raises(BadRequestError, match="5 МБ"):
        _serve({"/big.csv": big}, "/big.csv", monkeypatch)
