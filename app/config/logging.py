import logging
import logging.config
import sys

from app.context import request_id_var


class RequestIdFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        record.request_id = getattr(record, "request_id", None) or request_id_var.get() or "-"
        return super().format(record)


def configure_logging() -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": RequestIdFormatter,
                    "format": "%(asctime)s %(levelname)s [%(name)s] "
                    "request_id=%(request_id)s %(message)s",
                    "datefmt": "%Y-%m-%d %H:%M:%S",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "stream": sys.stdout,
                    "formatter": "default",
                }
            },
            "root": {"level": "INFO", "handlers": ["console"]},
            "loggers": {
                # HTTP requests are logged by RequestContextMiddleware.
                "uvicorn.access": {"level": "WARNING", "handlers": ["console"], "propagate": False}
            },
        }
    )
