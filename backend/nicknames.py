"""Optional nicknames: validation and the tap-to-pick generator.

A nickname is shown only to its owner (Profile screen, shareable badge card).
It is never sent to Loops or Sentry and never attached to a report.
"""
import re
import secrets
from typing import Iterable

MIN_LEN, MAX_LEN = 3, 20

# Letters, digits, spaces, hyphens and underscores; must start and end with a
# letter or digit; no doubled separators.
_SHAPE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9]|[ _-](?=[A-Za-z0-9]))*$")
# Five or more digits in a row could be a phone number, ZIP or ID.
_LONG_NUMBER = re.compile(r"\d{5,}")

# Substring match, case- and separator-insensitive. Names that impersonate the
# app or staff, plus a short list of slurs and obscenities. Not exhaustive: the
# generator is the main path and custom names are the fallback.
_BLOCKED = (
    "medscout", "admin", "moderator", "support", "official", "staff", "pharmacist",
    "doctor", "fuck", "shit", "cunt", "bitch", "nigg", "fag", "retard", "whore",
    "slut", "rape", "nazi", "hitler", "kkk",
)

ADJECTIVES = (
    "Brave", "Calm", "Clever", "Cozy", "Curious", "Daring", "Eager", "Gentle",
    "Happy", "Jolly", "Kind", "Loyal", "Lucky", "Merry", "Nimble", "Patient",
    "Plucky", "Quick", "Quiet", "Sunny", "Swift", "Steady", "Trusty", "Witty",
)
ANIMALS = (
    "Beagle", "Collie", "Corgi", "Pug", "Husky", "Poodle", "Terrier", "Retriever",
    "Spaniel", "Setter", "Pointer", "Whippet", "Otter", "Fox", "Owl", "Badger",
    "Heron", "Robin", "Panda", "Koala", "Lynx", "Moose", "Puffin", "Wombat",
)


class NicknameError(ValueError):
    pass


def normalize(raw: str) -> str:
    """Trim and collapse runs of spaces."""
    return " ".join(raw.split())


def validate(raw: str) -> str:
    """The cleaned nickname, or NicknameError with a user-facing message."""
    name = normalize(raw)
    if not MIN_LEN <= len(name) <= MAX_LEN:
        raise NicknameError(f"Nicknames are {MIN_LEN}–{MAX_LEN} characters.")
    if not _SHAPE.match(name):
        raise NicknameError("Use letters, numbers, spaces, - or _, starting and ending with a letter or number.")
    if _LONG_NUMBER.search(name):
        raise NicknameError("Nicknames can't contain long numbers.")
    squashed = re.sub(r"[ _-]", "", name).lower()
    if any(word in squashed for word in _BLOCKED):
        raise NicknameError("That nickname isn't allowed. Try one of the suggestions.")
    return name


def suggestions(taken: Iterable[str] = (), count: int = 5) -> list[str]:
    """`count` distinct adjective+animal names not in `taken` (case-insensitive).
    Adds a two-digit number once plain names keep colliding."""
    taken_lower = {t.lower() for t in taken}
    out: list[str] = []
    for attempt in range(count * 20):
        name = f"{secrets.choice(ADJECTIVES)} {secrets.choice(ANIMALS)}"
        if attempt >= count * 5:
            name += f" {secrets.randbelow(90) + 10}"
        if name.lower() not in taken_lower and name not in out:
            out.append(name)
            if len(out) == count:
                break
    return out
