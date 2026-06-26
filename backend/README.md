# Seapedia Backend

This is the backend API application for Seapedia.

## Authentication System

The backend implements JWT-based authentication using HS256 algorithm with the secret defined in the `JWT_SECRET` environment variable.

### Auth API Endpoints

- **POST `/api/auth/register`**: Register a new user. Default role is `BUYER`. Returns the user profile without the password.
- **POST `/api/auth/login`**: Authenticate with email/password.
  - If the user has a single role, returns JWT with `{ userId, activeRole }`.
  - If the user has multiple roles, returns JWT with `{ userId, roles }` (without `activeRole`).
- **POST `/api/auth/select-role`**: Select an active role for the session. Protected by Bearer token authentication. Returns a new JWT containing the selected `activeRole`.
- **POST `/api/auth/logout`**:
  - The client is responsible for dropping/clearing the JWT token from local storage or cookie state when this endpoint is called.
  - Returns a standard success response: `{ "message": "Logout successful" }`.
- **GET `/api/auth/me`**: Get current logged-in user profile, roles, and active role. Protected by Bearer token authentication.
