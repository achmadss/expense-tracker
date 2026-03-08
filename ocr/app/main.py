import io
import json
import logging
import os
from urllib.parse import urlparse

import httpx
import aio_pika
from paddleocr import PaddleOCR
from PIL import Image
from pdf2image import convert_from_bytes
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="OCR Service")

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672")
OCR_REQUEST_QUEUE = os.getenv("OCR_REQUEST_QUEUE", "ocr_request")
OCR_RESULT_QUEUE = os.getenv("OCR_RESULT_QUEUE", "ocr_result")

MAX_FILE_SIZE = 50 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".pdf"}

ocr_engine: PaddleOCR | None = None


def get_ocr_engine() -> PaddleOCR:
    global ocr_engine
    if ocr_engine is None:
        ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False, show_log=False)
    return ocr_engine


def validate_image_size(content: bytes) -> None:
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )


def validate_url_extension(url: str) -> bool:
    parsed = urlparse(url.lower())
    path = parsed.path
    return any(path.endswith(ext) for ext in SUPPORTED_EXTENSIONS)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


async def process_ocr_from_url(url: str) -> str:
    if not validate_url_extension(url):
        raise ValueError(
            f"URL must point to a supported file format: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    if url.lower().endswith(".pdf"):
        return await process_pdf_from_url(url)

    ocr = get_ocr_engine()
    result = ocr.ocr(url, cls=True)

    text_lines = []
    if result and result[0]:
        for line in result[0]:
            if line and len(line) >= 2:
                text_lines.append(line[1][0])
    return "\n".join(text_lines).strip()


async def process_pdf_from_url(url: str) -> str:
    async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise ValueError("Failed to download PDF")

        validate_image_size(response.content)
        images = convert_from_bytes(response.content)

        ocr = get_ocr_engine()
        all_text_lines = []

        for image in images:
            img_bytes = io.BytesIO()
            image.save(img_bytes, format="PNG")
            img_bytes.seek(0)

            result = ocr.ocr(img_bytes.getvalue(), cls=True)
            if result and result[0]:
                for line in result[0]:
                    if line and len(line) >= 2:
                        all_text_lines.append(line[1][0])

        return "\n".join(all_text_lines).strip()


async def on_message(message: aio_pika.IncomingMessage):
    async with message.process():
        data = {}
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

    get_ocr_engine()
    asyncio.create_task(start_rabbitmq_consumer())
