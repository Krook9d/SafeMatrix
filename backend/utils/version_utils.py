"""
Simple version comparison utilities to handle common dotted numeric versions (e.g., 2.46, 1.10.3).
This is not a full semantic version parser but sufficient for comparing numeric parts.
"""
from typing import Optional


def _normalize(v: Optional[str]) -> list[int]:
    if not v:
        return []
    # Keep only digits and dots; split and convert to ints, ignoring non-numeric tails
    parts: list[int] = []
    for token in str(v).split('.'):
        num = ''
        for ch in token:
            if ch.isdigit():
                num += ch
            else:
                break
        if num == '':
            parts.append(0)
        else:
            parts.append(int(num))
    return parts


def compare_versions(a: Optional[str], b: Optional[str]) -> int:
    """
    Compare two version strings numerically.
    Returns -1 if a < b, 0 if equal, +1 if a > b.
    """
    pa, pb = _normalize(a), _normalize(b)
    # Pad to same length
    max_len = max(len(pa), len(pb))
    pa.extend([0] * (max_len - len(pa)))
    pb.extend([0] * (max_len - len(pb)))
    for x, y in zip(pa, pb):
        if x < y:
            return -1
        if x > y:
            return 1
    return 0


def in_version_range(version: Optional[str], start_incl: Optional[str] = None, start_excl: Optional[str] = None,
                     end_incl: Optional[str] = None, end_excl: Optional[str] = None) -> bool:
    """
    Check if a version is within the given range constraints.
    Any missing boundary is treated as unbounded in that direction.
    """
    if version is None:
        # If we don't know the version, conservatively return False (cannot assert affected)
        return False

    if start_incl is not None and compare_versions(version, start_incl) < 0:
        return False
    if start_excl is not None and compare_versions(version, start_excl) <= 0:
        return False
    if end_incl is not None and compare_versions(version, end_incl) > 0:
        return False
    if end_excl is not None and compare_versions(version, end_excl) >= 0:
        return False
    return True
