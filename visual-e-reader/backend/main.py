import os
import uuid
import requests
import logging
import uvicorn
import replicate
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_text(prompt,
                  api_key,
                  model,
                  model_params={},
                  max_attempts=3,
                  wait_secs=5):

    for attempt_i in range(max_attempts):
        try:
            client = replicate.client.Client(api_token=api_key)
            output = client.run(
                model, input={"prompt": prompt, **model_params})
            logging.info("Completed text generation")
            output = "".join(output)
        except Exception as e:
            if isinstance(e, KeyboardInterrupt):
                raise
            logging.info("LLM API failure: {}".format(e))
            output = None
            time.sleep(wait_secs)
    return output


def generate_image(prompt,
                   api_key,
                   model,
                   parameters={},
                   max_attempts=3,
                   wait_secs=2):
    for attempt_i in range(max_attempts):
        client = replicate.client.Client(api_token=api_key)
        try:
            output = client.run(model, input={"prompt": prompt, **parameters})
            if not output:
                raise
            logging.info("Completed image generation")
            return output
        except Exception as e:
            if isinstance(e, KeyboardInterrupt):
                raise
            if "NSFW" in str(e):  # Prompt was blocked, don't bother re-trying
                break
            time.sleep(wait_secs)

    logging.info("Job failure")
    return None


app = FastAPI(title="Image Generation API", version="1.0.0")

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                   "http://127.0.0.1:5173",
                   "http://localhost:8080",
                   "http://127.0.0.1:8080"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LLMRequest(BaseModel):
    prompt: str
    api_key: str = os.environ["REPLICATE_API_KEY"]
    model: str = "meta/meta-llama-3.1-405b-instruct"
    parameters: dict = {"max_tokens": 150}


class ImageGenerationRequest(BaseModel):
    prompt: str
    api_key: str = os.environ["REPLICATE_API_KEY"]
    model: str = "black-forest-labs/flux-1.1-pro"
    parameters: dict = {"output_format": "png"}


class EnvisionResponse(BaseModel):
    image_id: str
    imggen_prompt: str
    status: str


class EnvisionRequest(BaseModel):
    passage: str
    context: str
    imggen_base_prompt: str = None
    imggen_style_description: str = "Colored pencil illustration style."

    @property
    def llm_prompt(self) -> str:
        return f"""You are operating inside a "visual e-reader" application that envisions highlighted passages of text as images using an AI text-to-image generation model. Your task is to consider a highlighted passage ("fragment") inside of its story context, and then write a brief "scene description" (max 100 words) that prompts the text-to-image model to visually depict the content of the fragment. The scene description should focus specifically on what's mentioned in the fragment, using the provided context for interpretation. Respond with the scene description only, without preamble.

        Highlighted Passage: {self.passage}
        Context: {self.context}
        Scene Description:
        """

    @property
    def imggen_prompt(self) -> str:
        return f"""{self.imggen_base_prompt} {self.imggen_style_description}"""


# Storage for generated images (in production, use a proper database)
IMAGES_DIR = "generated_images"
os.makedirs(IMAGES_DIR, exist_ok=True)


@app.get("/")
async def root():
    return {"message": "Image Generation API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/envision", response_model=EnvisionResponse)
async def envision(envision_request: EnvisionRequest):
    try:
        llm_request = LLMRequest(prompt=envision_request.llm_prompt)
        imggen_base_prompt = generate_text(prompt=llm_request.prompt,
                                           api_key=llm_request.api_key,
                                           model=llm_request.model,
                                           model_params=llm_request.parameters)
        envision_request.imggen_base_prompt = imggen_base_prompt
    except Exception as e:
        logger.error(f"Error generating text: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate text: {str(e)}")

    try:
        # Generate a unique ID for the image
        image_id = str(uuid.uuid4())
        imggen_request = ImageGenerationRequest(
            prompt=envision_request.imggen_prompt)

        url = generate_image(prompt=imggen_request.prompt,
                             api_key=imggen_request.api_key,
                             model=imggen_request.model,
                             parameters=imggen_request.parameters)

        logger.info(f"Generated image URL: {url}")

        if not url:
            raise HTTPException(
                status_code=500, detail="No image URLs returned from generation")

        response = requests.get(url)
        if response.status_code != 200:
            raise HTTPException(
                status_code=500, detail="Failed to download generated image")

        image = Image.open(BytesIO(response.content))

        # Save the image
        image_path = os.path.join(IMAGES_DIR, f"{image_id}.png")
        image.save(image_path, "PNG")

        # Return the response
        logger.info(f"Image generated successfully: {image_id}")

        return EnvisionResponse(
            image_id=image_id,
            imggen_prompt=imggen_request.prompt,
            status="completed"
        )

    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate image: {str(e)}")


@app.get("/api/images/{image_id}")
async def get_image(image_id: str):
    """Serve generated images"""
    image_path = os.path.join(IMAGES_DIR, f"{image_id}.png")

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(image_path, media_type="image/png")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
