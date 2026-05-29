import requests

BASE_URL = "http://localhost:5101"
TIMEOUT = 30

def test_get_health_db_returns_error_on_inmemory_provider():
    url = f"{BASE_URL}/health/db"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        # We expect a 500 status code
        assert response.status_code == 500, f"Expected status code 500, got {response.status_code}"
        json_response = response.json()
        # Validate that it has an error envelope indicating relational diagnostics unavailable
        assert isinstance(json_response, dict), "Response is not a JSON object"
        # Check specific expected detail message
        detail = json_response.get('detail', '')
        assert isinstance(detail, str), "Detail field is not a string"
        assert "relational-specific methods" in detail.lower(), f"Expected 'relational-specific methods' in detail, got: {detail}"
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {str(e)}"

test_get_health_db_returns_error_on_inmemory_provider()