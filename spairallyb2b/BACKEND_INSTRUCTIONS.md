# Spairally B2B — Go Backend Server Instructions

## Project Structure

```
spairally-backend/
├── go.mod
├── go.sum
├── main.go
├── handlers/
│   ├── auth.go
│   ├── polygon.go
│   ├── detections.go
│   └── users.go
├── middleware/
│   └── jwt.go
├── models/
│   └── user.go
├── data/
│   ├── users.json
│   └── polygons.json
│   └── detections.json
```

---

## 1. Initialize the Module

```bash
mkdir spairally-backend
cd spairally-backend
go mod init spairally-backend
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
go get github.com/rs/cors
```

---

## 2. `go.mod`

```go
module spairally-backend

go 1.22

require (
    github.com/golang-jwt/jwt/v5 v5.2.1
    github.com/rs/cors v1.11.0
    golang.org/x/crypto v0.21.0
)
```

---

## 3. `models/user.go`

```go
package models

type User struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Email       string `json:"email"`
    PasswordHash string `json:"passwordHash"`
    Institution string `json:"institution"`
    Role        string `json:"role"` // "admin" | "user"
    CreatedAt   string `json:"createdAt"`
}
```

---

## 4. `middleware/jwt.go`

```go
package middleware

import (
    "context"
    "net/http"
    "strings"

    "github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("spairally-secret-change-in-prod")

type contextKey string
const ClaimsKey contextKey = "claims"

func Auth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
            http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
            return
        }
        tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
        token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
            return JWTSecret, nil
        })
        if err != nil || !token.Valid {
            http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
            return
        }
        ctx := context.WithValue(r.Context(), ClaimsKey, token.Claims.(jwt.MapClaims))
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

---

## 5. `handlers/auth.go`

Handles `/api/register` (POST) and `/api/login` (POST).

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "os"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "golang.org/x/crypto/bcrypt"

    "spairally-backend/middleware"
    "spairally-backend/models"

    "github.com/google/uuid"
)

const usersFile = "data/users.json"

func loadUsers() ([]models.User, error) {
    data, err := os.ReadFile(usersFile)
    if err != nil {
        return []models.User{}, nil
    }
    var users []models.User
    json.Unmarshal(data, &users)
    return users, nil
}

func saveUsers(users []models.User) error {
    data, _ := json.MarshalIndent(users, "", "  ")
    return os.WriteFile(usersFile, data, 0644)
}

func makeToken(user models.User) (string, error) {
    claims := jwt.MapClaims{
        "id":          user.ID,
        "name":        user.Name,
        "institution": user.Institution,
        "role":        user.Role,
        "exp":         time.Now().Add(72 * time.Hour).Unix(),
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(middleware.JWTSecret)
}

// POST /api/register
// Body: { "name": "...", "email": "...", "password": "...", "institution": "..." }
func Register(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Name        string `json:"name"`
        Email       string `json:"email"`
        Password    string `json:"password"`
        Institution string `json:"institution"`
    }
    json.NewDecoder(r.Body).Decode(&body)

    users, _ := loadUsers()
    for _, u := range users {
        if u.Name == body.Name {
            http.Error(w, `{"error":"user already exists"}`, http.StatusConflict)
            return
        }
    }

    hash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
    user := models.User{
        ID:           uuid.NewString(),
        Name:         body.Name,
        Email:        body.Email,
        PasswordHash: string(hash),
        Institution:  body.Institution,
        Role:         "user",
        CreatedAt:    time.Now().Format(time.RFC3339),
    }
    users = append(users, user)
    saveUsers(users)

    token, _ := makeToken(user)
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "token": token,
        "user":  user,
    })
}

// POST /api/login
// Body: { "name": "...", "password": "..." }
func Login(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Name     string `json:"name"`
        Password string `json:"password"`
    }
    json.NewDecoder(r.Body).Decode(&body)

    users, _ := loadUsers()
    for _, u := range users {
        if u.Name == body.Name {
            if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)) == nil {
                token, _ := makeToken(u)
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{
                    "token": token,
                    "user":  u,
                })
                return
            }
        }
    }
    http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
}
```

> **Note:** Also add `github.com/google/uuid` to go.mod: `go get github.com/google/uuid`

---

## 6. `handlers/polygon.go`

Serves GeoJSON multipolygon based on institution name.

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "os"
)

