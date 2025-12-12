import re
from typing import Any, Dict


class InstructionConstraintEvaluator:
    """Objective checks aligned to repo guardrails.

    Not an LLM judge. It flags obvious violations like suggesting disallowed apps.
    """

    _disallowed = re.compile(r"(?i)\b(qbittorrent|sabnzbd|prowlarr|jackett|deluge|transmission|torrent|tracker|indexer)\b")

    def __call__(self, *, query: str, response: str, **kwargs) -> Dict[str, Any]:
        txt = response or ""

        has_disallowed = bool(self._disallowed.search(txt))
        mentions_core = all(k in txt.lower() for k in ("plex", "sonarr", "radarr"))

        return {
            "violates_disallowed_apps": 1 if has_disallowed else 0,
            "mentions_core_services": 1 if mentions_core else 0,
        }


class EnvFormatEvaluator:
    """Checks that a generated .env is present and sane.

    Evaluates:
    - required keys present
    - no duplicate keys
    - values match expected columns when provided
    """

    _line_re = re.compile(r"^(?P<k>[A-Za-z0-9_]+)=(?P<v>.*)$")

    def __call__(self, *, response: str, expected_appdata_root: str = "", expected_data_root: str = "", expected_transcode_root: str = "", expected_puid: str = "", expected_pgid: str = "", expected_tz: str = "", **kwargs) -> Dict[str, Any]:
        text = (response or "").replace("\r\n", "\n")
        lines = [ln.strip() for ln in text.split("\n") if ln.strip() and not ln.strip().startswith("#")]

        parsed: Dict[str, str] = {}
        duplicate = 0
        invalid = 0

        for ln in lines:
            m = self._line_re.match(ln)
            if not m:
                invalid += 1
                continue
            k = m.group("k")
            v = m.group("v")
            if k in parsed:
                duplicate += 1
            parsed[k] = v

        required = ["APPDATA_ROOT", "DATA_ROOT", "TRANSCODE_ROOT", "PUID", "PGID", "TZ", "PLEX_CLAIM", "ADVERTISE_IP"]
        missing = [k for k in required if k not in parsed]

        def eq(key: str, expected: str) -> int:
            if not expected:
                return 1
            return 1 if parsed.get(key, "") == expected else 0

        return {
            "env_missing_required_keys": len(missing),
            "env_invalid_lines": invalid,
            "env_duplicate_keys": duplicate,
            "env_matches_appdata_root": eq("APPDATA_ROOT", expected_appdata_root),
            "env_matches_data_root": eq("DATA_ROOT", expected_data_root),
            "env_matches_transcode_root": eq("TRANSCODE_ROOT", expected_transcode_root),
            "env_matches_puid": eq("PUID", expected_puid),
            "env_matches_pgid": eq("PGID", expected_pgid),
            "env_matches_tz": eq("TZ", expected_tz),
        }
