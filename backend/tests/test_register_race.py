"""Concurrent signups with the same email."""
import threading


def test_simultaneous_duplicate_registration_one_wins_no_500(client):
    results = []
    barrier = threading.Barrier(2)

    def go():
        barrier.wait()
        r = client.post("/api/v1/auth/register", json={"email": "dup@test.com", "password": "password123"})
        results.append(r.status_code)

    ts = [threading.Thread(target=go) for _ in range(2)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(results) == [201, 409]
