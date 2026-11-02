import argparse
import asyncio

from app.config.logging import configure_logging
from app.temporal.worker import run_worker


def main() -> None:
    parser = argparse.ArgumentParser(description="Tech Adviser Temporal worker")
    parser.parse_args()
    configure_logging()
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
