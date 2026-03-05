#!/bin/bash
set -e

REPORT_DIR="tests/reports"
LOG_DIR="tests/logs"
mkdir -p "$REPORT_DIR" "$LOG_DIR"

UNIT_LOG="$LOG_DIR/unit.log"
INTEGRATION_LOG="$LOG_DIR/integration.log"
SECURITY_LOG="$LOG_DIR/security.log"
COVERAGE_JSON="$REPORT_DIR/coverage-final.json"
COVERAGE_HTML="$REPORT_DIR/coverage-html"


# Run all tests with coverage.
npm test -- --coverage || exit 1

exit 0
