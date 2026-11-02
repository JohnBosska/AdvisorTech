from app.utils.rag import (
    NO_CONTEXT_ANSWER,
    Passage,
    build_or_tsquery,
    cited_refs,
    reciprocal_rank_fusion,
    render_context,
    split_into_chunks,
)


def test_chunks_respect_target_and_keep_all_text() -> None:
    paragraphs = [f"Абзац {i}. " + "слово " * 60 for i in range(12)]
    chunks = split_into_chunks("\n\n".join(paragraphs), target=500, overlap=80)
    assert len(chunks) > 3
    assert all(len(c) <= 500 + 80 + 20 for c in chunks)
    joined = " ".join(chunks)
    assert all(f"Абзац {i}." in joined for i in range(12))


def test_empty_and_blank_text_give_no_chunks() -> None:
    assert split_into_chunks("") == []
    assert split_into_chunks("  \n\n \r\n ") == []


def test_one_very_long_paragraph_is_wrapped() -> None:
    chunks = split_into_chunks("слово " * 1000, target=300, overlap=50)
    assert len(chunks) > 5 and all(len(c) <= 360 for c in chunks)


def test_tsquery_is_or_of_sanitised_words() -> None:
    query = build_or_tsquery("Какая валовая маржа; DROP TABLE x --  (по группам)?")
    assert query is not None
    assert set(query.split(" | ")) >= {"валовая", "маржа", "группам"}
    assert not any(ch in query for ch in "';()-&!:*<>\\")
    assert build_or_tsquery("?! -- ;") is None


def test_rank_fusion_prefers_items_found_by_both() -> None:
    assert reciprocal_rank_fusion([[1, 2, 3], [3, 4, 1]])[:2] == [1, 3]
    assert reciprocal_rank_fusion([]) == []


def test_only_valid_citations_are_returned_in_order() -> None:
    assert cited_refs("Факт [2], ещё [1] и снова [2]; выдуманный [9].", {1, 2, 3}) == [2, 1]
    assert cited_refs("без ссылок", {1}) == []


def test_context_blocks_neutralise_quotes_in_titles() -> None:
    block = render_context([Passage(1, 1, 'Регламент "А"', "текст", ref=1)])
    assert '<source id="1" title="Регламент \'А\'">' in block
    assert "Данные из 1С" in NO_CONTEXT_ANSWER
