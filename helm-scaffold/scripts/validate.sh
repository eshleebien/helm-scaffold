#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: validate.sh <release> <chart-path> <namespace> [env]" >&2
  exit 1
}

[[ $# -lt 3 ]] && usage

RELEASE="$1"
CHART="$2"
NAMESPACE="$3"
ENV="${4:-}"

# --- helm lint ---
echo "==> Running helm lint..."
if ! helm lint "$CHART" 2>&1; then
  echo "ERROR: helm lint failed for chart at $CHART" >&2
  exit 1
fi

# --- helm dry-run ---
echo "==> Running helm upgrade --dry-run..."
VALUES_FLAGS="-f $CHART/values.yaml"
if [[ -n "$ENV" ]]; then
  VALUES_FLAGS="$VALUES_FLAGS -f $CHART/values.${ENV}.yaml"
fi

# shellcheck disable=SC2086
if ! helm upgrade --install --dry-run "$RELEASE" "$CHART" \
     -n "$NAMESPACE" --create-namespace \
     $VALUES_FLAGS 2>&1; then
  echo "ERROR: helm dry-run failed for release $RELEASE in namespace $NAMESPACE" >&2
  exit 1
fi

echo "Validation passed"
