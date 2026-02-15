import pytest
from unittest.mock import patch


class TestEncryptionService:
    @pytest.fixture(autouse=True)
    def setup_fernet_key(self):
        from cryptography.fernet import Fernet
        key = Fernet.generate_key().decode()
        with patch("app.services.encryption_service.settings") as mock_settings:
            mock_settings.FERNET_KEY = key
            yield mock_settings

    def test_encrypt_and_decrypt_roundtrip(self):
        from app.services.encryption_service import encrypt, decrypt
        original = "sk-my-secret-api-key-12345"
        encrypted = encrypt(original)
        decrypted = decrypt(encrypted)
        assert decrypted == original

    def test_encrypted_value_differs_from_plaintext(self):
        from app.services.encryption_service import encrypt
        original = "sk-my-secret-api-key-12345"
        encrypted = encrypt(original)
        assert encrypted != original

    def test_decrypt_with_wrong_key_fails(self):
        from app.services.encryption_service import encrypt
        from cryptography.fernet import Fernet, InvalidToken
        encrypted = encrypt("secret")
        wrong_key = Fernet.generate_key().decode()
        f = Fernet(wrong_key.encode())
        with pytest.raises(InvalidToken):
            f.decrypt(encrypted.encode())
