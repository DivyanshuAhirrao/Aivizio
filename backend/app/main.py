from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import openai
import redis
import os
import json
import time
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
import logging

# Configuring logging for debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Aivizio Backend API",
    description="API for Aivizio, a platform for AI-driven video analysis.",
    version="1.0.0",
)

# CORS middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize Redis client for rate limiting
redis_client = redis.from_url(
    os.getenv("UPSTASH_REDIS_URL"),
    password=os.getenv("UPSTASH_REDIS_TOKEN"),
    decode_responses=True
)

# Pydantic models for request/response validation
class ImageGenerationRequest(BaseModel):
    prompt: str
    size: Optional[str] = "1024x1024"
    quality: Optional[str] = "standard"

class ImageGenerationResponse(BaseModel):
    image_url: str
    prompt: str
    created_at: str
    remaining_requests: int

class RateLimitInfo(BaseModel):
    remaining_requests: int
    reset_time: str
    is_limited: bool

# Rate limiting function
async def check_rate_limit(client_ip:str) -> tuple[bool, int, datetime]:
   """
   check_rate_limit checks the number of requests made by a client IP have exceeded the limit.
   Returns (is_allowed, remaining_requests, reset_time).
   """
   try:
        #Create a unique key for the client IP
        key = f"rate_limit:{client_ip}"

        # Get the current count and timestamp of requests
        current_data = redis_client.get(key)

        if current_data :
            data = json.loads(current_data)
            request_count = data.get("count", 0)
            last_reset = datetime.fromisoformmat(data.get("last_reset"))

            #Check if we eed to reset in one hour
            if datetime.now() - last_reset > timedelta(hours=1):
                new_data ={
                    "count": 0,
                    "last_reset": datetime.now().isoformat()
                }
                redis_client.setex(key, 3600, json.dumps(new_data)) # Expires in one hour
                return True, 9, datetime.now() + timedelta(hours=1) # 10 Requests - 1 for the current request

            #Check if limit exceeded
            if request_count >= 10:
                reset_time = last_reset + timedelta(hours=1)
                return False, 0, reset_time

            return True, 10 - request_count-1, last_reset + timedelta(hours=1)
        
        else:
            # First request from this IP
            new_data = {
                "count": 0,
                "last_reset": datetime.now().isoformat()
            }

            redis_client.setex(key, 3600, json.dumps(new_data))
            return True, 9, datetime.now() + timedelta(hours=1)

   except Exception as e:
        logger.error(f"Rate limiting Error: {e}")
        #If Redis fails, allow the request but log the error
        return True, 9, datetime.now() + timedelta(hours=1)
    
async def increment_request_count(client_ip: str):
    """Increment the request count for a client IP"""
    try:
        key = f"rate_limit:{client_ip}"
        current_data = redis_client.get(key)
        
        if current_data:
            data = json.loads(current_data)
            data["count"] = data.get("count", 0) + 1
            redis_client.setex(key, 3600, json.dumps(data))
    except Exception as e:
        logger.error(f"Error incrementing request count: {e}")

# API Endpoints 

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Aivizio API is running !", "status":"healthy"}

@app.get("/api/rate-limit/{client_ip}")
async def get_rate_limit_info(client_ip:str)-> RateLimitInfo:
    """Get current rate limit status for a client IP"""
    is_allowed, remaining, reset_time = await check_rate_limit(client_ip)
    
    return RateLimitInfo(
        remaining_requests=remaining,
        reset_time= reset_time.isoformat(),
        is_limited= not is_allowed
    )

@app.post("/api/generate-image")
async def generate_image(
    request: ImageGenerationRequest,
    client_ip: str = "127.0.0.1"  # In production, get from request headers
) -> ImageGenerationResponse:
    """
    Generate an image using DALL-E API
    This is the main endpoint that handles image generation
    """
    
    # Check rate limiting first
    is_allowed, remaining, reset_time = await check_rate_limit(client_ip)
    
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "reset_time": reset_time.isoformat(),
                "remaining_requests": remaining
            }
        )
    
    try:
        # Validate prompt (basic security check)
        if len(request.prompt.strip()) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt must be at least 3 characters long"
            )
        
        if len(request.prompt) > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt must be less than 1000 characters"
            )
        
        # Generate image using OpenAI DALL-E
        logger.info(f"Generating image for prompt: {request.prompt[:50]}...")
        
        response = openai.images.generate(
            model="dall-e-3",  # Use DALL-E 3 for better quality
            prompt=request.prompt,
            size=request.size,
            quality=request.quality,
            n=1  # Number of images to generate
        )
        
        # Extract image URL from response
        image_url = response.data[0].url
        
        # Increment request count after successful generation
        await increment_request_count(client_ip)
        
        # Return response
        return ImageGenerationResponse(
            image_url=image_url,
            prompt=request.prompt,
            created_at=datetime.now().isoformat(),
            remaining_requests=remaining - 1
        )
        
    except openai.OpenAIError as e:
        logger.error(f"OpenAI API error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image generation failed: {str(e)}"
        )
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True  # Auto-reload during development
    )