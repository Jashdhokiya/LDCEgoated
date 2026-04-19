# EduGuard DBT Backend

## Local backend run

Install Python dependencies and start the API:

```bash
pip install -r requirements.txt
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

## Docker build

This repository now includes a backend-only Docker image. The frontend is not part of the container build.

```bash
docker build -t eduguard-backend .
docker run --rm -p 8080:8080 --env-file .env eduguard-backend
```

## Cloud Run deployment

Use the root `Dockerfile` when deploying to Google Cloud Run. Cloud Run will inject `PORT`, and the container already listens on it.

Recommended environment variables:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRE_HOURS`
- `GROQ_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Example deploy command:

```bash
gcloud run deploy eduguard-backend \
	--source . \
	--region us-east1 \
	--allow-unauthenticated
```
