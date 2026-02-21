import io
import logging
from typing import Optional
from urllib.parse import urlparse

import pytesseract
import httpx
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="OCR Service")

MAX_FILE_SIZE = 50 * 1024 * 1024
SUPPORTED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/bmp",
    "image/webp",
    "application/octet-stream",
}

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}

SUPPORTED_PIL_FORMATS = {"PNG", "JPEG", "BMP", "WEBP"}


def validate_image_size(content: bytes) -> None:
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )


def validate_content_type(content_type: Optional[str]) -> None:
    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image format. Supported: {', '.join(SUPPORTED_CONTENT_TYPES)}",
        )


def validate_url_extension(url: str) -> bool:
    parsed = urlparse(url.lower())
    path = parsed.path
    return any(path.endswith(ext) for ext in SUPPORTED_EXTENSIONS)


def perform_ocr(image: Image.Image) -> str:
    custom_config = r"--oem 3 --psm 6"
    text = pytesseract.image_to_string(image, lang="eng+ind", config=custom_config)
    return text.strip()


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/ocr/tesseract")
async def tesseract_ocr_from_file(file: UploadFile = File(...)):
    content = await file.read()

    validate_image_size(content)
    validate_content_type(file.content_type)

    try:
        image = Image.open(io.BytesIO(content))

        if image.format not in SUPPORTED_PIL_FORMATS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Unsupported image format",
            )

        text = perform_ocr(image)

        return JSONResponse(content={"content": text})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process image",
        )


@app.post("/ocr/tesseract/url")
async def tesseract_ocr_from_url(payload: dict):
    url = payload.get("url")

    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="URL is required"
        )

    if not validate_url_extension(url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"URL must point to a supported image format: {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            response = await client.get(url)

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL does not return a valid response",
                )

            content_type = response.headers.get("content-type", "")
            content = response.content

            validate_image_size(content)
            validate_content_type(content_type)

            image = Image.open(io.BytesIO(content))

            if image.format not in SUPPORTED_PIL_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Unsupported image format from URL",
                )

            text = perform_ocr(image)

            return JSONResponse(content={"content": text})

    except HTTPException:
        raise
    except httpx.RequestError as e:
        logger.error(f"Failed to fetch URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch image from URL",
        )
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process image",
        )
