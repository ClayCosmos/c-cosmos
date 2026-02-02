package service

// Search service is handled directly by the SearchHandler using sqlc queries.
// PostgreSQL tsvector full-text search is used via generated stored columns.
// See migrations/001_init.up.sql for the tsvector column definitions.
