from dataclasses import dataclass


@dataclass
class EmailPayload:
    recipient: str
    subject: str
    text_body: str
