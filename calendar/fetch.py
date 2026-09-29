import json, urllib.request, time, sys

STATES = ["BW","BY","BE","BB","HB","HH","HE","MV","NI","NW","RP","SL","SN","ST","SH","TH"]
RANGES = [("2024-01-01","2026-12-30"), ("2026-12-31","2029-12-30")]

def fetch(kind, state, vf, vt):
    url = f"https://openholidaysapi.org/{kind}?countryIsoCode=DE&languageIsoCode=DE&validFrom={vf}&validTo={vt}&subdivisionCode=DE-{state}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            print("retry", kind, state, vf, e, file=sys.stderr)
            time.sleep(2)
    raise SystemExit(f"failed {kind} {state} {vf}")

all_school = {}
all_public = {}
names = {}

for state in STATES:
    school = []
    public = []
    for vf, vt in RANGES:
        school += fetch("SchoolHolidays", state, vf, vt)
        public += fetch("PublicHolidays", state, vf, vt)
    all_school[state] = school
    all_public[state] = public
    print(state, "school", len(school), "public", len(public), file=sys.stderr)

with open("school_raw.json", "w") as f:
    json.dump(all_school, f)
with open("public_raw.json", "w") as f:
    json.dump(all_public, f)
print("done", file=sys.stderr)
