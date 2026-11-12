from passlib.context import CryptContext

# Hashes bcrypt ($2b$): compatibles con las claves ya guardadas en la base
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError: # Hash corrupto o en un formato desconocido
        return False
