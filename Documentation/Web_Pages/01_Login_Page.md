# Page 1: User Login Page

* **Route**: `/login`
* **Target Audience**: All users accessing the portal.
* **Primary Goal**: Securely authenticate users, generate session tokens, and load personal layout preferences.

---

## 📐 Visual Layout & Wireframe

```
+--------------------------------------------------------+
|                                                        |
|                   [ Application Logo ]                 |
|             Federated VCF Operations Portal            |
|                                                        |
|        Username: [_____________________________]       |
|        Password: [_____________________________]       |
|                                                        |
|                    [  Sign In  ]                       |
|                                                        |
|  [!] Invalid credentials or session expired.           |
|                                                        |
+--------------------------------------------------------+
```

---

## ⚡ Key Functions & Controls

1. **Credentials Form**: Input fields for Username and Password with auto-focus on load.
2. **Sign In Action Button**: Triggers `POST /api/v1/auth/login` payload validation.
3. **Session Persistence**: Sets secure HTTP-only cookie or JWT session bearer token upon successful authentication.
4. **Automatic Redirect**: Redirects authenticated users directly to `/` (Personalized Home Page).
5. **Inline Error Messaging**: Displays dynamic error banners for expired sessions or invalid credentials.

---

## 🔌 API Endpoints & State Machine

* `POST /api/v1/auth/login`: Submits login payload (`{ username, password }`).
* `GET /api/v1/auth/me`: Validates existing session tokens on initial app load.
