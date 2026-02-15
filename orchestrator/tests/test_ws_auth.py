import pytest
from jose import jwt
from unittest.mock import AsyncMock, MagicMock, patch


class TestWebSocketAuth:
    def test_valid_token_decodes(self):
        """Test that a valid JWT can be decoded."""
        secret = "test-secret"
        payload = {"sub": "42", "type": "access"}
        token = jwt.encode(payload, secret, algorithm="HS256")
        decoded = jwt.decode(token, secret, algorithms=["HS256"])
        assert decoded["sub"] == "42"

    def test_invalid_token_raises(self):
        """Test that an invalid token raises."""
        from jose import JWTError
        with pytest.raises(JWTError):
            jwt.decode("bad-token", "secret", algorithms=["HS256"])
