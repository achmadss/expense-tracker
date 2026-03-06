import io
import json
import logging
import os
from typing import Optional
from urllib.parse import urlparse

import pytesseract
import httpx
import aio_pika
from paddleocr import PaddleOCR
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="OCR Service")

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672")
OCR_REQUEST_QUEUE = os.getenv("OCR_REQUEST_QUEUE", "ocr_request")
OCR_RESULT_QUEUE = os.getenv("OCR_RESULT_QUEUE", "ocr_result")

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


def perform_easyocr(image: Image.Image) -> str:
    ocr = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False, show_log=False)
    img_bytes = io.BytesIO()
    image.save(img_bytes, format="PNG")
    img_bytes.seek(0)
    result = ocr.ocr(img_bytes.getvalue(), cls=True)
    text_lines = []
    if result and result[0]:
        for line in result[0]:
            if line and len(line) >= 2:
                text_lines.append(line[1][0])
    return "\n".join(text_lines).strip()


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

        text = perform_easyocr(image)

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

            text = perform_easyocr(image)

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


async def process_ocr_from_url(url: str) -> str:
    if not validate_url_extension(url):
        raise ValueError(
            f"URL must point to a supported image format: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        response = await client.get(url)

        if response.status_code != 200:
            raise ValueError("URL does not return a valid response")

        content_type = response.headers.get("content-type", "")
        content = response.content

        validate_image_size(content)
        validate_content_type(content_type)

        image = Image.open(io.BytesIO(content))

        if image.format not in SUPPORTED_PIL_FORMATS:
            raise ValueError("Unsupported image format from URL")

        text = perform_easyocr(image)
        return text


async def on_message(message: aio_pika.IncomingMessage):
    async with message.process():
        try:
            data = json.loads(message.body.decode())
            request_id = data.get("requestId", "unknown")
            url = data.get("url")

            logger.info(f"Processing OCR request {request_id}: {url}")

            text = await process_ocr_from_url(url)

            result = {
                "requestId": request_id,
                "url": url,
                "content": text,
                "error": None,
            }

            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            channel = await connection.channel()
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(result).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=OCR_RESULT_QUEUE,
            )
            await connection.close()

            logger.info(f"OCR request {request_id} completed")

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            result = {
                "requestId": data.get("requestId", "unknown"),
                "url": data.get("url"),
                "content": "",
                "error": str(e),
            }

            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            channel = await connection.channel()
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(result).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=OCR_RESULT_QUEUE,
            )
            await connection.close()


async def start_rabbitmq_consumer():
    for attempt in range(10):
        try:
            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            channel = await connection.channel()

            await channel.set_qos(prefetch_count=1)

            request_queue = await channel.declare_queue(OCR_REQUEST_QUEUE, durable=True)
            await channel.declare_queue(OCR_RESULT_QUEUE, durable=True)

            await request_queue.consume(on_message)

            logger.info(f"RabbitMQ consumer started, listening on {OCR_REQUEST_QUEUE}")
            return
        except Exception as e:
            logger.warning(
                f"RabbitMQ not ready, retrying in 3s... ({attempt + 1}/10): {e}"
            )
            import asyncio

            await asyncio.sleep(3)


@app.on_event("startup")
async def startup():
    import asyncio

    asyncio.create_task(start_rabbitmq_consumer())
