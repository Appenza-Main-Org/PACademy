import requests

BASE_URL = "http://localhost:5101"

def test_get_health_endpoint_returns_basic_health_status():
    url = f"{BASE_URL}/health"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"GET request to /health failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, dict), "Response JSON is not an object"

    # Basic health status checks - the API is operational
    # Since no schema specified, check some common health keys or just presence of keys
    # We'll check that keys exist and some indication of status in the content
    assert any(key in data for key in ['status', 'health', 'message', 'version']), \
        "Health response does not contain expected status indicator keys"

test_get_health_endpoint_returns_basic_health_status()