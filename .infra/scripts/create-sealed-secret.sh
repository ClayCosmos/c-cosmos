#!/bin/bash
# Create SealedSecret for ClayCosmos Server
#
# Usage:
#   ./create-sealed-secret.sh <env-file>
#
# Example:
#   ./create-sealed-secret.sh ../../server/.env

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/bored-snake-kubeconfig.yaml}"

ENV_FILE=${1:-}

if [ -z "$ENV_FILE" ]; then
    echo "Usage: $0 <env-file>"
    echo ""
    echo "Example:"
    echo "  $0 ../../server/.env"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found: $ENV_FILE"
    exit 1
fi

if [ ! -f "$KUBECONFIG" ]; then
    echo "Error: Kubeconfig not found: $KUBECONFIG"
    exit 1
fi

NAMESPACE="claycosmos"
SECRET_NAME="claycosmos-server-secrets"
OUTPUT_FILE="$SCRIPT_DIR/../argocd/manifests/server/overlays/prod/sealed-secret.yaml"

DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2-)
REDIS_URL=$(grep "^REDIS_URL=" "$ENV_FILE" | cut -d '=' -f2-)

if [ -z "$DATABASE_URL" ] || [ -z "$REDIS_URL" ]; then
    echo "Error: DATABASE_URL and REDIS_URL are required in $ENV_FILE"
    exit 1
fi

echo "============================================"
echo "Creating SealedSecret for ClayCosmos"
echo "============================================"
echo "Kubeconfig:  $KUBECONFIG"
echo "Namespace:   $NAMESPACE"
echo "Output:      $OUTPUT_FILE"
echo ""

kubectl create secret generic "$SECRET_NAME" \
    --namespace="$NAMESPACE" \
    --from-literal=DATABASE_URL="$DATABASE_URL" \
    --from-literal=REDIS_URL="$REDIS_URL" \
    --dry-run=client -o yaml | \
    kubeseal --controller-name=sealed-secrets --controller-namespace=sealed-secrets --format yaml > "$OUTPUT_FILE"

echo "Created: $OUTPUT_FILE"
echo ""
echo "Next: git add && git commit && git push"
