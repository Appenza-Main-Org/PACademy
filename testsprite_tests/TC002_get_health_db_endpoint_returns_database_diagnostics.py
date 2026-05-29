import requests

BASE_URL = "http://localhost:5101"
TIMEOUT = 30

def test_tc002_get_health_db_endpoint_returns_database_diagnostics():
    url = f"{BASE_URL}/health/db"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError as e:
        assert False, f"Response is not valid JSON: {e}"

    # Validate expected keys for database diagnostics
    expected_keys = {"provider", "schema", "connection-name"}
    assert isinstance(data, dict), "Response JSON is not an object"
    missing_keys = expected_keys - set(data.keys())
    assert not missing_keys, f"Missing keys in response: {missing_keys}"

    # Additional type checks (basic)
    assert isinstance(data["provider"], str) and data["provider"], "Invalid or empty 'provider'"
    assert isinstance(data["schema"], str) and data["schema"], "Invalid or empty 'schema'"
    assert isinstance(data["connection-name"], str) and data["connection-name"], "Invalid or empty 'connection-name'"

test_tc002_get_health_db_endpoint_returns_database_diagnostics()