// GET /api/polygon?institution=<name>
// Returns a GeoJSON Feature with MultiPolygon geometry
func GetPolygon(w http.ResponseWriter, r *http.Request) {
    institution := r.URL.Query().Get("institution")

    data, err := os.ReadFile("data/polygons.json")
    if err != nil {
        http.Error(w, `{"error":"polygons data unavailable"}`, http.StatusInternalServerError)
        return
    }

    var polygons map[string]interface{}
    json.Unmarshal(data, &polygons)

    poly, ok := polygons[institution]
    if !ok {
        http.Error(w, `{"error":"no polygon for institution"}`, http.StatusNotFound)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(poly)
}
```

### `data/polygons.json` format

```json
{
  "Test University": {
    "type": "Feature",
    "geometry": {
      "type": "MultiPolygon",
      "coordinates": [
        [
          [
            [-0.1278, 51.5074],
            [-0.1270, 51.5074],
            [-0.1270, 51.5080],
            [-0.1278, 51.5080],
            [-0.1278, 51.5074]
          ]
        ]
      ]
    },
    "properties": { "name": "Test University Campus", "area_sqm": 48000 }
  }
}
```

---

## 7. `handlers/detections.go`

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "os"
)

// GET /api/detections
// Optional query: ?institution=<name>
func GetDetections(w http.ResponseWriter, r *http.Request) {
    institution := r.URL.Query().Get("institution")

    data, err := os.ReadFile("data/detections.json")
    if err != nil {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode([]interface{}{})
        return
    }

    var detections []map[string]interface{}
    json.Unmarshal(data, &detections)

    if institution != "" {
        filtered := []map[string]interface{}{}
        for _, d := range detections {
            if d["institution"] == institution {
                filtered = append(filtered, d)
            }
        }
        detections = filtered
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(detections)
}
```

### `data/detections.json` format

```json
[
  {
    "id": "d1",
    "type": "Smoke Detection",
    "location": "Building A, Floor 2",
    "institution": "Test University",
    "severity": "high",
    "status": "resolved",
    "time": "2026-03-10T08:32:00Z",
    "coordinates": [-0.1272, 51.5077]
  },
  {
    "id": "d2",
    "type": "Motion Detected",
    "location": "Parking Zone C",
    "institution": "Test University",
    "severity": "low",
    "status": "active",
    "time": "2026-03-10T09:15:00Z",
    "coordinates": [-0.1274, 51.5078]
  }
]
```

---

## 8. `handlers/users.go`

```go
package handlers

import (
    "encoding/json"
    "net/http"
)

// GET /api/users  (protected — admin only in production)
func GetUsers(w http.ResponseWriter, r *http.Request) {
    users, err := loadUsers()
    if err != nil {
        http.Error(w, `{"error":"could not load users"}`, http.StatusInternalServerError)
        return
    }
    // Strip password hashes before sending
    type SafeUser struct {
        ID          string `json:"id"`
        Name        string `json:"name"`
        Email       string `json:"email"`
        Institution string `json:"institution"`
        Role        string `json:"role"`
        CreatedAt   string `json:"createdAt"`
    }
    safe := []SafeUser{}
    for _, u := range users {
        safe = append(safe, SafeUser{
            ID: u.ID, Name: u.Name, Email: u.Email,
            Institution: u.Institution, Role: u.Role, CreatedAt: u.CreatedAt,
        })
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(safe)
}
```

---

## 9. `main.go`

```go
package main

import (
    "fmt"
    "log"
    "net/http"

    "github.com/rs/cors"

    "spairally-backend/handlers"
    "spairally-backend/middleware"
)

func main() {
    mux := http.NewServeMux()

    // Public auth routes
    mux.HandleFunc("POST /auth/register",        handlers.Register)
    mux.HandleFunc("POST /auth/login",           handlers.Login)
    mux.HandleFunc("POST /auth/logout",          handlers.Logout)
    mux.HandleFunc("POST /auth/refresh",         handlers.Refresh)
    mux.HandleFunc("POST /auth/forgot-password", handlers.ForgotPassword)
    mux.HandleFunc("POST /auth/reset-password",  handlers.ResetPassword)

    // Protected auth routes
    mux.Handle("GET /auth/profile", middleware.Auth(http.HandlerFunc(handlers.Profile)))

    // Protected data routes
    mux.Handle("GET /polygon",    middleware.Auth(http.HandlerFunc(handlers.GetPolygon)))
    mux.Handle("GET /detections", middleware.Auth(http.HandlerFunc(handlers.GetDetections)))
    mux.Handle("GET /users",      middleware.Auth(http.HandlerFunc(handlers.GetUsers)))

    // CORS — allow frontend dev server (localhost:3000 or 5173)
    c := cors.New(cors.Options{
        AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"},
        AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowedHeaders:   []string{"Authorization", "Content-Type"},
        AllowCredentials: true,
    })

    port := ":8080"
    fmt.Println("🚀 Spairally backend running on http://localhost" + port)
    log.Fatal(http.ListenAndServe(port, c.Handler(mux)))
}
```

---

## 10. Running the Backend

```bash
# From the spairally-backend/ directory
go mod tidy
go run main.go
```

Server starts at `http://localhost:8080`.

---

## 11. API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/login` | ❌ | Login, receive JWT |
| POST | `/auth/logout` | ✅ Bearer | Invalidate session |
| POST | `/auth/refresh` | ✅ Bearer | Refresh JWT token |
| GET | `/auth/profile` | ✅ Bearer | Get current user profile |
| POST | `/auth/forgot-password` | ❌ | Request password reset |
| POST | `/auth/reset-password` | ❌ | Reset password with token |
| GET | `/polygon?institution=<name>` | ✅ Bearer | Get MultiPolygon GeoJSON |
| GET | `/detections?institution=<name>` | ✅ Bearer | Get detection history |
| GET | `/users` | ✅ Bearer | List all users |

---

## 12. Frontend API Base URL

In the frontend (`app.js`), set:

```js
const api = axios.create({ baseURL: 'http://localhost:8080' });
```

---

## Environment / Production Notes

- Replace `JWTSecret` in `middleware/jwt.go` with an environment variable (`os.Getenv("JWT_SECRET")`).
- Swap JSON file storage for a PostgreSQL or MongoDB database using `database/sql` or `go.mongodb.org/mongo-driver`.
- Add `POST /api/detections` endpoint for IoT sensor ingestion.
- Add role-based access: only `admin` users can call `GET /api/users`.
