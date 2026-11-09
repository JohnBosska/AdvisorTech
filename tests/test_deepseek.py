"""DeepSeek provider against a local fake of its OpenAI-compatible API."""

import asyncio

import pytest
from aiohttp import web

from app.config.ai import ai
from app.exceptions import ServiceUnavailableError
from app.services import deepseek, embeddings
from app.services.llm import get_llm


def _run(coro_factory, handlers: dict, monkeypatch):
    async def main():
        app = web.Application()
        for path, handler in handlers.items():
            app.router.add_post(path, handler)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 0)
        await site.start()
        port = site._server.sockets[0].getsockname()[1]
        monkeypatch.setattr(ai, "deepseek_base_url", f"http://127.0.0.1:{port}")
        try:
            return await coro_factory()
        finally:
            await runner.cleanup()

    return asyncio.run(main())


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(ai, "deepseek_api_key", type(ai.deepseek_api_key)("sk-test"))
    monkeypatch.setattr(ai, "deepseek_embedding_model", "")


def test_deepseek_is_the_primary_provider(configured) -> None:
    assert ai.provider == "deepseek"
    assert isinstance(get_llm(), deepseek.DeepSeekLLM)


def test_chat_completion_sends_bearer_and_system_prompt(configured, monkeypatch) -> None:
    seen = {}

    async def chat(request):
        seen["auth"] = request.headers["Authorization"]
        seen["body"] = await request.json()
        return web.json_response(
            {"model": "deepseek-flash", "choices": [{"message": {"content": " Ответ [1] "}}]}
        )

    result = _run(
        lambda: deepseek.DeepSeekLLM().complete("SYS", [{"role": "user", "content": "q"}]),
        {"/chat/completions": chat},
        monkeypatch,
    )
    assert result.text == "Ответ [1]" and result.model == "deepseek-flash"
    assert seen["auth"] == "Bearer sk-test"
    assert seen["body"]["messages"][0] == {"role": "system", "content": "SYS"}


def test_http_error_becomes_503(configured, monkeypatch) -> None:
    async def fail(request):
        return web.json_response({"error": {"message": "Insufficient Balance"}}, status=402)

    with pytest.raises(ServiceUnavailableError):
        _run(
            lambda: deepseek.DeepSeekLLM().complete("s", [{"role": "user", "content": "q"}]),
            {"/chat/completions": fail},
            monkeypatch,
        )


def test_embeddings_are_opt_in_and_dimension_checked(configured, monkeypatch) -> None:
    assert not ai.deepseek_embeddings  # no model configured: GigaChat/Voyage path stays in charge
    monkeypatch.setattr(ai, "deepseek_embedding_model", "deepseek-embed")
    assert ai.deepseek_embeddings and ai.vector_configured

    async def ok(request):
        body = await request.json()
        return web.json_response(
            {
                "data": [
                    {"index": i, "embedding": [0.1] * ai.embedding_dim}
                    for i, _ in enumerate(body["input"])
                ][::-1]
            }
        )

    vectors = _run(
        lambda: embeddings.embed(["a", "b"], input_type="document"),
        {"/embeddings": ok},
        monkeypatch,
    )
    assert len(vectors) == 2 and len(vectors[0]) == ai.embedding_dim

    async def wrong_dim(request):
        return web.json_response({"data": [{"index": 0, "embedding": [0.1] * 7}]})

    with pytest.raises(ServiceUnavailableError, match="dims"):
        _run(
            lambda: embeddings.embed(["a"], input_type="query"),
            {"/embeddings": wrong_dim},
            monkeypatch,
        )
