package apierr

import "net/http"

type APIError struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *APIError) Error() string { return e.Message }

func BadRequest(msg string) *APIError {
	return &APIError{Status: http.StatusBadRequest, Code: "bad_request", Message: msg}
}

func Unauthorized(msg string) *APIError {
	return &APIError{Status: http.StatusUnauthorized, Code: "unauthorized", Message: msg}
}

func Forbidden(msg string) *APIError {
	return &APIError{Status: http.StatusForbidden, Code: "forbidden", Message: msg}
}

func NotFound(msg string) *APIError {
	return &APIError{Status: http.StatusNotFound, Code: "not_found", Message: msg}
}

func Conflict(msg string) *APIError {
	return &APIError{Status: http.StatusConflict, Code: "conflict", Message: msg}
}

func Internal(msg string) *APIError {
	return &APIError{Status: http.StatusInternalServerError, Code: "internal_error", Message: msg}
}
