package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labbed/platform/internal/config"
)

type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

type Claims struct {
	UserID  string    `json:"user_id"`
	Email   string    `json:"email"`
	IsAdmin bool      `json:"is_admin"`
	Type    TokenType `json:"type"`
	jwt.RegisteredClaims
}

func GenerateAccessToken(userID, email string, isAdmin bool) (string, error) {
	return generateToken(userID, email, isAdmin, AccessToken, config.AppConfig.Auth.AccessTokenExpiry)
}

func GenerateRefreshToken(userID, email string, isAdmin bool) (string, error) {
	return generateToken(userID, email, isAdmin, RefreshToken, config.AppConfig.Auth.RefreshTokenExpiry)
}

func generateToken(userID, email string, isAdmin bool, tokenType TokenType, expiry time.Duration) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID:  userID,
		Email:   email,
		IsAdmin: isAdmin,
		Type:    tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.Auth.JWTSecret))
}

func ValidateToken(tokenString string, expectedType TokenType) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(config.AppConfig.Auth.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	if claims.Type != expectedType {
		return nil, errors.New("wrong token type")
	}
	if claims.ExpiresAt != nil && time.Now().After(claims.ExpiresAt.Time) {
		return nil, errors.New("token expired")
	}
	return claims, nil
}
