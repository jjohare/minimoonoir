#!/bin/bash
# Deploy Image API to Cloud Run
# Usage: ./deploy.sh [tag]

set -e

PROJECT_ID="cumbriadreamlab"
REGION="us-central1"
SERVICE_NAME="image-api"
REPO="minimoonoir"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}"
TAG="${1:-latest}"
SERVICE_ACCOUNT="fairfield-applications@${PROJECT_ID}.iam.gserviceaccount.com"
GCS_BUCKET="minimoonoir-images"

echo "=== Image API Deployment ==="
echo "Image: ${IMAGE_NAME}:${TAG}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

echo "Building..."
docker build -t ${IMAGE_NAME}:${TAG} -t ${IMAGE_NAME}:latest .

echo "Pushing..."
docker push ${IMAGE_NAME}:${TAG}
docker push ${IMAGE_NAME}:latest

echo "Deploying..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME}:${TAG} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --service-account ${SERVICE_ACCOUNT} \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars "GCS_BUCKET=${GCS_BUCKET},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "Deployed: ${SERVICE_URL}"
curl -s "${SERVICE_URL}/health" | jq . 2>/dev/null || true
