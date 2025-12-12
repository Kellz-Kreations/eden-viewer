from zoneinfo import available_timezones as a; import sys; tz=a(); print(f"timezones={len(tz)}"); sys.exit(0 if tz else 1)
