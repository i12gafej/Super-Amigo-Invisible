"""Integration checks for the disposable CI database, never a production database."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import hashlib
import json
import subprocess
import uuid


def sql(statement):
    return subprocess.run(
        ["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement],
        text=True, capture_output=True, check=False,
    )


def run(statement):
    result = sql(statement)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def quoted(value):
    return "'" + str(value).replace("'", "''") + "'"


def register(room, name, normalized):
    token_hash = hashlib.sha256(uuid.uuid4().bytes).hexdigest()
    return (
        "select public.register_participant("
        + ",".join(quoted(v) for v in [room, name, normalized, token_hash, "ci-only-cipher"])
        + ",false);"
    )


def simultaneous(statements):
    barrier = Barrier(len(statements))

    def worker(statement):
        barrier.wait()
        return sql(statement)

    with ThreadPoolExecutor(max_workers=len(statements)) as executor:
        return list(executor.map(worker, statements))


room = "ci-concurrency-" + uuid.uuid4().hex
run(
    "insert into public.rooms(id,name,event_date,password_hash,admin_password_hash) values ("
    + quoted(room)
    + ",'Concurrency test','2026-12-25',extensions.crypt('room-test',extensions.gen_salt('bf',4)),"
    + "extensions.crypt('admin-test',extensions.gen_salt('bf',4)));"
)
results = simultaneous([register(room, "Ana Garcia", "ana garcia") for _ in range(2)])
assert sum(r.returncode == 0 for r in results) == 1, "Concurrent duplicate registration succeeded twice"
assert any("DUPLICATE" in r.stderr for r in results), "Missing duplicate rejection"
a = run("select id from public.participants where room_id=" + quoted(room) + ";")
b = run(register(room, "Pablo Martin", "pablo martin"))
revision = run("select revision from public.rooms where id=" + quoted(room) + ";")
pairs = json.dumps([{"giver_id": a, "recipient_id": b}, {"giver_id": b, "recipient_id": a}])
statement = "select public.commit_draw(" + quoted(room) + "," + revision + "," + quoted(pairs) + "::jsonb);"
results = simultaneous([statement, statement])
assert sum(r.returncode == 0 for r in results) == 1, "Two concurrent draws replaced the same snapshot"
assert any("STALE" in r.stderr for r in results), "Missing stale snapshot rejection"
assert run("select count(*) from public.draws where room_id=" + quoted(room) + ";") == "1"
assert run("select count(*) from public.assignments where room_id=" + quoted(room) + ";") == "2"
assert run("select closed from public.rooms where id=" + quoted(room) + ";") == "t"
print("Concurrent registration and draw checks passed.")
